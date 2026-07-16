import { createHash } from "node:crypto";

import type {
  PrivateOwnedTemporaryEvent,
  PrivateTransactionalWorkspace,
} from "../workspace/private-filesystem-workspace.js";
import {
  advancePrivateRenderTransactionJournal,
  decidePrivateRenderTransactionRecovery,
  type ObservedPrivateRenderTransactionState,
  type PrivateRenderTransaction,
  type PrivateRenderTransactionJournal,
} from "./private-render-transaction.js";
import {
  parsePrivateRenderLockRecord,
  PrivateFilesystemTransactionStore,
  type PrivateTransactionRetirement,
  type PrivateTransactionWriterLease,
} from "./private-transaction-store.js";

export type PrivateTransactionExecutionStatus =
  | "ready"
  | "committed"
  | "rolled-back";

export interface PrivateTransactionExecutionResult {
  readonly status: PrivateTransactionExecutionStatus;
  readonly transactionDigest: string;
}

export type PrivateTransactionExecutionEvent =
  | {
      readonly kind: "journal-written";
      readonly state: PrivateRenderTransactionJournal["state"];
    }
  | {
      readonly kind: "path-written";
      readonly direction: "forward" | "rollback";
      readonly path: string;
    }
  | {
      readonly kind: "lock-written";
      readonly lockDigest: string;
    }
  | {
      readonly kind: "state-verified";
      readonly state: "base" | "target";
    }
  | {
      readonly kind: "retirement-written";
      readonly transactionDigest: string;
    }
  | {
      readonly kind: "temporary-created" | "temporary-synced";
      readonly path: string;
      readonly intentDigest: string;
    }
  | {
      readonly kind: "temporary-reclaimed";
      readonly path: string;
      readonly intentDigest: string;
    };

export type PrivateTransactionFaultInjector = (
  event: PrivateTransactionExecutionEvent,
) => void | Promise<void>;

export interface PrivateTransactionExecutorOptions {
  readonly store: PrivateFilesystemTransactionStore;
  readonly workspace: PrivateTransactionalWorkspace;
  readonly lockPath: string;
  readonly faultInjector?: PrivateTransactionFaultInjector;
}

export type PrivateTransactionExecutorErrorCode =
  | "PRIVATE_TRANSACTION_EXECUTOR_INVALID_STATE"
  | "PRIVATE_TRANSACTION_EXECUTOR_PRECONDITION_MISMATCH"
  | "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT";

export class PrivateTransactionExecutorError extends Error {
  override readonly name = "PrivateTransactionExecutorError";

  constructor(
    readonly code: PrivateTransactionExecutorErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
  }
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function contentDigest(content: string | null): string | null {
  return content === null ? null : digest(content);
}

async function emit(
  injector: PrivateTransactionFaultInjector | undefined,
  event: PrivateTransactionExecutionEvent,
): Promise<void> {
  await injector?.(event);
}

export class PrivateTransactionExecutor {
  constructor(private readonly options: PrivateTransactionExecutorOptions) {}

  private assertLockPath(transaction: PrivateRenderTransaction): void {
    if (transaction.operations.some((operation) => operation.path === this.options.lockPath)) {
      throw new PrivateTransactionExecutorError(
        "PRIVATE_TRANSACTION_EXECUTOR_INVALID_STATE",
        "Private render lock path overlaps a generated output path.",
        this.options.lockPath,
      );
    }
  }

  private async observeLockDigest(): Promise<string | null> {
    const content = await this.options.workspace.read(this.options.lockPath);
    if (content === null) {
      return null;
    }
    try {
      return parsePrivateRenderLockRecord(content, this.options.lockPath).digest;
    } catch (error) {
      throw new PrivateTransactionExecutorError(
        "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
        `Observed render lock is invalid: ${error instanceof Error ? error.message : String(error)}`,
        this.options.lockPath,
      );
    }
  }

  private async observe(
    transaction: PrivateRenderTransaction,
  ): Promise<ObservedPrivateRenderTransactionState> {
    return {
      lockDigest: await this.observeLockDigest(),
      files: Object.fromEntries(
        await Promise.all(
          transaction.operations.map(async (operation) => [
            operation.path,
            contentDigest(await this.options.workspace.read(operation.path)),
          ] as const),
        ),
      ),
    };
  }

  private async assertState(
    transaction: PrivateRenderTransaction,
    side: "before" | "after",
    expectedLockDigest: string | null,
    code: PrivateTransactionExecutorErrorCode,
  ): Promise<void> {
    const observed = await this.observe(transaction);
    if (observed.lockDigest !== expectedLockDigest) {
      throw new PrivateTransactionExecutorError(
        code,
        `Observed render lock does not match the transaction ${side} state.`,
        this.options.lockPath,
      );
    }
    for (const operation of transaction.operations) {
      const expected = side === "before" ? operation.beforeDigest : operation.afterDigest;
      if (observed.files[operation.path] !== expected) {
        throw new PrivateTransactionExecutorError(
          code,
          `Observed output does not match the transaction ${side} state: ${operation.path}`,
          operation.path,
        );
      }
    }
  }

  private async applyDigest(
    lease: PrivateTransactionWriterLease,
    transactionDigest: string,
    path: string,
    expectedCurrentDigest: string | null,
    targetDigest: string | null,
    code: PrivateTransactionExecutorErrorCode,
  ): Promise<boolean> {
    const current = await this.options.workspace.read(path);
    if (contentDigest(current) !== expectedCurrentDigest) {
      throw new PrivateTransactionExecutorError(
        code,
        `Output changed before transaction mutation: ${path}`,
        path,
      );
    }
    if (expectedCurrentDigest === targetDigest) {
      return false;
    }
    await this.options.store.verifyWriter(lease);
    if (targetDigest === null) {
      await this.options.workspace.removeAtomically(path);
    } else {
      await this.writeOwned(
        lease,
        transactionDigest,
        path,
        targetDigest,
        await this.options.store.readBlob(targetDigest),
      );
    }
    if (
      contentDigest(await this.options.workspace.read(path)) !== targetDigest
    ) {
      throw new PrivateTransactionExecutorError(
        code,
        `Output does not match the requested transaction state: ${path}`,
        path,
      );
    }
    return true;
  }

  private async writeOwned(
    lease: PrivateTransactionWriterLease,
    transactionDigest: string,
    path: string,
    targetDigest: string,
    content: string,
  ): Promise<void> {
    const intent = await this.options.store.registerTemporaryIntent(lease, {
      transactionDigest,
      targetPath: path,
      targetDigest,
    });
    await this.options.store.verifyWriter(lease);
    await this.options.workspace.writeAtomicallyOwned(
      intent,
      content,
      async (event: PrivateOwnedTemporaryEvent) => {
        await emit(this.options.faultInjector, {
          kind: event.kind,
          path: event.targetPath,
          intentDigest: intent.digest,
        });
      },
    );
  }

  private async reconcileTemporaryFiles(
    lease: PrivateTransactionWriterLease,
    transactionDigest: string,
  ): Promise<void> {
    const reclaimable = await this.options.store.readReclaimableTemporaryIntents(
      transactionDigest,
    );
    for (const intent of reclaimable) {
      await this.options.store.verifyWriter(lease);
      if ((await this.options.workspace.removeOwnedTemporary(intent)) === "removed") {
        await emit(this.options.faultInjector, {
          kind: "temporary-reclaimed",
          path: intent.targetPath,
          intentDigest: intent.digest,
        });
      }
    }
    const registry = await this.options.store.readTemporaryIntentRegistry();
    if (registry && registry.transactionDigest !== transactionDigest) {
      throw new PrivateTransactionExecutorError(
        "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
        "Temporary intent registry does not match the prepared transaction.",
      );
    }
    for (const intent of registry?.intents ?? []) {
      if ((await this.options.workspace.inspectOwnedTemporary(intent)) === "present") {
        throw new PrivateTransactionExecutorError(
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
          `Repository contains an owned temporary file without reclaim authority: ${intent.temporaryPath}`,
          intent.temporaryPath,
        );
      }
    }
  }

  private async writeJournal(
    lease: Parameters<PrivateFilesystemTransactionStore["writeJournal"]>[0],
    journal: PrivateRenderTransactionJournal,
  ): Promise<void> {
    await this.options.store.writeJournal(lease, journal);
    await emit(this.options.faultInjector, {
      kind: "journal-written",
      state: journal.state,
    });
  }

  async execute(): Promise<PrivateTransactionExecutionResult> {
    const lease = await this.options.store.acquireWriter();
    try {
      const recovery = await this.options.store.verifyPrepared();
      const { transaction, journal } = recovery;
      await this.reconcileTemporaryFiles(lease, transaction.digest);
      this.assertLockPath(transaction);
      if (journal.state !== "prepared") {
        throw new PrivateTransactionExecutorError(
          "PRIVATE_TRANSACTION_EXECUTOR_INVALID_STATE",
          `Cannot execute a transaction from journal state ${journal.state}.`,
        );
      }
      await this.assertState(
        transaction,
        "before",
        transaction.baseLockDigest,
        "PRIVATE_TRANSACTION_EXECUTOR_PRECONDITION_MISMATCH",
      );

      let currentJournal = advancePrivateRenderTransactionJournal(
        journal,
        "outputs-applying",
      );
      await this.writeJournal(lease, currentJournal);

      for (const operation of transaction.operations) {
        const changed = await this.applyDigest(
          lease,
          transaction.digest,
          operation.path,
          operation.beforeDigest,
          operation.afterDigest,
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
        );
        if (changed) {
          await emit(this.options.faultInjector, {
            kind: "path-written",
            direction: "forward",
            path: operation.path,
          });
        }
      }
      await this.assertState(
        transaction,
        "after",
        transaction.baseLockDigest,
        "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
      );

      const targetLockContent = await this.options.store.readBlob(
        recovery.manifest.targetLock.blobDigest,
      );
      if ((await this.observeLockDigest()) !== transaction.baseLockDigest) {
        throw new PrivateTransactionExecutorError(
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
          "Render lock changed before target lock publication.",
          this.options.lockPath,
        );
      }
      await this.options.store.verifyWriter(lease);
      await this.writeOwned(
        lease,
        transaction.digest,
        this.options.lockPath,
        recovery.manifest.targetLock.blobDigest,
        targetLockContent,
      );
      if ((await this.observeLockDigest()) !== transaction.targetLockDigest) {
        throw new PrivateTransactionExecutorError(
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
          "Published render lock does not match the transaction target.",
          this.options.lockPath,
        );
      }
      await emit(this.options.faultInjector, {
        kind: "lock-written",
        lockDigest: transaction.targetLockDigest,
      });

      currentJournal = advancePrivateRenderTransactionJournal(
        currentJournal,
        "lock-written",
      );
      await this.writeJournal(lease, currentJournal);
      await this.assertState(
        transaction,
        "after",
        transaction.targetLockDigest,
        "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
      );
      await emit(this.options.faultInjector, {
        kind: "state-verified",
        state: "target",
      });
      currentJournal = advancePrivateRenderTransactionJournal(
        currentJournal,
        "committed",
      );
      await this.writeJournal(lease, currentJournal);
      return { status: "committed", transactionDigest: transaction.digest };
    } finally {
      await this.options.store.releaseWriter(lease);
    }
  }

  async recover(): Promise<PrivateTransactionExecutionResult> {
    const lease = await this.options.store.acquireWriter();
    try {
      const recovery = await this.options.store.verifyPrepared();
      const { transaction, journal } = recovery;
      await this.reconcileTemporaryFiles(lease, transaction.digest);
      this.assertLockPath(transaction);

      if (journal.state === "prepared") {
        await this.assertState(
          transaction,
          "before",
          transaction.baseLockDigest,
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
        );
        return { status: "ready", transactionDigest: transaction.digest };
      }

      const observed = await this.observe(transaction);
      const decision = decidePrivateRenderTransactionRecovery(
        transaction,
        journal,
        observed,
      );
      if (decision.action === "conflict") {
        throw new PrivateTransactionExecutorError(
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
          decision.reason,
        );
      }
      if (journal.state === "committed") {
        return { status: "committed", transactionDigest: transaction.digest };
      }
      if (journal.state === "rolled-back") {
        return { status: "rolled-back", transactionDigest: transaction.digest };
      }

      if (decision.action === "rollback") {
        if (journal.state !== "outputs-applying") {
          throw new PrivateTransactionExecutorError(
            "PRIVATE_TRANSACTION_EXECUTOR_INVALID_STATE",
            `Cannot roll back journal state ${journal.state}.`,
          );
        }
        for (const operation of decision.operations) {
          const changed = await this.applyDigest(
            lease,
            transaction.digest,
            operation.path,
            observed.files[operation.path] ?? null,
            operation.targetDigest,
            "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
          );
          if (changed) {
            await emit(this.options.faultInjector, {
              kind: "path-written",
              direction: "rollback",
              path: operation.path,
            });
          }
        }
        await this.assertState(
          transaction,
          "before",
          transaction.baseLockDigest,
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
        );
        await emit(this.options.faultInjector, {
          kind: "state-verified",
          state: "base",
        });
        const rolledBack = advancePrivateRenderTransactionJournal(
          journal,
          "rolled-back",
        );
        await this.writeJournal(lease, rolledBack);
        return { status: "rolled-back", transactionDigest: transaction.digest };
      }

      for (const operation of decision.operations) {
        const changed = await this.applyDigest(
          lease,
          transaction.digest,
          operation.path,
          observed.files[operation.path] ?? null,
          operation.targetDigest,
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
        );
        if (changed) {
          await emit(this.options.faultInjector, {
            kind: "path-written",
            direction: "forward",
            path: operation.path,
          });
        }
      }
      await this.assertState(
        transaction,
        "after",
        transaction.targetLockDigest,
        "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
      );

      let currentJournal = journal;
      if (currentJournal.state === "outputs-applying") {
        currentJournal = advancePrivateRenderTransactionJournal(
          currentJournal,
          "lock-written",
        );
        await this.writeJournal(lease, currentJournal);
      }
      if (currentJournal.state !== "lock-written") {
        throw new PrivateTransactionExecutorError(
          "PRIVATE_TRANSACTION_EXECUTOR_INVALID_STATE",
          `Cannot commit recovered journal state ${currentJournal.state}.`,
        );
      }
      await emit(this.options.faultInjector, {
        kind: "state-verified",
        state: "target",
      });
      currentJournal = advancePrivateRenderTransactionJournal(
        currentJournal,
        "committed",
      );
      await this.writeJournal(lease, currentJournal);
      return { status: "committed", transactionDigest: transaction.digest };
    } finally {
      await this.options.store.releaseWriter(lease);
    }
  }

  async prepareRetirement(): Promise<PrivateTransactionRetirement> {
    const lease = await this.options.store.acquireWriter();
    try {
      const recovery = await this.options.store.verifyPrepared();
      const { transaction, journal } = recovery;
      await this.reconcileTemporaryFiles(lease, transaction.digest);
      this.assertLockPath(transaction);
      if (journal.state === "committed") {
        await this.assertState(
          transaction,
          "after",
          transaction.targetLockDigest,
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
        );
      } else if (journal.state === "rolled-back") {
        await this.assertState(
          transaction,
          "before",
          transaction.baseLockDigest,
          "PRIVATE_TRANSACTION_EXECUTOR_CONFLICT",
        );
      } else {
        throw new PrivateTransactionExecutorError(
          "PRIVATE_TRANSACTION_EXECUTOR_INVALID_STATE",
          `Cannot retire a transaction from journal state ${journal.state}.`,
        );
      }
      const retirement = await this.options.store.writeRetirement(lease);
      await emit(this.options.faultInjector, {
        kind: "retirement-written",
        transactionDigest: transaction.digest,
      });
      return retirement;
    } finally {
      await this.options.store.releaseWriter(lease);
    }
  }
}
