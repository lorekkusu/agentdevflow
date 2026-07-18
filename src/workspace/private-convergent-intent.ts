import { createHash } from "node:crypto";
import { posix } from "node:path";

export const privateConvergentIntentRevision = 1;

export interface PrivateConvergentMutationIntent {
  readonly revision: number;
  readonly planDigest: string;
  readonly targetPath: string;
  readonly temporaryPath: string;
  readonly targetDigest: string;
  readonly digest: string;
}

const sha256Pattern = /^[a-f0-9]{64}$/u;

function digestValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireDigest(value: string, description: string): string {
  if (!sha256Pattern.test(value)) {
    throw new Error(`${description} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function requireSafePath(value: string, description: string): string {
  if (
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
  planDigest: string,
  targetPath: string,
  targetDigest: string,
): string {
  const key = digestValue({
    revision: privateConvergentIntentRevision,
    planDigest,
    targetPath,
    targetDigest,
  });
  const parent = posix.dirname(targetPath);
  const name = `.${posix.basename(targetPath)}.agentdevflow-converge-${key}.tmp`;
  return parent === "." ? name : `${parent}/${name}`;
}

function intentDigest(
  intent: Omit<PrivateConvergentMutationIntent, "digest">,
): string {
  return digestValue(intent);
}

export function createPrivateConvergentMutationIntent(options: {
  readonly planDigest: string;
  readonly targetPath: string;
  readonly targetDigest: string;
}): PrivateConvergentMutationIntent {
  const planDigest = requireDigest(options.planDigest, "Convergent plan digest");
  const targetPath = requireSafePath(options.targetPath, "Convergent target path");
  const targetDigest = requireDigest(options.targetDigest, "Convergent target digest");
  const base = {
    revision: privateConvergentIntentRevision,
    planDigest,
    targetPath,
    temporaryPath: temporaryPathFor(planDigest, targetPath, targetDigest),
    targetDigest,
  } as const;
  return Object.freeze({ ...base, digest: intentDigest(base) });
}

export function validatePrivateConvergentMutationIntent(
  value: PrivateConvergentMutationIntent,
): void {
  if (value.revision !== privateConvergentIntentRevision) {
    throw new Error("Unsupported convergent mutation intent revision.");
  }
  const expected = createPrivateConvergentMutationIntent(value);
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("Convergent mutation intent has unexpected or missing fields.");
  }
  if (
    value.temporaryPath !== expected.temporaryPath ||
    value.digest !== expected.digest
  ) {
    throw new Error("Convergent mutation intent does not match its inputs.");
  }
}
