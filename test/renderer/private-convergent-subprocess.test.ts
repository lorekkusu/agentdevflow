import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyPrivateConvergentRenderPlan,
  type PrivateConvergentApplyEvent,
} from "../../src/renderer/private-convergent-apply.js";
import type { RenderPlan } from "../../src/renderer/contract.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { createPrivateDomainProjectFixture } from "../fixtures/project/private-domain-project.js";

const workerPath = fileURLToPath(
  new URL("../fixtures/renderer/private-convergent-subprocess-worker.js", import.meta.url),
);

async function fixture(t: TestContext): Promise<{
  readonly repository: string;
  readonly planPath: string;
  readonly plan: RenderPlan;
}> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-convergent-child-"));
  t.after(async () => {
    await rm(container, { recursive: true, force: true });
  });
  const repository = join(container, "repository");
  const planPath = join(container, "plan.json");
  await mkdir(repository);
  const { materialization, request } = createPrivateDomainProjectFixture();
  const renderer = new NativeProjectInstructionsRenderer(materialization);
  const adapter = new StagedRendererAdapter(renderer);
  const workspace =
    await PrivateFilesystemWorkspace.open(repository);
  const plan = await adapter.plan(request, workspace);
  await writeFile(planPath, `${JSON.stringify(plan)}\n`, "utf8");
  return { repository, planPath, plan };
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
        finish(() => reject(new Error(String("message" in message ? message.message : message))));
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

function boundaryKey(
  kind: PrivateConvergentApplyEvent["kind"],
  path: string,
): string {
  return `${kind}:${path}`;
}

test("converges after real process termination at every write boundary", async (t) => {
  const paths = [".cursor/rules/agentdevflow.mdc", "AGENTS.md", "CLAUDE.md"];
  const kinds: readonly PrivateConvergentApplyEvent["kind"][] = [
    "temporary-ready",
    "temporary-synced",
    "target-replaced",
    "path-applied",
  ];

  for (const path of paths) {
    for (const kind of kinds) {
      const boundary = boundaryKey(kind, path);
      await t.test(boundary, async (boundaryTest) => {
        const current = await fixture(boundaryTest);
        const child = fork(
          workerPath,
          [current.repository, current.planPath, boundary],
          { stdio: ["ignore", "ignore", "ignore", "ipc"] },
        );
        await waitForBoundary(child, boundary);
        const signal = process.platform === "win32" ? "SIGTERM" : "SIGKILL";
        assert.equal(child.kill(signal), true);
        await waitForExit(child);

        const workspace =
          await PrivateFilesystemWorkspace.open(
            current.repository,
          );
        await applyPrivateConvergentRenderPlan(current.plan, workspace);
        for (const file of current.plan.files) {
          assert.equal(await workspace.read(file.path), file.expectedContent);
        }
      });
    }
  }
});
