import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

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
} from "../../src/transaction/private-transaction-executor.js";
import {
  PrivateTransactionStoreLifecycle,
  PrivateTransactionStoreLifecycleError,
} from "../../src/transaction/private-transaction-store-lifecycle.js";
import {
  preparePrivateRenderRecovery,
  PrivateFilesystemTransactionStore,
  PrivateTransactionStoreError,
  serializePrivateRenderLockRecord,
} from "../../src/transaction/private-transaction-store.js";
import {
  PrivateFilesystemWorkspace,
  PrivateFilesystemWorkspaceError,
} from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import {
  balancedCandidateConfig,
  fastThreeProviderCandidateConfig,
} from "../fixtures/config/specimens.js";

interface SubprocessFixture {
  readonly repoRoot: string;
  readonly storeRoot: string;
  readonly workspace: PrivateFilesystemWorkspace;
  readonly store: PrivateFilesystemTransactionStore;
  readonly lockPath: string;
  readonly baseLock: PrivateRenderLock;
  readonly targetLockIntent: PrivateRenderLock;
  readonly transaction: PrivateRenderTransaction;
}

class InjectedSetupFault extends Error {
  constructor(readonly event: PrivateTransactionExecutionEvent) {
    super(`Injected recovery setup fault after ${event.kind}.`);
  }
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
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

async function subprocessFixture(t: TestContext): Promise<SubprocessFixture> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-subprocess-"));
  t.after(async () => {
    await rm(container, { recursive: true, force: true });
  });
  const repoRoot = join(container, "repository");
  const storeParent = join(container, "transaction-stores");
  const storeRoot = join(storeParent, "transaction-store");
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
    repoRoot,
    storeRoot,
    workspace,
    store,
    lockPath,
    baseLock,
    targetLockIntent,
    transaction,
  };
}

function waitForBoundary(
  child: ChildProcess,
  boundary: string,
  stderr: { value: string },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${boundary}. stderr: ${stderr.value}`));
    }, 10_000);
    const finish = (operation: () => void): void => {
      clearTimeout(timer);
      child.removeAllListeners("message");
      child.removeAllListeners("error");
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
        finish(() => reject(new Error(`Worker error: ${String("message" in message ? message.message : message)}`)));
      }
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("exit", (code, signal) =>
      finish(() =>
        reject(
          new Error(
            `Worker exited before ${boundary}: code=${String(code)} signal=${String(signal)} stderr=${stderr.value}`,
          ),
        ),
      ),
    );
  });
}

async function killAndWait(child: ChildProcess): Promise<void> {
  const forcedTerminationSignal: NodeJS.Signals =
    process.platform === "win32" ? "SIGTERM" : "SIGKILL";
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  assert.equal(child.kill(forcedTerminationSignal), true);
  const result = await exited;
  assert.equal(result.code, null);
  assert.equal(result.signal, forcedTerminationSignal);
}

function terminateAfterTest(child: ChildProcess): void {
  child.kill(process.platform === "win32" ? "SIGTERM" : "SIGKILL");
}

async function assertOutputSide(
  fixture: SubprocessFixture,
  side: "before" | "after",
): Promise<void> {
  for (const operation of fixture.transaction.operations) {
    const content = await fixture.workspace.read(operation.path);
    assert.equal(
      content === null ? null : digest(content),
      side === "before" ? operation.beforeDigest : operation.afterDigest,
      operation.path,
    );
  }
}

async function prepareRecoveryState(
  fixture: SubprocessFixture,
  direction: "rollback" | "roll-forward",
): Promise<void> {
  const setupBoundary = direction === "rollback"
    ? "path-written:forward:CLAUDE.md"
    : "journal-written:outputs-applying";
  let injected = false;
  await assert.rejects(
    () =>
      new PrivateTransactionExecutor({
        store: fixture.store,
        workspace: fixture.workspace,
        lockPath: fixture.lockPath,
        faultInjector: (event) => {
          if (!injected && eventKey(event) === setupBoundary) {
            injected = true;
            throw new InjectedSetupFault(event);
          }
        },
      }).execute(),
    InjectedSetupFault,
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

test(
  "recovers every forward boundary after real subprocess termination",
  async (t) => {
    const boundaries = [
      ["journal-written:outputs-applying", "rolled-back"],
      ["path-written:forward:.cursor/rules/agentdevflow.mdc", "rolled-back"],
      ["temporary-created:AGENTS.md", "rolled-back"],
      ["temporary-synced:AGENTS.md", "rolled-back"],
      ["path-written:forward:AGENTS.md", "rolled-back"],
      ["path-written:forward:CLAUDE.md", "rolled-back"],
      ["lock-written", "committed"],
      ["journal-written:lock-written", "committed"],
      ["state-verified:target", "committed"],
      ["journal-written:committed", "committed"],
    ] as const;
    const workerPath = fileURLToPath(
      new URL(
        "../fixtures/transaction/private-transaction-subprocess-worker.js",
        import.meta.url,
      ),
    );

    for (const [boundary, expectedStatus] of boundaries) {
      await t.test(boundary, async (subtest) => {
        const fixture = await subprocessFixture(subtest);
        const stderr = { value: "" };
        const child = fork(
          workerPath,
          [fixture.repoRoot, fixture.storeRoot, fixture.lockPath, boundary],
          { stdio: ["ignore", "ignore", "pipe", "ipc"] },
        );
        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => {
          stderr.value += chunk;
        });
        subtest.after(() => {
          if (child.exitCode === null && child.signalCode === null) {
            terminateAfterTest(child);
          }
        });

        await waitForBoundary(child, boundary, stderr);
        await killAndWait(child);

        await assert.rejects(
          () =>
            new PrivateTransactionExecutor({
              store: fixture.store,
              workspace: fixture.workspace,
              lockPath: fixture.lockPath,
            }).recover(),
          (error: unknown) =>
            error instanceof PrivateTransactionStoreError &&
            error.code === "PRIVATE_TRANSACTION_WRITER_BUSY",
        );
        const evidence = await fixture.store.inspectWriterForRecovery();
        assert.notEqual(evidence, null);
        const temporaryBoundary = boundary.startsWith("temporary-");
        const temporaryIntent = temporaryBoundary
          ? (await fixture.store.readTemporaryIntentRegistry())?.intents.find(
              (intent) =>
                intent.targetPath === "AGENTS.md" &&
                intent.writerFingerprint === evidence?.fingerprint,
            )
          : undefined;
        if (temporaryBoundary) {
          assert.ok(temporaryIntent);
          assert.equal(
            await fixture.workspace.inspectOwnedTemporary(temporaryIntent),
            "present",
          );
          const temporaryContent = await readFile(
            join(fixture.repoRoot, temporaryIntent.temporaryPath),
            "utf8",
          );
          if (boundary === "temporary-created:AGENTS.md") {
            assert.equal(temporaryContent, "");
          } else {
            assert.equal(digest(temporaryContent), temporaryIntent.targetDigest);
          }
        }
        await fixture.store.clearStaleWriterForRecovery({
          evidence: evidence ?? assert.fail("Expected stale writer evidence."),
          expectedTransactionDigest: fixture.transaction.digest,
        });

        const recoveryEvents: PrivateTransactionExecutionEvent[] = [];
        const recovered = await new PrivateTransactionExecutor({
          store: fixture.store,
          workspace: fixture.workspace,
          lockPath: fixture.lockPath,
          faultInjector: (event) => {
            recoveryEvents.push(event);
          },
        }).recover();
        assert.equal(recovered.status, expectedStatus);
        assert.equal(
          (await fixture.store.readJournal())?.state,
          expectedStatus === "committed" ? "committed" : "rolled-back",
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
        if (temporaryIntent) {
          assert.equal(
            await fixture.workspace.inspectOwnedTemporary(temporaryIntent),
            "absent",
          );
          assert.equal(
            recoveryEvents.some(
              (event) => eventKey(event) === "temporary-reclaimed:AGENTS.md",
            ),
            true,
          );
        }
      });
    }
  },
);

test(
  "recovers every recovery mutation boundary after subprocess termination",
  async (t) => {
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
    const workerPath = fileURLToPath(
      new URL(
        "../fixtures/transaction/private-transaction-subprocess-worker.js",
        import.meta.url,
      ),
    );

    for (const [direction, boundary, expectedStatus] of boundaries) {
      await t.test(`${direction}:${boundary}`, async (subtest) => {
        const fixture = await subprocessFixture(subtest);
        await prepareRecoveryState(fixture, direction);
        const stderr = { value: "" };
        const child = fork(
          workerPath,
          [
            fixture.repoRoot,
            fixture.storeRoot,
            fixture.lockPath,
            boundary,
            "recover",
          ],
          { stdio: ["ignore", "ignore", "pipe", "ipc"] },
        );
        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => {
          stderr.value += chunk;
        });
        subtest.after(() => {
          if (child.exitCode === null && child.signalCode === null) {
            terminateAfterTest(child);
          }
        });

        await waitForBoundary(child, boundary, stderr);
        await killAndWait(child);
        await assert.rejects(
          () =>
            new PrivateTransactionExecutor({
              store: fixture.store,
              workspace: fixture.workspace,
              lockPath: fixture.lockPath,
            }).recover(),
          (error: unknown) =>
            error instanceof PrivateTransactionStoreError &&
            error.code === "PRIVATE_TRANSACTION_WRITER_BUSY",
        );
        const evidence = await fixture.store.inspectWriterForRecovery();
        assert.notEqual(evidence, null);
        await fixture.store.clearStaleWriterForRecovery({
          evidence: evidence ?? assert.fail("Expected stale writer evidence."),
          expectedTransactionDigest: fixture.transaction.digest,
        });

        const recovered = await new PrivateTransactionExecutor({
          store: fixture.store,
          workspace: fixture.workspace,
          lockPath: fixture.lockPath,
        }).recover();
        assert.equal(recovered.status, expectedStatus);
        assert.equal((await fixture.store.readJournal())?.state, expectedStatus);
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
  },
);

test(
  "rejects a symbolic-link replacement of a killed writer temporary file",
  async (t) => {
    const fixture = await subprocessFixture(t);
    const boundary = "temporary-created:AGENTS.md";
    const workerPath = fileURLToPath(
      new URL(
        "../fixtures/transaction/private-transaction-subprocess-worker.js",
        import.meta.url,
      ),
    );
    const stderr = { value: "" };
    const child = fork(
      workerPath,
      [fixture.repoRoot, fixture.storeRoot, fixture.lockPath, boundary],
      { stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr.value += chunk;
    });
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) {
        terminateAfterTest(child);
      }
    });

    await waitForBoundary(child, boundary, stderr);
    await killAndWait(child);
    const evidence = await fixture.store.inspectWriterForRecovery();
    assert.notEqual(evidence, null);
    const intent = (await fixture.store.readTemporaryIntentRegistry())?.intents.find(
      (candidate) =>
        candidate.targetPath === "AGENTS.md" &&
        candidate.writerFingerprint === evidence?.fingerprint,
    );
    assert.ok(intent);
    await rm(join(fixture.repoRoot, intent.temporaryPath));
    const foreignPath = join(fixture.repoRoot, "foreign-temporary-target");
    await writeFile(foreignPath, "foreign\n", "utf8");
    await symlink(foreignPath, join(fixture.repoRoot, intent.temporaryPath));

    await fixture.store.clearStaleWriterForRecovery({
      evidence: evidence ?? assert.fail("Expected stale writer evidence."),
      expectedTransactionDigest: fixture.transaction.digest,
    });
    await assert.rejects(
      () =>
        new PrivateTransactionExecutor({
          store: fixture.store,
          workspace: fixture.workspace,
          lockPath: fixture.lockPath,
        }).recover(),
      (error: unknown) =>
        error instanceof PrivateFilesystemWorkspaceError &&
        error.code === "WORKSPACE_PATH_SYMLINK",
    );
    assert.equal(await readFile(foreignPath, "utf8"), "foreign\n");
    assert.equal((await fixture.store.readJournal())?.state, "outputs-applying");
  },
);

test(
  "fails recovery closed on foreign drift after recovery termination",
  async (t) => {
    const fixture = await subprocessFixture(t);
    await prepareRecoveryState(fixture, "rollback");
    const boundary = "path-written:rollback:.cursor/rules/agentdevflow.mdc";
    const workerPath = fileURLToPath(
      new URL(
        "../fixtures/transaction/private-transaction-subprocess-worker.js",
        import.meta.url,
      ),
    );
    const stderr = { value: "" };
    const child = fork(
      workerPath,
      [
        fixture.repoRoot,
        fixture.storeRoot,
        fixture.lockPath,
        boundary,
        "recover",
      ],
      { stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr.value += chunk;
    });
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) {
        terminateAfterTest(child);
      }
    });

    await waitForBoundary(child, boundary, stderr);
    await killAndWait(child);
    await fixture.workspace.writeAtomically("AGENTS.md", "foreign drift\n");
    const evidence = await fixture.store.inspectWriterForRecovery();
    assert.notEqual(evidence, null);
    await fixture.store.clearStaleWriterForRecovery({
      evidence: evidence ?? assert.fail("Expected stale writer evidence."),
      expectedTransactionDigest: fixture.transaction.digest,
    });
    await assert.rejects(
      () =>
        new PrivateTransactionExecutor({
          store: fixture.store,
          workspace: fixture.workspace,
          lockPath: fixture.lockPath,
        }).recover(),
      (error: unknown) =>
        error instanceof PrivateTransactionExecutorError &&
        error.code === "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
    );
    assert.equal((await fixture.store.readJournal())?.state, "outputs-applying");
  },
);

test(
  "recovers retirement after termination before writer release",
  async (t) => {
    const fixture = await subprocessFixture(t);
    await new PrivateTransactionExecutor({
      store: fixture.store,
      workspace: fixture.workspace,
      lockPath: fixture.lockPath,
    }).execute();
    const workerPath = fileURLToPath(
      new URL(
        "../fixtures/transaction/private-transaction-subprocess-worker.js",
        import.meta.url,
      ),
    );
    const stderr = { value: "" };
    const boundary = "retirement-written";
    const child = fork(
      workerPath,
      [
        fixture.repoRoot,
        fixture.storeRoot,
        fixture.lockPath,
        boundary,
        "retire",
      ],
      { stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr.value += chunk;
    });
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) {
        terminateAfterTest(child);
      }
    });

    await waitForBoundary(child, boundary, stderr);
    await killAndWait(child);
    assert.equal((await fixture.store.readRetirement())?.terminalState, "committed");
    const evidence = await fixture.store.inspectWriterForRecovery();
    assert.notEqual(evidence, null);

    const lifecycle = await PrivateTransactionStoreLifecycle.open(
      dirname(fixture.storeRoot),
    );
    await assert.rejects(
      () =>
        lifecycle.cleanup({
          storeName: basename(fixture.storeRoot),
          expectedTransactionDigest: fixture.transaction.digest,
        }),
      (error: unknown) =>
        error instanceof PrivateTransactionStoreLifecycleError &&
        error.code === "PRIVATE_TRANSACTION_LIFECYCLE_WRITER_BUSY",
    );
    await fixture.store.clearStaleWriterForRecovery({
      evidence: evidence ?? assert.fail("Expected stale writer evidence."),
      expectedTransactionDigest: fixture.transaction.digest,
    });
    const cleaned = await lifecycle.cleanup({
      storeName: basename(fixture.storeRoot),
      expectedTransactionDigest: fixture.transaction.digest,
    });
    assert.equal(cleaned.receipt.terminalState, "committed");
    assert.equal(
      (await lifecycle.prepareParentDisposal()).receipts[0]?.receiptDigest,
      cleaned.receipt.digest,
    );
    await assertOutputSide(fixture, "after");
    assert.equal(
      await fixture.workspace.read(fixture.lockPath),
      serializePrivateRenderLockRecord(fixture.targetLockIntent),
    );
  },
);

test(
  "resumes cleanup after termination at every lifecycle boundary",
  async (t) => {
    const boundaries = [
      "store-tombstoned",
      "receipt-written",
      "tombstone-removed",
    ] as const;
    const workerPath = fileURLToPath(
      new URL(
        "../fixtures/transaction/private-transaction-cleanup-subprocess-worker.js",
        import.meta.url,
      ),
    );

    for (const boundary of boundaries) {
      await t.test(boundary, async (subtest) => {
        const fixture = await subprocessFixture(subtest);
        const executor = new PrivateTransactionExecutor({
          store: fixture.store,
          workspace: fixture.workspace,
          lockPath: fixture.lockPath,
        });
        await executor.execute();
        await executor.prepareRetirement();
        const parentRoot = dirname(fixture.storeRoot);
        const storeName = basename(fixture.storeRoot);
        const stderr = { value: "" };
        const child = fork(
          workerPath,
          [parentRoot, storeName, fixture.transaction.digest, boundary],
          { stdio: ["ignore", "ignore", "pipe", "ipc"] },
        );
        child.stderr?.setEncoding("utf8");
        child.stderr?.on("data", (chunk: string) => {
          stderr.value += chunk;
        });
        subtest.after(() => {
          if (child.exitCode === null && child.signalCode === null) {
            terminateAfterTest(child);
          }
        });

        await waitForBoundary(child, boundary, stderr);
        await killAndWait(child);
        const lifecycle = await PrivateTransactionStoreLifecycle.open(parentRoot);
        const cleaned = await lifecycle.cleanup({
          storeName,
          expectedTransactionDigest: fixture.transaction.digest,
        });
        assert.equal(cleaned.receipt.terminalState, "committed");
        assert.equal(
          (await lifecycle.prepareParentDisposal()).receipts[0]?.receiptDigest,
          cleaned.receipt.digest,
        );
        await assertOutputSide(fixture, "after");
        assert.equal(
          await fixture.workspace.read(fixture.lockPath),
          serializePrivateRenderLockRecord(fixture.targetLockIntent),
        );
      });
    }
  },
);
