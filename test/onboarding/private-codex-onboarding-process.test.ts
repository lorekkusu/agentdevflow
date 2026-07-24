import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import type { ChildProcess } from "node:child_process";

import {
  runPrivateCodexOnboardingProcess,
  type PrivateCodexSpawn,
} from "../../src/onboarding/private-codex-onboarding-process.js";

function fakeChild(): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  Object.assign(child, {
    exitCode: null,
    signalCode: null,
    stdin: new PassThrough(),
    kill: () => true,
  });
  return child;
}

test("launches one interactive Codex process with inherited terminal I/O", async () => {
  const child = fakeChild();
  let observed:
    | {
        readonly executable: string;
        readonly args: readonly string[];
        readonly stdio: unknown;
      }
    | undefined;
  const spawnProcess: PrivateCodexSpawn = (executable, args, options) => {
    observed = { executable, args, stdio: options.stdio };
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  };

  const result = await runPrivateCodexOnboardingProcess(
    {
      acceptWithoutConfirmation: false,
      prompt: "reviewed prompt",
      repositoryPath: "/project",
    },
    spawnProcess,
    1_000,
  );

  assert.deepEqual(result, { outcome: "completed" });
  assert.deepEqual(observed, {
    executable: "codex",
    args: ["reviewed prompt"],
    stdio: "inherit",
  });
});

test("launches --yes through one non-interactive Codex process and stdin", async () => {
  const child = fakeChild();
  let stdin = "";
  child.stdin?.on("data", (chunk: Buffer) => {
    stdin += chunk.toString("utf8");
  });
  const spawnProcess: PrivateCodexSpawn = (_executable, args, options) => {
    assert.deepEqual(args, ["exec", "-"]);
    assert.deepEqual(options.stdio, ["pipe", "inherit", "inherit"]);
    queueMicrotask(() => child.emit("close", 0, null));
    return child;
  };

  const result = await runPrivateCodexOnboardingProcess(
    {
      acceptWithoutConfirmation: true,
      prompt: "approved prompt",
      repositoryPath: "/project",
    },
    spawnProcess,
    1_000,
  );

  assert.deepEqual(result, { outcome: "completed" });
  assert.equal(stdin, "approved prompt");
});

test("returns bounded missing, non-zero, and timeout diagnostics", async () => {
  const missing = fakeChild();
  const missingResult = runPrivateCodexOnboardingProcess(
    {
      acceptWithoutConfirmation: false,
      prompt: "prompt",
      repositoryPath: "/project",
    },
    () => {
      queueMicrotask(() => {
        const error = Object.assign(new Error("missing"), { code: "ENOENT" });
        missing.emit("error", error);
      });
      return missing;
    },
    1_000,
  );
  const missingOutcome = await missingResult;
  assert.equal(missingOutcome.outcome, "blocked");
  if (missingOutcome.outcome !== "blocked") assert.fail("expected blocked");
  assert.equal(missingOutcome.code, "CLI_ONBOARD_CODEX_NOT_FOUND");

  const failed = fakeChild();
  const failedResult = runPrivateCodexOnboardingProcess(
    {
      acceptWithoutConfirmation: false,
      prompt: "prompt",
      repositoryPath: "/project",
    },
    () => {
      queueMicrotask(() => failed.emit("close", 7, null));
      return failed;
    },
    1_000,
  );
  assert.deepEqual(await failedResult, {
    outcome: "blocked",
    code: "CLI_ONBOARD_CODEX_FAILED",
    message: "Codex CLI exited with status 7.",
  });

  const timedOut = fakeChild();
  Object.assign(timedOut, {
    kill: () => {
      queueMicrotask(() => timedOut.emit("close", null, "SIGTERM"));
      return true;
    },
  });
  const timeoutResult = await runPrivateCodexOnboardingProcess(
    {
      acceptWithoutConfirmation: false,
      prompt: "prompt",
      repositoryPath: "/project",
    },
    () => timedOut,
    1,
  );
  assert.equal(timeoutResult.outcome, "blocked");
  assert.equal(timeoutResult.code, "CLI_ONBOARD_CODEX_TIMEOUT");
});

test("forwards cancellation and force-stops a child that ignores timeout", async () => {
  const cancelled = fakeChild();
  const cancellationSignals: NodeJS.Signals[] = [];
  Object.assign(cancelled, {
    kill: (signal: NodeJS.Signals) => {
      cancellationSignals.push(signal);
      queueMicrotask(() => cancelled.emit("close", null, signal));
      return true;
    },
  });
  const cancellationResult = runPrivateCodexOnboardingProcess(
    {
      acceptWithoutConfirmation: false,
      prompt: "prompt",
      repositoryPath: "/project",
    },
    () => cancelled,
    1_000,
  );
  process.emit("SIGINT", "SIGINT");
  assert.deepEqual(await cancellationResult, {
    outcome: "blocked",
    code: "CLI_ONBOARD_CODEX_CANCELLED",
    message: "Codex onboarding was cancelled.",
  });
  assert.deepEqual(cancellationSignals, ["SIGINT"]);

  const unresponsive = fakeChild();
  const timeoutSignals: NodeJS.Signals[] = [];
  Object.assign(unresponsive, {
    kill: (signal: NodeJS.Signals) => {
      timeoutSignals.push(signal);
      if (signal === "SIGKILL") {
        queueMicrotask(() => unresponsive.emit("close", null, signal));
      }
      return true;
    },
  });
  const timeoutResult = await runPrivateCodexOnboardingProcess(
    {
      acceptWithoutConfirmation: false,
      prompt: "prompt",
      repositoryPath: "/project",
    },
    () => unresponsive,
    1,
    1,
  );
  assert.equal(timeoutResult.outcome, "blocked");
  assert.equal(timeoutResult.code, "CLI_ONBOARD_CODEX_TIMEOUT");
  assert.deepEqual(timeoutSignals, ["SIGTERM", "SIGKILL"]);
});
