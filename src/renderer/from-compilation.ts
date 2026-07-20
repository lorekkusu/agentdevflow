import { posix } from "node:path";

import type { CandidateCompilation } from "../compiler/private-model.js";
import {
  materializePrivateDomainProject,
  type PrivateResolvedDomainProject,
} from "./materialize-domain-project.js";
import type {
  InitializationImportAuthorization,
  OwnershipClaim,
  RenderRequest,
  RendererCapability,
  RendererProvider,
} from "./contract.js";
import {
  validatePrivateRendererSourceMaterialization,
  type PrivateRendererSourceMaterialization,
} from "./materialize-compilation.js";
import { createRenderInputDigest } from "./input-digest.js";

const sha256Pattern = /^[a-f0-9]{64}$/u;

export interface CompilationRenderRequestOptions {
  readonly materializedInputDigest: string;
  readonly sourceFiles: readonly string[];
  readonly ownership?: Readonly<Record<string, OwnershipClaim>>;
  readonly adoptPaths?: readonly string[];
  readonly initializationImports?: readonly InitializationImportAuthorization[];
}

export type MaterializedCompilationRenderRequestOptions = Omit<
  CompilationRenderRequestOptions,
  "materializedInputDigest" | "sourceFiles"
>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function normalizeInitializationImports(
  values: readonly InitializationImportAuthorization[],
): InitializationImportAuthorization[] {
  const paths = normalizeRelativePaths(
    values.map((value) => value.path),
    "Initialization import",
    false,
  );
  const byPath = new Map(values.map((value) => [value.path, value]));
  return paths.map((path) => {
    const value = byPath.get(path);
    if (!value) {
      throw new Error(`Initialization import path is not canonical: ${path}`);
    }
    if (
      !sha256Pattern.test(value.observedDigest) ||
      !sha256Pattern.test(value.targetDigest)
    ) {
      throw new Error(
        `Initialization import digests must be lowercase SHA-256 digests: ${path}`,
      );
    }
    if (value.observedDigest === value.targetDigest) {
      throw new Error(
        `Initialization import must bind different observed and target digests: ${path}`,
      );
    }
    return {
      path,
      observedDigest: value.observedDigest,
      targetDigest: value.targetDigest,
    };
  });
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

interface PrivateRenderRequestSource {
  readonly compilerDigest: string;
  readonly providers: readonly RendererProvider[];
  readonly capabilities: readonly RendererCapability[];
}

function renderRequestFromSource(
  source: PrivateRenderRequestSource,
  options: CompilationRenderRequestOptions,
): RenderRequest {
  if (!sha256Pattern.test(options.materializedInputDigest)) {
    throw new Error(
      "materializedInputDigest must be a lowercase SHA-256 digest.",
    );
  }
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
  const initializationImports = normalizeInitializationImports(
    options.initializationImports ?? [],
  );
  const adopted = new Set(adoptPaths);
  for (const authorization of initializationImports) {
    if (adopted.has(authorization.path)) {
      throw new Error(
        `Initialization path cannot be both adopted and imported: ${authorization.path}`,
      );
    }
  }
  const providers = [...new Set(source.providers)].sort(compareText);
  const capabilities = [...new Set(source.capabilities)].sort(compareText);
  const inputDigest = createRenderInputDigest({
    compilerDigest: source.compilerDigest,
    sourceDigest: options.materializedInputDigest,
    sourceFiles,
  });

  return {
    inputDigest,
    sourceDigest: options.materializedInputDigest,
    providers,
    capabilities,
    sourceFiles,
    ownership: Object.fromEntries(
      Object.entries(options.ownership ?? {}).sort(([left], [right]) =>
        compareText(left, right),
      ),
    ),
    ...(options.adoptPaths ? { adoptPaths } : {}),
    ...(options.initializationImports ? { initializationImports } : {}),
  };
}

/** Internal bridge from compiler evidence to the replaceable renderer contract. */
export function renderRequestFromCompilation(
  compilation: CandidateCompilation,
  options: CompilationRenderRequestOptions,
): RenderRequest {
  validateCapabilityCoverage(compilation);
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
  return renderRequestFromSource(
    { compilerDigest: compilation.compilerDigest, providers, capabilities },
    options,
  );
}

export function renderRequestFromPrivateDomainProjectMaterialization(
  project: PrivateResolvedDomainProject,
  materialization: PrivateRendererSourceMaterialization,
  options: MaterializedCompilationRenderRequestOptions = {},
): RenderRequest {
  validatePrivateRendererSourceMaterialization(materialization);
  const expectedMaterialization = materializePrivateDomainProject(project);
  if (
    materialization.digest !== expectedMaterialization.digest ||
    materialization.compilerDigest !== expectedMaterialization.compilerDigest
  ) {
    throw new Error(
      "Private renderer source materialization belongs to a different domain project compilation.",
    );
  }
  return renderRequestFromSource(
    {
      compilerDigest: project.workflowCompilation.compilationDigest,
      providers: project.normalizedIntent.providers.map(
        (provider): RendererProvider => provider.product,
      ),
      capabilities: ["rules"],
    },
    {
      ...options,
      materializedInputDigest: materialization.digest,
      sourceFiles: materialization.files.map((file) => file.path),
    },
  );
}

export function renderRequestFromMaterialization(
  compilation: CandidateCompilation,
  materialization: PrivateRendererSourceMaterialization,
  options: MaterializedCompilationRenderRequestOptions = {},
): RenderRequest {
  validatePrivateRendererSourceMaterialization(materialization);
  if (materialization.compilerDigest !== compilation.compilerDigest) {
    throw new Error(
      "Private renderer source materialization belongs to a different compilation.",
    );
  }
  return renderRequestFromCompilation(compilation, {
    ...options,
    materializedInputDigest: materialization.digest,
    sourceFiles: materialization.files.map((file) => file.path),
  });
}
