import { createHash } from "node:crypto";
import { posix } from "node:path";

export const privateTemporaryIntentRegistryRevision = 1;
export const privateWriterClearanceRegistryRevision = 1;

export interface PrivateTemporaryMutationIntent {
  readonly revision: number;
  readonly transactionDigest: string;
  readonly writerFingerprint: string;
  readonly targetPath: string;
  readonly temporaryPath: string;
  readonly targetDigest: string;
  readonly digest: string;
}

export interface PrivateTemporaryIntentRegistry {
  readonly revision: number;
  readonly transactionDigest: string;
  readonly intents: readonly PrivateTemporaryMutationIntent[];
  readonly digest: string;
}

export interface PrivateWriterClearance {
  readonly writerFingerprint: string;
  readonly transactionDigest: string;
  readonly digest: string;
}

export interface PrivateWriterClearanceRegistry {
  readonly revision: number;
  readonly transactionDigest: string;
  readonly clearances: readonly PrivateWriterClearance[];
  readonly digest: string;
}

const sha256Pattern = /^[a-f0-9]{64}$/u;

function digestValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, description: string): Record<string, unknown> {
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

function requireSafePath(value: unknown, description: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    value.includes("\\") ||
    value === "." ||
    value === ".." ||
    value.startsWith("../") ||
    posix.isAbsolute(value) ||
    posix.normalize(value) !== value
  ) {
    throw new Error(`${description} is unsafe.`);
  }
  return value;
}

function temporaryPathFor(
  transactionDigest: string,
  writerFingerprint: string,
  targetPath: string,
  targetDigest: string,
): string {
  const key = digestValue({
    revision: 1,
    transactionDigest,
    writerFingerprint,
    targetPath,
    targetDigest,
  });
  const parent = posix.dirname(targetPath);
  const name = `.${posix.basename(targetPath)}.agentdevflow-${key}.tmp`;
  return parent === "." ? name : `${parent}/${name}`;
}

function intentDigest(
  intent: Omit<PrivateTemporaryMutationIntent, "digest">,
): string {
  return digestValue({
    revision: intent.revision,
    transactionDigest: intent.transactionDigest,
    writerFingerprint: intent.writerFingerprint,
    targetPath: intent.targetPath,
    temporaryPath: intent.temporaryPath,
    targetDigest: intent.targetDigest,
  });
}

function registryDigest(
  registry: Omit<PrivateTemporaryIntentRegistry, "digest">,
): string {
  return digestValue({
    revision: registry.revision,
    transactionDigest: registry.transactionDigest,
    intents: registry.intents,
  });
}

function clearanceDigest(
  clearance: Omit<PrivateWriterClearance, "digest">,
): string {
  return digestValue({
    writerFingerprint: clearance.writerFingerprint,
    transactionDigest: clearance.transactionDigest,
  });
}

function clearanceRegistryDigest(
  registry: Omit<PrivateWriterClearanceRegistry, "digest">,
): string {
  return digestValue({
    revision: registry.revision,
    transactionDigest: registry.transactionDigest,
    clearances: registry.clearances,
  });
}

export function createPrivateTemporaryMutationIntent(options: {
  readonly transactionDigest: string;
  readonly writerFingerprint: string;
  readonly targetPath: string;
  readonly targetDigest: string;
}): PrivateTemporaryMutationIntent {
  const transactionDigest = requireSha256(
    options.transactionDigest,
    "Private temporary intent transaction digest",
  );
  const writerFingerprint = requireSha256(
    options.writerFingerprint,
    "Private temporary intent writer fingerprint",
  );
  const targetPath = requireSafePath(
    options.targetPath,
    "Private temporary intent target path",
  );
  const targetDigest = requireSha256(
    options.targetDigest,
    "Private temporary intent target digest",
  );
  const intentWithoutDigest = {
    revision: privateTemporaryIntentRegistryRevision,
    transactionDigest,
    writerFingerprint,
    targetPath,
    temporaryPath: temporaryPathFor(
      transactionDigest,
      writerFingerprint,
      targetPath,
      targetDigest,
    ),
    targetDigest,
  } as const;
  return Object.freeze({
    ...intentWithoutDigest,
    digest: intentDigest(intentWithoutDigest),
  });
}

export function validatePrivateTemporaryMutationIntent(
  value: unknown,
): asserts value is PrivateTemporaryMutationIntent {
  const intent = requireRecord(value, "Private temporary mutation intent");
  requireExactKeys(
    intent,
    [
      "revision",
      "transactionDigest",
      "writerFingerprint",
      "targetPath",
      "temporaryPath",
      "targetDigest",
      "digest",
    ],
    "Private temporary mutation intent",
  );
  if (intent.revision !== privateTemporaryIntentRegistryRevision) {
    throw new Error("Unsupported private temporary mutation intent revision.");
  }
  const transactionDigest = requireSha256(
    intent.transactionDigest,
    "Private temporary intent transaction digest",
  );
  const writerFingerprint = requireSha256(
    intent.writerFingerprint,
    "Private temporary intent writer fingerprint",
  );
  const targetPath = requireSafePath(
    intent.targetPath,
    "Private temporary intent target path",
  );
  const temporaryPath = requireSafePath(
    intent.temporaryPath,
    "Private temporary intent path",
  );
  const targetDigest = requireSha256(
    intent.targetDigest,
    "Private temporary intent target digest",
  );
  requireSha256(intent.digest, "Private temporary intent digest");
  const expectedTemporaryPath = temporaryPathFor(
    transactionDigest,
    writerFingerprint,
    targetPath,
    targetDigest,
  );
  if (temporaryPath !== expectedTemporaryPath) {
    throw new Error("Private temporary intent path does not match its inputs.");
  }
  const expectedDigest = intentDigest({
    revision: intent.revision as number,
    transactionDigest,
    writerFingerprint,
    targetPath,
    temporaryPath,
    targetDigest,
  });
  if (intent.digest !== expectedDigest) {
    throw new Error("Private temporary intent digest does not match.");
  }
}

export function createPrivateTemporaryIntentRegistry(
  transactionDigest: string,
  intents: readonly PrivateTemporaryMutationIntent[],
): PrivateTemporaryIntentRegistry {
  requireSha256(transactionDigest, "Private temporary intent registry transaction digest");
  const sorted = [...intents].sort((left, right) => compareText(left.digest, right.digest));
  for (const [index, intent] of sorted.entries()) {
    validatePrivateTemporaryMutationIntent(intent);
    if (intent.transactionDigest !== transactionDigest) {
      throw new Error("Private temporary intent belongs to another transaction.");
    }
    if (index > 0 && sorted[index - 1]?.digest === intent.digest) {
      throw new Error("Private temporary intent registry contains a duplicate intent.");
    }
  }
  const registryWithoutDigest = {
    revision: privateTemporaryIntentRegistryRevision,
    transactionDigest,
    intents: Object.freeze(sorted),
  } as const;
  return Object.freeze({
    ...registryWithoutDigest,
    digest: registryDigest(registryWithoutDigest),
  });
}

export function validatePrivateTemporaryIntentRegistry(
  value: unknown,
): asserts value is PrivateTemporaryIntentRegistry {
  const registry = requireRecord(value, "Private temporary intent registry");
  requireExactKeys(
    registry,
    ["revision", "transactionDigest", "intents", "digest"],
    "Private temporary intent registry",
  );
  if (registry.revision !== privateTemporaryIntentRegistryRevision) {
    throw new Error("Unsupported private temporary intent registry revision.");
  }
  const transactionDigest = requireSha256(
    registry.transactionDigest,
    "Private temporary intent registry transaction digest",
  );
  if (!Array.isArray(registry.intents)) {
    throw new Error("Private temporary intent registry intents must be an array.");
  }
  const normalized = createPrivateTemporaryIntentRegistry(
    transactionDigest,
    registry.intents,
  );
  requireSha256(registry.digest, "Private temporary intent registry digest");
  if (
    registry.intents.some(
      (intent, index) =>
        (intent as PrivateTemporaryMutationIntent).digest !==
        normalized.intents[index]?.digest,
    ) ||
    registry.digest !== normalized.digest
  ) {
    throw new Error("Private temporary intent registry is not canonical.");
  }
}

export function serializePrivateTemporaryIntentRegistry(
  registry: PrivateTemporaryIntentRegistry,
): string {
  return `${JSON.stringify({
    revision: registry.revision,
    transactionDigest: registry.transactionDigest,
    intents: registry.intents.map((intent) => ({
      revision: intent.revision,
      transactionDigest: intent.transactionDigest,
      writerFingerprint: intent.writerFingerprint,
      targetPath: intent.targetPath,
      temporaryPath: intent.temporaryPath,
      targetDigest: intent.targetDigest,
      digest: intent.digest,
    })),
    digest: registry.digest,
  })}\n`;
}

export function parsePrivateTemporaryIntentRegistry(
  content: string,
): PrivateTemporaryIntentRegistry {
  const value = JSON.parse(content) as unknown;
  validatePrivateTemporaryIntentRegistry(value);
  if (content !== serializePrivateTemporaryIntentRegistry(value)) {
    throw new Error("Stored private temporary intent registry is not canonical.");
  }
  return value;
}

export function createPrivateWriterClearance(
  transactionDigest: string,
  writerFingerprint: string,
): PrivateWriterClearance {
  const clearanceWithoutDigest = {
    writerFingerprint: requireSha256(
      writerFingerprint,
      "Private writer clearance fingerprint",
    ),
    transactionDigest: requireSha256(
      transactionDigest,
      "Private writer clearance transaction digest",
    ),
  } as const;
  return Object.freeze({
    ...clearanceWithoutDigest,
    digest: clearanceDigest(clearanceWithoutDigest),
  });
}

export function createPrivateWriterClearanceRegistry(
  transactionDigest: string,
  clearances: readonly PrivateWriterClearance[],
): PrivateWriterClearanceRegistry {
  requireSha256(transactionDigest, "Private writer clearance registry transaction digest");
  const sorted = [...clearances].sort((left, right) =>
    compareText(left.writerFingerprint, right.writerFingerprint));
  for (const [index, clearance] of sorted.entries()) {
    const expected = createPrivateWriterClearance(
      clearance.transactionDigest,
      clearance.writerFingerprint,
    );
    if (
      clearance.transactionDigest !== transactionDigest ||
      clearance.digest !== expected.digest
    ) {
      throw new Error("Private writer clearance is invalid or belongs to another transaction.");
    }
    if (
      index > 0 &&
      sorted[index - 1]?.writerFingerprint === clearance.writerFingerprint
    ) {
      throw new Error("Private writer clearance registry contains a duplicate.");
    }
  }
  const registryWithoutDigest = {
    revision: privateWriterClearanceRegistryRevision,
    transactionDigest,
    clearances: Object.freeze(sorted),
  } as const;
  return Object.freeze({
    ...registryWithoutDigest,
    digest: clearanceRegistryDigest(registryWithoutDigest),
  });
}

export function validatePrivateWriterClearanceRegistry(
  value: unknown,
): asserts value is PrivateWriterClearanceRegistry {
  const registry = requireRecord(value, "Private writer clearance registry");
  requireExactKeys(
    registry,
    ["revision", "transactionDigest", "clearances", "digest"],
    "Private writer clearance registry",
  );
  if (registry.revision !== privateWriterClearanceRegistryRevision) {
    throw new Error("Unsupported private writer clearance registry revision.");
  }
  const transactionDigest = requireSha256(
    registry.transactionDigest,
    "Private writer clearance registry transaction digest",
  );
  if (!Array.isArray(registry.clearances)) {
    throw new Error("Private writer clearance registry clearances must be an array.");
  }
  const normalized = createPrivateWriterClearanceRegistry(
    transactionDigest,
    registry.clearances as PrivateWriterClearance[],
  );
  requireSha256(registry.digest, "Private writer clearance registry digest");
  if (
    registry.clearances.some(
      (clearance, index) =>
        (clearance as PrivateWriterClearance).digest !==
        normalized.clearances[index]?.digest,
    ) ||
    registry.digest !== normalized.digest
  ) {
    throw new Error("Private writer clearance registry is not canonical.");
  }
}

export function serializePrivateWriterClearanceRegistry(
  registry: PrivateWriterClearanceRegistry,
): string {
  return `${JSON.stringify({
    revision: registry.revision,
    transactionDigest: registry.transactionDigest,
    clearances: registry.clearances.map((clearance) => ({
      writerFingerprint: clearance.writerFingerprint,
      transactionDigest: clearance.transactionDigest,
      digest: clearance.digest,
    })),
    digest: registry.digest,
  })}\n`;
}

export function parsePrivateWriterClearanceRegistry(
  content: string,
): PrivateWriterClearanceRegistry {
  const value = JSON.parse(content) as unknown;
  validatePrivateWriterClearanceRegistry(value);
  if (content !== serializePrivateWriterClearanceRegistry(value)) {
    throw new Error("Stored private writer clearance registry is not canonical.");
  }
  return value;
}
