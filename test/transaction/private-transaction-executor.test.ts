import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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
  createPrivateRenderTransaction,
  type PrivateRenderTransaction,
} from "../../src/transaction/private-render-transaction.js";
import {
  PrivateTransactionExecutor,
  PrivateTransactionExecutorError,
  type PrivateTransactionExecutionEvent,
  type PrivateTransactionExecutorErrorCode,
  type PrivateTransactionFaultInjector,
} from "../../src/transaction/private-transaction-executor.js";
import {
  preparePrivateRenderRecovery,
  PrivateFilesystemTransactionStore,
  PrivateTransactionStoreError,
  serializePrivateRenderLockRecord,
} from "../../src/transaction/private-transaction-store.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import {
  balancedCandidateConfig,
  fastThreeProviderCandidateConfig,
} from "../fixtures/config/specimens.js";

interface ExecutorFixture {
  readonly workspace: PrivateFilesystemWorkspace;
  readonly store: PrivateFilesystemTransactionStore;
  readonly lockPath: string;
  readonly baseLock: PrivateRenderLock;
  readonly targetLockIntent: PrivateRenderLock;
  readonly targetPlan: RenderPlan;
  readonly transaction: PrivateRenderTransaction;
}

class InjectedFault extends Error {
  constructor(readonly event: PrivateTransactionExecutionEvent) {
    super(`Injected fault after ${event.kind}.`);
  }
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agentdevflow-executor-"));
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

async function executorFixture(t: TestContext): Promise<ExecutorFixture> {
  const container = await temporaryDirectory(t);
  const repoRoot = join(container, "repository");
  const storeRoot = join(container, "transaction-store");
  await mkdir(repoRoot);
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
  await workspace.writeAtomically(
    lockPath,
    serializePrivateRenderLockRecord(baseLock),
  );

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
    workspace,
    store,
    lockPath,
    baseLock,
    targetLockIntent,
    targetPlan,
    transaction,
  };
}

function executor(
  fixture: ExecutorFixture,
  faultInjector?: PrivateTransactionFaultInjector,
  lockPath = fixture.lockPath,
): PrivateTransactionExecutor {
  return new PrivateTransactionExecutor({
    store: fixture.store,
    workspace: fixture.workspace,
    lockPath,
    faultInjector,
  });
}

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

async function prepareRecoveryState(
  fixture: ExecutorFixture,
  direction: "rollback" | "roll-forward",
): Promise<void> {
  const setupBoundary = direction === "rollback"
    ? "path-written:forward:CLAUDE.md"
    : "journal-written:outputs-applying";
  let injected = false;
  await assert.rejects(
    () =>
      executor(fixture, (event) => {
        if (!injected && eventKey(event) === setupBoundary) {
          injected = true;
          throw new InjectedFault(event);
        }
      }).execute(),
    InjectedFault,
  );
  assert.equal(injected, true);
  assert.equal((await fixture.store.readJournal())?.state, "outputs-applying");
  if (direction === "roll-forward") {
    await fixture.workspace.writeAtomically(
      fixture.lockPath,
      serializePrivateRenderLockRecord(fixture.targetLockIntent),
    );
  }
}

function rejectsWithCode(
  operation: () => Promise<unknown>,
  code: PrivateTransactionExecutorErrorCode,
): Promise<void> {
  return assert.rejects(operation, (error: unknown) => {
    assert.equal(error instanceof PrivateTransactionExecutorError, true);
    assert.equal((error as PrivateTransactionExecutorError).code, code);
    return true;
  });
}

async function assertOutputSide(
  fixture: ExecutorFixture,
  side: "before" | "after",
): Promise<void> {
  for (const operation of fixture.transaction.operations) {
    const content = await fixture.workspace.read(operation.path);
    const actual = content === null ? null : digest(content);
    assert.equal(
      actual,
      side === "before" ? operation.beforeDigest : operation.afterDigest,
      operation.path,
    );
  }
}

test("applies outputs, publishes the target lock last, and commits", async (t) => {
  const fixture = await executorFixture(t);
  const events: PrivateTransactionExecutionEvent[] = [];
  const result = await executor(fixture, (event) => {
    events.push(event);
  }).execute();

  assert.deepEqual(result, {
    status: "committed",
    transactionDigest: fixture.transaction.digest,
  });
  await assertOutputSide(fixture, "after");
  assert.equal(
    await fixture.workspace.read(fixture.lockPath),
    serializePrivateRenderLockRecord(fixture.targetLockIntent),
  );
  assert.equal((await fixture.store.readJournal())?.state, "committed");
  assert.deepEqual(
    events.map(eventKey),
    [
      "journal-written:outputs-applying",
      "temporary-created:.cursor/rules/agentdevflow.mdc",
      "temporary-synced:.cursor/rules/agentdevflow.mdc",
      "path-written:forward:.cursor/rules/agentdevflow.mdc",
      "temporary-created:AGENTS.md",
      "temporary-synced:AGENTS.md",
      "path-written:forward:AGENTS.md",
      "temporary-created:CLAUDE.md",
      "temporary-synced:CLAUDE.md",
      "path-written:forward:CLAUDE.md",
      `temporary-created:${fixture.lockPath}`,
      `temporary-synced:${fixture.lockPath}`,
      "lock-written",
      "journal-written:lock-written",
      "state-verified:target",
      "journal-written:committed",
    ],
  );
  assert.deepEqual(await executor(fixture).recover(), result);
});

test("retires only an exact terminal transaction and blocks store reuse", async (t) => {
  const fixture = await executorFixture(t);
  await executor(fixture).execute();
  const retirement = await executor(fixture).prepareRetirement();

  assert.equal(retirement.transactionDigest, fixture.transaction.digest);
  assert.equal(retirement.terminalState, "committed");
  assert.deepEqual(await fixture.store.readRetirement(), retirement);
  await assert.rejects(
    () => fixture.store.acquireWriter(),
    (error: unknown) =>
      error instanceof PrivateTransactionStoreError &&
      error.code === "PRIVATE_TRANSACTION_STORE_RETIRED",
  );
});

test("refuses retirement before terminal state or after terminal drift", async (t) => {
  const prepared = await executorFixture(t);
  await rejectsWithCode(
    () => executor(prepared).prepareRetirement(),
    "PRIVATE_TRANSACTION_EXECUTOR_INVALID_STATE",
  );
  assert.equal(await prepared.store.readRetirement(), null);

  const drifted = await executorFixture(t);
  await executor(drifted).execute();
  await drifted.workspace.writeAtomically("AGENTS.md", "terminal drift\n");
  await rejectsWithCode(
    () => executor(drifted).prepareRetirement(),
    "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
  );
  assert.equal(await drifted.store.readRetirement(), null);
});

test("rolls back output changes when interruption occurs before target lock", async (t) => {
  const fixture = await executorFixture(t);
  let injected = false;
  await assert.rejects(
    () =>
      executor(fixture, (event) => {
        if (!injected && event.kind === "path-written") {
          injected = true;
          throw new InjectedFault(event);
        }
      }).execute(),
    InjectedFault,
  );
  assert.equal((await fixture.store.readJournal())?.state, "outputs-applying");

  const recovered = await executor(fixture).recover();
  assert.equal(recovered.status, "rolled-back");
  assert.equal((await fixture.store.readJournal())?.state, "rolled-back");
  await assertOutputSide(fixture, "before");
  assert.equal(
    await fixture.workspace.read(fixture.lockPath),
    serializePrivateRenderLockRecord(fixture.baseLock),
  );
  assert.equal((await executor(fixture).recover()).status, "rolled-back");
});

test("cleans owned temporary files after cooperative executor faults", async (t) => {
  for (const boundary of [
    "temporary-created:AGENTS.md",
    "temporary-synced:AGENTS.md",
  ] as const) {
    await t.test(boundary, async (subtest) => {
      const fixture = await executorFixture(subtest);
      let injected = false;
      await assert.rejects(
        () =>
          executor(fixture, (event) => {
            if (!injected && eventKey(event) === boundary) {
              injected = true;
              throw new InjectedFault(event);
            }
          }).execute(),
        InjectedFault,
      );
      assert.equal(injected, true);
      const registry = await fixture.store.readTemporaryIntentRegistry();
      const intent = registry?.intents.find(
        (candidate) => candidate.targetPath === "AGENTS.md",
      );
      assert.ok(intent);
      assert.equal(await fixture.workspace.inspectOwnedTemporary(intent), "absent");
      assert.equal((await executor(fixture).recover()).status, "rolled-back");
      await assertOutputSide(fixture, "before");
    });
  }
});

test("refuses to reclaim an owned temporary file without writer clearance", async (t) => {
  const fixture = await executorFixture(t);
  const operation = fixture.transaction.operations.find(
    (candidate) => candidate.path === "AGENTS.md",
  );
  assert.ok(operation?.afterDigest);
  const lease = await fixture.store.acquireWriter();
  const intent = await fixture.store.registerTemporaryIntent(lease, {
    transactionDigest: fixture.transaction.digest,
    targetPath: operation.path,
    targetDigest: operation.afterDigest,
  });
  await fixture.workspace.writeAtomically(intent.temporaryPath, "partial");
  await fixture.store.releaseWriter(lease);

  await rejectsWithCode(
    () => executor(fixture).recover(),
    "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
  );
  assert.equal(await fixture.workspace.inspectOwnedTemporary(intent), "present");
});

test("reclaims an exact owned temporary file after explicit writer clearance", async (t) => {
  const fixture = await executorFixture(t);
  const operation = fixture.transaction.operations.find(
    (candidate) => candidate.path === "AGENTS.md",
  );
  assert.ok(operation?.afterDigest);
  const lease = await fixture.store.acquireWriter();
  const intent = await fixture.store.registerTemporaryIntent(lease, {
    transactionDigest: fixture.transaction.digest,
    targetPath: operation.path,
    targetDigest: operation.afterDigest,
  });
  await fixture.workspace.writeAtomically(intent.temporaryPath, "partial");
  const evidence = await fixture.store.inspectWriterForRecovery();
  assert.notEqual(evidence, null);

  await fixture.store.clearStaleWriterForRecovery({
    evidence: evidence ?? assert.fail("Expected stale writer evidence."),
    expectedTransactionDigest: fixture.transaction.digest,
  });
  const events: PrivateTransactionExecutionEvent[] = [];
  assert.equal(
    (await executor(fixture, (event) => {
      events.push(event);
    }).recover()).status,
    "ready",
  );
  assert.equal(await fixture.workspace.inspectOwnedTemporary(intent), "absent");
  assert.equal(
    events.some((event) => eventKey(event) === "temporary-reclaimed:AGENTS.md"),
    true,
  );
});

test("rolls forward when the target lock was published before interruption", async (t) => {
  const fixture = await executorFixture(t);
  await assert.rejects(
    () =>
      executor(fixture, (event) => {
        if (event.kind === "lock-written") {
          throw new InjectedFault(event);
        }
      }).execute(),
    InjectedFault,
  );
  assert.equal((await fixture.store.readJournal())?.state, "outputs-applying");
  await assertOutputSide(fixture, "after");
  assert.equal(
    await fixture.workspace.read(fixture.lockPath),
    serializePrivateRenderLockRecord(fixture.targetLockIntent),
  );

  assert.equal((await executor(fixture).recover()).status, "committed");
  assert.equal((await fixture.store.readJournal())?.state, "committed");
});

test("refuses project mutation after losing the writer lease", async (t) => {
  const fixture = await executorFixture(t);
  await assert.rejects(
    () =>
      executor(fixture, async (event) => {
        if (
          event.kind === "journal-written" &&
          event.state === "outputs-applying"
        ) {
          const evidence = await fixture.store.inspectWriterForRecovery();
          assert.notEqual(evidence, null);
          await fixture.store.clearStaleWriterForRecovery({
            evidence: evidence ?? assert.fail("Expected writer evidence."),
            expectedTransactionDigest: fixture.transaction.digest,
          });
        }
      }).execute(),
    (error: unknown) =>
      error instanceof PrivateTransactionStoreError &&
      error.code === "PRIVATE_TRANSACTION_WRITER_LEASE_LOST",
  );
  await assertOutputSide(fixture, "before");
  assert.equal((await fixture.store.readJournal())?.state, "outputs-applying");
});

test("recovers deterministically from every forward execution boundary", async (t) => {
  const boundaries = [
    ["journal-written:outputs-applying", "rolled-back"],
    ["path-written:forward:.cursor/rules/agentdevflow.mdc", "rolled-back"],
    ["path-written:forward:AGENTS.md", "rolled-back"],
    ["path-written:forward:CLAUDE.md", "rolled-back"],
    ["lock-written", "committed"],
    ["journal-written:lock-written", "committed"],
    ["state-verified:target", "committed"],
    ["journal-written:committed", "committed"],
  ] as const;

  for (const [boundary, expectedStatus] of boundaries) {
    await t.test(boundary, async (subtest) => {
      const fixture = await executorFixture(subtest);
      let injected = false;
      await assert.rejects(
        () =>
          executor(fixture, (event) => {
            if (!injected && eventKey(event) === boundary) {
              injected = true;
              throw new InjectedFault(event);
            }
          }).execute(),
        InjectedFault,
      );
      assert.equal(injected, true);
      assert.equal((await executor(fixture).recover()).status, expectedStatus);
      assert.equal(
        (await fixture.store.readJournal())?.state,
        expectedStatus === "committed" ? "committed" : "rolled-back",
      );
    });
  }
});

test("recovers deterministically from every recovery mutation boundary", async (t) => {
  const boundaries = [
    ["rollback", "path-written:rollback:.cursor/rules/agentdevflow.mdc", "rolled-back"],
    ["rollback", "path-written:rollback:AGENTS.md", "rolled-back"],
    ["rollback", "path-written:rollback:CLAUDE.md", "rolled-back"],
    ["rollback", "state-verified:base", "rolled-back"],
    ["rollback", "journal-written:rolled-back", "rolled-back"],
    ["roll-forward", "path-written:forward:.cursor/rules/agentdevflow.mdc", "committed"],
    ["roll-forward", "path-written:forward:AGENTS.md", "committed"],
    ["roll-forward", "path-written:forward:CLAUDE.md", "committed"],
    ["roll-forward", "journal-written:lock-written", "committed"],
    ["roll-forward", "state-verified:target", "committed"],
    ["roll-forward", "journal-written:committed", "committed"],
  ] as const;

  for (const [direction, boundary, expectedStatus] of boundaries) {
    await t.test(`${direction}:${boundary}`, async (subtest) => {
      const fixture = await executorFixture(subtest);
      await prepareRecoveryState(fixture, direction);
      let injected = false;
      await assert.rejects(
        () =>
          executor(fixture, (event) => {
            if (!injected && eventKey(event) === boundary) {
              injected = true;
              throw new InjectedFault(event);
            }
          }).recover(),
        InjectedFault,
      );
      assert.equal(injected, true);
      assert.equal((await executor(fixture).recover()).status, expectedStatus);
      assert.equal(
        (await fixture.store.readJournal())?.state,
        expectedStatus,
      );
      await assertOutputSide(
        fixture,
        expectedStatus === "committed" ? "after" : "before",
      );
      assert.equal(
        await fixture.workspace.read(fixture.lockPath),
        serializePrivateRenderLockRecord(
          expectedStatus === "committed"
            ? fixture.targetLockIntent
            : fixture.baseLock,
        ),
      );
    });
  }
});

test("fails recovery closed when an interrupted output has foreign drift", async (t) => {
  const fixture = await executorFixture(t);
  let injected = false;
  await assert.rejects(
    () =>
      executor(fixture, (event) => {
        if (!injected && event.kind === "path-written") {
          injected = true;
          throw new InjectedFault(event);
        }
      }).execute(),
    InjectedFault,
  );
  await fixture.workspace.writeAtomically("AGENTS.md", "foreign drift\n");
  await rejectsWithCode(
    () => executor(fixture).recover(),
    "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
  );
  assert.equal((await fixture.store.readJournal())?.state, "outputs-applying");
});

test("rejects an absent base lock and a lock path collision before apply", async (t) => {
  const missingLock = await executorFixture(t);
  await missingLock.workspace.removeAtomically(missingLock.lockPath);
  await rejectsWithCode(
    () => executor(missingLock).execute(),
    "PRIVATE_TRANSACTION_EXECUTOR_PRECONDITION_MISMATCH",
  );
  assert.equal((await missingLock.store.readJournal())?.state, "prepared");

  const collision = await executorFixture(t);
  await rejectsWithCode(
    () => executor(collision, undefined, "AGENTS.md").execute(),
    "PRIVATE_TRANSACTION_EXECUTOR_INVALID_STATE",
  );
  assert.equal((await collision.store.readJournal())?.state, "prepared");
  assert.equal((await executor(collision).recover()).status, "ready");
});
