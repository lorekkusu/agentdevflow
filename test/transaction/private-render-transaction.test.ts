import assert from "node:assert/strict";
import test from "node:test";

import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import {
  createPrivateRenderLock,
  derivePrivateRenderLockIntent,
  type PrivateRenderLock,
} from "../../src/lock/private-render-lock.js";
import type {
  OwnershipClaim,
  RenderPlan,
  RenderWorkspace,
} from "../../src/renderer/contract.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import {
  advancePrivateRenderTransactionJournal,
  createPrivateRenderTransaction,
  createPrivateRenderTransactionJournal,
  decidePrivateRenderTransactionRecovery,
  validatePrivateRenderTransaction,
  validatePrivateRenderTransactionJournal,
  type ObservedPrivateRenderTransactionState,
  type PrivateRenderTransaction,
  type PrivateRenderTransactionJournal,
} from "../../src/transaction/private-render-transaction.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import {
  balancedCandidateConfig,
  fastThreeProviderCandidateConfig,
} from "../fixtures/config/specimens.js";

class MemoryWorkspace implements RenderWorkspace {
  readonly files = new Map<string, string>();

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async writeAtomically(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async removeAtomically(path: string): Promise<void> {
    this.files.delete(path);
  }
}

interface TransactionFixture {
  readonly baseLock: PrivateRenderLock;
  readonly targetMaterialization: ReturnType<typeof materializeCompilation>;
  readonly targetLockIntent: PrivateRenderLock;
  readonly targetPlan: RenderPlan;
  readonly transaction: PrivateRenderTransaction;
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

async function transactionFixture(): Promise<TransactionFixture> {
  const workspace = new MemoryWorkspace();
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
  const baseVerification = await baseAdapter.verify(basePlan, workspace);
  const baseLock = createPrivateRenderLock({
    materialization: baseMaterialization,
    plan: basePlan,
    result: baseResult,
    verification: baseVerification,
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
    baseLock,
    targetMaterialization,
    targetLockIntent,
    targetPlan,
    transaction,
  };
}

function observedAt(
  transaction: PrivateRenderTransaction,
  lockDigest: string | null,
  side: "before" | "after",
): ObservedPrivateRenderTransactionState {
  return {
    lockDigest,
    files: Object.fromEntries(
      transaction.operations.map((operation) => [
        operation.path,
        side === "before" ? operation.beforeDigest : operation.afterDigest,
      ]),
    ),
  };
}

function journalAt(
  transaction: PrivateRenderTransaction,
  state: PrivateRenderTransactionJournal["state"],
): PrivateRenderTransactionJournal {
  let journal = createPrivateRenderTransactionJournal(transaction);
  for (const next of [
    "outputs-applying",
    "lock-written",
    "committed",
  ] as const) {
    if (journal.state === state) {
      break;
    }
    journal = advancePrivateRenderTransactionJournal(journal, next);
  }
  assert.equal(journal.state, state);
  return journal;
}

test("creates a deterministic transaction from observed preconditions and target intent", async () => {
  const fixture = await transactionFixture();
  validatePrivateRenderTransaction(fixture.transaction);

  assert.equal(fixture.targetPlan.safeToApply, true);
  assert.deepEqual(
    fixture.targetPlan.files.map(({ action, observedDigest }) => ({
      action,
      observedDigest,
    })),
    fixture.baseLock.files.map((file) => ({
      action: "update",
      observedDigest: file.contentDigest,
    })),
  );
  assert.deepEqual(
    fixture.transaction.operations.map(({ path, kind }) => ({ path, kind })),
    [
      { path: ".cursor/rules/agentdevflow.mdc", kind: "write" },
      { path: "AGENTS.md", kind: "write" },
      { path: "CLAUDE.md", kind: "write" },
    ],
  );
  assert.deepEqual(
    fixture.transaction.operations.map((operation) => operation.beforeDigest),
    fixture.baseLock.files.map((file) => file.contentDigest),
  );
  assert.deepEqual(
    fixture.transaction.operations.map((operation) => operation.afterDigest),
    fixture.targetLockIntent.files.map((file) => file.contentDigest),
  );
  assert.equal(
    fixture.transaction.digest,
    "206f6a493332fcee3139e56e52144b9018a4db13ad88dee9f96054644af4f4eb",
  );
  assert.equal("createdAt" in fixture.transaction, false);
  assert.equal("id" in fixture.transaction, false);

  const repeated = await transactionFixture();
  assert.deepEqual(repeated.transaction, fixture.transaction);
});

test("enforces the write-ahead journal state sequence", async () => {
  const { transaction } = await transactionFixture();
  const prepared = createPrivateRenderTransactionJournal(transaction);
  validatePrivateRenderTransactionJournal(prepared);
  assert.equal(prepared.state, "prepared");

  const applying = advancePrivateRenderTransactionJournal(
    prepared,
    "outputs-applying",
  );
  const lockWritten = advancePrivateRenderTransactionJournal(
    applying,
    "lock-written",
  );
  const committed = advancePrivateRenderTransactionJournal(
    lockWritten,
    "committed",
  );
  const rolledBack = advancePrivateRenderTransactionJournal(
    applying,
    "rolled-back",
  );
  assert.deepEqual(
    [prepared, applying, lockWritten, committed].map((journal) => journal.state),
    ["prepared", "outputs-applying", "lock-written", "committed"],
  );
  for (const journal of [prepared, applying, lockWritten, committed]) {
    validatePrivateRenderTransactionJournal(journal);
    assert.equal(journal.transactionDigest, transaction.digest);
  }
  validatePrivateRenderTransactionJournal(rolledBack);
  assert.equal(rolledBack.state, "rolled-back");

  assert.throws(
    () => advancePrivateRenderTransactionJournal(prepared, "lock-written"),
    /Invalid private render transaction journal transition/u,
  );
  assert.throws(
    () => advancePrivateRenderTransactionJournal(lockWritten, "outputs-applying"),
    /Invalid private render transaction journal transition/u,
  );
  assert.throws(
    () => advancePrivateRenderTransactionJournal(committed, "committed"),
    /Invalid private render transaction journal transition/u,
  );
  assert.throws(
    () => advancePrivateRenderTransactionJournal(rolledBack, "outputs-applying"),
    /Invalid private render transaction journal transition/u,
  );
});

test("rolls back partial outputs while the base lock remains authoritative", async () => {
  const { baseLock, transaction } = await transactionFixture();
  const journal = journalAt(transaction, "outputs-applying");
  const untouched = decidePrivateRenderTransactionRecovery(
    transaction,
    journal,
    observedAt(transaction, baseLock.digest, "before"),
  );
  assert.deepEqual(untouched, {
    action: "rollback",
    operations: [],
    reason: "The base lock is the rollback anchor; restore observed preconditions.",
  });

  const partial = observedAt(transaction, baseLock.digest, "before");
  const changedPaths = transaction.operations.slice(0, 2);
  const partialFiles = { ...partial.files };
  for (const operation of changedPaths) {
    partialFiles[operation.path] = operation.afterDigest;
  }
  const decision = decidePrivateRenderTransactionRecovery(
    transaction,
    journal,
    { ...partial, files: partialFiles },
  );
  assert.deepEqual(decision, {
    action: "rollback",
    operations: changedPaths.map((operation) => ({
      path: operation.path,
      targetDigest: operation.beforeDigest,
    })),
    reason: "The base lock is the rollback anchor; restore observed preconditions.",
  });
});

test("rolls forward after the target lock becomes the commit anchor", async () => {
  const { targetLockIntent, transaction } = await transactionFixture();
  const journal = journalAt(transaction, "lock-written");
  const partial = observedAt(transaction, targetLockIntent.digest, "after");
  const missing = transaction.operations[1];
  assert.ok(missing);
  const partialFiles = {
    ...partial.files,
    [missing.path]: missing.beforeDigest,
  };
  assert.deepEqual(
    decidePrivateRenderTransactionRecovery(transaction, journal, {
      ...partial,
      files: partialFiles,
    }),
    {
      action: "roll-forward",
      operations: [{ path: missing.path, targetDigest: missing.afterDigest }],
      reason: "The target lock is the commit anchor; complete target outputs.",
    },
  );

  assert.deepEqual(
    decidePrivateRenderTransactionRecovery(
      transaction,
      journal,
      observedAt(transaction, targetLockIntent.digest, "after"),
    ),
    {
      action: "complete",
      operations: [],
      reason: "The target lock and all target outputs are present.",
    },
  );
});

test("fails closed for foreign, corrupted, or contradictory recovery state", async () => {
  const { baseLock, targetLockIntent, transaction } =
    await transactionFixture();
  const applying = journalAt(transaction, "outputs-applying");
  const lockWritten = journalAt(transaction, "lock-written");
  const committed = journalAt(transaction, "committed");
  const before = observedAt(transaction, baseLock.digest, "before");

  assert.equal(
    decidePrivateRenderTransactionRecovery(transaction, applying, {
      ...before,
      lockDigest: "f".repeat(64),
    }).action,
    "conflict",
  );
  assert.match(
    decidePrivateRenderTransactionRecovery(transaction, applying, {
      ...before,
      lockDigest: "invalid",
    }).reason,
    /invalid lock digest/u,
  );
  const first = transaction.operations[0];
  assert.ok(first);
  assert.match(
    decidePrivateRenderTransactionRecovery(transaction, applying, {
      ...before,
      files: { ...before.files, [first.path]: "0".repeat(64) },
    }).reason,
    /neither before nor after/u,
  );
  assert.match(
    decidePrivateRenderTransactionRecovery(transaction, applying, {
      ...before,
      files: Object.fromEntries(
        Object.entries(before.files).filter(([path]) => path !== first.path),
      ),
    }).reason,
    /missing/u,
  );
  assert.match(
    decidePrivateRenderTransactionRecovery(
      transaction,
      lockWritten,
      before,
    ).reason,
    /lock-written journal does not have the target lock/u,
  );

  const driftedTarget = observedAt(
    transaction,
    targetLockIntent.digest,
    "after",
  );
  assert.match(
    decidePrivateRenderTransactionRecovery(transaction, committed, {
      ...driftedTarget,
      files: { ...driftedTarget.files, [first.path]: first.beforeDigest },
    }).reason,
    /Committed output no longer matches/u,
  );
});

test("treats a rolled-back journal as a terminal verified base state", async () => {
  const { baseLock, transaction } = await transactionFixture();
  const applying = journalAt(transaction, "outputs-applying");
  const rolledBack = advancePrivateRenderTransactionJournal(
    applying,
    "rolled-back",
  );
  assert.deepEqual(
    decidePrivateRenderTransactionRecovery(
      transaction,
      rolledBack,
      observedAt(transaction, baseLock.digest, "before"),
    ),
    {
      action: "complete",
      operations: [],
      reason: "The rolled-back transaction already matches its base state.",
    },
  );

  const drifted = observedAt(transaction, baseLock.digest, "before");
  const first = transaction.operations[0];
  assert.ok(first);
  assert.match(
    decidePrivateRenderTransactionRecovery(transaction, rolledBack, {
      ...drifted,
      files: { ...drifted.files, [first.path]: first.afterDigest },
    }).reason,
    /Rolled-back output no longer matches/u,
  );
});

test("rejects malformed transaction and journal data", async () => {
  const { transaction } = await transactionFixture();
  const journal = createPrivateRenderTransactionJournal(transaction);

  assert.throws(
    () => validatePrivateRenderTransaction({ ...transaction, createdAt: "now" }),
    /unexpected or missing fields/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderTransaction({
        ...transaction,
        operations: [...transaction.operations].reverse(),
      }),
    /not unique and sorted/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderTransaction({
        ...transaction,
        operations: transaction.operations.map((operation, index) =>
          index === 0 ? { ...operation, path: "../outside" } : operation,
        ),
      }),
    /path is unsafe/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderTransaction({
        ...transaction,
        operations: transaction.operations.map((operation, index) =>
          index === 0
            ? { ...operation, afterDigest: operation.beforeDigest }
            : operation,
        ),
      }),
    /Invalid write transaction operation/u,
  );
  assert.throws(
    () => validatePrivateRenderTransaction({ ...transaction, digest: "0".repeat(64) }),
    /digest does not match/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderTransactionJournal({
        ...journal,
        transactionDigest: "0".repeat(64),
      }),
    /journal digest does not match/u,
  );
  assert.throws(
    () => validatePrivateRenderTransactionJournal({ ...journal, state: "failed" }),
    /Unsupported private render transaction journal state/u,
  );
});

test("refuses unsafe or mismatched transaction inputs", async () => {
  const { baseLock, targetMaterialization, targetLockIntent, targetPlan } =
    await transactionFixture();

  assert.throws(
    () =>
      createPrivateRenderTransaction({
        baseLock,
        materialization: targetMaterialization,
        targetLockIntent,
        plan: {
          ...targetPlan,
          diagnostics: [
            {
              code: "EXPERIMENTAL_FAILURE",
              severity: "error",
              message: "The experimental plan is unsafe.",
            },
          ],
          safeToApply: false,
        },
      }),
    /unsafe render transaction/u,
  );
  assert.throws(
    () =>
      createPrivateRenderTransaction({
        baseLock,
        materialization: targetMaterialization,
        targetLockIntent,
        plan: { ...targetPlan, previousOwnership: {} },
      }),
    /ownership does not match the base lock/u,
  );
  assert.throws(
    () =>
      createPrivateRenderTransaction({
        baseLock,
        materialization: targetMaterialization,
        targetLockIntent: baseLock,
        plan: targetPlan,
      }),
    /Target lock intent does not match the source materialization/u,
  );
  const first = targetPlan.files[0];
  assert.ok(first);
  assert.throws(
    () =>
      createPrivateRenderTransaction({
        baseLock,
        materialization: targetMaterialization,
        targetLockIntent,
        plan: {
          ...targetPlan,
          files: targetPlan.files.map((file, index) =>
            index === 0 ? { ...file, expectedContent: "tampered\n" } : file,
          ),
        },
      }),
    /content digest does not match/u,
  );
});
