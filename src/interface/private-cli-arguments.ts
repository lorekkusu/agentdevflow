import { parseArgs } from "node:util";

import {
  candidateArtifactTypes,
  candidatePresets,
  candidateProviderProducts,
  candidateProviderSurfaces,
  candidateReviewSeparations,
  candidateTrackerModes,
  type CandidateArtifactType,
  type CandidatePreset,
  type CandidateProviderInstance,
  type CandidateProviderProduct,
  type CandidateProviderSurface,
  type CandidateReviewSeparation,
  type CandidateTrackerMode,
  type NormalizedCandidateProjectConfig,
} from "../config/candidate.js";
import { normalizeCandidateProjectConfig } from "../config/normalize-candidate.js";

export const privateCliCommands = [
  "check",
  "diff",
  "doctor",
  "init",
  "render",
] as const;
export type PrivateCliCommand = (typeof privateCliCommands)[number];

export type PrivateCliDiagnosticCode =
  | "DUPLICATE_OPTION"
  | "INVALID_ARGUMENTS"
  | "INVALID_CONFIGURATION"
  | "INVALID_OPTION_VALUE"
  | "MISSING_COMMAND"
  | "MISSING_REQUIRED_OPTION"
  | "UNKNOWN_COMMAND";

export interface PrivateCliDiagnostic {
  readonly code: PrivateCliDiagnosticCode;
  readonly option?: string;
  readonly path?: string;
  readonly message: string;
}

export type PrivateCliInvocation =
  | {
      readonly command: "check" | "diff";
      readonly projectConfigPath: string;
    }
  | {
      readonly command: "doctor";
      readonly projectConfigPath: string;
      readonly observationsPath: string;
    }
  | {
      readonly command: "render";
      readonly projectConfigPath: string;
      readonly approvedPlanDigest: string;
    }
  | {
      readonly command: "init";
      readonly projectConfigPath: string;
      readonly approvalPath?: string;
      readonly configuration: NormalizedCandidateProjectConfig;
      readonly canonicalConfigurationJson: string;
      readonly configurationDigest: string;
    };

export type PrivateCliArgumentResult =
  | { readonly ok: true; readonly invocation: PrivateCliInvocation }
  | { readonly ok: false; readonly diagnostics: readonly PrivateCliDiagnostic[] };

type PrivateCliFailure = Extract<PrivateCliArgumentResult, { ok: false }>;

type OptionDefinition = {
  readonly type: "string";
  readonly multiple?: boolean;
};

type ParsedValue = string | boolean | string[] | boolean[] | undefined;

const stringOption = { type: "string" } as const;
const multipleStringOption = { type: "string", multiple: true } as const;
const sha256Pattern = /^[a-f0-9]{64}$/u;

function failure(
  code: PrivateCliDiagnosticCode,
  message: string,
  option?: string,
): PrivateCliFailure {
  return {
    ok: false,
    diagnostics: [{ code, ...(option === undefined ? {} : { option }), message }],
  };
}

function stringValue(
  values: Record<string, ParsedValue>,
  name: string,
): string | undefined {
  const value = values[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringValues(
  values: Record<string, ParsedValue>,
  name: string,
): readonly string[] {
  const value = values[name];
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : [];
}

function parseCommandOptions(
  args: readonly string[],
  options: Readonly<Record<string, OptionDefinition>>,
  repeatable: ReadonlySet<string> = new Set(),
):
  | { readonly ok: true; readonly values: Record<string, ParsedValue> }
  | { readonly ok: false; readonly result: PrivateCliFailure } {
  try {
    const parsed = parseArgs({
      args: [...args],
      options,
      strict: true,
      allowPositionals: false,
      tokens: true,
    });
    const occurrences = new Map<string, number>();
    for (const token of parsed.tokens) {
      if (token.kind === "option") {
        occurrences.set(token.name, (occurrences.get(token.name) ?? 0) + 1);
      }
    }
    const duplicate = [...occurrences.entries()]
      .filter(([name, count]) => count > 1 && !repeatable.has(name))
      .map(([name]) => name)
      .sort()[0];
    if (duplicate !== undefined) {
      return {
        ok: false,
        result: failure(
          "DUPLICATE_OPTION",
          `Option --${duplicate} must not be repeated.`,
          `--${duplicate}`,
        ),
      };
    }
    return { ok: true, values: parsed.values };
  } catch {
    return {
      ok: false,
      result: failure(
        "INVALID_ARGUMENTS",
        "Command arguments do not match the candidate option matrix.",
      ),
    };
  }
}

function missingOption(name: string): PrivateCliFailure {
  return failure(
    "MISSING_REQUIRED_OPTION",
    `Required option --${name} is missing or empty.`,
    `--${name}`,
  );
}

function requireStringOption(
  values: Record<string, ParsedValue>,
  name: string,
): string | PrivateCliFailure {
  return stringValue(values, name) ?? missingOption(name);
}

function isFailure(
  value: string | PrivateCliFailure,
): value is PrivateCliFailure {
  return typeof value !== "string";
}

function parseClosedValue<T extends string>(
  value: string,
  allowed: readonly T[],
  option: string,
): T | PrivateCliFailure {
  if (!allowed.includes(value as T)) {
    return failure(
      "INVALID_OPTION_VALUE",
      `Option --${option} must be one of: ${allowed.join(", ")}.`,
      `--${option}`,
    );
  }
  return value as T;
}

function parseProvider(
  value: string,
): CandidateProviderInstance | PrivateCliFailure {
  const parts = value.split(",");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --provider must use id,product,surface form.",
      "--provider",
    );
  }
  const [id, productValue, surfaceValue] = parts as [string, string, string];
  const product = parseClosedValue<CandidateProviderProduct>(
    productValue,
    candidateProviderProducts,
    "provider",
  );
  if (typeof product !== "string") {
    return product;
  }
  const surface = parseClosedValue<CandidateProviderSurface>(
    surfaceValue,
    candidateProviderSurfaces,
    "provider",
  );
  if (typeof surface !== "string") {
    return surface;
  }
  return { id, product, surface };
}

function parseInitArguments(args: readonly string[]): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(
    args,
    {
      approval: stringOption,
      config: stringOption,
      developer: stringOption,
      preset: stringOption,
      provider: multipleStringOption,
      reviewer: stringOption,
      "review-artifact": multipleStringOption,
      "review-required": stringOption,
      "reviewer-separation": stringOption,
      steward: stringOption,
      tracker: stringOption,
    },
    new Set(["provider", "review-artifact"]),
  );
  if (!parsed.ok) {
    return parsed.result;
  }

  const configPath = requireStringOption(parsed.values, "config");
  if (isFailure(configPath)) return configPath;
  const presetValue = requireStringOption(parsed.values, "preset");
  if (isFailure(presetValue)) return presetValue;
  const developer = requireStringOption(parsed.values, "developer");
  if (isFailure(developer)) return developer;
  const reviewer = requireStringOption(parsed.values, "reviewer");
  if (isFailure(reviewer)) return reviewer;
  const steward = requireStringOption(parsed.values, "steward");
  if (isFailure(steward)) return steward;
  const trackerValue = requireStringOption(parsed.values, "tracker");
  if (isFailure(trackerValue)) return trackerValue;
  const reviewRequiredValue = requireStringOption(
    parsed.values,
    "review-required",
  );
  if (isFailure(reviewRequiredValue)) return reviewRequiredValue;
  const reviewerSeparationValue = requireStringOption(
    parsed.values,
    "reviewer-separation",
  );
  if (isFailure(reviewerSeparationValue)) return reviewerSeparationValue;

  const providerValues = stringValues(parsed.values, "provider");
  if (providerValues.length === 0) return missingOption("provider");
  const artifactValues = stringValues(parsed.values, "review-artifact");
  if (artifactValues.length === 0) return missingOption("review-artifact");
  const approvalPath = stringValue(parsed.values, "approval");
  if (
    Object.hasOwn(parsed.values, "approval") &&
    approvalPath === undefined
  ) {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --approval must not be empty when provided.",
      "--approval",
    );
  }

  const preset = parseClosedValue<CandidatePreset>(
    presetValue,
    candidatePresets,
    "preset",
  );
  if (typeof preset !== "string") return preset;
  const tracker = parseClosedValue<CandidateTrackerMode>(
    trackerValue,
    candidateTrackerModes,
    "tracker",
  );
  if (typeof tracker !== "string") return tracker;
  const reviewerSeparation = parseClosedValue<CandidateReviewSeparation>(
    reviewerSeparationValue,
    candidateReviewSeparations,
    "reviewer-separation",
  );
  if (typeof reviewerSeparation !== "string") return reviewerSeparation;
  if (reviewRequiredValue !== "true" && reviewRequiredValue !== "false") {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --review-required must be true or false.",
      "--review-required",
    );
  }

  const providers: CandidateProviderInstance[] = [];
  for (const value of providerValues) {
    const provider = parseProvider(value);
    if ("ok" in provider) return provider;
    providers.push(provider);
  }
  const artifactTypes: CandidateArtifactType[] = [];
  for (const value of artifactValues) {
    const artifact = parseClosedValue<CandidateArtifactType>(
      value,
      candidateArtifactTypes,
      "review-artifact",
    );
    if (typeof artifact !== "string") return artifact;
    artifactTypes.push(artifact);
  }

  const normalized = normalizeCandidateProjectConfig({
    schemaVersion: 0,
    preset,
    providers,
    roles: { developer, reviewer, steward },
    tracker: { mode: tracker },
    review: {
      requiredBeforeMerge: reviewRequiredValue === "true",
      reviewerSeparation,
      artifactTypes,
    },
  });
  if (!normalized.ok) {
    return {
      ok: false,
      diagnostics: normalized.diagnostics.map((diagnostic) => ({
        code: "INVALID_CONFIGURATION" as const,
        path: diagnostic.path,
        message: diagnostic.message,
      })),
    };
  }

  return {
    ok: true,
    invocation: {
      command: "init",
      projectConfigPath: configPath,
      ...(approvalPath === undefined ? {} : { approvalPath }),
      configuration: normalized.config,
      canonicalConfigurationJson: normalized.canonicalJson,
      configurationDigest: normalized.digest,
    },
  };
}

function parseConfigCommand(
  command: "check" | "diff",
  args: readonly string[],
): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(args, { config: stringOption });
  if (!parsed.ok) return parsed.result;
  const configPath = requireStringOption(parsed.values, "config");
  if (isFailure(configPath)) return configPath;
  return {
    ok: true,
    invocation: { command, projectConfigPath: configPath },
  };
}

function parseDoctorArguments(args: readonly string[]): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(args, {
    config: stringOption,
    observations: stringOption,
  });
  if (!parsed.ok) return parsed.result;
  const configPath = requireStringOption(parsed.values, "config");
  if (isFailure(configPath)) return configPath;
  const observationsPath = requireStringOption(parsed.values, "observations");
  if (isFailure(observationsPath)) return observationsPath;
  return {
    ok: true,
    invocation: {
      command: "doctor",
      projectConfigPath: configPath,
      observationsPath,
    },
  };
}

function parseRenderArguments(args: readonly string[]): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(args, {
    "approve-plan": stringOption,
    config: stringOption,
  });
  if (!parsed.ok) return parsed.result;
  const configPath = requireStringOption(parsed.values, "config");
  if (isFailure(configPath)) return configPath;
  const approvedPlanDigest = requireStringOption(parsed.values, "approve-plan");
  if (isFailure(approvedPlanDigest)) return approvedPlanDigest;
  if (!sha256Pattern.test(approvedPlanDigest)) {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --approve-plan must be a lowercase SHA-256 digest.",
      "--approve-plan",
    );
  }
  return {
    ok: true,
    invocation: { command: "render", projectConfigPath: configPath, approvedPlanDigest },
  };
}

/** Parses an experimental, pure argument representation with no filesystem I/O. */
export function parsePrivateCliArguments(
  args: readonly string[],
): PrivateCliArgumentResult {
  const [commandValue, ...commandArgs] = args;
  if (commandValue === undefined) {
    return failure("MISSING_COMMAND", "A command is required.");
  }
  if (!privateCliCommands.includes(commandValue as PrivateCliCommand)) {
    return failure(
      "UNKNOWN_COMMAND",
      `Unknown command: ${commandValue}.`,
    );
  }
  const command = commandValue as PrivateCliCommand;
  switch (command) {
    case "check":
    case "diff":
      return parseConfigCommand(command, commandArgs);
    case "doctor":
      return parseDoctorArguments(commandArgs);
    case "init":
      return parseInitArguments(commandArgs);
    case "render":
      return parseRenderArguments(commandArgs);
  }
}
