import { readFile } from "node:fs/promises";

import {
  executePrivateRenderCommand,
  type PrivateRenderCommandEvent,
} from "../../../src/commands/private-render-command-service.js";
import type { PrivateRenderPlanSnapshot } from "../../../src/commands/private-render-plan-snapshot.js";
import type { PrivateRendererSourceMaterialization } from "../../../src/renderer/materialize-compilation.js";
import { PrivateFilesystemWorkspace } from "../../../src/workspace/private-filesystem-workspace.js";

interface WorkerFixture {
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly snapshot: PrivateRenderPlanSnapshot;
  readonly lockPath: string;
}

async function send(message: object): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (!process.send) {
      reject(new Error("Subprocess worker requires an IPC channel."));
      return;
    }
    process.send(message, (error) => (error ? reject(error) : resolve()));
  });
}

async function main(): Promise<void> {
  const [repositoryRoot, fixturePath, requestedBoundary] = process.argv.slice(2);
  if (!repositoryRoot || !fixturePath || !requestedBoundary) {
    throw new Error(
      "Expected repository root, fixture path, and boundary arguments.",
    );
  }
  const fixture = JSON.parse(
    await readFile(fixturePath, "utf8"),
  ) as WorkerFixture;
  const workspace =
    await PrivateFilesystemWorkspace.openForProcessTermination(repositoryRoot);
  let reached = false;
  await executePrivateRenderCommand({
    materialization: fixture.materialization,
    snapshot: fixture.snapshot,
    baseLock: null,
    lockPath: fixture.lockPath,
    workspace,
    async faultInjector(event: PrivateRenderCommandEvent) {
      if (!reached && event.kind === requestedBoundary) {
        reached = true;
        await send({ kind: "boundary", boundary: requestedBoundary });
        await new Promise<void>(() => {
          setInterval(() => undefined, 1_000);
        });
      }
    },
  });
  throw new Error(`Requested boundary was not reached: ${requestedBoundary}`);
}

try {
  await main();
} catch (error) {
  await send({
    kind: "error",
    message: error instanceof Error ? error.stack ?? error.message : String(error),
  }).catch(() => undefined);
  process.exitCode = 1;
}
