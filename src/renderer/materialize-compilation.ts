import { createHash } from "node:crypto";

import type { RendererProvider } from "./contract.js";

export const privateRendererSourceRevision = 1;

export interface PrivateRendererSourceFile {
  readonly path: string;
  readonly provider: RendererProvider;
  readonly capability: "project-instructions";
  readonly content: string;
  readonly contentDigest: string;
  readonly sourceRefs: readonly string[];
}

export interface PrivateRendererSourceMaterialization {
  readonly revision: number;
  readonly compilerDigest: string;
  readonly digest: string;
  readonly files: readonly PrivateRendererSourceFile[];
}

function digestText(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function digestValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function expectedMaterializationDigest(
  materialization: Omit<PrivateRendererSourceMaterialization, "digest">,
): string {
  return digestValue({
    revision: materialization.revision,
    compilerDigest: materialization.compilerDigest,
    files: materialization.files.map((file) => ({
      path: file.path,
      provider: file.provider,
      capability: file.capability,
      contentDigest: file.contentDigest,
      sourceRefs: file.sourceRefs,
    })),
  });
}

export interface CreatePrivateRendererSourceMaterializationOptions {
  readonly compilerDigest: string;
  readonly files: readonly {
    readonly path: string;
    readonly provider: RendererProvider;
    readonly content: string;
    readonly sourceRefs: readonly string[];
  }[];
}

export function createPrivateRendererSourceMaterialization(
  options: CreatePrivateRendererSourceMaterializationOptions,
): PrivateRendererSourceMaterialization {
  const files: readonly PrivateRendererSourceFile[] = options.files
    .map((file) => ({
      path: file.path,
      provider: file.provider,
      capability: "project-instructions" as const,
      content: file.content,
      contentDigest: digestText(file.content),
      sourceRefs: [...file.sourceRefs].sort(),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const base = {
    revision: privateRendererSourceRevision,
    compilerDigest: options.compilerDigest,
    files,
  };
  return { ...base, digest: expectedMaterializationDigest(base) };
}

export function validatePrivateRendererSourceMaterialization(
  materialization: PrivateRendererSourceMaterialization,
): void {
  if (materialization.revision !== privateRendererSourceRevision) {
    throw new Error(
      `Unsupported private renderer source revision: ${materialization.revision}.`,
    );
  }
  if (materialization.files.length === 0) {
    throw new Error("Private renderer source materialization is empty.");
  }
  const seenPaths = new Set<string>();
  const seenProviders = new Set<RendererProvider>();
  for (const file of materialization.files) {
    if (seenPaths.has(file.path)) {
      throw new Error(`Private renderer source path is duplicated: ${file.path}`);
    }
    seenPaths.add(file.path);
    if (seenProviders.has(file.provider)) {
      throw new Error(
        `Private renderer source provider is duplicated: ${file.provider}`,
      );
    }
    seenProviders.add(file.provider);
    if (digestText(file.content) !== file.contentDigest) {
      throw new Error(
        `Private renderer source content digest does not match: ${file.path}`,
      );
    }
  }
  const expected = expectedMaterializationDigest({
    revision: materialization.revision,
    compilerDigest: materialization.compilerDigest,
    files: materialization.files,
  });
  if (expected !== materialization.digest) {
    throw new Error("Private renderer source materialization digest does not match.");
  }
}
