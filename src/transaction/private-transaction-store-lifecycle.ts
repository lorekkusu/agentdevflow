import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import {
  lstat,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import { PrivateFilesystemWorkspace } from "../workspace/private-filesystem-workspace.js";
import {
  PrivateFilesystemTransactionStore,
  type PrivateTransactionRetirement,
  type PrivateTransactionTerminalState,
} from "./private-transaction-store.js";

export const privateTransactionCleanupReceiptRevision = 1;
export const privateTransactionStoreParentRevision = 1;

export interface PrivateTransactionStoreParentRecord {
  readonly revision: number;
  readonly owner: "agentdevflow-private-transaction-store-lifecycle";
  readonly receiptRetention: "parent-lifetime";
  readonly digest: string;
}

export interface PrivateTransactionCleanupFile {
  readonly path: string;
  readonly contentDigest: string;
}

export interface PrivateTransactionCleanupReceipt {
  readonly revision: number;
  readonly storeName: string;
  readonly transactionDigest: string;
  readonly retirementDigest: string;
  readonly terminalState: PrivateTransactionTerminalState;
  readonly files: readonly PrivateTransactionCleanupFile[];
  readonly digest: string;
}

export type PrivateTransactionStoreLifecycleEvent =
  | { readonly kind: "store-tombstoned"; readonly transactionDigest: string }
  | { readonly kind: "receipt-written"; readonly transactionDigest: string }
  | { readonly kind: "tombstone-removed"; readonly transactionDigest: string };

export type PrivateTransactionStoreLifecycleFaultInjector = (
  event: PrivateTransactionStoreLifecycleEvent,
) => void | Promise<void>;

export interface CleanupPrivateTransactionStoreOptions {
  readonly storeName: string;
  readonly expectedTransactionDigest: string;
  readonly faultInjector?: PrivateTransactionStoreLifecycleFaultInjector;
}

export interface PrivateTransactionStoreCleanupResult {
  readonly status: "cleaned";
  readonly receipt: PrivateTransactionCleanupReceipt;
}

export interface PrivateTransactionStoreParentReceiptReference {
  readonly storeName: string;
  readonly transactionDigest: string;
  readonly receiptDigest: string;
}

export interface PrivateTransactionStoreParentDisposalSnapshot {
  readonly revision: number;
  readonly parentRecordDigest: string;
  readonly receipts: readonly PrivateTransactionStoreParentReceiptReference[];
  readonly digest: string;
}

export type PrivateTransactionStoreLifecycleErrorCode =
  | "PRIVATE_TRANSACTION_LIFECYCLE_UNSAFE_PATH"
  | "PRIVATE_TRANSACTION_LIFECYCLE_CONFLICT"
  | "PRIVATE_TRANSACTION_LIFECYCLE_WRITER_BUSY"
  | "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID"
  | "PRIVATE_TRANSACTION_LIFECYCLE_RECEIPT_INVALID"
  | "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_UNCLAIMED"
  | "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT"
  | "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_NOT_DISPOSABLE";

export class PrivateTransactionStoreLifecycleError extends Error {
  override readonly name = "PrivateTransactionStoreLifecycleError";

  constructor(
    readonly code: PrivateTransactionStoreLifecycleErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
  }
}

const sha256Pattern = /^[a-f0-9]{64}$/u;
const storeNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const parentRecordPath = ".agentdevflow-transaction-parent.json";
const parentOwner = "agentdevflow-private-transaction-store-lifecycle";
const parentReceiptRetention = "parent-lifetime";
const rootRecordNames = new Set([
  "journal.json",
  "manifest.json",
  "retirement.json",
  "temporary-intents.json",
  "transaction.json",
  "writer-clearances.json",
]);
const rootTemporaryPattern = /^\.(?:writer\.lock|transaction\.json|manifest\.json|journal\.json|retirement\.json|temporary-intents\.json|writer-clearances\.json)\.agentdevflow-\d+-\d+\.tmp$/u;
const blobTemporaryPattern = /^\.[a-f0-9]{64}\.agentdevflow-\d+-\d+\.tmp$/u;

function isAllowedStoreFilePath(path: string): boolean {
  if (rootRecordNames.has(path) || rootTemporaryPattern.test(path)) {
    return true;
  }
  if (!path.startsWith("blobs/")) {
    return false;
  }
  const name = path.slice("blobs/".length);
  return sha256Pattern.test(name) || blobTemporaryPattern.test(name);
}

function digest(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function parentRecordDigest(
  record: Omit<PrivateTransactionStoreParentRecord, "digest">,
): string {
  return digest(
    JSON.stringify({
      revision: record.revision,
      owner: record.owner,
      receiptRetention: record.receiptRetention,
    }),
  );
}

function createParentRecord(): PrivateTransactionStoreParentRecord {
  const recordWithoutDigest = {
    revision: privateTransactionStoreParentRevision,
    owner: parentOwner,
    receiptRetention: parentReceiptRetention,
  } as const;
  return Object.freeze({
    ...recordWithoutDigest,
    digest: parentRecordDigest(recordWithoutDigest),
  });
}

export function serializePrivateTransactionStoreParentRecord(
  record: PrivateTransactionStoreParentRecord,
): string {
  return `${JSON.stringify({
    revision: record.revision,
    owner: record.owner,
    receiptRetention: record.receiptRetention,
    digest: record.digest,
  })}\n`;
}

export function parsePrivateTransactionStoreParentRecord(
  content: string,
): PrivateTransactionStoreParentRecord {
  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
      "Private transaction store parent record is not valid JSON.",
      parentRecordPath,
    );
  }
  if (!isRecord(value)) {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
      "Private transaction store parent record must be an object.",
      parentRecordPath,
    );
  }
  const actualKeys = Object.keys(value).sort(compareText);
  const expectedKeys = ["digest", "owner", "receiptRetention", "revision"];
  const record: PrivateTransactionStoreParentRecord = {
    revision: value.revision as number,
    owner: value.owner as PrivateTransactionStoreParentRecord["owner"],
    receiptRetention:
      value.receiptRetention as PrivateTransactionStoreParentRecord["receiptRetention"],
    digest: value.digest as string,
  };
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    record.revision !== privateTransactionStoreParentRevision ||
    record.owner !== parentOwner ||
    record.receiptRetention !== parentReceiptRetention ||
    !sha256Pattern.test(record.digest) ||
    record.digest !==
      parentRecordDigest({
        revision: record.revision,
        owner: record.owner,
        receiptRetention: record.receiptRetention,
      }) ||
    content !== serializePrivateTransactionStoreParentRecord(record)
  ) {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
      "Private transaction store parent record is invalid or non-canonical.",
      parentRecordPath,
    );
  }
  return Object.freeze(record);
}

function parentDisposalSnapshotDigest(
  snapshot: Omit<PrivateTransactionStoreParentDisposalSnapshot, "digest">,
): string {
  return digest(
    JSON.stringify({
      revision: snapshot.revision,
      parentRecordDigest: snapshot.parentRecordDigest,
      receipts: snapshot.receipts,
    }),
  );
}

function isNodeErrorWithCode(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

function pathIsWithinRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function receiptDigest(
  receipt: Omit<PrivateTransactionCleanupReceipt, "digest">,
): string {
  return digest(
    JSON.stringify({
      revision: receipt.revision,
      storeName: receipt.storeName,
      transactionDigest: receipt.transactionDigest,
      retirementDigest: receipt.retirementDigest,
      terminalState: receipt.terminalState,
      files: receipt.files,
    }),
  );
}

function createReceipt(
  storeName: string,
  retirement: PrivateTransactionRetirement,
  files: readonly PrivateTransactionCleanupFile[],
): PrivateTransactionCleanupReceipt {
  const receiptWithoutDigest = {
    revision: privateTransactionCleanupReceiptRevision,
    storeName,
    transactionDigest: retirement.transactionDigest,
    retirementDigest: retirement.digest,
    terminalState: retirement.terminalState,
    files,
  } as const;
  return Object.freeze({
    ...receiptWithoutDigest,
    digest: receiptDigest(receiptWithoutDigest),
  });
}

export function serializePrivateTransactionCleanupReceipt(
  receipt: PrivateTransactionCleanupReceipt,
): string {
  return `${JSON.stringify({
    revision: receipt.revision,
    storeName: receipt.storeName,
    transactionDigest: receipt.transactionDigest,
    retirementDigest: receipt.retirementDigest,
    terminalState: receipt.terminalState,
    files: receipt.files.map((file) => ({
      path: file.path,
      contentDigest: file.contentDigest,
    })),
    digest: receipt.digest,
  })}\n`;
}

export function parsePrivateTransactionCleanupReceipt(
  content: string,
): PrivateTransactionCleanupReceipt {
  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_RECEIPT_INVALID",
      "Private transaction cleanup receipt is not valid JSON.",
    );
  }
  if (!isRecord(value)) {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_RECEIPT_INVALID",
      "Private transaction cleanup receipt must be an object.",
    );
  }
  const expectedKeys = [
    "digest",
    "files",
    "retirementDigest",
    "revision",
    "storeName",
    "terminalState",
    "transactionDigest",
  ];
  const actualKeys = Object.keys(value).sort(compareText);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index]) ||
    value.revision !== privateTransactionCleanupReceiptRevision ||
    typeof value.storeName !== "string" ||
    !storeNamePattern.test(value.storeName) ||
    typeof value.transactionDigest !== "string" ||
    !sha256Pattern.test(value.transactionDigest) ||
    typeof value.retirementDigest !== "string" ||
    !sha256Pattern.test(value.retirementDigest) ||
    (value.terminalState !== "committed" &&
      value.terminalState !== "rolled-back") ||
    typeof value.digest !== "string" ||
    !sha256Pattern.test(value.digest) ||
    !Array.isArray(value.files)
  ) {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_RECEIPT_INVALID",
      "Private transaction cleanup receipt is structurally invalid.",
    );
  }
  const files: PrivateTransactionCleanupFile[] = [];
  for (const fileValue of value.files) {
    if (!isRecord(fileValue)) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_RECEIPT_INVALID",
        "Private transaction cleanup receipt file must be an object.",
      );
    }
    const fileKeys = Object.keys(fileValue).sort(compareText);
    if (
      fileKeys.length !== 2 ||
      fileKeys[0] !== "contentDigest" ||
      fileKeys[1] !== "path" ||
      typeof fileValue.path !== "string" ||
      !isAllowedStoreFilePath(fileValue.path) ||
      typeof fileValue.contentDigest !== "string" ||
      !sha256Pattern.test(fileValue.contentDigest)
    ) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_RECEIPT_INVALID",
        "Private transaction cleanup receipt file is structurally invalid.",
      );
    }
    files.push({
      path: fileValue.path,
      contentDigest: fileValue.contentDigest,
    });
  }
  if (
    files.length === 0 ||
    files.some(
      (file, index) =>
        index > 0 && compareText(files[index - 1]?.path ?? "", file.path) >= 0,
    )
  ) {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_RECEIPT_INVALID",
      "Private transaction cleanup receipt files must be non-empty, unique, and sorted.",
    );
  }
  const receipt: PrivateTransactionCleanupReceipt = {
    revision: value.revision,
    storeName: value.storeName,
    transactionDigest: value.transactionDigest,
    retirementDigest: value.retirementDigest,
    terminalState: value.terminalState,
    files,
    digest: value.digest,
  };
  if (
    receipt.digest !== receiptDigest({
      revision: receipt.revision,
      storeName: receipt.storeName,
      transactionDigest: receipt.transactionDigest,
      retirementDigest: receipt.retirementDigest,
      terminalState: receipt.terminalState,
      files: receipt.files,
    }) ||
    content !== serializePrivateTransactionCleanupReceipt(receipt)
  ) {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_RECEIPT_INVALID",
      "Private transaction cleanup receipt is not canonical or has the wrong digest.",
    );
  }
  return Object.freeze({
    ...receipt,
    files: Object.freeze(
      receipt.files.map((file) => Object.freeze({ ...file })),
    ),
  });
}

async function inspectEntry(path: string): Promise<Stats | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, constants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function requireDirectory(path: string, displayedPath: string): Promise<void> {
  const entry = await inspectEntry(path);
  if (!entry?.isDirectory() || entry.isSymbolicLink()) {
    throw new PrivateTransactionStoreLifecycleError(
      "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
      `Private transaction lifecycle path is not a regular directory: ${displayedPath}`,
      displayedPath,
    );
  }
}

async function auditRetiredStoreTree(
  root: string,
  expectedFiles?: readonly PrivateTransactionCleanupFile[],
): Promise<readonly PrivateTransactionCleanupFile[]> {
  const observedFiles: PrivateTransactionCleanupFile[] = [];
  const recordFile = async (path: string, absolutePath: string): Promise<void> => {
    observedFiles.push({ path, contentDigest: digest(await readFile(absolutePath)) });
  };
  const rootEntries = await readdir(root, { withFileTypes: true });
  for (const entry of rootEntries) {
    const entryPath = join(root, entry.name);
    const stat = await lstat(entryPath);
    if (stat.isSymbolicLink()) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
        `Retired transaction store contains a symbolic link: ${entry.name}`,
        entry.name,
      );
    }
    if (entry.name === "blobs") {
      if (!stat.isDirectory()) {
        throw new PrivateTransactionStoreLifecycleError(
          "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
          "Retired transaction store blobs path is not a directory.",
          "blobs",
        );
      }
      continue;
    }
    if (entry.name === "writer.lock") {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_WRITER_BUSY",
        "Retired transaction store still has a writer record.",
        "writer.lock",
      );
    }
    if (
      !stat.isFile() ||
      (!rootRecordNames.has(entry.name) &&
        !rootTemporaryPattern.test(entry.name))
    ) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
        `Retired transaction store contains an unknown entry: ${entry.name}`,
        entry.name,
      );
    }
    await recordFile(entry.name, entryPath);
  }

  const blobsRoot = join(root, "blobs");
  const blobsEntry = await inspectEntry(blobsRoot);
  if (!blobsEntry) {
    if (!expectedFiles) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
        "Retired transaction store blobs directory is missing.",
        "blobs",
      );
    }
  } else {
    await requireDirectory(blobsRoot, "blobs");
  }
  if (blobsEntry) {
    for (const entry of await readdir(blobsRoot, { withFileTypes: true })) {
      const entryPath = join(blobsRoot, entry.name);
      const stat = await lstat(entryPath);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new PrivateTransactionStoreLifecycleError(
          "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
          `Retired transaction store blob entry is not a regular file: blobs/${entry.name}`,
          `blobs/${entry.name}`,
        );
      }
      if (sha256Pattern.test(entry.name)) {
        const content = await readFile(entryPath);
        if (digest(content) !== entry.name) {
          throw new PrivateTransactionStoreLifecycleError(
            "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
            `Retired transaction store orphan blob is corrupt: blobs/${entry.name}`,
            `blobs/${entry.name}`,
          );
        }
        observedFiles.push({
          path: `blobs/${entry.name}`,
          contentDigest: digest(content),
        });
      } else if (!blobTemporaryPattern.test(entry.name)) {
        throw new PrivateTransactionStoreLifecycleError(
          "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
          `Retired transaction store contains an unknown blob entry: blobs/${entry.name}`,
          `blobs/${entry.name}`,
        );
      } else {
        await recordFile(`blobs/${entry.name}`, entryPath);
      }
    }
  }
  observedFiles.sort((left, right) => compareText(left.path, right.path));
  if (expectedFiles) {
    const expectedByPath = new Map(
      expectedFiles.map((file) => [file.path, file.contentDigest]),
    );
    for (const observed of observedFiles) {
      if (expectedByPath.get(observed.path) !== observed.contentDigest) {
        throw new PrivateTransactionStoreLifecycleError(
          "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
          `Retired transaction tombstone content is not authorized by its receipt: ${observed.path}`,
          observed.path,
        );
      }
    }
  }
  return Object.freeze(observedFiles.map((file) => Object.freeze(file)));
}

async function emit(
  injector: PrivateTransactionStoreLifecycleFaultInjector | undefined,
  event: PrivateTransactionStoreLifecycleEvent,
): Promise<void> {
  await injector?.(event);
}

export class PrivateTransactionStoreLifecycle {
  private constructor(
    private readonly canonicalParent: string,
    private readonly workspace: PrivateFilesystemWorkspace,
    private readonly parentRecord: PrivateTransactionStoreParentRecord,
  ) {}

  static async initialize(
    parentRoot: string,
  ): Promise<PrivateTransactionStoreLifecycle> {
    const requested = resolve(parentRoot);
    await requireDirectory(requested, "transaction store parent");
    const canonicalParent = await realpath(requested);
    if ((await readdir(canonicalParent)).length !== 0) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
        "Private transaction store parent must be empty before initialization.",
      );
    }
    const workspace = await PrivateFilesystemWorkspace.open(canonicalParent);
    const parentRecord = createParentRecord();
    if (
      !(await workspace.createExclusively(
        parentRecordPath,
        serializePrivateTransactionStoreParentRecord(parentRecord),
      ))
    ) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
        "Private transaction store parent initialization conflicted.",
        parentRecordPath,
      );
    }
    const initializedEntries = await readdir(canonicalParent);
    if (
      initializedEntries.length !== 1 ||
      initializedEntries[0] !== parentRecordPath
    ) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
        "Private transaction store parent changed during initialization.",
      );
    }
    return new PrivateTransactionStoreLifecycle(
      canonicalParent,
      workspace,
      parentRecord,
    );
  }

  static async open(parentRoot: string): Promise<PrivateTransactionStoreLifecycle> {
    const requested = resolve(parentRoot);
    await requireDirectory(requested, "transaction store parent");
    const canonicalParent = await realpath(requested);
    await syncDirectory(canonicalParent);
    const workspace = await PrivateFilesystemWorkspace.open(canonicalParent);
    const parentRecordContent = await workspace.read(parentRecordPath);
    if (parentRecordContent === null) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_UNCLAIMED",
        "Private transaction store parent has no ownership record.",
        parentRecordPath,
      );
    }
    const parentRecord = parsePrivateTransactionStoreParentRecord(
      parentRecordContent,
    );
    return new PrivateTransactionStoreLifecycle(
      canonicalParent,
      workspace,
      parentRecord,
    );
  }

  private async verifyParentOwnership(): Promise<void> {
    const currentParentRecordContent = await this.workspace.read(parentRecordPath);
    if (currentParentRecordContent === null) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
        "Private transaction store parent ownership record is missing.",
        parentRecordPath,
      );
    }
    const currentParentRecord = parsePrivateTransactionStoreParentRecord(
      currentParentRecordContent,
    );
    if (currentParentRecord.digest !== this.parentRecord.digest) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_CONFLICT",
        "Private transaction store parent ownership changed.",
        parentRecordPath,
      );
    }
  }

  async prepareParentDisposal(): Promise<PrivateTransactionStoreParentDisposalSnapshot> {
    await this.verifyParentOwnership();
    const receiptReferences: PrivateTransactionStoreParentReceiptReference[] = [];
    for (const entry of await readdir(this.canonicalParent, {
      withFileTypes: true,
    })) {
      if (entry.name === parentRecordPath) {
        continue;
      }
      const entryPath = join(this.canonicalParent, entry.name);
      const stat = await lstat(entryPath);
      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new PrivateTransactionStoreLifecycleError(
          "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_NOT_DISPOSABLE",
          `Private transaction store parent still contains a non-receipt entry: ${entry.name}`,
          entry.name,
        );
      }
      let receipt: PrivateTransactionCleanupReceipt;
      try {
        receipt = parsePrivateTransactionCleanupReceipt(
          await readFile(entryPath, "utf8"),
        );
      } catch (error) {
        if (error instanceof PrivateTransactionStoreLifecycleError) {
          throw new PrivateTransactionStoreLifecycleError(
            "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_NOT_DISPOSABLE",
            `Private transaction store parent contains an invalid receipt candidate: ${entry.name}`,
            entry.name,
          );
        }
        throw error;
      }
      const expectedName = `.agentdevflow-retired-${receipt.storeName}-${receipt.transactionDigest}.json`;
      if (entry.name !== expectedName) {
        throw new PrivateTransactionStoreLifecycleError(
          "PRIVATE_TRANSACTION_LIFECYCLE_PARENT_NOT_DISPOSABLE",
          `Private transaction cleanup receipt has an unexpected parent path: ${entry.name}`,
          entry.name,
        );
      }
      receiptReferences.push({
        storeName: receipt.storeName,
        transactionDigest: receipt.transactionDigest,
        receiptDigest: receipt.digest,
      });
    }
    receiptReferences.sort((left, right) => {
      const storeOrder = compareText(left.storeName, right.storeName);
      return storeOrder === 0
        ? compareText(left.transactionDigest, right.transactionDigest)
        : storeOrder;
    });
    const snapshotWithoutDigest = {
      revision: privateTransactionStoreParentRevision,
      parentRecordDigest: this.parentRecord.digest,
      receipts: Object.freeze(
        receiptReferences.map((reference) => Object.freeze(reference)),
      ),
    } as const;
    return Object.freeze({
      ...snapshotWithoutDigest,
      digest: parentDisposalSnapshotDigest(snapshotWithoutDigest),
    });
  }

  private paths(storeName: string, transactionDigest: string): {
    readonly source: string;
    readonly tombstone: string;
    readonly tombstoneName: string;
    readonly receiptName: string;
  } {
    if (!storeNamePattern.test(storeName) || storeName === "." || storeName === "..") {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_UNSAFE_PATH",
        `Private transaction store name is unsafe: ${storeName}`,
        storeName,
      );
    }
    if (!sha256Pattern.test(transactionDigest)) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_UNSAFE_PATH",
        "Private transaction lifecycle requires a canonical transaction digest.",
      );
    }
    const tombstoneName = `.agentdevflow-retired-${storeName}-${transactionDigest}`;
    const receiptName = `${tombstoneName}.json`;
    const source = resolve(this.canonicalParent, storeName);
    const tombstone = resolve(this.canonicalParent, tombstoneName);
    if (
      !pathIsWithinRoot(this.canonicalParent, source) ||
      !pathIsWithinRoot(this.canonicalParent, tombstone)
    ) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_UNSAFE_PATH",
        "Private transaction lifecycle path escapes its parent.",
      );
    }
    return { source, tombstone, tombstoneName, receiptName };
  }

  private async verifyRetiredStore(
    root: string,
    expectedTransactionDigest: string,
  ): Promise<{
    readonly retirement: PrivateTransactionRetirement;
    readonly files: readonly PrivateTransactionCleanupFile[];
  }> {
    await requireDirectory(root, "retired transaction store");
    const store = await PrivateFilesystemTransactionStore.open(root);
    const retirement = await store.readRetirement();
    if (!retirement || retirement.transactionDigest !== expectedTransactionDigest) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
        "Retired transaction store does not match the expected transaction.",
      );
    }
    const recovery = await store.verifyPrepared();
    await store.readTemporaryIntentRegistry();
    await store.readWriterClearanceRegistry();
    if (
      recovery.transaction.digest !== retirement.transactionDigest ||
      recovery.manifest.digest !== retirement.manifestDigest ||
      recovery.journal.state !== retirement.terminalState
    ) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_STORE_INVALID",
        "Retired transaction store records do not match its retirement marker.",
      );
    }
    if ((await store.inspectWriterForRecovery()) !== null) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_WRITER_BUSY",
        "Retired transaction store still has an active or stale writer record.",
        "writer.lock",
      );
    }
    return {
      retirement,
      files: await auditRetiredStoreTree(root),
    };
  }

  async cleanup(
    options: CleanupPrivateTransactionStoreOptions,
  ): Promise<PrivateTransactionStoreCleanupResult> {
    await this.verifyParentOwnership();
    const paths = this.paths(options.storeName, options.expectedTransactionDigest);
    let source = await inspectEntry(paths.source);
    let tombstone = await inspectEntry(paths.tombstone);
    const existingReceiptContent = await this.workspace.read(paths.receiptName);
    const existingReceipt = existingReceiptContent === null
      ? null
      : parsePrivateTransactionCleanupReceipt(existingReceiptContent);

    if (source && tombstone) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_CONFLICT",
        "Private transaction store and tombstone both exist.",
      );
    }
    if (source && existingReceipt) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_CONFLICT",
        "Private transaction store exists after a cleanup receipt was published.",
      );
    }
    if (!source && !tombstone) {
      if (
        !existingReceipt ||
        existingReceipt.storeName !== options.storeName ||
        existingReceipt.transactionDigest !== options.expectedTransactionDigest
      ) {
        throw new PrivateTransactionStoreLifecycleError(
          "PRIVATE_TRANSACTION_LIFECYCLE_CONFLICT",
          "Private transaction cleanup has no store, tombstone, or matching receipt.",
        );
      }
      return { status: "cleaned", receipt: existingReceipt };
    }

    let retirement: PrivateTransactionRetirement | null = null;
    let authorizedFiles: readonly PrivateTransactionCleanupFile[];
    if (source) {
      const verified = await this.verifyRetiredStore(
        paths.source,
        options.expectedTransactionDigest,
      );
      retirement = verified.retirement;
      authorizedFiles = verified.files;
      await rename(paths.source, paths.tombstone);
      await syncDirectory(this.canonicalParent);
      source = null;
      tombstone = await inspectEntry(paths.tombstone);
      await emit(options.faultInjector, {
        kind: "store-tombstoned",
        transactionDigest: options.expectedTransactionDigest,
      });
    } else {
      if (existingReceipt) {
        if (
          existingReceipt.storeName !== options.storeName ||
          existingReceipt.transactionDigest !== options.expectedTransactionDigest
        ) {
          throw new PrivateTransactionStoreLifecycleError(
            "PRIVATE_TRANSACTION_LIFECYCLE_CONFLICT",
            "Existing cleanup receipt does not match the requested transaction.",
            paths.receiptName,
          );
        }
        authorizedFiles = existingReceipt.files;
        await auditRetiredStoreTree(paths.tombstone, authorizedFiles);
      } else {
        const verified = await this.verifyRetiredStore(
          paths.tombstone,
          options.expectedTransactionDigest,
        );
        retirement = verified.retirement;
        authorizedFiles = verified.files;
      }
    }
    if (!tombstone) {
      throw new PrivateTransactionStoreLifecycleError(
        "PRIVATE_TRANSACTION_LIFECYCLE_CONFLICT",
        "Private transaction tombstone disappeared before cleanup.",
      );
    }

    let receipt: PrivateTransactionCleanupReceipt;
    if (existingReceipt) {
      receipt = existingReceipt;
    } else {
      if (!retirement) {
        throw new PrivateTransactionStoreLifecycleError(
          "PRIVATE_TRANSACTION_LIFECYCLE_CONFLICT",
          "Private transaction cleanup cannot create a receipt without a verified retirement.",
        );
      }
      receipt = createReceipt(options.storeName, retirement, authorizedFiles);
      await this.workspace.writeAtomically(
        paths.receiptName,
        serializePrivateTransactionCleanupReceipt(receipt),
      );
      await emit(options.faultInjector, {
        kind: "receipt-written",
        transactionDigest: options.expectedTransactionDigest,
      });
    }

    await auditRetiredStoreTree(paths.tombstone, receipt.files);
    await rm(paths.tombstone, { recursive: true, force: false });
    await syncDirectory(this.canonicalParent);
    await emit(options.faultInjector, {
      kind: "tombstone-removed",
      transactionDigest: options.expectedTransactionDigest,
    });
    return { status: "cleaned", receipt };
  }
}
