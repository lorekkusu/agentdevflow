import { createHash } from "node:crypto";
import { posix } from "node:path";

import {
  derivePrivateRenderLockIntent,
  validatePrivateRenderLock,
  type PrivateRenderLock,
} from "../lock/private-render-lock.js";
import type { PlannedFile, RenderPlan } from "../renderer/contract.js";
import type { PrivateRendererSourceMaterialization } from "../renderer/materialize-compilation.js";
import { validateRenderPlanIntegrity } from "../renderer/staged-adapter.js";

export const privateRenderTransactionRevision = 1;
export const privateRenderTransactionJournalRevision = 1;

export type PrivateRenderTransactionOperationKind =
  | "write"
  | "remove"
  | "retain";

export interface PrivateRenderTransactionOperation {
  readonly path: string;
  readonly kind: PrivateRenderTransactionOperationKind;
  readonly beforeDigest: string | null;
  readonly afterDigest: string | null;
}

export interface PrivateRenderTransaction {
  readonly revision: number;
  readonly planDigest: string;
  readonly baseLockDigest: string | null;
  readonly targetLockDigest: string;
  readonly operations: readonly PrivateRenderTransactionOperation[];
  readonly digest: string;
}

export type PrivateRenderTransactionJournalState =
  | "prepared"
  | "outputs-applying"
  | "lock-written"
  | "committed"
  | "rolled-back";

export interface PrivateRenderTransactionJournal {
  readonly revision: number;
  readonly transactionDigest: string;
  readonly state: PrivateRenderTransactionJournalState;
  readonly digest: string;
}

export interface CreatePrivateRenderTransactionOptions {
  readonly baseLock: PrivateRenderLock | null;
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly targetLockIntent: PrivateRenderLock;
  readonly plan: RenderPlan;
}

export interface ObservedPrivateRenderTransactionState {
  readonly lockDigest: string | null;
  readonly files: Readonly<Record<string, string | null>>;
}

export type PrivateRenderRecoveryAction =
  | "rollback"
  | "roll-forward"
  | "complete"
  | "conflict";

export interface PrivateRenderRecoveryOperation {
  readonly path: string;
  readonly targetDigest: string | null;
}

export interface PrivateRenderRecoveryDecision {
  readonly action: PrivateRenderRecoveryAction;
  readonly operations: readonly PrivateRenderRecoveryOperation[];
  readonly reason: string;
}

const sha256Pattern = /^[a-f0-9]{64}$/u;
const journalStates: readonly PrivateRenderTransactionJournalState[] = [
  "prepared",
  "outputs-applying",
  "lock-written",
  "committed",
  "rolled-back",
];
const journalTransitions: Readonly<
  Record<
    PrivateRenderTransactionJournalState,
    readonly PrivateRenderTransactionJournalState[]
  >
> = {
  prepared: ["outputs-applying"],
  "outputs-applying": ["lock-written", "rolled-back"],
  "lock-written": ["committed"],
  committed: [],
  "rolled-back": [],
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function digestValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  description: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  description: string,
): void {
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(`${description} has unexpected or missing fields.`);
  }
}

function requireSha256(value: unknown, description: string): string {
  if (typeof value !== "string" || !sha256Pattern.test(value)) {
    throw new Error(`${description} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function requireNullableSha256(
  value: unknown,
  description: string,
): string | null {
  return value === null ? null : requireSha256(value, description);
}

function requireSafePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error("Private render transaction path must be non-empty and trimmed.");
  }
  if (
    value.includes("\\") ||
    value === "." ||
    value === ".." ||
    value.startsWith("../") ||
    posix.isAbsolute(value) ||
    posix.normalize(value) !== value
  ) {
    throw new Error(`Private render transaction path is unsafe: ${value}`);
  }
  return value;
}

function operationKind(file: PlannedFile): PrivateRenderTransactionOperationKind {
  switch (file.action) {
    case "create":
    case "update":
      return "write";
    case "delete":
      return "remove";
    case "unchanged":
      return "retain";
    case "conflict":
      throw new Error(`Render transaction contains a conflict at ${file.path}.`);
  }
}

function validateOperationShape(
  operation: PrivateRenderTransactionOperation,
): void {
  switch (operation.kind) {
    case "write":
      if (
        operation.afterDigest === null ||
        operation.beforeDigest === operation.afterDigest
      ) {
        throw new Error(`Invalid write transaction operation: ${operation.path}`);
      }
      return;
    case "remove":
      if (operation.afterDigest !== null) {
        throw new Error(`Invalid remove transaction operation: ${operation.path}`);
      }
      return;
    case "retain":
      if (
        operation.beforeDigest === null ||
        operation.beforeDigest !== operation.afterDigest
      ) {
        throw new Error(`Invalid retain transaction operation: ${operation.path}`);
      }
      return;
  }
}

function transactionDigest(
  transaction: Omit<PrivateRenderTransaction, "digest">,
): string {
  return digestValue({
    revision: transaction.revision,
    planDigest: transaction.planDigest,
    baseLockDigest: transaction.baseLockDigest,
    targetLockDigest: transaction.targetLockDigest,
    operations: transaction.operations.map((operation) => ({
      path: operation.path,
      kind: operation.kind,
      beforeDigest: operation.beforeDigest,
      afterDigest: operation.afterDigest,
    })),
  });
}

function journalDigest(
  journal: Omit<PrivateRenderTransactionJournal, "digest">,
): string {
  return digestValue({
    revision: journal.revision,
    transactionDigest: journal.transactionDigest,
    state: journal.state,
  });
}

export function validatePrivateRenderTransaction(
  value: unknown,
): asserts value is PrivateRenderTransaction {
  const transaction = requireRecord(value, "Private render transaction");
  requireExactKeys(
    transaction,
    [
      "revision",
      "planDigest",
      "baseLockDigest",
      "targetLockDigest",
      "operations",
      "digest",
    ],
    "Private render transaction",
  );
  if (transaction.revision !== privateRenderTransactionRevision) {
    throw new Error(
      `Unsupported private render transaction revision: ${String(transaction.revision)}.`,
    );
  }
  requireSha256(transaction.planDigest, "Private render transaction plan digest");
  const baseLockDigest = requireNullableSha256(
    transaction.baseLockDigest,
    "Private render transaction base lock digest",
  );
  const targetLockDigest = requireSha256(
    transaction.targetLockDigest,
    "Private render transaction target lock digest",
  );
  if (baseLockDigest === targetLockDigest) {
    throw new Error("Private render transaction does not change lock state.");
  }
  requireSha256(transaction.digest, "Private render transaction digest");

  if (!Array.isArray(transaction.operations) || transaction.operations.length === 0) {
    throw new Error("Private render transaction operations are empty.");
  }
  let previousPath = "";
  const operations: PrivateRenderTransactionOperation[] = [];
  for (const [index, operationValue] of transaction.operations.entries()) {
    const operation = requireRecord(
      operationValue,
      "Private render transaction operation",
    );
    requireExactKeys(
      operation,
      ["path", "kind", "beforeDigest", "afterDigest"],
      "Private render transaction operation",
    );
    const path = requireSafePath(operation.path);
    if (index > 0 && compareText(previousPath, path) >= 0) {
      throw new Error(
        "Private render transaction paths are not unique and sorted.",
      );
    }
    previousPath = path;
    if (
      operation.kind !== "write" &&
      operation.kind !== "remove" &&
      operation.kind !== "retain"
    ) {
      throw new Error(`Unsupported transaction operation kind: ${String(operation.kind)}.`);
    }
    const parsed: PrivateRenderTransactionOperation = {
      path,
      kind: operation.kind,
      beforeDigest: requireNullableSha256(
        operation.beforeDigest,
        `Private render transaction before digest for ${path}`,
      ),
      afterDigest: requireNullableSha256(
        operation.afterDigest,
        `Private render transaction after digest for ${path}`,
      ),
    };
    validateOperationShape(parsed);
    operations.push(parsed);
  }

  const expectedDigest = transactionDigest({
    revision: transaction.revision as number,
    planDigest: transaction.planDigest as string,
    baseLockDigest,
    targetLockDigest,
    operations,
  });
  if (transaction.digest !== expectedDigest) {
    throw new Error("Private render transaction digest does not match.");
  }
}

export function validatePrivateRenderTransactionJournal(
  value: unknown,
): asserts value is PrivateRenderTransactionJournal {
  const journal = requireRecord(value, "Private render transaction journal");
  requireExactKeys(
    journal,
    ["revision", "transactionDigest", "state", "digest"],
    "Private render transaction journal",
  );
  if (journal.revision !== privateRenderTransactionJournalRevision) {
    throw new Error(
      `Unsupported private render transaction journal revision: ${String(journal.revision)}.`,
    );
  }
  requireSha256(
    journal.transactionDigest,
    "Private render transaction journal transaction digest",
  );
  if (
    typeof journal.state !== "string" ||
    !journalStates.includes(journal.state as PrivateRenderTransactionJournalState)
  ) {
    throw new Error(`Unsupported private render transaction journal state: ${String(journal.state)}.`);
  }
  requireSha256(journal.digest, "Private render transaction journal digest");
  const expectedDigest = journalDigest({
    revision: journal.revision as number,
    transactionDigest: journal.transactionDigest as string,
    state: journal.state as PrivateRenderTransactionJournalState,
  });
  if (journal.digest !== expectedDigest) {
    throw new Error("Private render transaction journal digest does not match.");
  }
}

function expectedOwnership(lock: PrivateRenderLock | null): ReadonlyMap<
  string,
  { readonly owner: string; readonly digest: string }
> {
  return new Map(
    (lock?.files ?? []).map((file) => [
      file.path,
      { owner: file.owner, digest: file.contentDigest },
    ]),
  );
}

function validateBaseOwnership(
  baseLock: PrivateRenderLock | null,
  plan: RenderPlan,
): void {
  const expected = expectedOwnership(baseLock);
  const actualPaths = Object.keys(plan.previousOwnership).sort(compareText);
  const expectedPaths = [...expected.keys()].sort(compareText);
  if (
    actualPaths.length !== expectedPaths.length ||
    actualPaths.some((path, index) => path !== expectedPaths[index])
  ) {
    throw new Error("Render plan ownership does not match the base lock.");
  }
  for (const path of expectedPaths) {
    const claim = plan.previousOwnership[path];
    const expectedClaim = expected.get(path);
    if (
      !claim ||
      !expectedClaim ||
      claim.owner !== expectedClaim.owner ||
      claim.digest !== expectedClaim.digest
    ) {
      throw new Error(`Render plan ownership does not match the base lock: ${path}`);
    }
  }
}

function validateTargetLockIntent(
  targetLock: PrivateRenderLock,
  materialization: PrivateRendererSourceMaterialization,
  plan: RenderPlan,
): void {
  const derivedIntent = derivePrivateRenderLockIntent({ materialization, plan });
  if (targetLock.digest !== derivedIntent.digest) {
    throw new Error("Target lock intent does not match the source materialization.");
  }
  if (
    targetLock.renderer.name !== plan.backend ||
    targetLock.renderer.version !== plan.backendVersion ||
    targetLock.renderer.ownershipKey !== plan.ownershipKey ||
    targetLock.renderer.inputDigest !== plan.inputDigest
  ) {
    throw new Error("Target lock intent does not match the render plan.");
  }
  const targetFiles = new Map(
    targetLock.files.map((file) => [file.path, file.contentDigest]),
  );
  const plannedFiles = plan.files.filter((file) => file.action !== "delete");
  if (targetFiles.size !== plannedFiles.length) {
    throw new Error("Target lock files do not match the render plan.");
  }
  for (const file of plannedFiles) {
    if (
      file.expectedDigest === null ||
      targetFiles.get(file.path) !== file.expectedDigest
    ) {
      throw new Error(`Target lock file does not match the render plan: ${file.path}`);
    }
  }
}

export function createPrivateRenderTransaction(
  options: CreatePrivateRenderTransactionOptions,
): PrivateRenderTransaction {
  const { baseLock, materialization, targetLockIntent, plan } = options;
  if (baseLock) {
    validatePrivateRenderLock(baseLock);
  }
  validatePrivateRenderLock(targetLockIntent);
  validateRenderPlanIntegrity(plan);
  if (!plan.safeToApply) {
    throw new Error("Refusing to prepare an unsafe render transaction.");
  }
  validateBaseOwnership(baseLock, plan);
  validateTargetLockIntent(targetLockIntent, materialization, plan);

  const operations = plan.files
    .map(
      (file): PrivateRenderTransactionOperation => ({
        path: file.path,
        kind: operationKind(file),
        beforeDigest: file.observedDigest,
        afterDigest: file.expectedDigest,
      }),
    )
    .sort((left, right) => compareText(left.path, right.path));
  for (const operation of operations) {
    validateOperationShape(operation);
  }
  const base = {
    revision: privateRenderTransactionRevision,
    planDigest: plan.planDigest,
    baseLockDigest: baseLock?.digest ?? null,
    targetLockDigest: targetLockIntent.digest,
    operations,
  } satisfies Omit<PrivateRenderTransaction, "digest">;
  const transaction: PrivateRenderTransaction = {
    ...base,
    digest: transactionDigest(base),
  };
  validatePrivateRenderTransaction(transaction);
  return transaction;
}

export function createPrivateRenderTransactionJournal(
  transaction: PrivateRenderTransaction,
): PrivateRenderTransactionJournal {
  validatePrivateRenderTransaction(transaction);
  const base = {
    revision: privateRenderTransactionJournalRevision,
    transactionDigest: transaction.digest,
    state: "prepared" as const,
  };
  return { ...base, digest: journalDigest(base) };
}

export function advancePrivateRenderTransactionJournal(
  journal: PrivateRenderTransactionJournal,
  nextState: PrivateRenderTransactionJournalState,
): PrivateRenderTransactionJournal {
  validatePrivateRenderTransactionJournal(journal);
  if (!journalTransitions[journal.state].includes(nextState)) {
    throw new Error(
      `Invalid private render transaction journal transition: ${journal.state} -> ${nextState}.`,
    );
  }
  const base = {
    revision: privateRenderTransactionJournalRevision,
    transactionDigest: journal.transactionDigest,
    state: nextState,
  };
  return { ...base, digest: journalDigest(base) };
}

function conflict(reason: string): PrivateRenderRecoveryDecision {
  return { action: "conflict", operations: [], reason };
}

export function decidePrivateRenderTransactionRecovery(
  transaction: PrivateRenderTransaction,
  journal: PrivateRenderTransactionJournal,
  observed: ObservedPrivateRenderTransactionState,
): PrivateRenderRecoveryDecision {
  validatePrivateRenderTransaction(transaction);
  validatePrivateRenderTransactionJournal(journal);
  if (journal.transactionDigest !== transaction.digest) {
    return conflict("The journal belongs to a different transaction.");
  }
  if (!isRecord(observed) || !isRecord(observed.files)) {
    return conflict("Observed transaction state is malformed.");
  }
  if (
    observed.lockDigest !== null &&
    (typeof observed.lockDigest !== "string" ||
      !sha256Pattern.test(observed.lockDigest))
  ) {
    return conflict("Observed state has an invalid lock digest.");
  }

  const observedByPath = new Map<string, string | null>();
  for (const operation of transaction.operations) {
    if (!Object.hasOwn(observed.files, operation.path)) {
      return conflict(`Observed state is missing ${operation.path}.`);
    }
    const digest = observed.files[operation.path];
    if (digest !== null && (typeof digest !== "string" || !sha256Pattern.test(digest))) {
      return conflict(`Observed state has an invalid digest at ${operation.path}.`);
    }
    if (digest !== operation.beforeDigest && digest !== operation.afterDigest) {
      return conflict(`Observed state is neither before nor after at ${operation.path}.`);
    }
    observedByPath.set(operation.path, digest ?? null);
  }

  if (journal.state === "rolled-back") {
    if (observed.lockDigest !== transaction.baseLockDigest) {
      return conflict("A rolled-back journal does not have the base lock.");
    }
    if (
      transaction.operations.some(
        (operation) => observedByPath.get(operation.path) !== operation.beforeDigest,
      )
    ) {
      return conflict("Rolled-back output no longer matches the transaction base.");
    }
    return {
      action: "complete",
      operations: [],
      reason: "The rolled-back transaction already matches its base state.",
    };
  }

  if (journal.state === "committed") {
    if (observed.lockDigest !== transaction.targetLockDigest) {
      return conflict("A committed journal does not have the target lock.");
    }
    if (
      transaction.operations.some(
        (operation) => observedByPath.get(operation.path) !== operation.afterDigest,
      )
    ) {
      return conflict("Committed output no longer matches the transaction target.");
    }
    return {
      action: "complete",
      operations: [],
      reason: "The committed transaction already matches its target state.",
    };
  }

  if (
    journal.state === "lock-written" &&
    observed.lockDigest !== transaction.targetLockDigest
  ) {
    return conflict("A lock-written journal does not have the target lock.");
  }

  const rollingForward = observed.lockDigest === transaction.targetLockDigest;
  const rollingBack = observed.lockDigest === transaction.baseLockDigest;
  if (!rollingForward && !rollingBack) {
    return conflict("Observed lock is neither the transaction base nor target.");
  }
  const target = rollingForward ? "afterDigest" : "beforeDigest";
  const operations = transaction.operations
    .filter(
      (operation) => observedByPath.get(operation.path) !== operation[target],
    )
    .map((operation) => ({
      path: operation.path,
      targetDigest: operation[target],
    }));

  if (rollingForward && operations.length === 0) {
    return {
      action: "complete",
      operations: [],
      reason: "The target lock and all target outputs are present.",
    };
  }
  return {
    action: rollingForward ? "roll-forward" : "rollback",
    operations,
    reason: rollingForward
      ? "The target lock is the commit anchor; complete target outputs."
      : "The base lock is the rollback anchor; restore observed preconditions.",
  };
}
