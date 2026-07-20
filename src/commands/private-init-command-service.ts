import { createHash } from "node:crypto";

import type {
  NormalizedCandidateProjectConfig,
} from "../config/candidate.js";
import { normalizeCandidateProjectConfig } from "../config/normalize-candidate.js";
import type {
  PrivateInitImportAssessment,
  PrivateInitImportClassification,
} from "../import/private-assessment.js";
import type { RendererProvider } from "../renderer/contract.js";

export type {
  PrivateInitImportAssessment,
  PrivateInitImportClassification,
} from "../import/private-assessment.js";

export const privateInitProposalRevision = 1;

export const privateInitProviderPaths = {
  "claude-code": "CLAUDE.md",
  codex: "AGENTS.md",
  cursor: ".cursor/rules/agentdevflow.mdc",
} as const satisfies Readonly<Record<RendererProvider, string>>;

export interface PrivateInitTarget {
  readonly provider: RendererProvider;
  readonly content: string;
  readonly sourceRefs: readonly string[];
}

export interface PrivateInitReadWorkspace {
  read(path: string): Promise<string | null>;
}

export interface ExecutePrivateInitCommandOptions {
  readonly proposedConfiguration: unknown;
  readonly targets: readonly PrivateInitTarget[];
  readonly importAssessments: readonly PrivateInitImportAssessment[];
  readonly workspace: PrivateInitReadWorkspace;
}

export type PrivateInitDisposition = "create" | "adopt" | "import" | "abort";
export type PrivateInitObservedState = "absent" | "present" | "unreadable";
export type PrivateInitOutcome = "ready" | "review-required" | "blocked";
export type PrivateInitDiagnosticLevel = "warning" | "error";

export interface PrivateInitDiagnostic {
  readonly code: string;
  readonly level: PrivateInitDiagnosticLevel;
  readonly message: string;
  readonly path?: string;
  readonly provider?: RendererProvider;
}

export interface PrivateInitProposalEntry {
  readonly provider: RendererProvider;
  readonly path: string;
  readonly disposition: PrivateInitDisposition;
  readonly observedState: PrivateInitObservedState;
  readonly observedDigest: string | null;
  readonly targetDigest: string;
  readonly targetContent: string;
  readonly sourceRefs: readonly string[];
  readonly informationLoss: readonly string[];
  readonly requiresExplicitApproval: boolean;
}

export interface PrivateInitConfigurationProposal {
  readonly revision: number;
  readonly value: NormalizedCandidateProjectConfig;
  readonly canonicalJson: string;
  readonly digest: string;
}

export interface PrivateInitCommandResult {
  readonly outcome: PrivateInitOutcome;
  readonly candidateExitCode: 0 | 1 | 2;
  readonly proposedConfiguration: PrivateInitConfigurationProposal | null;
  readonly entries: readonly PrivateInitProposalEntry[];
  readonly diagnostics: readonly PrivateInitDiagnostic[];
}

const providers = new Set<RendererProvider>([
  "claude-code",
  "codex",
  "cursor",
]);
const classifications = new Set<PrivateInitImportClassification>([
  "lossless",
  "lossy",
  "unsupported",
]);
const sha256Pattern = /^[a-f0-9]{64}$/u;

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  description: string,
): void {
  const actual = Object.keys(value).sort(compareText);
  const expected = [...keys].sort(compareText);
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${description} has unexpected or missing fields.`);
  }
}

function requireProvider(value: unknown, description: string): RendererProvider {
  if (typeof value !== "string" || !providers.has(value as RendererProvider)) {
    throw new Error(`${description} is unsupported: ${String(value)}.`);
  }
  return value as RendererProvider;
}

function requireString(value: unknown, description: string): string {
  if (typeof value !== "string") {
    throw new Error(`${description} must be a string.`);
  }
  return value;
}

function requireTrimmedStrings(
  value: unknown,
  description: string,
  allowEmpty: boolean,
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${description} must be an array.`);
  }
  const result = value.map((item, index) => {
    if (
      typeof item !== "string" ||
      item.length === 0 ||
      item.trim() !== item
    ) {
      throw new Error(`${description} entry ${index} must be a non-empty trimmed string.`);
    }
    return item;
  });
  if (!allowEmpty && result.length === 0) {
    throw new Error(`${description} must not be empty.`);
  }
  const sorted = [...new Set(result)].sort(compareText);
  if (sorted.length !== result.length) {
    throw new Error(`${description} must not contain duplicates.`);
  }
  return sorted;
}

function parseTargets(value: unknown): PrivateInitTarget[] {
  if (!Array.isArray(value)) {
    throw new Error("Private init targets must be an array.");
  }
  const seen = new Set<RendererProvider>();
  const targets = value.map((item, index) => {
    const description = `Private init target ${index}`;
    if (!isRecord(item)) {
      throw new Error(`${description} must be an object.`);
    }
    requireExactKeys(item, ["provider", "content", "sourceRefs"], description);
    const provider = requireProvider(item.provider, `${description} provider`);
    if (seen.has(provider)) {
      throw new Error(`Private init target provider is duplicated: ${provider}.`);
    }
    seen.add(provider);
    return {
      provider,
      content: requireString(item.content, `${description} content`),
      sourceRefs: requireTrimmedStrings(
        item.sourceRefs,
        `${description} source references`,
        false,
      ),
    };
  });
  return targets.sort((left, right) => compareText(left.provider, right.provider));
}

function parseAssessments(value: unknown): PrivateInitImportAssessment[] {
  if (!Array.isArray(value)) {
    throw new Error("Private init import assessments must be an array.");
  }
  const seen = new Set<RendererProvider>();
  const assessments = value.map((item, index) => {
    const description = `Private init import assessment ${index}`;
    if (!isRecord(item)) {
      throw new Error(`${description} must be an object.`);
    }
    requireExactKeys(
      item,
      [
        "provider",
        "observedDigest",
        "classification",
        "proposedConfigurationDigest",
        "proposedTargetDigest",
        "informationLoss",
      ],
      description,
    );
    const provider = requireProvider(item.provider, `${description} provider`);
    if (seen.has(provider)) {
      throw new Error(`Private init import assessment provider is duplicated: ${provider}.`);
    }
    seen.add(provider);
    const observedDigest = requireString(
      item.observedDigest,
      `${description} observed digest`,
    );
    if (!sha256Pattern.test(observedDigest)) {
      throw new Error(`${description} observed digest must be a lowercase SHA-256 digest.`);
    }
    if (
      typeof item.classification !== "string" ||
      !classifications.has(item.classification as PrivateInitImportClassification)
    ) {
      throw new Error(`${description} classification is unsupported: ${String(item.classification)}.`);
    }
    const classification = item.classification as PrivateInitImportClassification;
    const proposedConfigurationDigest =
      item.proposedConfigurationDigest === null
        ? null
        : requireString(
            item.proposedConfigurationDigest,
            `${description} proposed configuration digest`,
          );
    if (
      proposedConfigurationDigest !== null &&
      !sha256Pattern.test(proposedConfigurationDigest)
    ) {
      throw new Error(`${description} proposed configuration digest must be a lowercase SHA-256 digest.`);
    }
    const proposedTargetDigest =
      item.proposedTargetDigest === null
        ? null
        : requireString(
            item.proposedTargetDigest,
            `${description} proposed target digest`,
          );
    if (
      proposedTargetDigest !== null &&
      !sha256Pattern.test(proposedTargetDigest)
    ) {
      throw new Error(`${description} proposed target digest must be a lowercase SHA-256 digest.`);
    }
    const informationLoss = requireTrimmedStrings(
      item.informationLoss,
      `${description} information loss`,
      true,
    );
    if (
      (classification === "lossless" && informationLoss.length > 0) ||
      (classification !== "lossless" && informationLoss.length === 0)
    ) {
      throw new Error(`${description} classification contradicts its information-loss entries.`);
    }
    if (
      (classification === "unsupported" &&
        (proposedConfigurationDigest !== null || proposedTargetDigest !== null)) ||
      (classification !== "unsupported" &&
        (proposedConfigurationDigest === null || proposedTargetDigest === null))
    ) {
      throw new Error(`${description} classification contradicts its configuration digest.`);
    }
    return {
      provider,
      observedDigest,
      classification,
      proposedConfigurationDigest,
      proposedTargetDigest,
      informationLoss,
    };
  });
  return assessments.sort((left, right) =>
    compareText(left.provider, right.provider),
  );
}

function compareDiagnostics(
  left: PrivateInitDiagnostic,
  right: PrivateInitDiagnostic,
): number {
  return (
    compareText(left.code, right.code) ||
    compareText(left.path ?? "", right.path ?? "") ||
    compareText(left.provider ?? "", right.provider ?? "") ||
    compareText(left.message, right.message)
  );
}

function diagnostic(
  code: string,
  level: PrivateInitDiagnosticLevel,
  message: string,
  provider?: RendererProvider,
): PrivateInitDiagnostic {
  return {
    code,
    level,
    message,
    ...(provider === undefined
      ? {}
      : { provider, path: privateInitProviderPaths[provider] }),
  };
}

function blockedInput(message: string): PrivateInitCommandResult {
  return {
    outcome: "blocked",
    candidateExitCode: 2,
    proposedConfiguration: null,
    entries: [],
    diagnostics: [diagnostic("INIT_INPUT_INVALID", "error", message)],
  };
}

function configuredProducts(
  configuration: NormalizedCandidateProjectConfig,
): RendererProvider[] {
  return [...new Set(configuration.providers.map((provider) => provider.product))]
    .sort(compareText);
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export async function executePrivateInitCommand(
  options: ExecutePrivateInitCommandOptions,
): Promise<PrivateInitCommandResult> {
  const normalized = normalizeCandidateProjectConfig(options.proposedConfiguration);
  if (!normalized.ok) {
    return blockedInput(
      `Proposed candidate configuration is invalid: ${normalized.diagnostics
        .map((item) => `${item.path} ${item.message}`)
        .join(" ")}`,
    );
  }

  let targets: PrivateInitTarget[];
  let assessments: PrivateInitImportAssessment[];
  try {
    targets = parseTargets(options.targets);
    assessments = parseAssessments(options.importAssessments);
  } catch (error) {
    return blockedInput(error instanceof Error ? error.message : String(error));
  }

  const expectedProviders = configuredProducts(normalized.config);
  const targetProviders = targets.map((target) => target.provider);
  if (!sameValues(expectedProviders, targetProviders)) {
    return blockedInput(
      "Private init targets must contain exactly one entry for every configured provider product.",
    );
  }

  const assessmentByProvider = new Map(
    assessments.map((assessment) => [assessment.provider, assessment]),
  );
  for (const assessment of assessments) {
    if (!targetProviders.includes(assessment.provider)) {
      return blockedInput(
        `Private init import assessment has no configured target: ${assessment.provider}.`,
      );
    }
  }

  const diagnostics: PrivateInitDiagnostic[] = [];
  const entries: PrivateInitProposalEntry[] = [];
  for (const target of targets) {
    const path = privateInitProviderPaths[target.provider];
    const targetDigest = digest(target.content);
    let existing: string | null;
    try {
      existing = await options.workspace.read(path);
    } catch (error) {
      diagnostics.push(
        diagnostic(
          "INIT_WORKSPACE_READ_FAILED",
          "error",
          `Provider path could not be read: ${error instanceof Error ? error.message : String(error)}`,
          target.provider,
        ),
      );
      entries.push({
        provider: target.provider,
        path,
        disposition: "abort",
        observedState: "unreadable",
        observedDigest: null,
        targetDigest,
        targetContent: target.content,
        sourceRefs: target.sourceRefs,
        informationLoss: [],
        requiresExplicitApproval: false,
      });
      continue;
    }

    if (existing === null) {
      entries.push({
        provider: target.provider,
        path,
        disposition: "create",
        observedState: "absent",
        observedDigest: null,
        targetDigest,
        targetContent: target.content,
        sourceRefs: target.sourceRefs,
        informationLoss: [],
        requiresExplicitApproval: false,
      });
      continue;
    }

    const observedDigest = digest(existing);
    if (observedDigest === targetDigest) {
      entries.push({
        provider: target.provider,
        path,
        disposition: "adopt",
        observedState: "present",
        observedDigest,
        targetDigest,
        targetContent: target.content,
        sourceRefs: target.sourceRefs,
        informationLoss: [],
        requiresExplicitApproval: true,
      });
      continue;
    }

    const assessment = assessmentByProvider.get(target.provider);
    let disposition: PrivateInitDisposition = "abort";
    let informationLoss: readonly string[] = [];
    if (assessment === undefined) {
      diagnostics.push(
        diagnostic(
          "INIT_IMPORT_ANALYSIS_UNAVAILABLE",
          "error",
          "Existing provider content differs from the target and has no import assessment.",
          target.provider,
        ),
      );
    } else if (assessment.observedDigest !== observedDigest) {
      diagnostics.push(
        diagnostic(
          "INIT_IMPORT_ANALYSIS_STALE",
          "error",
          "The import assessment does not match the currently observed provider content.",
          target.provider,
        ),
      );
    } else if (assessment.classification === "unsupported") {
      informationLoss = assessment.informationLoss;
      diagnostics.push(
        diagnostic(
          "INIT_IMPORT_UNSUPPORTED",
          "error",
          `Existing provider content cannot be imported: ${informationLoss.join("; ")}`,
          target.provider,
        ),
      );
    } else if (
      assessment.proposedConfigurationDigest !== normalized.digest
    ) {
      diagnostics.push(
        diagnostic(
          "INIT_IMPORT_CONFIGURATION_MISMATCH",
          "error",
          "The import assessment proposes a different candidate configuration.",
          target.provider,
        ),
      );
    } else if (assessment.proposedTargetDigest !== targetDigest) {
      diagnostics.push(
        diagnostic(
          "INIT_IMPORT_TARGET_MISMATCH",
          "error",
          "The import assessment proposes different target content.",
          target.provider,
        ),
      );
    } else {
      disposition = "import";
      informationLoss = assessment.informationLoss;
      if (assessment.classification === "lossy") {
        diagnostics.push(
          diagnostic(
            "INIT_IMPORT_INFORMATION_LOSS",
            "warning",
            `Import requires explicit review of information loss: ${informationLoss.join("; ")}`,
            target.provider,
          ),
        );
      }
    }

    entries.push({
      provider: target.provider,
      path,
      disposition,
      observedState: "present",
      observedDigest,
      targetDigest,
      targetContent: target.content,
      sourceRefs: target.sourceRefs,
      informationLoss,
      requiresExplicitApproval: disposition === "import",
    });
  }

  entries.sort((left, right) => compareText(left.path, right.path));
  diagnostics.sort(compareDiagnostics);
  const hasAbort = entries.some((entry) => entry.disposition === "abort");
  const hasImport = entries.some((entry) => entry.disposition === "import");
  const outcome: PrivateInitOutcome = hasAbort
    ? "blocked"
    : hasImport
      ? "review-required"
      : "ready";

  return {
    outcome,
    candidateExitCode: outcome === "ready" ? 0 : outcome === "review-required" ? 1 : 2,
    proposedConfiguration: {
      revision: privateInitProposalRevision,
      value: normalized.config,
      canonicalJson: normalized.canonicalJson,
      digest: normalized.digest,
    },
    entries,
    diagnostics,
  };
}
