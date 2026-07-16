import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import {
  createPrivateRenderLock,
  derivePrivateRenderLockIntent,
  type PrivateRenderLock,
} from "../../src/lock/private-render-lock.js";
import type { OwnershipClaim } from "../../src/renderer/contract.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { createPrivateRenderTransaction } from "../../src/transaction/private-render-transaction.js";
import { PrivateTransactionExecutor } from "../../src/transaction/private-transaction-executor.js";
import {
  parsePrivateTransactionStoreParentRecord,
  parsePrivateTransactionCleanupReceipt,
  PrivateTransactionStoreLifecycle,
  PrivateTransactionStoreLifecycleError,
  serializePrivateTransactionStoreParentRecord,
  type PrivateTransactionStoreLifecycleErrorCode,
  type PrivateTransactionStoreLifecycleEvent,
} from "../../src/transaction/private-transaction-store-lifecycle.js";
import {
  preparePrivateRenderRecovery,
  PrivateFilesystemTransactionStore,
  serializePrivateRenderLockRecord,
} from "../../src/transaction/private-transaction-store.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import {
  balancedCandidateConfig,
  fastThreeProviderCandidateConfig,
} from "../fixtures/config/specimens.js";

interface LifecycleFixture {
  readonly storeParent: string;
  readonly storeName: string;
  readonly storeRoot: string;
  readonly store: PrivateFilesystemTransactionStore;
  readonly executor: PrivateTransactionExecutor;
  readonly transactionDigest: string;
}

class InjectedCleanupFault extends Error {
  constructor(readonly event: PrivateTransactionStoreLifecycleEvent) {
    super(`Injected cleanup fault after ${event.kind}.`);
  }
}

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agentdevflow-lifecycle-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function compile(input: unknown): CandidateCompilation {
  const result = compileCandidateProjectConfig(input, initialCompilerOptions);
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
}

function ownershipFromLock(
  lock: PrivateRenderLock,
): Readonly<Record<string, OwnershipClaim>> {
  return Object.fromEntries(
    lock.files.map((file) => [
      file.path,
      { owner: file.owner, digest: file.contentDigest },
    ]),
  );
}

async function lifecycleFixture(t: TestContext): Promise<LifecycleFixture> {
  const container = await temporaryDirectory(t);
  const repoRoot = join(container, "repository");
  const storeParent = join(container, "stores");
  const storeName = "transaction-1";
  const storeRoot = join(storeParent, storeName);
  await mkdir(repoRoot);
  await mkdir(storeParent);
  await PrivateTransactionStoreLifecycle.initialize(storeParent);
  await mkdir(storeRoot);
  const workspace = await PrivateFilesystemWorkspace.open(repoRoot);
  const store = await PrivateFilesystemTransactionStore.open(storeRoot);
  const lockPath = "private/render-lock.json";

  const baseCompilation = compile(balancedCandidateConfig);
  const baseMaterialization = materializeCompilation(baseCompilation);
  const baseAdapter = new StagedRendererAdapter(
    new NativeProjectInstructionsRenderer(baseMaterialization),
  );
  const basePlan = await baseAdapter.plan(
    renderRequestFromMaterialization(baseCompilation, baseMaterialization),
    workspace,
  );
  const baseResult = await baseAdapter.render(basePlan, workspace);
  const baseLock = createPrivateRenderLock({
    materialization: baseMaterialization,
    plan: basePlan,
    result: baseResult,
    verification: await baseAdapter.verify(basePlan, workspace),
  });
  await workspace.writeAtomically(lockPath, serializePrivateRenderLockRecord(baseLock));

  const targetCompilation = compile(fastThreeProviderCandidateConfig);
  const targetMaterialization = materializeCompilation(targetCompilation);
  const targetAdapter = new StagedRendererAdapter(
    new NativeProjectInstructionsRenderer(targetMaterialization),
  );
  const targetPlan = await targetAdapter.plan(
    renderRequestFromMaterialization(targetCompilation, targetMaterialization, {
      ownership: ownershipFromLock(baseLock),
    }),
    workspace,
  );
  const targetLockIntent = derivePrivateRenderLockIntent({
    materialization: targetMaterialization,
    plan: targetPlan,
  });
  const transaction = createPrivateRenderTransaction({
    baseLock,
    materialization: targetMaterialization,
    targetLockIntent,
    plan: targetPlan,
  });
  const lease = await store.acquireWriter();
  try {
    await preparePrivateRenderRecovery({
      store,
      lease,
      transaction,
      baseLock,
      targetLockIntent,
      plan: targetPlan,
      workspace,
    });
  } finally {
    await store.releaseWriter(lease);
  }
  return {
    storeParent,
    storeName,
    storeRoot,
    store,
    executor: new PrivateTransactionExecutor({ store, workspace, lockPath }),
    transactionDigest: transaction.digest,
  };
}

function rejectsWithCode(
  operation: () => Promise<unknown>,
  code: PrivateTransactionStoreLifecycleErrorCode,
): Promise<void> {
  return assert.rejects(operation, (error: unknown) => {
    assert.equal(error instanceof PrivateTransactionStoreLifecycleError, true);
    assert.equal((error as PrivateTransactionStoreLifecycleError).code, code);
    return true;
  });
}

async function retire(fixture: LifecycleFixture): Promise<void> {
  await fixture.executor.execute();
  await fixture.executor.prepareRetirement();
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

test("tombstones, receipts, removes, and idempotently confirms a terminal store", async (t) => {
  const fixture = await lifecycleFixture(t);
  await retire(fixture);
  const orphanContent = "unreferenced preparation blob\n";
  await writeFile(
    join(fixture.storeRoot, "blobs", digest(orphanContent)),
    orphanContent,
  );
  await writeFile(
    join(fixture.storeRoot, ".journal.json.agentdevflow-999-1.tmp"),
    "partial record\n",
  );
  await writeFile(
    join(
      fixture.storeRoot,
      "blobs",
      `.${"a".repeat(64)}.agentdevflow-999-2.tmp`,
    ),
    "partial blob\n",
  );
  const lifecycle = await PrivateTransactionStoreLifecycle.open(fixture.storeParent);
  const result = await lifecycle.cleanup({
    storeName: fixture.storeName,
    expectedTransactionDigest: fixture.transactionDigest,
  });

  assert.equal(result.status, "cleaned");
  assert.equal(result.receipt.transactionDigest, fixture.transactionDigest);
  const entries = await readdir(fixture.storeParent);
  const receiptName =
    `.agentdevflow-retired-${fixture.storeName}-${fixture.transactionDigest}.json`;
  assert.deepEqual(entries.sort(), [
    ".agentdevflow-transaction-parent.json",
    receiptName,
  ].sort());
  assert.deepEqual(
    parsePrivateTransactionCleanupReceipt(
      await readFile(join(fixture.storeParent, receiptName), "utf8"),
    ),
    result.receipt,
  );
  assert.deepEqual(
    await lifecycle.cleanup({
      storeName: fixture.storeName,
      expectedTransactionDigest: fixture.transactionDigest,
    }),
    result,
  );
  const disposal = await lifecycle.prepareParentDisposal();
  assert.deepEqual(disposal.receipts, [
    {
      storeName: fixture.storeName,
      transactionDigest: fixture.transactionDigest,
      receiptDigest: result.receipt.digest,
    },
  ]);
  assert.match(disposal.digest, /^[a-f0-9]{64}$/u);
});

test("claims only an empty dedicated parent with a canonical owner record", async (t) => {
  const parent = await temporaryDirectory(t);
  const initialized = await PrivateTransactionStoreLifecycle.initialize(parent);
  const recordPath = join(parent, ".agentdevflow-transaction-parent.json");
  const recordContent = await readFile(recordPath, "utf8");
  const record = parsePrivateTransactionStoreParentRecord(recordContent);

  assert.equal(record.receiptRetention, "parent-lifetime");
  assert.equal(serializePrivateTransactionStoreParentRecord(record), recordContent);
  assert.deepEqual(
    await initialized.prepareParentDisposal(),
    await (await PrivateTransactionStoreLifecycle.open(parent)).prepareParentDisposal(),
  );
  await rejectsWithCode(
    () => PrivateTransactionStoreLifecycle.initialize(parent),
    "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
  );

  const unclaimed = await temporaryDirectory(t);
  await rejectsWithCode(
    () => PrivateTransactionStoreLifecycle.open(unclaimed),
    "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_UNCLAIMED",
  );

  const nonEmpty = await temporaryDirectory(t);
  await writeFile(join(nonEmpty, "foreign"), "foreign\n", "utf8");
  await rejectsWithCode(
    () => PrivateTransactionStoreLifecycle.initialize(nonEmpty),
    "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
  );

  await writeFile(recordPath, "{}\n", "utf8");
  await rejectsWithCode(
    () =>
      initialized.cleanup({
        storeName: "missing",
        expectedTransactionDigest: "a".repeat(64),
      }),
    "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
  );
  await rejectsWithCode(
    () => PrivateTransactionStoreLifecycle.open(parent),
    "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
  );
});

test("permits a disposal snapshot only after stores and tombstones are gone", async (t) => {
  const fixture = await lifecycleFixture(t);
  const lifecycle = await PrivateTransactionStoreLifecycle.open(fixture.storeParent);
  await rejectsWithCode(
    () => lifecycle.prepareParentDisposal(),
    "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_NOT_DISPOSABLE",
  );

  await retire(fixture);
  await assert.rejects(
    () =>
      lifecycle.cleanup({
        storeName: fixture.storeName,
        expectedTransactionDigest: fixture.transactionDigest,
        faultInjector: (event) => {
          if (event.kind === "store-tombstoned") {
            throw new InjectedCleanupFault(event);
          }
        },
      }),
    InjectedCleanupFault,
  );
  await rejectsWithCode(
    () => lifecycle.prepareParentDisposal(),
    "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_NOT_DISPOSABLE",
  );
});

test("refuses disposal with foreign parent content", async (t) => {
  const parent = await temporaryDirectory(t);
  const lifecycle = await PrivateTransactionStoreLifecycle.initialize(parent);
  await writeFile(join(parent, "foreign"), "foreign\n", "utf8");
  await rejectsWithCode(
    () => lifecycle.prepareParentDisposal(),
    "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_NOT_DISPOSABLE",
  );
});

test("resumes idempotently after every cleanup lifecycle boundary", async (t) => {
  const boundaries = [
    "store-tombstoned",
    "receipt-written",
    "tombstone-removed",
  ] as const;
  for (const boundary of boundaries) {
    await t.test(boundary, async (subtest) => {
      const fixture = await lifecycleFixture(subtest);
      await retire(fixture);
      const lifecycle = await PrivateTransactionStoreLifecycle.open(
        fixture.storeParent,
      );
      let injected = false;
      await assert.rejects(
        () =>
          lifecycle.cleanup({
            storeName: fixture.storeName,
            expectedTransactionDigest: fixture.transactionDigest,
            faultInjector: (event) => {
              if (!injected && event.kind === boundary) {
                injected = true;
                throw new InjectedCleanupFault(event);
              }
            },
          }),
        InjectedCleanupFault,
      );
      assert.equal(injected, true);
      const recovered = await lifecycle.cleanup({
        storeName: fixture.storeName,
        expectedTransactionDigest: fixture.transactionDigest,
      });
      assert.equal(recovered.status, "cleaned");
      assert.equal(recovered.receipt.transactionDigest, fixture.transactionDigest);
    });
  }
});

test("resumes a partially removed tombstone only from receipt-authorized bytes", async (t) => {
  const fixture = await lifecycleFixture(t);
  await retire(fixture);
  const lifecycle = await PrivateTransactionStoreLifecycle.open(fixture.storeParent);
  await assert.rejects(
    () =>
      lifecycle.cleanup({
        storeName: fixture.storeName,
        expectedTransactionDigest: fixture.transactionDigest,
        faultInjector: (event) => {
          if (event.kind === "receipt-written") {
            throw new InjectedCleanupFault(event);
          }
        },
      }),
    InjectedCleanupFault,
  );
  const tombstone = join(
    fixture.storeParent,
    `.agentdevflow-retired-${fixture.storeName}-${fixture.transactionDigest}`,
  );
  await unlink(join(tombstone, "journal.json"));
  const blobNames = await readdir(join(tombstone, "blobs"));
  await unlink(join(tombstone, "blobs", blobNames[0] ?? "missing"));

  const recovered = await lifecycle.cleanup({
    storeName: fixture.storeName,
    expectedTransactionDigest: fixture.transactionDigest,
  });
  assert.equal(recovered.status, "cleaned");

  const changedFixture = await lifecycleFixture(t);
  await retire(changedFixture);
  const changedLifecycle = await PrivateTransactionStoreLifecycle.open(
    changedFixture.storeParent,
  );
  await assert.rejects(
    () =>
      changedLifecycle.cleanup({
        storeName: changedFixture.storeName,
        expectedTransactionDigest: changedFixture.transactionDigest,
        faultInjector: (event) => {
          if (event.kind === "receipt-written") {
            throw new InjectedCleanupFault(event);
          }
        },
      }),
    InjectedCleanupFault,
  );
  const changedTombstone = join(
    changedFixture.storeParent,
    `.agentdevflow-retired-${changedFixture.storeName}-${changedFixture.transactionDigest}`,
  );
  await writeFile(join(changedTombstone, "journal.json"), "replaced bytes\n");
  await rejectsWithCode(
    () =>
      changedLifecycle.cleanup({
        storeName: changedFixture.storeName,
        expectedTransactionDigest: changedFixture.transactionDigest,
      }),
    "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
  );
});

test("refuses a writer record or unknown store content before deletion", async (t) => {
  const writerFixture = await lifecycleFixture(t);
  await retire(writerFixture);
  await writeFile(join(writerFixture.storeRoot, "writer.lock"), `${"a".repeat(64)}\n`);
  const writerLifecycle = await PrivateTransactionStoreLifecycle.open(
    writerFixture.storeParent,
  );
  await rejectsWithCode(
    () =>
      writerLifecycle.cleanup({
        storeName: writerFixture.storeName,
        expectedTransactionDigest: writerFixture.transactionDigest,
      }),
    "PRIVATE_TRANSACTION_LIFECYCLE_WRITER_BUSY",
  );

  const unknownFixture = await lifecycleFixture(t);
  await retire(unknownFixture);
  await writeFile(join(unknownFixture.storeRoot, "foreign.txt"), "foreign\n");
  const unknownLifecycle = await PrivateTransactionStoreLifecycle.open(
    unknownFixture.storeParent,
  );
  await rejectsWithCode(
    () =>
      unknownLifecycle.cleanup({
        storeName: unknownFixture.storeName,
        expectedTransactionDigest: unknownFixture.transactionDigest,
      }),
    "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
  );

  const corruptFixture = await lifecycleFixture(t);
  await retire(corruptFixture);
  await writeFile(
    join(corruptFixture.storeRoot, "blobs", "0".repeat(64)),
    "wrong digest\n",
  );
  const corruptLifecycle = await PrivateTransactionStoreLifecycle.open(
    corruptFixture.storeParent,
  );
  await rejectsWithCode(
    () =>
      corruptLifecycle.cleanup({
        storeName: corruptFixture.storeName,
        expectedTransactionDigest: corruptFixture.transactionDigest,
      }),
    "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
  );
});

test("rejects unsafe names and unmatched missing stores", async (t) => {
  const parent = await temporaryDirectory(t);
  const lifecycle = await PrivateTransactionStoreLifecycle.initialize(parent);
  await rejectsWithCode(
    () =>
      lifecycle.cleanup({
        storeName: "../outside",
        expectedTransactionDigest: "a".repeat(64),
      }),
    "PRIVATE_TRANSACTION_LIFECYCLE_UNSAFE_PATH",
  );
  await rejectsWithCode(
    () =>
      lifecycle.cleanup({
        storeName: "missing",
        expectedTransactionDigest: "a".repeat(64),
      }),
    "PRIVATE_TRANSACTION_LIFECYCLE_CONFLICT",
  );
});

test(
  "refuses symbolic links without changing their target",
  async (t) => {
    const fixture = await lifecycleFixture(t);
    await retire(fixture);
    const target = join(fixture.storeParent, "outside.txt");
    await writeFile(target, "outside\n");
    await symlink(target, join(fixture.storeRoot, "linked-entry"));
    const lifecycle = await PrivateTransactionStoreLifecycle.open(
      fixture.storeParent,
    );
    await rejectsWithCode(
      () =>
        lifecycle.cleanup({
          storeName: fixture.storeName,
          expectedTransactionDigest: fixture.transactionDigest,
        }),
      "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
    );
    assert.equal(await readFile(target, "utf8"), "outside\n");
  },
);
