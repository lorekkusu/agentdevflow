import { posix } from "node:path";

import type { PrivateResolvedDomainProject } from "./materialize-domain-project.js";
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

export function renderRequestFromPrivateDomainProjectMaterialization(
  project: PrivateResolvedDomainProject,
  materialization: PrivateRendererSourceMaterialization,
  options: MaterializedCompilationRenderRequestOptions = {},
): RenderRequest {
  validatePrivateRendererSourceMaterialization(materialization);
  const expectedProviders = [
    ...new Set(
      project.normalizedIntent.providers.map(
        (provider): RendererProvider => provider.product,
      ),
    ),
  ].sort(compareText);
  const materializedProviders = materialization.files
    .map((file) => file.provider)
    .sort(compareText);
  const requiredProjectReference =
    `domain-project-resolution:sha256:${project.resolutionDigest}`;
  if (
    materialization.compilerDigest !==
      project.workflowCompilation.compilationDigest ||
    expectedProviders.length !== materializedProviders.length ||
    expectedProviders.some(
      (provider, index) => provider !== materializedProviders[index],
    ) ||
    materialization.files.some(
      (file) => !file.sourceRefs.includes(requiredProjectReference),
    )
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
