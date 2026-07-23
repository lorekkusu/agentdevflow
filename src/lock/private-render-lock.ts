import { createHash } from "node:crypto";
import { posix } from "node:path";

import type {
  RenderPlan,
  RenderResult,
  VerifyResult,
} from "../renderer/contract.js";
import { createRenderInputDigest } from "../renderer/input-digest.js";
import {
  validatePrivateRendererSourceMaterialization,
  type PrivateRendererSourceMaterialization,
} from "../renderer/materialize-compilation.js";
import { validateRenderPlanIntegrity } from "../renderer/staged-adapter.js";

export const privateRenderLockRevision = 1;
export const privateRenderLockDefaultMaxBytes = 262_144;

export interface PrivateRenderLockSource {
  readonly revision: number;
  readonly digest: string;
}

export interface PrivateRenderLockRenderer {
  readonly name: string;
  readonly version: string;
  readonly ownershipKey: string;
  readonly inputDigest: string;
}

export interface PrivateRenderLockFile {
  readonly path: string;
  readonly owner: string;
  readonly contentDigest: string;
  readonly sourceRefs: readonly string[];
}

export interface PrivateRenderLock {
  readonly revision: number;
  readonly compilerDigest: string;
  readonly source: PrivateRenderLockSource;
  readonly renderer: PrivateRenderLockRenderer;
  readonly files: readonly PrivateRenderLockFile[];
  readonly digest: string;
}

export interface CreatePrivateRenderLockOptions {
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly plan: RenderPlan;
  readonly result: RenderResult;
  readonly verification: VerifyResult;
}

export interface DerivePrivateRenderLockIntentOptions {
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly plan: RenderPlan;
}

export interface ParsePrivateRenderLockOptions {
  readonly maxBytes?: number;
}

const sha256Pattern = /^[a-f0-9]{64}$/u;

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

function requireNonEmptyString(value: unknown, description: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${description} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireSha256(value: unknown, description: string): string {
  if (typeof value !== "string" || !sha256Pattern.test(value)) {
    throw new Error(`${description} must be a lowercase SHA-256 digest.`);
  }
  return value;
}

function requireRevision(value: unknown, expected: number): void {
  if (value !== expected) {
    throw new Error(`Unsupported private render lock revision: ${String(value)}.`);
  }
}

function requireSafePath(value: unknown): string {
  const path = requireNonEmptyString(value, "Private render lock file path");
  if (
    path.includes("\\") ||
    path === "." ||
    path === ".." ||
    path.startsWith("../") ||
    posix.isAbsolute(path) ||
    posix.normalize(path) !== path
  ) {
    throw new Error(`Private render lock file path is unsafe: ${path}`);
  }
  return path;
}

function requireSourceRefs(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Private render lock source references are empty: ${path}`);
  }
  const sourceRefs = value.map((sourceRef) =>
    requireNonEmptyString(
      sourceRef,
      `Private render lock source reference for ${path}`,
    ),
  );
  for (let index = 0; index < sourceRefs.length; index += 1) {
    const sourceRef = sourceRefs[index] ?? "";
    if (/\p{Cc}/u.test(sourceRef)) {
      throw new Error(
        `Private render lock source reference contains control characters: ${path}`,
      );
    }
    if (index > 0 && compareText(sourceRefs[index - 1] ?? "", sourceRef) >= 0) {
      throw new Error(
        `Private render lock source references are not unique and sorted: ${path}`,
      );
    }
  }
  return sourceRefs;
}

function lockDigest(
  lock: Omit<PrivateRenderLock, "digest">,
): string {
  return digestValue({
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
  });
}

export function validatePrivateRenderLock(
  value: unknown,
): asserts value is PrivateRenderLock {
  const lock = requireRecord(value, "Private render lock");
  requireExactKeys(
    lock,
    ["revision", "compilerDigest", "source", "renderer", "files", "digest"],
    "Private render lock",
  );
  requireRevision(lock.revision, privateRenderLockRevision);
  requireSha256(lock.compilerDigest, "Private render lock compiler digest");
  requireSha256(lock.digest, "Private render lock digest");

  const source = requireRecord(lock.source, "Private render lock source");
  requireExactKeys(source, ["revision", "digest"], "Private render lock source");
  if (!Number.isSafeInteger(source.revision) || Number(source.revision) < 1) {
    throw new Error("Private render lock source revision must be a positive integer.");
  }
  requireSha256(source.digest, "Private render lock source digest");

  const renderer = requireRecord(
    lock.renderer,
    "Private render lock renderer",
  );
  requireExactKeys(
    renderer,
    ["name", "version", "ownershipKey", "inputDigest"],
    "Private render lock renderer",
  );
  requireNonEmptyString(renderer.name, "Private render lock renderer name");
  requireNonEmptyString(renderer.version, "Private render lock renderer version");
  const ownershipKey = requireNonEmptyString(
    renderer.ownershipKey,
    "Private render lock ownership key",
  );
  requireSha256(renderer.inputDigest, "Private render lock input digest");

  if (!Array.isArray(lock.files) || lock.files.length === 0) {
    throw new Error("Private render lock files are empty.");
  }
  let previousPath = "";
  for (const [index, fileValue] of lock.files.entries()) {
    const file = requireRecord(fileValue, "Private render lock file");
    requireExactKeys(
      file,
      ["path", "owner", "contentDigest", "sourceRefs"],
      "Private render lock file",
    );
    const path = requireSafePath(file.path);
    if (index > 0 && compareText(previousPath, path) >= 0) {
      throw new Error("Private render lock file paths are not unique and sorted.");
    }
    previousPath = path;
    const owner = requireNonEmptyString(
      file.owner,
      `Private render lock owner for ${path}`,
    );
    if (owner !== ownershipKey) {
      throw new Error(`Private render lock owner does not match renderer: ${path}`);
    }
    requireSha256(
      file.contentDigest,
      `Private render lock content digest for ${path}`,
    );
    requireSourceRefs(file.sourceRefs, path);
  }

  const expectedDigest = lockDigest({
    revision: lock.revision as number,
    compilerDigest: lock.compilerDigest as string,
    source: lock.source as unknown as PrivateRenderLockSource,
    renderer: lock.renderer as unknown as PrivateRenderLockRenderer,
    files: lock.files as unknown as readonly PrivateRenderLockFile[],
  });
  if (lock.digest !== expectedDigest) {
    throw new Error("Private render lock digest does not match.");
  }
}

/** Derives expected lock bytes without claiming that the render was applied. */
export function derivePrivateRenderLockIntent(
  options: DerivePrivateRenderLockIntentOptions,
): PrivateRenderLock {
  const { materialization, plan } = options;
  validatePrivateRendererSourceMaterialization(materialization);
  if (!plan.safeToApply) {
    throw new Error("Refusing to lock an unsafe render plan.");
  }
  if (plan.sourceDigest !== materialization.digest) {
    throw new Error("Render plan belongs to a different source materialization.");
  }
  const sourceFiles = materialization.files
    .map((file) => file.path)
    .sort(compareText);
  const expectedInputDigest = createRenderInputDigest({
    compilerDigest: materialization.compilerDigest,
    sourceDigest: materialization.digest,
    sourceFiles,
  });
  if (plan.inputDigest !== expectedInputDigest) {
    throw new Error("Render plan input digest does not match materialization.");
  }
  validateRenderPlanIntegrity(plan);

  const plannedFiles = plan.files
    .filter((file) => file.action !== "delete")
    .sort((left, right) => compareText(left.path, right.path));
  if (plannedFiles.length === 0) {
    throw new Error("Refusing to create an empty private render lock.");
  }
  const files: PrivateRenderLockFile[] = plannedFiles.map((file) => {
    if (file.action === "conflict" || file.expectedDigest === null) {
      throw new Error(`Render plan has no lockable output at ${file.path}.`);
    }
    if (file.sourceRefs.length === 0) {
      throw new Error(`Render plan has no source references at ${file.path}.`);
    }
    return {
      path: file.path,
      owner: plan.ownershipKey,
      contentDigest: file.expectedDigest,
      sourceRefs: [...new Set(file.sourceRefs)].sort(compareText),
    };
  });

  const base = {
    revision: privateRenderLockRevision,
    compilerDigest: materialization.compilerDigest,
    source: {
      revision: materialization.revision,
      digest: materialization.digest,
    },
    renderer: {
      name: plan.backend,
      version: plan.backendVersion,
      ownershipKey: plan.ownershipKey,
      inputDigest: plan.inputDigest,
    },
    files,
  } satisfies Omit<PrivateRenderLock, "digest">;
  const lock: PrivateRenderLock = { ...base, digest: lockDigest(base) };
  validatePrivateRenderLock(lock);
  return lock;
}

export function createPrivateRenderLock(
  options: CreatePrivateRenderLockOptions,
): PrivateRenderLock {
  const { materialization, plan, result, verification } = options;
  const lock = derivePrivateRenderLockIntent({ materialization, plan });
  if (result.planDigest !== plan.planDigest) {
    throw new Error("Render result belongs to a different plan.");
  }
  if (verification.planDigest !== plan.planDigest) {
    throw new Error("Render verification belongs to a different plan.");
  }
  if (!verification.ok || verification.diagnostics.length > 0) {
    throw new Error("Refusing to lock an unverified render result.");
  }

  for (const file of lock.files) {
    const claim = result.ownership[file.path];
    if (
      !claim ||
      claim.owner !== file.owner ||
      claim.digest !== file.contentDigest
    ) {
      throw new Error(`Render ownership does not match planned output: ${file.path}`);
    }
  }
  const expectedOwnershipPaths = lock.files.map((file) => file.path);
  const actualOwnershipPaths = Object.keys(result.ownership).sort(compareText);
  if (
    expectedOwnershipPaths.length !== actualOwnershipPaths.length ||
    expectedOwnershipPaths.some(
      (path, index) => path !== actualOwnershipPaths[index],
    )
  ) {
    throw new Error("Render result contains unexpected ownership claims.");
  }
  return lock;
}

export function serializePrivateRenderLock(lock: PrivateRenderLock): string {
  validatePrivateRenderLock(lock);
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

export function parsePrivateRenderLock(
  content: string,
  options: ParsePrivateRenderLockOptions = {},
): PrivateRenderLock {
  const maxBytes = options.maxBytes ?? privateRenderLockDefaultMaxBytes;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Private render lock maxBytes must be a positive safe integer.");
  }
  if (Buffer.byteLength(content, "utf8") > maxBytes) {
    throw new Error(`Private render lock exceeds the ${maxBytes}-byte limit.`);
  }

  let value: unknown;
  try {
    value = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(
      `Private render lock is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  validatePrivateRenderLock(value);
  if (serializePrivateRenderLock(value) !== content) {
    throw new Error("Private render lock bytes are not canonical.");
  }
  return value;
}
