import { parseArgs } from "node:util";

import {
  candidateProviderProducts,
  candidateProviderSurfaces,
  type CandidateProviderInstance,
  type CandidateProviderProduct,
  type CandidateProviderSurface,
} from "../config/candidate.js";
import {
  resolvePrivateDomainProject,
  type PrivateDomainProjectIntent,
} from "../project/private-domain-project-resolution.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../workflows/private-local-reviewed-change.js";

export const privateCliCommands = [
  "check",
  "diff",
  "doctor",
  "init",
  "render",
] as const;
export type PrivateCliCommand = (typeof privateCliCommands)[number];
export type PrivateCliOutputFormat = "human" | "json";

export const defaultProjectConfigPath = "agentdevflow.config.jsonc";
export const defaultRenderLockPath = ".agentdevflow/lock.json";
export const defaultRepositoryPath = ".";

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
      readonly repositoryPath: string;
      readonly lockPath: string;
      readonly outputFormat: PrivateCliOutputFormat;
    }
  | {
      readonly command: "doctor";
      readonly projectConfigPath: string;
      readonly repositoryPath: string;
      readonly observationsPath: string;
      readonly outputFormat: PrivateCliOutputFormat;
    }
  | {
      readonly command: "render";
      readonly projectConfigPath: string;
      readonly repositoryPath: string;
      readonly lockPath: string;
      readonly approvedPlanSnapshotDigest: string;
      readonly outputFormat: PrivateCliOutputFormat;
    }
  | {
      readonly command: "init";
      readonly projectConfigPath: string;
      readonly repositoryPath: string;
      readonly lockPath: string;
      readonly intent: PrivateDomainProjectIntent;
      readonly configurationContent: string;
      readonly outputFormat: PrivateCliOutputFormat;
    };

export type PrivateCliArgumentResult =
  | { readonly ok: true; readonly invocation: PrivateCliInvocation }
  | { readonly ok: false; readonly diagnostics: readonly PrivateCliDiagnostic[] };

type PrivateCliFailure = Extract<PrivateCliArgumentResult, { ok: false }>;

type OptionDefinition = {
  readonly type: "boolean" | "string";
  readonly multiple?: boolean;
};

type ParsedValue = string | boolean | (string | boolean)[] | undefined;

const stringOption = { type: "string" } as const;
const booleanOption = { type: "boolean" } as const;
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

function outputFormat(values: Record<string, ParsedValue>): PrivateCliOutputFormat {
  return values.json === true ? "json" : "human";
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
      config: stringOption,
      developer: stringOption,
      lock: stringOption,
      json: booleanOption,
      preset: stringOption,
      provider: multipleStringOption,
      repository: stringOption,
      reviewer: stringOption,
      steward: stringOption,
      tracker: stringOption,
      workflow: stringOption,
    },
    new Set(["provider"]),
  );
  if (!parsed.ok) {
    return parsed.result;
  }

  const configPath = stringValue(parsed.values, "config") ?? defaultProjectConfigPath;
  const repositoryPath = stringValue(parsed.values, "repository") ?? defaultRepositoryPath;
  const lockPath = stringValue(parsed.values, "lock") ?? defaultRenderLockPath;
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
  const workflowValue = requireStringOption(parsed.values, "workflow");
  if (isFailure(workflowValue)) return workflowValue;

  const providerValues = stringValues(parsed.values, "provider");
  if (providerValues.length === 0) return missingOption("provider");
  if (presetValue !== "balanced" && presetValue !== "fast") {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --preset must be one of: balanced, fast.",
      "--preset",
    );
  }
  if (trackerValue !== "local" && trackerValue !== "none") {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --tracker must be one of: local, none.",
      "--tracker",
    );
  }
  if (workflowValue !== "local-reviewed-change") {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --workflow must be local-reviewed-change for the current offline init path.",
      "--workflow",
    );
  }

  const providers: CandidateProviderInstance[] = [];
  for (const value of providerValues) {
    const provider = parseProvider(value);
    if ("ok" in provider) return provider;
    providers.push(provider);
  }
  providers.sort((left, right) => left.id.localeCompare(right.id));
  const intent: PrivateDomainProjectIntent = {
    revision: 1,
    preset: presetValue,
    providers,
    roles: { developer, reviewer, steward },
    tracker: { mode: trackerValue },
    workflow: { family: workflowValue },
    capabilityBindings: [
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
    ],
  };
  const resolved = resolvePrivateDomainProject(intent, {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      diagnostics: resolved.diagnostics.map((diagnostic) => ({
        code: "INVALID_CONFIGURATION" as const,
        path: diagnostic.path,
        message: diagnostic.message,
      })),
    };
  }
  const normalizedIntent = resolved.normalizedIntent;

  return {
    ok: true,
    invocation: {
      command: "init",
      projectConfigPath: configPath,
      repositoryPath,
      lockPath,
      intent: normalizedIntent,
      configurationContent: `${JSON.stringify(normalizedIntent, null, 2)}\n`,
      outputFormat: outputFormat(parsed.values),
    },
  };
}

function parseConfigCommand(
  command: "check" | "diff",
  args: readonly string[],
): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(args, {
    config: stringOption,
    json: booleanOption,
    lock: stringOption,
    repository: stringOption,
  });
  if (!parsed.ok) return parsed.result;
  const configPath = stringValue(parsed.values, "config") ?? defaultProjectConfigPath;
  const repositoryPath = stringValue(parsed.values, "repository") ?? defaultRepositoryPath;
  const lockPath = stringValue(parsed.values, "lock") ?? defaultRenderLockPath;
  return {
    ok: true,
    invocation: {
      command,
      projectConfigPath: configPath,
      repositoryPath,
      lockPath,
      outputFormat: outputFormat(parsed.values),
    },
  };
}

function parseDoctorArguments(args: readonly string[]): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(args, {
    config: stringOption,
    json: booleanOption,
    observations: stringOption,
    repository: stringOption,
  });
  if (!parsed.ok) return parsed.result;
  const configPath = stringValue(parsed.values, "config") ?? defaultProjectConfigPath;
  const repositoryPath = stringValue(parsed.values, "repository") ?? defaultRepositoryPath;
  const observationsPath = requireStringOption(parsed.values, "observations");
  if (isFailure(observationsPath)) return observationsPath;
  return {
    ok: true,
    invocation: {
      command: "doctor",
      projectConfigPath: configPath,
      repositoryPath,
      observationsPath,
      outputFormat: outputFormat(parsed.values),
    },
  };
}

function parseRenderArguments(args: readonly string[]): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(args, {
    "approve-plan": stringOption,
    config: stringOption,
    json: booleanOption,
    lock: stringOption,
    repository: stringOption,
  });
  if (!parsed.ok) return parsed.result;
  const configPath = stringValue(parsed.values, "config") ?? defaultProjectConfigPath;
  const repositoryPath = stringValue(parsed.values, "repository") ?? defaultRepositoryPath;
  const lockPath = stringValue(parsed.values, "lock") ?? defaultRenderLockPath;
  const approvedPlanSnapshotDigest = requireStringOption(
    parsed.values,
    "approve-plan",
  );
  if (isFailure(approvedPlanSnapshotDigest)) return approvedPlanSnapshotDigest;
  if (!sha256Pattern.test(approvedPlanSnapshotDigest)) {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --approve-plan must be a lowercase exact-plan SHA-256 digest.",
      "--approve-plan",
    );
  }
  return {
    ok: true,
    invocation: {
      command: "render",
      projectConfigPath: configPath,
      repositoryPath,
      lockPath,
      approvedPlanSnapshotDigest,
      outputFormat: outputFormat(parsed.values),
    },
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
