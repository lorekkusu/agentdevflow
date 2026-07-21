import { createHash, randomUUID } from "node:crypto";

import {
  validatePrivateRenderLock,
  type PrivateRenderLock,
} from "../lock/private-render-lock.js";
import type { RenderPlan, RenderWorkspace } from "../renderer/contract.js";
import { validateRenderPlanIntegrity } from "../renderer/staged-adapter.js";
import { PrivateFilesystemWorkspace } from "../workspace/private-filesystem-workspace.js";
import {
  advancePrivateRenderTransactionJournal,
  createPrivateRenderTransactionJournal,
  validatePrivateRenderTransaction,
  validatePrivateRenderTransactionJournal,
  type PrivateRenderTransaction,
  type PrivateRenderTransactionJournal,
} from "./private-render-transaction.js";
import {
  createPrivateTemporaryIntentRegistry,
  createPrivateTemporaryMutationIntent,
  createPrivateWriterClearance,
  createPrivateWriterClearanceRegistry,
  parsePrivateTemporaryIntentRegistry,
  parsePrivateWriterClearanceRegistry,
  serializePrivateTemporaryIntentRegistry,
  serializePrivateWriterClearanceRegistry,
  type PrivateTemporaryIntentRegistry,
  type PrivateTemporaryMutationIntent,
  type PrivateWriterClearanceRegistry,
} from "../workspace/private-temporary-intent.js";

export const privateRenderRecoveryManifestRevision = 1;
export const privateTransactionRetirementRevision = 1;

export interface PrivateRenderRecoveryLockBlob {
  readonly lockDigest: string;
  readonly blobDigest: string;
}

export interface PrivateRenderRecoveryManifest {
  readonly revision: number;
  readonly transactionDigest: string;
  readonly baseLock: PrivateRenderRecoveryLockBlob | null;
  readonly targetLock: PrivateRenderRecoveryLockBlob;
  readonly requiredBlobs: readonly string[];
  readonly digest: string;
}

export type PrivateTransactionTerminalState = "committed" | "rolled-back";

export interface PrivateTransactionRetirement {
  readonly revision: number;
  readonly transactionDigest: string;
  readonly manifestDigest: string;
  readonly terminalState: PrivateTransactionTerminalState;
  readonly digest: string;
}

export interface PrivateTransactionWriterLease {
  readonly token: string;
}

export interface PrivateStaleWriterEvidence {
  readonly fingerprint: string;
}

export interface ClearPrivateStaleWriterOptions {
  readonly evidence: PrivateStaleWriterEvidence;
  readonly expectedTransactionDigest: string;
}

export interface PreparePrivateRenderRecoveryOptions {
  readonly store: PrivateFilesystemTransactionStore;
  readonly lease: PrivateTransactionWriterLease;
  readonly transaction: PrivateRenderTransaction;
  readonly baseLock: PrivateRenderLock | null;
  readonly targetLockIntent: PrivateRenderLock;
  readonly plan: RenderPlan;
  readonly workspace: RenderWorkspace;
}

export interface VerifiedPrivateRenderRecovery {
  readonly transaction: PrivateRenderTransaction;
  readonly manifest: PrivateRenderRecoveryManifest;
  readonly journal: PrivateRenderTransactionJournal;
  readonly baseLock: PrivateRenderLock | null;
  readonly targetLock: PrivateRenderLock;
}

export type PrivateTransactionStoreErrorCode =
  | "PRIVATE_TRANSACTION_WRITER_BUSY"
  | "PRIVATE_TRANSACTION_WRITER_LEASE_LOST"
  | "PRIVATE_TRANSACTION_STALE_WRITER_INVALID"
  | "PRIVATE_TRANSACTION_STALE_WRITER_EVIDENCE_MISMATCH"
  | "PRIVATE_TRANSACTION_STORE_RETIRED"
  | "PRIVATE_TRANSACTION_STORE_CONFLICT"
  | "PRIVATE_TRANSACTION_BLOB_MISSING"
  | "PRIVATE_TRANSACTION_BLOB_CORRUPT"
  | "PRIVATE_TRANSACTION_PRECONDITION_MISMATCH"
  | "PRIVATE_TRANSACTION_STORED_DATA_INVALID";

export class PrivateTransactionStoreError extends Error {
  override readonly name = "PrivateTransactionStoreError";

  constructor(
    readonly code: PrivateTransactionStoreErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
  }
}

const writerLockPath = "writer.lock";
const transactionPath = "transaction.json";
const manifestPath = "manifest.json";
const journalPath = "journal.json";
const retirementPath = "retirement.json";
const temporaryIntentRegistryPath = "temporary-intents.json";
const writerClearanceRegistryPath = "writer-clearances.json";
const sha256Pattern = /^[a-f0-9]{64}$/u;

function isCanonicalWriterRecord(content: string): boolean {
  return content.length === 65 &&
    content.endsWith("\n") &&
    sha256Pattern.test(content.slice(0, -1));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
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

function manifestDigest(
  manifest: Omit<PrivateRenderRecoveryManifest, "digest">,
): string {
  return digest(
    JSON.stringify({
      revision: manifest.revision,
      transactionDigest: manifest.transactionDigest,
      baseLock: manifest.baseLock,
      targetLock: manifest.targetLock,
      requiredBlobs: manifest.requiredBlobs,
    }),
  );
}

function retirementDigest(
  retirement: Omit<PrivateTransactionRetirement, "digest">,
): string {
  return digest(
    JSON.stringify({
      revision: retirement.revision,
      transactionDigest: retirement.transactionDigest,
      manifestDigest: retirement.manifestDigest,
      terminalState: retirement.terminalState,
    }),
  );
}

export function validatePrivateTransactionRetirement(
  value: unknown,
): asserts value is PrivateTransactionRetirement {
  const retirement = requireRecord(value, "Private transaction retirement");
  requireExactKeys(
    retirement,
    [
      "revision",
      "transactionDigest",
      "manifestDigest",
      "terminalState",
      "digest",
    ],
    "Private transaction retirement",
  );
  if (retirement.revision !== privateTransactionRetirementRevision) {
    throw new Error(
      `Unsupported private transaction retirement revision: ${String(retirement.revision)}.`,
    );
  }
  const transactionDigest = requireSha256(
    retirement.transactionDigest,
    "Private transaction retirement transaction digest",
  );
  const storedManifestDigest = requireSha256(
    retirement.manifestDigest,
    "Private transaction retirement manifest digest",
  );
  if (
    retirement.terminalState !== "committed" &&
    retirement.terminalState !== "rolled-back"
  ) {
    throw new Error("Private transaction retirement state must be terminal.");
  }
  requireSha256(retirement.digest, "Private transaction retirement digest");
  const expectedDigest = retirementDigest({
    revision: retirement.revision as number,
    transactionDigest,
    manifestDigest: storedManifestDigest,
    terminalState: retirement.terminalState,
  });
  if (retirement.digest !== expectedDigest) {
    throw new Error("Private transaction retirement digest does not match.");
  }
}

function parseLockBlob(
  value: unknown,
  description: string,
): PrivateRenderRecoveryLockBlob {
  const lock = requireRecord(value, description);
  requireExactKeys(lock, ["lockDigest", "blobDigest"], description);
  return {
    lockDigest: requireSha256(lock.lockDigest, `${description} lock digest`),
    blobDigest: requireSha256(lock.blobDigest, `${description} blob digest`),
  };
}

export function validatePrivateRenderRecoveryManifest(
  value: unknown,
): asserts value is PrivateRenderRecoveryManifest {
  const manifest = requireRecord(value, "Private render recovery manifest");
  requireExactKeys(
    manifest,
    [
      "revision",
      "transactionDigest",
      "baseLock",
      "targetLock",
      "requiredBlobs",
      "digest",
    ],
    "Private render recovery manifest",
  );
  if (manifest.revision !== privateRenderRecoveryManifestRevision) {
    throw new Error(
      `Unsupported private render recovery manifest revision: ${String(manifest.revision)}.`,
    );
  }
  const transactionDigest = requireSha256(
    manifest.transactionDigest,
    "Private render recovery transaction digest",
  );
  const baseLock =
    manifest.baseLock === null
      ? null
      : parseLockBlob(manifest.baseLock, "Private render recovery base lock");
  const targetLock = parseLockBlob(
    manifest.targetLock,
    "Private render recovery target lock",
  );
  if (!Array.isArray(manifest.requiredBlobs) || manifest.requiredBlobs.length === 0) {
    throw new Error("Private render recovery required blobs are empty.");
  }
  const requiredBlobs = manifest.requiredBlobs.map((blobDigest) =>
    requireSha256(blobDigest, "Private render recovery required blob digest"),
  );
  for (let index = 1; index < requiredBlobs.length; index += 1) {
    if (compareText(requiredBlobs[index - 1] ?? "", requiredBlobs[index] ?? "") >= 0) {
      throw new Error(
        "Private render recovery required blobs are not unique and sorted.",
      );
    }
  }
  requireSha256(manifest.digest, "Private render recovery manifest digest");
  const expectedDigest = manifestDigest({
    revision: manifest.revision as number,
    transactionDigest,
    baseLock,
    targetLock,
    requiredBlobs,
  });
  if (manifest.digest !== expectedDigest) {
    throw new Error("Private render recovery manifest digest does not match.");
  }
}

function serializeTransaction(transaction: PrivateRenderTransaction): string {
  return `${JSON.stringify({
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
    digest: transaction.digest,
  })}\n`;
}

function serializeManifest(manifest: PrivateRenderRecoveryManifest): string {
  return `${JSON.stringify({
    revision: manifest.revision,
    transactionDigest: manifest.transactionDigest,
    baseLock: manifest.baseLock,
    targetLock: manifest.targetLock,
    requiredBlobs: manifest.requiredBlobs,
    digest: manifest.digest,
  })}\n`;
}

function serializeJournal(journal: PrivateRenderTransactionJournal): string {
  return `${JSON.stringify({
    revision: journal.revision,
    transactionDigest: journal.transactionDigest,
    state: journal.state,
    digest: journal.digest,
  })}\n`;
}

export function serializePrivateTransactionRetirement(
  retirement: PrivateTransactionRetirement,
): string {
  return `${JSON.stringify({
    revision: retirement.revision,
    transactionDigest: retirement.transactionDigest,
    manifestDigest: retirement.manifestDigest,
    terminalState: retirement.terminalState,
    digest: retirement.digest,
  })}\n`;
}

export function serializePrivateRenderLockRecord(
  lock: PrivateRenderLock,
): string {
  return `${JSON.stringify({
    revision: lock.revision,
    compilerDigest: lock.compilerDigest,
    source: {
      revision: lock.source.revision,
      digest: lock.source.digest,
    },
    renderer: {
      name: lock.renderer.name,
      version: lock.renderer.version,
      ownershipKey: lock.renderer.ownershipKey,
      inputDigest: lock.renderer.inputDigest,
    },
    files: lock.files.map((file) => ({
      path: file.path,
      owner: file.owner,
      contentDigest: file.contentDigest,
      sourceRefs: file.sourceRefs,
    })),
    digest: lock.digest,
  })}\n`;
}

function parseJson(content: string, description: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      `${description} is not valid JSON.`,
    );
  }
}

function parseStoredTransaction(content: string): PrivateRenderTransaction {
  const value = parseJson(content, "Stored private render transaction");
  try {
    validatePrivateRenderTransaction(value);
  } catch (error) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      `Stored private render transaction is invalid: ${error instanceof Error ? error.message : String(error)}`,
      transactionPath,
    );
  }
  if (content !== serializeTransaction(value)) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      "Stored private render transaction is not canonical.",
      transactionPath,
    );
  }
  return value;
}

function parseStoredManifest(content: string): PrivateRenderRecoveryManifest {
  const value = parseJson(content, "Stored private render recovery manifest");
  try {
    validatePrivateRenderRecoveryManifest(value);
  } catch (error) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      `Stored private render recovery manifest is invalid: ${error instanceof Error ? error.message : String(error)}`,
      manifestPath,
    );
  }
  if (content !== serializeManifest(value)) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      "Stored private render recovery manifest is not canonical.",
      manifestPath,
    );
  }
  return value;
}

function parseStoredJournal(content: string): PrivateRenderTransactionJournal {
  const value = parseJson(content, "Stored private render transaction journal");
  try {
    validatePrivateRenderTransactionJournal(value);
  } catch (error) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      `Stored private render transaction journal is invalid: ${error instanceof Error ? error.message : String(error)}`,
      journalPath,
    );
  }
  if (content !== serializeJournal(value)) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      "Stored private render transaction journal is not canonical.",
      journalPath,
    );
  }
  return value;
}

function parseStoredRetirement(content: string): PrivateTransactionRetirement {
  const value = parseJson(content, "Stored private transaction retirement");
  try {
    validatePrivateTransactionRetirement(value);
  } catch (error) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      `Stored private transaction retirement is invalid: ${error instanceof Error ? error.message : String(error)}`,
      retirementPath,
    );
  }
  if (content !== serializePrivateTransactionRetirement(value)) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      "Stored private transaction retirement is not canonical.",
      retirementPath,
    );
  }
  return value;
}

export function parsePrivateRenderLockRecord(
  content: string,
  path: string,
): PrivateRenderLock {
  const value = parseJson(content, "Stored private render lock blob");
  try {
    validatePrivateRenderLock(value);
  } catch (error) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      `Stored private render lock blob is invalid: ${error instanceof Error ? error.message : String(error)}`,
      path,
    );
  }
  if (content !== serializePrivateRenderLockRecord(value)) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
      "Stored private render lock blob is not canonical.",
      path,
    );
  }
  return value;
}

function expectedRequiredBlobs(
  transaction: PrivateRenderTransaction,
  baseLock: PrivateRenderRecoveryLockBlob | null,
  targetLock: PrivateRenderRecoveryLockBlob,
): readonly string[] {
  return [
    ...transaction.operations.flatMap((operation) =>
      [operation.beforeDigest, operation.afterDigest].filter(
        (value): value is string => value !== null,
      ),
    ),
    ...(baseLock ? [baseLock.blobDigest] : []),
    targetLock.blobDigest,
  ].filter((value, index, values) => values.indexOf(value) === index)
    .sort(compareText);
}

function validateManifestAgainstTransaction(
  manifest: PrivateRenderRecoveryManifest,
  transaction: PrivateRenderTransaction,
): void {
  if (manifest.transactionDigest !== transaction.digest) {
    throw new Error("Recovery manifest belongs to a different transaction.");
  }
  if (manifest.baseLock?.lockDigest !== transaction.baseLockDigest) {
    throw new Error("Recovery manifest base lock does not match the transaction.");
  }
  if (manifest.targetLock.lockDigest !== transaction.targetLockDigest) {
    throw new Error("Recovery manifest target lock does not match the transaction.");
  }
  const expected = expectedRequiredBlobs(
    transaction,
    manifest.baseLock,
    manifest.targetLock,
  );
  if (
    expected.length !== manifest.requiredBlobs.length ||
    expected.some((blobDigest, index) => blobDigest !== manifest.requiredBlobs[index])
  ) {
    throw new Error("Recovery manifest required blobs do not match the transaction.");
  }
}

export class PrivateFilesystemTransactionStore {
  private constructor(private readonly workspace: PrivateFilesystemWorkspace) {}

  static async open(root: string): Promise<PrivateFilesystemTransactionStore> {
    return new PrivateFilesystemTransactionStore(
      await PrivateFilesystemWorkspace.open(root),
    );
  }

  async acquireWriter(): Promise<PrivateTransactionWriterLease> {
    if ((await this.readRetirement()) !== null) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORE_RETIRED",
        "Private transaction store is retired and cannot be reused.",
        retirementPath,
      );
    }
    const token = digest(randomUUID());
    if (!(await this.workspace.createExclusively(writerLockPath, `${token}\n`))) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_WRITER_BUSY",
        "Private transaction store already has an active writer.",
        writerLockPath,
      );
    }
    return Object.freeze({ token });
  }

  async verifyWriter(lease: PrivateTransactionWriterLease): Promise<void> {
    if ((await this.workspace.read(writerLockPath)) !== `${lease.token}\n`) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_WRITER_LEASE_LOST",
        "Private transaction writer lease is no longer active.",
        writerLockPath,
      );
    }
  }

  private async verifyMutableWriter(
    lease: PrivateTransactionWriterLease,
  ): Promise<void> {
    await this.verifyWriter(lease);
    if ((await this.readRetirement()) !== null) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORE_RETIRED",
        "Private transaction store is retired and cannot be mutated.",
        retirementPath,
      );
    }
  }

  async inspectWriterForRecovery(): Promise<PrivateStaleWriterEvidence | null> {
    const content = await this.workspace.read(writerLockPath);
    if (content === null) {
      return null;
    }
    if (!isCanonicalWriterRecord(content)) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STALE_WRITER_INVALID",
        "Private transaction writer record is not a canonical opaque token.",
        writerLockPath,
      );
    }
    return Object.freeze({ fingerprint: digest(content) });
  }

  /**
   * Clears one unchanged writer record after the caller has independently
   * confirmed that its owner process has terminated. This method cannot prove
   * process death and must never be used as automatic stale-writer takeover.
   */
  async clearStaleWriterForRecovery(
    options: ClearPrivateStaleWriterOptions,
  ): Promise<void> {
    if (
      !sha256Pattern.test(options.evidence.fingerprint) ||
      !sha256Pattern.test(options.expectedTransactionDigest)
    ) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STALE_WRITER_INVALID",
        "Stale-writer recovery requires canonical evidence and transaction digests.",
      );
    }
    const recovery = await this.verifyPrepared();
    if (recovery.transaction.digest !== options.expectedTransactionDigest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STALE_WRITER_EVIDENCE_MISMATCH",
        "Prepared transaction does not match the stale-writer recovery request.",
        transactionPath,
      );
    }
    const content = await this.workspace.read(writerLockPath);
    if (
      content === null ||
      !isCanonicalWriterRecord(content) ||
      digest(content) !== options.evidence.fingerprint
    ) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STALE_WRITER_EVIDENCE_MISMATCH",
        "Writer record changed after stale-writer evidence was captured.",
        writerLockPath,
      );
    }
    const existingClearances = await this.readWriterClearanceRegistry();
    if (
      existingClearances &&
      existingClearances.transactionDigest !== recovery.transaction.digest
    ) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        "Writer clearance registry belongs to another transaction.",
        writerClearanceRegistryPath,
      );
    }
    const clearance = createPrivateWriterClearance(
      recovery.transaction.digest,
      options.evidence.fingerprint,
    );
    const clearances = existingClearances?.clearances.some(
      (existing) => existing.writerFingerprint === clearance.writerFingerprint,
    )
      ? existingClearances.clearances
      : [...(existingClearances?.clearances ?? []), clearance];
    const clearanceRegistry = createPrivateWriterClearanceRegistry(
      recovery.transaction.digest,
      clearances,
    );
    await this.workspace.writeAtomically(
      writerClearanceRegistryPath,
      serializePrivateWriterClearanceRegistry(clearanceRegistry),
    );
    if (!(await this.workspace.removeIfContentMatches(writerLockPath, content))) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STALE_WRITER_EVIDENCE_MISMATCH",
        "Writer record could not be cleared from unchanged stale-writer evidence.",
        writerLockPath,
      );
    }
  }

  async releaseWriter(lease: PrivateTransactionWriterLease): Promise<void> {
    if (
      !(await this.workspace.removeIfContentMatches(
        writerLockPath,
        `${lease.token}\n`,
      ))
    ) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_WRITER_LEASE_LOST",
        "Private transaction writer lease could not be released safely.",
        writerLockPath,
      );
    }
  }

  private async writeInitialRecord(
    lease: PrivateTransactionWriterLease,
    path: string,
    content: string,
  ): Promise<void> {
    await this.verifyMutableWriter(lease);
    const existing = await this.workspace.read(path);
    if (existing === content) {
      return;
    }
    if (existing !== null) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORE_CONFLICT",
        `Private transaction store already contains different data at ${path}.`,
        path,
      );
    }
    await this.workspace.writeAtomically(path, content);
  }

  async putBlob(
    lease: PrivateTransactionWriterLease,
    content: string,
  ): Promise<string> {
    await this.verifyMutableWriter(lease);
    const blobDigest = digest(content);
    const path = `blobs/${blobDigest}`;
    const existing = await this.workspace.read(path);
    if (existing !== null && digest(existing) !== blobDigest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_BLOB_CORRUPT",
        `Private transaction blob does not match its digest: ${blobDigest}`,
        path,
      );
    }
    if (existing === null) {
      await this.workspace.writeAtomically(path, content);
    }
    return blobDigest;
  }

  async readBlob(blobDigest: string): Promise<string> {
    requireSha256(blobDigest, "Private transaction blob digest");
    const path = `blobs/${blobDigest}`;
    const content = await this.workspace.read(path);
    if (content === null) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_BLOB_MISSING",
        `Private transaction blob is missing: ${blobDigest}`,
        path,
      );
    }
    if (digest(content) !== blobDigest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_BLOB_CORRUPT",
        `Private transaction blob does not match its digest: ${blobDigest}`,
        path,
      );
    }
    return content;
  }

  async writeTransaction(
    lease: PrivateTransactionWriterLease,
    transaction: PrivateRenderTransaction,
  ): Promise<void> {
    validatePrivateRenderTransaction(transaction);
    await this.writeInitialRecord(
      lease,
      transactionPath,
      serializeTransaction(transaction),
    );
  }

  async writeManifest(
    lease: PrivateTransactionWriterLease,
    manifest: PrivateRenderRecoveryManifest,
  ): Promise<void> {
    validatePrivateRenderRecoveryManifest(manifest);
    await this.writeInitialRecord(lease, manifestPath, serializeManifest(manifest));
  }

  async writeJournal(
    lease: PrivateTransactionWriterLease,
    journal: PrivateRenderTransactionJournal,
  ): Promise<void> {
    validatePrivateRenderTransactionJournal(journal);
    await this.verifyMutableWriter(lease);
    const existingContent = await this.workspace.read(journalPath);
    if (existingContent === null) {
      if (journal.state !== "prepared") {
        throw new PrivateTransactionStoreError(
          "PRIVATE_TRANSACTION_STORE_CONFLICT",
          "The first persisted transaction journal state must be prepared.",
          journalPath,
        );
      }
    } else {
      const existing = parseStoredJournal(existingContent);
      if (serializeJournal(existing) === serializeJournal(journal)) {
        return;
      }
      let expected: PrivateRenderTransactionJournal;
      try {
        expected = advancePrivateRenderTransactionJournal(existing, journal.state);
      } catch {
        throw new PrivateTransactionStoreError(
          "PRIVATE_TRANSACTION_STORE_CONFLICT",
          `Invalid stored journal transition: ${existing.state} -> ${journal.state}.`,
          journalPath,
        );
      }
      if (serializeJournal(expected) !== serializeJournal(journal)) {
        throw new PrivateTransactionStoreError(
          "PRIVATE_TRANSACTION_STORE_CONFLICT",
          "Stored journal transition does not match the transaction.",
          journalPath,
        );
      }
    }
    const records = await this.verifyRecoveryRecords();
    if (records.transaction.digest !== journal.transactionDigest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORE_CONFLICT",
        "Stored recovery records belong to a different journal transaction.",
        journalPath,
      );
    }
    await this.workspace.writeAtomically(journalPath, serializeJournal(journal));
  }

  async readTransaction(): Promise<PrivateRenderTransaction | null> {
    const content = await this.workspace.read(transactionPath);
    return content === null ? null : parseStoredTransaction(content);
  }

  async readManifest(): Promise<PrivateRenderRecoveryManifest | null> {
    const content = await this.workspace.read(manifestPath);
    return content === null ? null : parseStoredManifest(content);
  }

  async readJournal(): Promise<PrivateRenderTransactionJournal | null> {
    const content = await this.workspace.read(journalPath);
    return content === null ? null : parseStoredJournal(content);
  }

  async readRetirement(): Promise<PrivateTransactionRetirement | null> {
    const content = await this.workspace.read(retirementPath);
    return content === null ? null : parseStoredRetirement(content);
  }

  async readTemporaryIntentRegistry(): Promise<PrivateTemporaryIntentRegistry | null> {
    const content = await this.workspace.read(temporaryIntentRegistryPath);
    if (content === null) {
      return null;
    }
    try {
      return parsePrivateTemporaryIntentRegistry(content);
    } catch (error) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        `Stored private temporary intent registry is invalid: ${error instanceof Error ? error.message : String(error)}`,
        temporaryIntentRegistryPath,
      );
    }
  }

  async readWriterClearanceRegistry(): Promise<PrivateWriterClearanceRegistry | null> {
    const content = await this.workspace.read(writerClearanceRegistryPath);
    if (content === null) {
      return null;
    }
    try {
      return parsePrivateWriterClearanceRegistry(content);
    } catch (error) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        `Stored private writer clearance registry is invalid: ${error instanceof Error ? error.message : String(error)}`,
        writerClearanceRegistryPath,
      );
    }
  }

  async registerTemporaryIntent(
    lease: PrivateTransactionWriterLease,
    options: {
      readonly transactionDigest: string;
      readonly targetPath: string;
      readonly targetDigest: string;
    },
  ): Promise<PrivateTemporaryMutationIntent> {
    await this.verifyMutableWriter(lease);
    const recovery = await this.verifyPrepared();
    if (recovery.transaction.digest !== options.transactionDigest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORE_CONFLICT",
        "Temporary mutation intent belongs to another transaction.",
        temporaryIntentRegistryPath,
      );
    }
    const intent = createPrivateTemporaryMutationIntent({
      transactionDigest: options.transactionDigest,
      writerFingerprint: digest(`${lease.token}\n`),
      targetPath: options.targetPath,
      targetDigest: options.targetDigest,
    });
    const existing = await this.readTemporaryIntentRegistry();
    if (existing && existing.transactionDigest !== recovery.transaction.digest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        "Temporary intent registry belongs to another transaction.",
        temporaryIntentRegistryPath,
      );
    }
    if (existing?.intents.some((candidate) => candidate.digest === intent.digest)) {
      return intent;
    }
    const registry = createPrivateTemporaryIntentRegistry(
      recovery.transaction.digest,
      [...(existing?.intents ?? []), intent],
    );
    await this.workspace.writeAtomically(
      temporaryIntentRegistryPath,
      serializePrivateTemporaryIntentRegistry(registry),
    );
    return intent;
  }

  async readReclaimableTemporaryIntents(
    expectedTransactionDigest: string,
  ): Promise<readonly PrivateTemporaryMutationIntent[]> {
    const intents = await this.readTemporaryIntentRegistry();
    if (!intents) {
      return [];
    }
    if (intents.transactionDigest !== expectedTransactionDigest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        "Temporary intent registry does not match the prepared transaction.",
        temporaryIntentRegistryPath,
      );
    }
    const clearances = await this.readWriterClearanceRegistry();
    if (!clearances) {
      return [];
    }
    if (
      intents.transactionDigest !== clearances.transactionDigest ||
      clearances.transactionDigest !== expectedTransactionDigest
    ) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        "Temporary ownership registries do not match the prepared transaction.",
      );
    }
    const cleared = new Set(
      clearances.clearances.map((clearance) => clearance.writerFingerprint),
    );
    return Object.freeze(
      intents.intents.filter((intent) => cleared.has(intent.writerFingerprint)),
    );
  }

  async writeRetirement(
    lease: PrivateTransactionWriterLease,
  ): Promise<PrivateTransactionRetirement> {
    await this.verifyWriter(lease);
    const recovery = await this.verifyPrepared();
    if (
      recovery.journal.state !== "committed" &&
      recovery.journal.state !== "rolled-back"
    ) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORE_CONFLICT",
        `Private transaction store cannot retire from journal state ${recovery.journal.state}.`,
        journalPath,
      );
    }
    const retirementWithoutDigest = {
      revision: privateTransactionRetirementRevision,
      transactionDigest: recovery.transaction.digest,
      manifestDigest: recovery.manifest.digest,
      terminalState: recovery.journal.state,
    } as const;
    const retirement = Object.freeze({
      ...retirementWithoutDigest,
      digest: retirementDigest(retirementWithoutDigest),
    });
    const content = serializePrivateTransactionRetirement(retirement);
    const existing = await this.workspace.read(retirementPath);
    if (existing !== null && existing !== content) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORE_CONFLICT",
        "Private transaction store contains a different retirement record.",
        retirementPath,
      );
    }
    if (existing === null) {
      await this.workspace.writeAtomically(retirementPath, content);
    }
    return retirement;
  }

  private async verifyRecoveryRecords(): Promise<{
    readonly transaction: PrivateRenderTransaction;
    readonly manifest: PrivateRenderRecoveryManifest;
    readonly baseLock: PrivateRenderLock | null;
    readonly targetLock: PrivateRenderLock;
  }> {
    const transaction = await this.readTransaction();
    const manifest = await this.readManifest();
    if (!transaction || !manifest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        "Private transaction recovery records are incomplete.",
      );
    }
    try {
      validateManifestAgainstTransaction(manifest, transaction);
    } catch (error) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        error instanceof Error ? error.message : String(error),
        manifestPath,
      );
    }
    for (const blobDigest of manifest.requiredBlobs) {
      await this.readBlob(blobDigest);
    }

    let baseLock: PrivateRenderLock | null = null;
    if (manifest.baseLock) {
      const path = `blobs/${manifest.baseLock.blobDigest}`;
      baseLock = parsePrivateRenderLockRecord(
        await this.readBlob(manifest.baseLock.blobDigest),
        path,
      );
      if (baseLock.digest !== manifest.baseLock.lockDigest) {
        throw new PrivateTransactionStoreError(
          "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
          "Stored base lock blob has the wrong lock digest.",
          path,
        );
      }
    }
    const targetPath = `blobs/${manifest.targetLock.blobDigest}`;
    const targetLock = parsePrivateRenderLockRecord(
      await this.readBlob(manifest.targetLock.blobDigest),
      targetPath,
    );
    if (targetLock.digest !== manifest.targetLock.lockDigest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        "Stored target lock blob has the wrong lock digest.",
        targetPath,
      );
    }
    return { transaction, manifest, baseLock, targetLock };
  }

  async verifyPrepared(): Promise<VerifiedPrivateRenderRecovery> {
    const records = await this.verifyRecoveryRecords();
    const journal = await this.readJournal();
    if (!journal) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        "Private transaction store has no prepared journal.",
        journalPath,
      );
    }
    if (journal.transactionDigest !== records.transaction.digest) {
      throw new PrivateTransactionStoreError(
        "PRIVATE_TRANSACTION_STORED_DATA_INVALID",
        "Stored journal belongs to a different transaction.",
        journalPath,
      );
    }
    return { ...records, journal };
  }
}

function assertContentDigest(
  path: string,
  side: "before" | "after",
  content: string | null,
  expectedDigest: string | null,
): void {
  const actualDigest = content === null ? null : digest(content);
  if (actualDigest !== expectedDigest) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_PRECONDITION_MISMATCH",
      `Private transaction ${side} content does not match at ${path}.`,
      path,
    );
  }
}

export async function preparePrivateRenderRecovery(
  options: PreparePrivateRenderRecoveryOptions,
): Promise<PrivateRenderRecoveryManifest> {
  const {
    store,
    lease,
    transaction,
    baseLock,
    targetLockIntent,
    plan,
    workspace,
  } = options;
  validatePrivateRenderTransaction(transaction);
  validatePrivateRenderLock(targetLockIntent);
  validateRenderPlanIntegrity(plan);
  if (baseLock) {
    validatePrivateRenderLock(baseLock);
  }
  if (
    transaction.planDigest !== plan.planDigest ||
    transaction.baseLockDigest !== (baseLock?.digest ?? null) ||
    transaction.targetLockDigest !== targetLockIntent.digest
  ) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_PRECONDITION_MISMATCH",
      "Transaction, plan, and lock inputs do not match.",
    );
  }

  const plannedByPath = new Map(plan.files.map((file) => [file.path, file]));
  const operationPaths = transaction.operations.map((operation) => operation.path);
  if (
    plannedByPath.size !== operationPaths.length ||
    operationPaths.some((path) => !plannedByPath.has(path))
  ) {
    throw new PrivateTransactionStoreError(
      "PRIVATE_TRANSACTION_PRECONDITION_MISMATCH",
      "Transaction operations do not match the render plan.",
    );
  }

  const requiredBlobs = new Set<string>();
  for (const operation of transaction.operations) {
    const planned = plannedByPath.get(operation.path);
    if (!planned) {
      throw new Error(`Missing planned file for ${operation.path}.`);
    }
    const beforeContent = await workspace.read(operation.path);
    assertContentDigest(
      operation.path,
      "before",
      beforeContent,
      operation.beforeDigest,
    );
    assertContentDigest(
      operation.path,
      "after",
      planned.expectedContent,
      operation.afterDigest,
    );
    if (beforeContent !== null) {
      requiredBlobs.add(await store.putBlob(lease, beforeContent));
    }
    if (planned.expectedContent !== null) {
      requiredBlobs.add(await store.putBlob(lease, planned.expectedContent));
    }
  }

  let baseLockBlob: PrivateRenderRecoveryLockBlob | null = null;
  if (baseLock) {
    baseLockBlob = {
      lockDigest: baseLock.digest,
      blobDigest: await store.putBlob(
        lease,
        serializePrivateRenderLockRecord(baseLock),
      ),
    };
    requiredBlobs.add(baseLockBlob.blobDigest);
  }
  const targetLockBlob: PrivateRenderRecoveryLockBlob = {
    lockDigest: targetLockIntent.digest,
    blobDigest: await store.putBlob(
      lease,
      serializePrivateRenderLockRecord(targetLockIntent),
    ),
  };
  requiredBlobs.add(targetLockBlob.blobDigest);

  const manifestBase = {
    revision: privateRenderRecoveryManifestRevision,
    transactionDigest: transaction.digest,
    baseLock: baseLockBlob,
    targetLock: targetLockBlob,
    requiredBlobs: [...requiredBlobs].sort(compareText),
  } satisfies Omit<PrivateRenderRecoveryManifest, "digest">;
  const manifest: PrivateRenderRecoveryManifest = {
    ...manifestBase,
    digest: manifestDigest(manifestBase),
  };
  validatePrivateRenderRecoveryManifest(manifest);
  validateManifestAgainstTransaction(manifest, transaction);

  await store.writeTransaction(lease, transaction);
  await store.writeManifest(lease, manifest);
  await store.writeJournal(
    lease,
    createPrivateRenderTransactionJournal(transaction),
  );
  await store.verifyPrepared();
  return manifest;
}
