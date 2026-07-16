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
} from "../../src/transaction/private-transaction-executor.js";
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
  faultInjector?: (event: PrivateTransactionExecutionEvent) => void,
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
  return event.kind;
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
  const result = await executor(fixture, (event) => events.push(event)).execute();

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
    events.map((event) =>
      event.kind === "journal-written"
        ? `${event.kind}:${event.state}`
        : event.kind === "path-written"
          ? `${event.kind}:${event.direction}:${event.path}`
          : event.kind,
    ),
    [
      "journal-written:outputs-applying",
      "path-written:forward:.cursor/rules/agentdevflow.mdc",
      "path-written:forward:AGENTS.md",
      "path-written:forward:CLAUDE.md",
      "lock-written",
      "journal-written:lock-written",
      "state-verified",
      "journal-written:committed",
    ],
  );
  assert.deepEqual(await executor(fixture).recover(), result);
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
