import { isAbsolute, win32 } from "node:path";
import { parseArgs } from "node:util";

import {
  candidateProviderProducts,
  type CandidateProviderInstance,
  type CandidateProviderProduct,
} from "../config/candidate.js";
import type { PrivateDomainCapabilityObservation } from "../compiler/private-domain-workflow.js";
import {
  isPrivateProjectGuidanceRuleId,
  privateProjectGuidanceRuleIdMaxLength,
  privateProjectGuidanceRuleIdPattern,
  privateProjectGuidanceScopes,
  type PrivateProjectGuidanceScope,
} from "../guidance/private-project-guidance.js";
import {
  resolvePrivateDomainProject,
  type PrivateDomainProjectIntent,
} from "../project/private-domain-project-resolution.js";
import { privateIssueToPullRequestCapabilityObservations } from "../workflows/private-issue-to-reviewed-pull-request.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../workflows/private-local-reviewed-change.js";

export const privateCliCommands = [
  "check",
  "diff",
  "init",
  "render",
  "rule",
] as const;
export type PrivateCliCommand = (typeof privateCliCommands)[number];
export type PrivateCliOutputFormat = "human" | "json";
export const privateRuleOperations = [
  "add",
  "list",
  "remove",
  "show",
  "update",
] as const;
export type PrivateRuleOperation = (typeof privateRuleOperations)[number];
export const privateRuleScopes = privateProjectGuidanceScopes;
export type PrivateRuleScope = PrivateProjectGuidanceScope;

export type PrivateRuleContentInput =
  | {
      readonly kind: "file";
      readonly path: string;
    }
  | {
      readonly kind: "stdin";
    };

export const defaultProjectConfigPath = "agentdevflow.config.jsonc";
export const defaultRenderLockPath = ".agentdevflow/lock.json";
export const defaultRepositoryPath = ".";

export type PrivateCliDiagnosticCode =
  | "DUPLICATE_OPTION"
  | "INVALID_ARGUMENTS"
  | "INVALID_CONFIGURATION"
  | "INVALID_OPTION_VALUE"
  | "INVALID_RULE_ID"
  | "MISSING_COMMAND"
  | "MISSING_REQUIRED_OPTION"
  | "MISSING_RULE_OPERATION"
  | "UNKNOWN_RULE_OPERATION"
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
    }
  | {
      readonly command: "rule";
      readonly operation: "list";
      readonly repositoryPath: string;
      readonly outputFormat: PrivateCliOutputFormat;
    }
  | {
      readonly command: "rule";
      readonly operation: "show";
      readonly repositoryPath: string;
      readonly ruleId: string;
      readonly outputFormat: PrivateCliOutputFormat;
    }
  | {
      readonly command: "rule";
      readonly operation: "remove";
      readonly repositoryPath: string;
      readonly ruleId: string;
      readonly outputFormat: PrivateCliOutputFormat;
    }
  | {
      readonly command: "rule";
      readonly operation: "add";
      readonly repositoryPath: string;
      readonly ruleId: string;
      readonly scope: PrivateRuleScope;
      readonly input: PrivateRuleContentInput;
      readonly outputFormat: PrivateCliOutputFormat;
    }
  | {
      readonly command: "rule";
      readonly operation: "update";
      readonly repositoryPath: string;
      readonly ruleId: string;
      readonly input: PrivateRuleContentInput;
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
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --provider must use id,product form.",
      "--provider",
    );
  }
  const [id, productValue] = parts as [string, string];
  const product = parseClosedValue<CandidateProviderProduct>(
    productValue,
    candidateProviderProducts,
    "provider",
  );
  if (typeof product !== "string") {
    return product;
  }
  return { id, product };
}

function parseInitArguments(args: readonly string[]): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(
    args,
    {
      ci: stringOption,
      config: stringOption,
      developer: stringOption,
      lock: stringOption,
      json: booleanOption,
      preset: stringOption,
      provider: multipleStringOption,
      "pull-request-host": stringOption,
      "pull-request-state": stringOption,
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
  if (
    workflowValue !== "local-reviewed-change" &&
    workflowValue !== "issue-to-reviewed-pull-request"
  ) {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --workflow must be one of: issue-to-reviewed-pull-request, local-reviewed-change.",
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
  const ci = stringValue(parsed.values, "ci");
  const pullRequestHost = stringValue(parsed.values, "pull-request-host");
  const pullRequestState = stringValue(parsed.values, "pull-request-state");
  let intent: PrivateDomainProjectIntent;
  let capabilityObservations: readonly PrivateDomainCapabilityObservation[];
  if (workflowValue === "local-reviewed-change") {
    if (trackerValue !== "local" && trackerValue !== "none") {
      return failure(
        "INVALID_OPTION_VALUE",
        "Local reviewed change requires --tracker local or none.",
        "--tracker",
      );
    }
    if (
      ci !== undefined ||
      pullRequestHost !== undefined ||
      pullRequestState !== undefined
    ) {
      return failure(
        "INVALID_ARGUMENTS",
        "Pull-request options are not accepted for local-reviewed-change.",
      );
    }
    intent = {
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
    capabilityObservations = privateLocalReviewedChangeCapabilityObservations;
  } else {
    if (trackerValue !== "github-issues" && trackerValue !== "linear") {
      return failure(
        "INVALID_OPTION_VALUE",
        "Issue-to-reviewed-pull-request requires --tracker github-issues or linear.",
        "--tracker",
      );
    }
    if (pullRequestState === undefined) {
      return missingOption("pull-request-state");
    }
    if (pullRequestState !== "draft" && pullRequestState !== "ready") {
      return failure(
        "INVALID_OPTION_VALUE",
        "Option --pull-request-state must be one of: draft, ready.",
        "--pull-request-state",
      );
    }
    if (pullRequestHost === undefined) {
      return missingOption("pull-request-host");
    }
    if (ci === undefined) {
      return missingOption("ci");
    }
    intent = {
      revision: 1,
      preset: presetValue,
      providers,
      roles: { developer, reviewer, steward },
      tracker: { mode: trackerValue },
      workflow: {
        family: workflowValue,
        initialState: pullRequestState,
        auxiliaryReview: "disabled",
        mergeMethod: "squash",
      },
      capabilityBindings: [
        { binding: "tracker", target: { kind: "tracker" } },
        {
          binding: "developer",
          target: { kind: "responsibility", responsibility: "developer" },
        },
        {
          binding: "pull-request-host",
          target: { kind: "external", id: pullRequestHost },
        },
        { binding: "ci", target: { kind: "external", id: ci } },
        {
          binding: "reviewer",
          target: { kind: "responsibility", responsibility: "reviewer" },
        },
      ],
    };
    capabilityObservations = privateIssueToPullRequestCapabilityObservations;
  }
  const resolved = resolvePrivateDomainProject(intent, {
    capabilityObservations,
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

function invalidRuleId(ruleId: string): PrivateCliFailure {
  return failure(
    "INVALID_RULE_ID",
    `Rule id ${JSON.stringify(ruleId)} must match ${privateProjectGuidanceRuleIdPattern.source}, contain at most ${privateProjectGuidanceRuleIdMaxLength} ASCII characters, and not be a reserved Windows filename.`,
  );
}

function parseRuleId(
  args: readonly string[],
):
  | {
      readonly ok: true;
      readonly ruleId: string;
      readonly optionArgs: readonly string[];
    }
  | { readonly ok: false; readonly result: PrivateCliFailure } {
  const [ruleId, ...optionArgs] = args;
  if (ruleId === undefined || ruleId.startsWith("-")) {
    return {
      ok: false,
      result: failure(
        "INVALID_ARGUMENTS",
        "A rule id positional argument is required.",
      ),
    };
  }
  if (!isPrivateProjectGuidanceRuleId(ruleId)) {
    return { ok: false, result: invalidRuleId(ruleId) };
  }
  return { ok: true, ruleId, optionArgs };
}

function parseRuleContentInput(
  values: Record<string, ParsedValue>,
): PrivateRuleContentInput | PrivateCliFailure {
  const fileValue = values.file;
  const fileSelected = typeof fileValue === "string";
  const stdin = values.stdin === true;
  if (fileSelected === stdin) {
    return failure(
      "INVALID_ARGUMENTS",
      "Exactly one of --file or --stdin is required.",
    );
  }
  if (fileSelected && fileValue.length === 0) {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --file must not be empty.",
      "--file",
    );
  }
  if (
    fileSelected &&
    (isAbsolute(fileValue) || win32.isAbsolute(fileValue))
  ) {
    return failure(
      "INVALID_OPTION_VALUE",
      "Option --file must be a repository-relative path.",
      "--file",
    );
  }
  return !fileSelected
    ? { kind: "stdin" }
    : { kind: "file", path: fileValue };
}

function parseRuleListArguments(
  args: readonly string[],
): PrivateCliArgumentResult {
  const parsed = parseCommandOptions(args, {
    json: booleanOption,
    repository: stringOption,
  });
  if (!parsed.ok) return parsed.result;
  return {
    ok: true,
    invocation: {
      command: "rule",
      operation: "list",
      repositoryPath:
        stringValue(parsed.values, "repository") ?? defaultRepositoryPath,
      outputFormat: outputFormat(parsed.values),
    },
  };
}

function parseRuleShowOrRemoveArguments(
  operation: "show" | "remove",
  args: readonly string[],
): PrivateCliArgumentResult {
  const id = parseRuleId(args);
  if (!id.ok) return id.result;
  const parsed = parseCommandOptions(id.optionArgs, {
    json: booleanOption,
    repository: stringOption,
  });
  if (!parsed.ok) return parsed.result;
  const repositoryPath =
    stringValue(parsed.values, "repository") ?? defaultRepositoryPath;
  const selectedOutputFormat = outputFormat(parsed.values);
  if (operation === "show") {
    return {
      ok: true,
      invocation: {
        command: "rule",
        operation: "show",
        repositoryPath,
        ruleId: id.ruleId,
        outputFormat: selectedOutputFormat,
      },
    };
  }
  return {
    ok: true,
    invocation: {
      command: "rule",
      operation: "remove",
      repositoryPath,
      ruleId: id.ruleId,
      outputFormat: selectedOutputFormat,
    },
  };
}

function parseRuleAddArguments(
  args: readonly string[],
): PrivateCliArgumentResult {
  const id = parseRuleId(args);
  if (!id.ok) return id.result;
  const parsed = parseCommandOptions(id.optionArgs, {
    file: stringOption,
    json: booleanOption,
    repository: stringOption,
    scope: stringOption,
    stdin: booleanOption,
  });
  if (!parsed.ok) return parsed.result;
  const scopeValue = requireStringOption(parsed.values, "scope");
  if (isFailure(scopeValue)) return scopeValue;
  const scope = parseClosedValue(
    scopeValue,
    privateRuleScopes,
    "scope",
  );
  if (isFailure(scope)) return scope;
  const input = parseRuleContentInput(parsed.values);
  if ("ok" in input) return input;
  return {
    ok: true,
    invocation: {
      command: "rule",
      operation: "add",
      repositoryPath:
        stringValue(parsed.values, "repository") ?? defaultRepositoryPath,
      ruleId: id.ruleId,
      scope,
      input,
      outputFormat: outputFormat(parsed.values),
    },
  };
}

function parseRuleUpdateArguments(
  args: readonly string[],
): PrivateCliArgumentResult {
  const id = parseRuleId(args);
  if (!id.ok) return id.result;
  const parsed = parseCommandOptions(id.optionArgs, {
    file: stringOption,
    json: booleanOption,
    repository: stringOption,
    stdin: booleanOption,
  });
  if (!parsed.ok) return parsed.result;
  const input = parseRuleContentInput(parsed.values);
  if ("ok" in input) return input;
  return {
    ok: true,
    invocation: {
      command: "rule",
      operation: "update",
      repositoryPath:
        stringValue(parsed.values, "repository") ?? defaultRepositoryPath,
      ruleId: id.ruleId,
      input,
      outputFormat: outputFormat(parsed.values),
    },
  };
}

function parseRuleArguments(args: readonly string[]): PrivateCliArgumentResult {
  const [operationValue, ...operationArgs] = args;
  if (operationValue === undefined) {
    return failure(
      "MISSING_RULE_OPERATION",
      "A rule operation is required.",
    );
  }
  if (!privateRuleOperations.includes(operationValue as PrivateRuleOperation)) {
    return failure(
      "UNKNOWN_RULE_OPERATION",
      `Unknown rule operation: ${operationValue}.`,
    );
  }
  const operation = operationValue as PrivateRuleOperation;
  switch (operation) {
    case "add":
      return parseRuleAddArguments(operationArgs);
    case "list":
      return parseRuleListArguments(operationArgs);
    case "remove":
    case "show":
      return parseRuleShowOrRemoveArguments(operation, operationArgs);
    case "update":
      return parseRuleUpdateArguments(operationArgs);
  }
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
    case "init":
      return parseInitArguments(commandArgs);
    case "render":
      return parseRenderArguments(commandArgs);
    case "rule":
      return parseRuleArguments(commandArgs);
  }
}
