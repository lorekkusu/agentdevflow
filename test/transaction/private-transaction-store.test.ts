import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
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
import type { OwnershipClaim, RenderPlan } from "../../src/renderer/contract.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import {
  advancePrivateRenderTransactionJournal,
  createPrivateRenderTransaction,
  type PrivateRenderTransaction,
} from "../../src/transaction/private-render-transaction.js";
import {
  preparePrivateRenderRecovery,
  PrivateFilesystemTransactionStore,
  PrivateTransactionStoreError,
  validatePrivateRenderRecoveryManifest,
  type PrivateRenderRecoveryManifest,
  type PrivateTransactionStoreErrorCode,
} from "../../src/transaction/private-transaction-store.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import {
  balancedCandidateConfig,
  fastThreeProviderCandidateConfig,
} from "../fixtures/config/specimens.js";

interface StoreFixture {
  readonly repoRoot: string;
  readonly storeRoot: string;
  readonly workspace: PrivateFilesystemWorkspace;
  readonly store: PrivateFilesystemTransactionStore;
  readonly baseLock: PrivateRenderLock;
  readonly targetLockIntent: PrivateRenderLock;
  readonly targetPlan: RenderPlan;
  readonly transaction: PrivateRenderTransaction;
}

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agentdevflow-store-"));
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

async function storeFixture(t: TestContext): Promise<StoreFixture> {
  const container = await temporaryDirectory(t);
  const repoRoot = join(container, "repository");
  const storeRoot = join(container, "transaction-store");
  await mkdir(repoRoot);
  await mkdir(storeRoot);
  const workspace = await PrivateFilesystemWorkspace.open(repoRoot);
  const store = await PrivateFilesystemTransactionStore.open(storeRoot);

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
  return {
    repoRoot,
    storeRoot,
    workspace,
    store,
    baseLock,
    targetLockIntent,
    targetPlan,
    transaction,
  };
}

function rejectsWithCode(
  operation: () => Promise<unknown>,
  code: PrivateTransactionStoreErrorCode,
): Promise<void> {
  return assert.rejects(operation, (error: unknown) => {
    assert.equal(error instanceof PrivateTransactionStoreError, true);
    assert.equal((error as PrivateTransactionStoreError).code, code);
    return true;
  });
}

async function prepareFixture(
  fixture: StoreFixture,
): Promise<PrivateRenderRecoveryManifest> {
  const lease = await fixture.store.acquireWriter();
  try {
    return await preparePrivateRenderRecovery({
      store: fixture.store,
      lease,
      transaction: fixture.transaction,
      baseLock: fixture.baseLock,
      targetLockIntent: fixture.targetLockIntent,
      plan: fixture.targetPlan,
      workspace: fixture.workspace,
    });
  } finally {
    await fixture.store.releaseWriter(lease);
  }
}

test("persists every recovery blob before the prepared journal", async (t) => {
  const fixture = await storeFixture(t);
  const manifest = await prepareFixture(fixture);
  validatePrivateRenderRecoveryManifest(manifest);

  assert.equal(
    manifest.digest,
    "8bc7fced54e1552ce29632f3c3d5a0c6ac05fafc80f9b75ddff97ab173de0d3b",
  );
  assert.equal(manifest.transactionDigest, fixture.transaction.digest);
  assert.equal(manifest.baseLock?.lockDigest, fixture.baseLock.digest);
  assert.equal(manifest.targetLock.lockDigest, fixture.targetLockIntent.digest);
  assert.deepEqual(
    manifest.requiredBlobs,
    [...manifest.requiredBlobs].sort(),
  );
  assert.equal(new Set(manifest.requiredBlobs).size, manifest.requiredBlobs.length);

  const verified = await fixture.store.verifyPrepared();
  assert.deepEqual(verified.transaction, fixture.transaction);
  assert.deepEqual(verified.manifest, manifest);
  assert.equal(verified.journal.state, "prepared");
  assert.deepEqual(verified.baseLock, fixture.baseLock);
  assert.deepEqual(verified.targetLock, fixture.targetLockIntent);
  for (const blobDigest of manifest.requiredBlobs) {
    assert.equal(
      await readFile(join(fixture.storeRoot, "blobs", blobDigest), "utf8"),
      await fixture.store.readBlob(blobDigest),
    );
  }
  assert.equal(
    (await readdir(fixture.storeRoot)).includes("writer.lock"),
    false,
  );
});

test("does not publish a prepared journal after a changed path precondition", async (t) => {
  const fixture = await storeFixture(t);
  await fixture.workspace.writeAtomically("AGENTS.md", "changed after plan\n");
  const lease = await fixture.store.acquireWriter();
  try {
    await rejectsWithCode(
      () =>
        preparePrivateRenderRecovery({
          store: fixture.store,
          lease,
          transaction: fixture.transaction,
          baseLock: fixture.baseLock,
          targetLockIntent: fixture.targetLockIntent,
          plan: fixture.targetPlan,
          workspace: fixture.workspace,
        }),
      "PRIVATE_TRANSACTION_PRECONDITION_MISMATCH",
    );
    assert.equal(await fixture.store.readTransaction(), null);
    assert.equal(await fixture.store.readManifest(), null);
    assert.equal(await fixture.store.readJournal(), null);
    assert.ok((await readdir(join(fixture.storeRoot, "blobs"))).length > 0);
  } finally {
    await fixture.store.releaseWriter(lease);
  }
});

test("excludes concurrent writers and rejects a released lease", async (t) => {
  const fixture = await storeFixture(t);
  const secondStore = await PrivateFilesystemTransactionStore.open(
    fixture.storeRoot,
  );
  const firstLease = await fixture.store.acquireWriter();
  await rejectsWithCode(
    () => secondStore.acquireWriter(),
    "PRIVATE_TRANSACTION_WRITER_BUSY",
  );
  await fixture.store.releaseWriter(firstLease);
  await rejectsWithCode(
    () => fixture.store.putBlob(firstLease, "content\n"),
    "PRIVATE_TRANSACTION_WRITER_LEASE_LOST",
  );

  const secondLease = await secondStore.acquireWriter();
  await secondStore.releaseWriter(secondLease);
});

test("detects corrupt and missing content-addressed recovery blobs", async (t) => {
  const fixture = await storeFixture(t);
  const manifest = await prepareFixture(fixture);
  const blobDigest = manifest.requiredBlobs[0];
  assert.ok(blobDigest);
  const path = join(fixture.storeRoot, "blobs", blobDigest);
  const original = await readFile(path, "utf8");

  await writeFile(path, "corrupt\n", "utf8");
  await rejectsWithCode(
    () => fixture.store.verifyPrepared(),
    "PRIVATE_TRANSACTION_BLOB_CORRUPT",
  );
  await writeFile(path, original, "utf8");
  await rm(path);
  await rejectsWithCode(
    () => fixture.store.verifyPrepared(),
    "PRIVATE_TRANSACTION_BLOB_MISSING",
  );

  const lease = await fixture.store.acquireWriter();
  try {
    const prepared = await fixture.store.readJournal();
    assert.ok(prepared);
    const applying = advancePrivateRenderTransactionJournal(
      prepared,
      "outputs-applying",
    );
    await rejectsWithCode(
      () => fixture.store.writeJournal(lease, applying),
      "PRIVATE_TRANSACTION_BLOB_MISSING",
    );
    assert.equal((await fixture.store.readJournal())?.state, "prepared");
  } finally {
    await fixture.store.releaseWriter(lease);
  }
});

test("persists only strict forward journal transitions", async (t) => {
  const fixture = await storeFixture(t);
  const manifest = await prepareFixture(fixture);
  assert.doesNotThrow(() => validatePrivateRenderRecoveryManifest(manifest));
  assert.throws(
    () =>
      validatePrivateRenderRecoveryManifest({
        ...manifest,
        requiredBlobs: [...manifest.requiredBlobs].reverse(),
      }),
    /not unique and sorted/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderRecoveryManifest({
        ...manifest,
        digest: "0".repeat(64),
      }),
    /digest does not match/u,
  );

  const lease = await fixture.store.acquireWriter();
  try {
    const prepared = await fixture.store.readJournal();
    assert.ok(prepared);
    const applying = advancePrivateRenderTransactionJournal(
      prepared,
      "outputs-applying",
    );
    await fixture.store.writeJournal(lease, applying);
    const lockWritten = advancePrivateRenderTransactionJournal(
      applying,
      "lock-written",
    );
    const committed = advancePrivateRenderTransactionJournal(
      lockWritten,
      "committed",
    );
    await rejectsWithCode(
      () => fixture.store.writeJournal(lease, committed),
      "PRIVATE_TRANSACTION_STORE_CONFLICT",
    );
    await fixture.store.writeJournal(lease, lockWritten);
    await fixture.store.writeJournal(lease, committed);
    assert.equal((await fixture.store.verifyPrepared()).journal.state, "committed");
  } finally {
    await fixture.store.releaseWriter(lease);
  }
});

test("rejects non-canonical stored records", async (t) => {
  const fixture = await storeFixture(t);
  await prepareFixture(fixture);
  const path = join(fixture.storeRoot, "transaction.json");
  const canonical = await readFile(path, "utf8");
  await writeFile(path, `${canonical} `, "utf8");

  await rejectsWithCode(
    () => fixture.store.readTransaction(),
    "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
  );
});
