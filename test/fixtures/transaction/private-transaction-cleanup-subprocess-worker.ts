import {
  PrivateTransactionStoreLifecycle,
  type PrivateTransactionStoreLifecycleEvent,
} from "../../../src/transaction/private-transaction-store-lifecycle.js";

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

async function suspendAtBoundary(
  event: PrivateTransactionStoreLifecycleEvent,
  requestedBoundary: string,
): Promise<void> {
  if (event.kind !== requestedBoundary) {
    return;
  }
  await send({ kind: "boundary", boundary: requestedBoundary });
  await new Promise<void>(() => {
    setInterval(() => undefined, 1_000);
  });
}

async function main(): Promise<void> {
  const [parentRoot, storeName, transactionDigest, requestedBoundary] =
    process.argv.slice(2);
  if (!parentRoot || !storeName || !transactionDigest || !requestedBoundary) {
    throw new Error(
      "Expected store parent, store name, transaction digest, and boundary arguments.",
    );
  }
  const lifecycle = await PrivateTransactionStoreLifecycle.open(parentRoot);
  await lifecycle.cleanup({
    storeName,
    expectedTransactionDigest: transactionDigest,
    faultInjector: (event) => suspendAtBoundary(event, requestedBoundary),
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
