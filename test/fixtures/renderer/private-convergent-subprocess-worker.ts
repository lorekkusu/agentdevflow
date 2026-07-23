import { readFile } from "node:fs/promises";

import {
  applyPrivateConvergentRenderPlan,
  type PrivateConvergentApplyEvent,
} from "../../../src/renderer/private-convergent-apply.js";
import type { RenderPlan } from "../../../src/renderer/contract.js";
import { PrivateFilesystemWorkspace } from "../../../src/workspace/private-filesystem-workspace.js";

function eventKey(event: PrivateConvergentApplyEvent): string {
  return `${event.kind}:${event.path}`;
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
  const [repositoryRoot, planPath, requestedBoundary] = process.argv.slice(2);
  if (!repositoryRoot || !planPath || !requestedBoundary) {
    throw new Error("Expected repository root, plan path, and boundary arguments.");
  }
  const plan = JSON.parse(await readFile(planPath, "utf8")) as RenderPlan;
  const workspace =
    await PrivateFilesystemWorkspace.open(repositoryRoot);
  let reached = false;
  await applyPrivateConvergentRenderPlan(plan, workspace, async (event) => {
    if (!reached && eventKey(event) === requestedBoundary) {
      reached = true;
      await send({ kind: "boundary", boundary: requestedBoundary });
      await new Promise<void>(() => {
        setInterval(() => undefined, 1_000);
      });
    }
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
