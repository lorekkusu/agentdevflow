import { createHash } from "node:crypto";
import { posix } from "node:path";

import type { CandidateCompilation } from "../compiler/private-model.js";
import type {
  OwnershipClaim,
  RenderRequest,
  RendererCapability,
  RendererProvider,
} from "./contract.js";

const sha256Pattern = /^[a-f0-9]{64}$/u;

export interface CompilationRenderRequestOptions {
  readonly materializedInputDigest: string;
  readonly sourceFiles: readonly string[];
  readonly ownership?: Readonly<Record<string, OwnershipClaim>>;
  readonly adoptPaths?: readonly string[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeRelativePaths(
  paths: readonly string[],
  description: string,
  requireOne: boolean,
): string[] {
  if (requireOne && paths.length === 0) {
    throw new Error("At least one materialized source file is required.");
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const originalPath of paths) {
    const path = posix.normalize(originalPath.replaceAll("\\", "/"));
    if (
      path === "." ||
      path === ".." ||
      path.startsWith("../") ||
      posix.isAbsolute(path)
    ) {
      throw new Error(`${description} path is unsafe: ${originalPath}`);
    }
    if (seen.has(path)) {
      throw new Error(`${description} path is duplicated: ${path}`);
    }
    seen.add(path);
    normalized.push(path);
  }
  return normalized.sort(compareText);
}

function rendererCapability(
  capability: CandidateCompilation["capabilityResolutions"][number]["capability"],
): RendererCapability {
  switch (capability) {
    case "project-instructions":
      return "rules";
  }
}

function validateCapabilityCoverage(compilation: CandidateCompilation): void {
  const resolutions = new Set<string>();
  for (const resolution of compilation.capabilityResolutions) {
    const key = `${resolution.requirementId}\u0000${resolution.providerId}\u0000${resolution.capability}`;
    if (resolutions.has(key)) {
      throw new Error(
        `Compilation contains duplicate capability resolution ${resolution.requirementId} for provider ${resolution.providerId}.`,
      );
    }
    resolutions.add(key);
  }
  const expected = new Set<string>();
  for (const requirement of compilation.workflow.capabilityRequirements) {
    for (const provider of compilation.workflow.providers) {
      const key = `${requirement.id}\u0000${provider.id}\u0000${requirement.capability}`;
      expected.add(key);
      if (!resolutions.has(key)) {
        throw new Error(
          `Compilation is missing capability resolution ${requirement.id} for provider ${provider.id}.`,
        );
      }
    }
  }
  for (const key of resolutions) {
    if (!expected.has(key)) {
      throw new Error("Compilation contains an unexpected capability resolution.");
    }
  }
}

/** Internal bridge from compiler evidence to the replaceable renderer contract. */
export function renderRequestFromCompilation(
  compilation: CandidateCompilation,
  options: CompilationRenderRequestOptions,
): RenderRequest {
  if (!sha256Pattern.test(options.materializedInputDigest)) {
    throw new Error(
      "materializedInputDigest must be a lowercase SHA-256 digest.",
    );
  }
  validateCapabilityCoverage(compilation);

  const sourceFiles = normalizeRelativePaths(
    options.sourceFiles,
    "Materialized source",
    true,
  );
  const adoptPaths = normalizeRelativePaths(
    options.adoptPaths ?? [],
    "Adoption",
    false,
  );
  const providers = [
    ...new Set(
      compilation.workflow.providers.map(
        (provider): RendererProvider => provider.product,
      ),
    ),
  ].sort(compareText);
  const capabilities = [
    ...new Set(
      compilation.capabilityResolutions.map((resolution) =>
        rendererCapability(resolution.capability),
      ),
    ),
  ].sort(compareText);
  const inputDigest = digest({
    compilerDigest: compilation.compilerDigest,
    materializedInputDigest: options.materializedInputDigest,
    sourceFiles,
  });

  return {
    inputDigest,
    providers,
    capabilities,
    sourceFiles,
    ownership: Object.fromEntries(
      Object.entries(options.ownership ?? {}).sort(([left], [right]) =>
        compareText(left, right),
      ),
    ),
    ...(options.adoptPaths ? { adoptPaths } : {}),
  };
}
