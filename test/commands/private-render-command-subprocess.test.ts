import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

import { executePrivateRenderCommand } from "../../src/commands/private-render-command-service.js";
import { createPrivateRenderPlanSnapshot } from "../../src/commands/private-render-plan-snapshot.js";
import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import { serializePrivateRenderLock } from "../../src/lock/private-render-lock.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import { balancedCandidateConfig } from "../fixtures/config/specimens.js";

const workerPath = fileURLToPath(
  new URL(
    "../fixtures/commands/private-render-command-subprocess-worker.js",
    import.meta.url,
  ),
);
const lockPath = ".private-fixture/render-lock.json";

async function fixture(t: TestContext) {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-command-child-"));
  t.after(async () => {
    await rm(container, { recursive: true, force: true });
  });
  const repository = join(container, "repository");
  const fixturePath = join(container, "fixture.json");
  await mkdir(repository);
  const result = compileCandidateProjectConfig(
    balancedCandidateConfig,
    initialCompilerOptions,
  );
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  const materialization = materializeCompilation(result.compilation);
  const renderer = new NativeProjectInstructionsRenderer(materialization);
  const adapter = new StagedRendererAdapter(renderer);
  const workspace =
    await PrivateFilesystemWorkspace.openForProcessTermination(repository);
  const plan = await adapter.plan(
    renderRequestFromMaterialization(result.compilation, materialization),
    workspace,
  );
  const snapshot = createPrivateRenderPlanSnapshot(plan);
  await writeFile(
    fixturePath,
    `${JSON.stringify({ materialization, snapshot, lockPath })}\n`,
    "utf8",
  );
  return { repository, fixturePath, materialization, snapshot };
}

function waitForBoundary(child: ChildProcess, boundary: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${boundary}.`)),
      10_000,
    );
    const finish = (operation: () => void): void => {
      clearTimeout(timer);
      child.removeAllListeners("message");
      child.removeAllListeners("exit");
      operation();
    };
    child.on("message", (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "kind" in message &&
        message.kind === "boundary" &&
        "boundary" in message &&
        message.boundary === boundary
      ) {
        finish(resolve);
      } else if (
        typeof message === "object" &&
        message !== null &&
        "kind" in message &&
        message.kind === "error"
      ) {
        finish(() =>
          reject(
            new Error(String("message" in message ? message.message : message)),
          ),
        );
      }
    });
    child.once("exit", (code, signal) => {
      finish(() =>
        reject(
          new Error(
            `Worker exited before ${boundary}: code=${String(code)} signal=${String(signal)}.`,
          ),
        ),
      );
    });
  });
}

async function waitForExit(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
}

test("resumes command publication after real process termination", async (t) => {
  for (const boundary of ["render-applied", "lock-target-replaced"] as const) {
    await t.test(boundary, async (boundaryTest) => {
      const current = await fixture(boundaryTest);
      const child = fork(
        workerPath,
        [current.repository, current.fixturePath, boundary],
        { stdio: ["ignore", "ignore", "ignore", "ipc"] },
      );
      await waitForBoundary(child, boundary);
      const signal = process.platform === "win32" ? "SIGTERM" : "SIGKILL";
      assert.equal(child.kill(signal), true);
      await waitForExit(child);

      const workspace =
        await PrivateFilesystemWorkspace.openForProcessTermination(
          current.repository,
        );
      const resumed = await executePrivateRenderCommand({
        materialization: current.materialization,
        snapshot: current.snapshot,
        baseLock: null,
        lockPath,
        workspace,
      });
      assert.equal(resumed.verification.ok, true);
      assert.equal(
        await workspace.read(lockPath),
        serializePrivateRenderLock(resumed.lock),
      );
    });
  }
});
