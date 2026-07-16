import {
  PrivateTransactionExecutor,
  type PrivateTransactionExecutionEvent,
} from "../../../src/transaction/private-transaction-executor.js";
import { PrivateFilesystemTransactionStore } from "../../../src/transaction/private-transaction-store.js";
import { PrivateFilesystemWorkspace } from "../../../src/workspace/private-filesystem-workspace.js";

function eventKey(event: PrivateTransactionExecutionEvent): string {
  if (event.kind === "journal-written") {
    return `${event.kind}:${event.state}`;
  }
  if (event.kind === "path-written") {
    return `${event.kind}:${event.direction}:${event.path}`;
  }
  if (event.kind === "state-verified") {
    return `${event.kind}:${event.state}`;
  }
  if (
    event.kind === "temporary-created" ||
    event.kind === "temporary-synced" ||
    event.kind === "temporary-reclaimed"
  ) {
    return `${event.kind}:${event.path}`;
  }
  return event.kind;
}

async function send(message: object): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (!process.send) {
      reject(new Error("Subprocess worker requires an IPC channel."));
      return;
    }
    process.send(message, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function main(): Promise<void> {
  const [repositoryRoot, storeRoot, lockPath, requestedBoundary, operation = "execute"] =
    process.argv.slice(2);
  if (!repositoryRoot || !storeRoot || !lockPath || !requestedBoundary) {
    throw new Error(
      "Expected repository root, store root, lock path, and boundary arguments.",
    );
  }
  const workspace = await PrivateFilesystemWorkspace.open(repositoryRoot);
  const store = await PrivateFilesystemTransactionStore.open(storeRoot);
  let reached = false;
  const executor = new PrivateTransactionExecutor({
    store,
    workspace,
    lockPath,
    faultInjector: async (event) => {
      if (!reached && eventKey(event) === requestedBoundary) {
        reached = true;
        await send({ kind: "boundary", boundary: requestedBoundary });
        await new Promise<void>(() => {
          setInterval(() => undefined, 1_000);
        });
      }
    },
  });
  if (operation === "execute") {
    await executor.execute();
  } else if (operation === "recover") {
    await executor.recover();
  } else if (operation === "retire") {
    await executor.prepareRetirement();
  } else {
    throw new Error(`Unsupported subprocess worker operation: ${operation}`);
  }
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
