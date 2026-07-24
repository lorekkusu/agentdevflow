import type { PrivateDomainProjectPlanDiagnostic } from "../application/private-domain-project-plan.js";
import type {
  PrivateCheckCommandResult,
  PrivateCheckDiagnosticLevel,
} from "../commands/private-check-command-service.js";
import type { PrivateDiffCommandResult } from "../commands/private-diff-command-service.js";
import type { PrivateRenderCommandResult } from "../commands/private-render-command-service.js";
import type {
  PrivateCliDiagnostic,
  PrivateCliOutputFormat,
  PrivateRuleOperation,
  PrivateRuleScope,
} from "../interface/private-cli-arguments.js";
import type { PrivateDomainProjectDocumentDiagnostic } from "../interface/private-domain-project-document.js";
import type { PrivateExistingProjectInventoryResult } from "../onboarding/private-existing-project-inventory.js";

export interface PrivateLocalCliIo {
  readonly stdout: { write(content: string): unknown };
  readonly stderr: { write(content: string): unknown };
}

export interface DisplayDiagnostic {
  readonly code: string;
  readonly level: PrivateCheckDiagnosticLevel;
  readonly message: string;
  readonly path?: string;
}

type PlanningDiagnostic =
  | PrivateDomainProjectDocumentDiagnostic
  | PrivateDomainProjectPlanDiagnostic;

export type PrivateLocalCliCommand =
  | "check"
  | "diff"
  | "init"
  | "onboard"
  | "render"
  | "rule";
type PrivatePlanningCliCommand = Exclude<
  PrivateLocalCliCommand,
  "onboard" | "rule"
>;

export interface PrivateRuleSummary {
  readonly id: string;
  readonly scope: PrivateRuleScope;
  readonly path: string;
}

export interface PrivateRuleRecord extends PrivateRuleSummary {
  readonly content: string;
}

export type PrivateRuleCommandResult =
  | {
      readonly operation: "list";
      readonly outcome: "success";
      readonly exitCode: 0;
      readonly diagnostics: readonly DisplayDiagnostic[];
      readonly rules: readonly PrivateRuleSummary[];
    }
  | {
      readonly operation: "show";
      readonly outcome: "success";
      readonly exitCode: 0;
      readonly diagnostics: readonly DisplayDiagnostic[];
      readonly rule: PrivateRuleRecord;
    }
  | {
      readonly operation: "add" | "remove" | "update";
      readonly outcome: "success";
      readonly exitCode: 0;
      readonly diagnostics: readonly DisplayDiagnostic[];
      readonly rule: PrivateRuleSummary;
    }
  | {
      readonly operation: PrivateRuleOperation;
      readonly outcome: "blocked";
      readonly exitCode: 2;
      readonly diagnostics: readonly DisplayDiagnostic[];
    };

export const privateCliJsonSchemaVersion = 1;
export const privateCliOutputByteLimit = 1_048_576;

function machineOutput(value: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(
    { schemaVersion: privateCliJsonSchemaVersion, ...value },
    null,
    2,
  );
}

function selectedOutput(
  format: PrivateCliOutputFormat,
  human: string,
  machine: Readonly<Record<string, unknown>>,
): string {
  return format === "json" ? machineOutput(machine) : human;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareDisplayDiagnostics(
  left: DisplayDiagnostic,
  right: DisplayDiagnostic,
): number {
  return (
    compareText(left.code, right.code) ||
    compareText(left.path ?? "", right.path ?? "") ||
    compareText(left.message, right.message)
  );
}

function displayLine(diagnostic: DisplayDiagnostic): string {
  const path = diagnostic.path === undefined ? "" : ` (${diagnostic.path})`;
  return `  [${diagnostic.level}] ${diagnostic.code}${path}: ${diagnostic.message}`;
}

export function formatDiagnostics(
  diagnostics: readonly DisplayDiagnostic[],
): readonly string[] {
  if (diagnostics.length === 0) {
    return ["diagnostics: none"];
  }
  return [
    "diagnostics:",
    ...[...diagnostics].sort(compareDisplayDiagnostics).map(displayLine),
  ];
}

export function cliDiagnostics(
  diagnostics: readonly PrivateCliDiagnostic[],
): readonly DisplayDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    level: "error",
    message: diagnostic.message,
    ...(diagnostic.path === undefined ? {} : { path: diagnostic.path }),
  }));
}

export function planningDiagnostics(
  diagnostics: readonly PlanningDiagnostic[],
): readonly DisplayDiagnostic[] {
  const result: DisplayDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    result.push({
      code: diagnostic.code,
      level: "error",
      message: diagnostic.message,
      path: diagnostic.path,
    });
    if (!("cause" in diagnostic) || diagnostic.cause === undefined) {
      continue;
    }
    const cause = diagnostic.cause;
    result.push({
      code: cause.code,
      level: "error",
      message: cause.message,
      path: cause.path,
    });
    if ("causes" in cause) {
      result.push(
        ...cause.causes.map((nested) => ({
          code: nested.code,
          level: "error" as const,
          message: nested.message,
          path: nested.path,
        })),
      );
    }
  }
  return result;
}

export function resultHeader(options: {
  readonly command: PrivatePlanningCliCommand;
  readonly outcome: string;
  readonly planDigest: string | null;
  readonly snapshotDigest: string | null;
}): string[] {
  return [
    `agentdevflow ${options.command}: ${options.outcome}`,
    `exact-plan-digest: ${options.snapshotDigest ?? "unavailable"}`,
    `renderer-plan-digest: ${options.planDigest ?? "unavailable"}`,
  ];
}

export function formatCheck(
  result: PrivateCheckCommandResult,
  format: PrivateCliOutputFormat = "human",
): string {
  const human = [
    ...resultHeader({ command: "check", ...result }),
    ...formatDiagnostics(result.diagnostics),
  ].join("\n");
  return selectedOutput(format, human, {
    command: "check",
    outcome: result.outcome,
    exitCode: result.candidateExitCode,
    exactPlanDigest: result.snapshotDigest,
    rendererPlanDigest: result.planDigest,
    diagnostics: [...result.diagnostics].sort(compareDisplayDiagnostics),
  });
}

function safeHumanContentLine(line: string): string {
  return line.replace(
    /[\u0000-\u0009\u000b-\u001f\u007f]/gu,
    (character) => {
      switch (character) {
        case "\t":
          return "\\t";
        case "\r":
          return "\\r";
        default:
          return `\\u${character.codePointAt(0)?.toString(16).padStart(4, "0")}`;
      }
    },
  );
}

function humanContent(label: "before" | "after", value: string | null): string[] {
  if (value === null) {
    return [`  ${label}-content: <absent>`];
  }
  const hasFinalNewline = value.endsWith("\n");
  const contentLines = value.split("\n");
  if (hasFinalNewline) {
    contentLines.pop();
  }
  const width = String(Math.max(1, contentLines.length)).length;
  return [
    `  ${label}-content:`,
    ...contentLines.map(
      (line, index) =>
        `    ${String(index + 1).padStart(width)} | ${safeHumanContentLine(line)}`,
    ),
    `  ${label}-final-newline: ${hasFinalNewline ? "yes" : "no"}`,
  ];
}

function compareRuleSummary(
  left: PrivateRuleSummary,
  right: PrivateRuleSummary,
): number {
  return (
    compareText(left.id, right.id) ||
    compareText(left.scope, right.scope) ||
    compareText(left.path, right.path)
  );
}

function normalizedRuleSummary(
  rule: PrivateRuleSummary,
): PrivateRuleSummary {
  return {
    id: rule.id,
    scope: rule.scope,
    path: rule.path,
  };
}

function normalizedRuleRecord(
  rule: PrivateRuleRecord,
): PrivateRuleRecord {
  return {
    ...normalizedRuleSummary(rule),
    content: rule.content,
  };
}

function ruleSummaryLines(
  rule: PrivateRuleSummary,
  indentation = "",
): string[] {
  return [
    `${indentation}id: ${rule.id}`,
    `${indentation}scope: ${rule.scope}`,
    `${indentation}path: ${rule.path}`,
  ];
}

function ruleContentLines(content: string): string[] {
  const hasFinalNewline = content.endsWith("\n");
  const contentLines = content.split("\n");
  if (hasFinalNewline) {
    contentLines.pop();
  }
  const width = String(Math.max(1, contentLines.length)).length;
  return [
    "  content:",
    ...contentLines.map(
      (line, index) =>
        `    ${String(index + 1).padStart(width)} | ${safeHumanContentLine(line)}`,
    ),
    `  content-final-newline: ${hasFinalNewline ? "yes" : "no"}`,
  ];
}

function inventoryContentLines(content: string | null): string[] {
  if (content === null) {
    return ["  content: <absent>"];
  }
  const hasFinalNewline = content.endsWith("\n");
  const contentLines = content.split("\n");
  if (hasFinalNewline) {
    contentLines.pop();
  }
  const width = String(Math.max(1, contentLines.length)).length;
  return [
    "  content:",
    ...contentLines.map(
      (line, index) =>
        `    ${String(index + 1).padStart(width)} | ${safeHumanContentLine(line)}`,
    ),
    `  content-final-newline: ${hasFinalNewline ? "yes" : "no"}`,
  ];
}

export function formatExistingProjectInventory(
  result: PrivateExistingProjectInventoryResult,
  format: PrivateCliOutputFormat = "human",
): string {
  const diagnostics = [...result.diagnostics].sort(compareDisplayDiagnostics);
  const lines = [
    `agentdevflow onboard: ${result.outcome}`,
    ...formatDiagnostics(diagnostics),
  ];
  if (result.outcome === "blocked") {
    lines.push("targets: unavailable");
    return selectedOutput(format, lines.join("\n"), {
      command: "onboard",
      outcome: result.outcome,
      exitCode: result.exitCode,
      diagnostics,
      targets: null,
    });
  }
  lines.push(`targets: ${result.targets.length}`);
  for (const [index, target] of result.targets.entries()) {
    lines.push(
      `target ${index + 1}:`,
      `  provider: ${target.provider}`,
      `  path: ${target.path}`,
      `  disposition: ${target.disposition}`,
      `  classification: ${target.classification}`,
      `  byte-count: ${target.byteCount ?? "absent"}`,
      `  observed-sha256: ${target.observedDigest ?? "absent"}`,
      ...inventoryContentLines(target.content),
    );
  }
  lines.push(
    "next: represent retained content with rule commands, then run diff with one exact --replace-existing path=sha256 input per reviewed unmanaged target",
  );
  return selectedOutput(format, lines.join("\n"), {
    command: "onboard",
    outcome: result.outcome,
    exitCode: result.exitCode,
    diagnostics,
    targets: result.targets,
  });
}

export function formatRuleResult(
  result: PrivateRuleCommandResult,
  format: PrivateCliOutputFormat = "human",
): string {
  const diagnostics = [...result.diagnostics].sort(compareDisplayDiagnostics);
  const lines = [
    `agentdevflow rule ${result.operation}: ${result.outcome}`,
    ...formatDiagnostics(diagnostics),
  ];
  if (result.outcome === "blocked") {
    lines.push(result.operation === "list" ? "rules: unavailable" : "rule: unavailable");
    return selectedOutput(format, lines.join("\n"), {
      command: "rule",
      operation: result.operation,
      outcome: result.outcome,
      exitCode: result.exitCode,
      diagnostics,
      ...(result.operation === "list" ? { rules: null } : { rule: null }),
    });
  }
  if (result.operation === "list") {
    const rules = result.rules
      .map(normalizedRuleSummary)
      .sort(compareRuleSummary);
    lines.push(`rules: ${rules.length === 0 ? "none" : rules.length}`);
    for (const [index, rule] of rules.entries()) {
      lines.push(`rule ${index + 1}:`, ...ruleSummaryLines(rule, "  "));
    }
    return selectedOutput(format, lines.join("\n"), {
      command: "rule",
      operation: result.operation,
      outcome: result.outcome,
      exitCode: result.exitCode,
      diagnostics,
      rules,
    });
  }
  if (result.operation === "show") {
    const rule = normalizedRuleRecord(result.rule);
    lines.push("rule:", ...ruleSummaryLines(rule, "  "));
    lines.push(...ruleContentLines(rule.content));
    return selectedOutput(format, lines.join("\n"), {
      command: "rule",
      operation: result.operation,
      outcome: result.outcome,
      exitCode: result.exitCode,
      diagnostics,
      rule,
    });
  }
  const rule = normalizedRuleSummary(result.rule);
  lines.push("rule:", ...ruleSummaryLines(rule, "  "));
  return selectedOutput(format, lines.join("\n"), {
    command: "rule",
    operation: result.operation,
    outcome: result.outcome,
    exitCode: result.exitCode,
    diagnostics,
    rule,
  });
}

export function formatDiff(
  result: PrivateDiffCommandResult,
  format: PrivateCliOutputFormat = "human",
): string {
  const lines = [
    ...resultHeader({ command: "diff", ...result }),
    ...formatDiagnostics(result.diagnostics),
  ];
  if (result.outcome === "blocked") {
    lines.push("changes: unavailable");
    return selectedOutput(format, lines.join("\n"), {
      command: "diff",
      outcome: result.outcome,
      exitCode: result.candidateExitCode,
      exactPlanDigest: result.snapshotDigest,
      rendererPlanDigest: result.planDigest,
      diagnostics: [...result.diagnostics].sort(compareDisplayDiagnostics),
      changes: null,
    });
  }
  if (result.changes.length === 0) {
    lines.push("changes: none");
    return selectedOutput(format, lines.join("\n"), {
      command: "diff",
      outcome: result.outcome,
      exitCode: result.candidateExitCode,
      exactPlanDigest: result.snapshotDigest,
      rendererPlanDigest: result.planDigest,
      diagnostics: [...result.diagnostics].sort(compareDisplayDiagnostics),
      changes: [],
    });
  }
  lines.push(`changes: ${result.changes.length}`);
  for (const [index, change] of result.changes.entries()) {
    lines.push(
      `change ${index + 1}:`,
      `  kind: ${change.kind}`,
      `  action: ${change.action}`,
      `  path: ${change.path}`,
      `  before-sha256: ${change.beforeDigest ?? "absent"}`,
      `  after-sha256: ${change.afterDigest ?? "absent"}`,
      ...humanContent("before", change.beforeContent),
      ...humanContent("after", change.afterContent),
    );
  }
  return selectedOutput(format, lines.join("\n"), {
    command: "diff",
    outcome: result.outcome,
    exitCode: result.candidateExitCode,
    exactPlanDigest: result.snapshotDigest,
    rendererPlanDigest: result.planDigest,
    diagnostics: [...result.diagnostics].sort(compareDisplayDiagnostics),
    changes: result.changes,
  });
}

export function formatRender(
  result: PrivateRenderCommandResult,
  format: PrivateCliOutputFormat = "human",
): string {
  const changed =
    result.renderResult.written.length > 0 ||
    result.renderResult.removed.length > 0 ||
    result.lockPublished;
  const outcome = changed ? "applied" : "clean";
  const human = [
    ...resultHeader({
      command: "render",
      outcome,
      planDigest: result.renderResult.planDigest,
      snapshotDigest: result.snapshotDigest,
    }),
    "diagnostics: none",
    `written: ${result.renderResult.written.length === 0 ? "none" : result.renderResult.written.join(", ")}`,
    `removed: ${result.renderResult.removed.length === 0 ? "none" : result.renderResult.removed.join(", ")}`,
    `lock-published: ${result.lockPublished ? "yes" : "no"}`,
  ].join("\n");
  return selectedOutput(format, human, {
    command: "render",
    outcome,
    exitCode: 0,
    exactPlanDigest: result.snapshotDigest,
    rendererPlanDigest: result.renderResult.planDigest,
    diagnostics: [],
    written: result.renderResult.written,
    removed: result.renderResult.removed,
    lockPublished: result.lockPublished,
  });
}

export function formatCleanRenderPlan(options: {
  readonly planDigest: string;
  readonly snapshotDigest: string;
}, format: PrivateCliOutputFormat = "human"): string {
  const human = [
    ...resultHeader({ command: "render", outcome: "clean", ...options }),
    "diagnostics: none",
    "written: none",
    "removed: none",
    "lock-published: no",
  ].join("\n");
  return selectedOutput(format, human, {
    command: "render",
    outcome: "clean",
    exitCode: 0,
    exactPlanDigest: options.snapshotDigest,
    rendererPlanDigest: options.planDigest,
    diagnostics: [],
    written: [],
    removed: [],
    lockPublished: false,
  });
}

function initDisposition(action: string): "create" | "adopt" | "import" | "abort" {
  switch (action) {
    case "create":
      return "create";
    case "unchanged":
      return "adopt";
    case "update":
      return "import";
    default:
      return "abort";
  }
}

export function formatInit(options: {
  readonly outcome: "ready" | "review-required";
  readonly configurationDisposition: "create" | "adopt";
  readonly configurationPath: string;
  readonly configurationContent: string;
  readonly planDigest: string;
  readonly snapshotDigest: string;
  readonly files: readonly {
    readonly path: string;
    readonly action: string;
    readonly expectedDigest: string | null;
  }[];
  readonly diagnostics: readonly DisplayDiagnostic[];
}, format: PrivateCliOutputFormat = "human"): string {
  const diagnostics = [...options.diagnostics].sort(compareDisplayDiagnostics);
  const lines = [
    ...resultHeader({ command: "init", ...options }),
    ...formatDiagnostics(diagnostics),
    `configuration-disposition: ${options.configurationDisposition}`,
    `configuration-path: ${options.configurationPath}`,
    `configuration-content-json: ${JSON.stringify(options.configurationContent)}`,
    `provider-dispositions: ${options.files.length}`,
  ];
  for (const [index, file] of options.files.entries()) {
    lines.push(
      `provider ${index + 1}:`,
      `  disposition: ${initDisposition(file.action)}`,
      `  path: ${file.path}`,
      `  target-sha256: ${file.expectedDigest ?? "absent"}`,
    );
  }
  lines.push(
    options.outcome === "review-required" &&
      options.files.some((file) => file.action === "conflict")
      ? "next: run onboard, represent retained content with rule commands, then run diff with exact --replace-existing inputs"
      : "next: run diff and review the complete exact plan before render",
  );
  return selectedOutput(format, lines.join("\n"), {
    command: "init",
    outcome: options.outcome,
    exitCode: options.outcome === "ready" ? 0 : 1,
    exactPlanDigest: options.snapshotDigest,
    rendererPlanDigest: options.planDigest,
    diagnostics,
    configuration: {
      disposition: options.configurationDisposition,
      path: options.configurationPath,
      content: options.configurationContent,
    },
    providers: options.files.map((file) => ({
      disposition: initDisposition(file.action),
      path: file.path,
      targetDigest: file.expectedDigest,
    })),
  });
}

export function blockedBeforePlanning(
  command: PrivatePlanningCliCommand,
  diagnostic: DisplayDiagnostic,
  format: PrivateCliOutputFormat = "human",
): string {
  return blockedWithoutPlan(command, [diagnostic], format);
}

export function blockedWithoutPlan(
  command: PrivatePlanningCliCommand,
  inputDiagnostics: readonly DisplayDiagnostic[],
  format: PrivateCliOutputFormat = "human",
): string {
  const diagnostics = [...inputDiagnostics].sort(compareDisplayDiagnostics);
  const human = [
    ...resultHeader({
      command,
      outcome: "blocked",
      planDigest: null,
      snapshotDigest: null,
    }),
    ...formatDiagnostics(diagnostics),
    ...(command === "diff" ? ["changes: unavailable"] : []),
  ].join("\n");
  return selectedOutput(format, human, {
    command,
    outcome: "blocked",
    exitCode: 2,
    exactPlanDigest: null,
    rendererPlanDigest: null,
    diagnostics,
    ...(command === "diff" ? { changes: null } : {}),
  });
}

export function blockedWithPlan(
  command: PrivatePlanningCliCommand,
  options: {
    readonly planDigest: string;
    readonly snapshotDigest: string;
    readonly diagnostics: readonly DisplayDiagnostic[];
  },
  format: PrivateCliOutputFormat = "human",
): string {
  const diagnostics = [...options.diagnostics].sort(compareDisplayDiagnostics);
  const human = [
    ...resultHeader({ command, outcome: "blocked", ...options }),
    ...formatDiagnostics(diagnostics),
    ...(command === "diff" ? ["changes: unavailable"] : []),
  ].join("\n");
  return selectedOutput(format, human, {
    command,
    outcome: "blocked",
    exitCode: 2,
    exactPlanDigest: options.snapshotDigest,
    rendererPlanDigest: options.planDigest,
    diagnostics,
    ...(command === "diff" ? { changes: null } : {}),
  });
}

export function formatArgumentFailure(
  diagnostics: readonly DisplayDiagnostic[],
  format: PrivateCliOutputFormat,
): string {
  const sorted = [...diagnostics].sort(compareDisplayDiagnostics);
  return selectedOutput(format, formatDiagnostics(sorted).join("\n"), {
    command: null,
    outcome: "blocked",
    exitCode: 2,
    diagnostics: sorted,
  });
}

export function formatOutputLimitFailure(
  command: PrivatePlanningCliCommand,
  format: PrivateCliOutputFormat,
): string {
  return blockedBeforePlanning(
    command,
    {
      code: "CLI_OUTPUT_TOO_LARGE",
      level: "error",
      message: `The command output exceeds ${privateCliOutputByteLimit} UTF-8 bytes. Narrow the managed input before retrying.`,
    },
    format,
  );
}

export function writeBoundedOutput(
  stream: PrivateLocalCliIo["stdout"] | PrivateLocalCliIo["stderr"],
  command: PrivatePlanningCliCommand,
  format: PrivateCliOutputFormat,
  content: string,
): boolean {
  if (Buffer.byteLength(content, "utf8") <= privateCliOutputByteLimit) {
    writeLine(stream, content);
    return true;
  }
  writeLine(stream, formatOutputLimitFailure(command, format));
  return false;
}

export function formatRuleOutputLimitFailure(
  operation: PrivateRuleOperation,
  format: PrivateCliOutputFormat,
): string {
  return formatRuleResult(
    {
      operation,
      outcome: "blocked",
      exitCode: 2,
      diagnostics: [
        {
          code: "CLI_OUTPUT_TOO_LARGE",
          level: "error",
          message: `The command output exceeds ${privateCliOutputByteLimit} UTF-8 bytes. Narrow the managed input before retrying.`,
        },
      ],
    },
    format,
  );
}

export function writeBoundedRuleOutput(
  stream: PrivateLocalCliIo["stdout"] | PrivateLocalCliIo["stderr"],
  operation: PrivateRuleOperation,
  format: PrivateCliOutputFormat,
  content: string,
): boolean {
  if (Buffer.byteLength(content, "utf8") <= privateCliOutputByteLimit) {
    writeLine(stream, content);
    return true;
  }
  writeLine(stream, formatRuleOutputLimitFailure(operation, format));
  return false;
}

export function writeBoundedOnboardOutput(
  stream: PrivateLocalCliIo["stdout"] | PrivateLocalCliIo["stderr"],
  format: PrivateCliOutputFormat,
  content: string,
): boolean {
  if (Buffer.byteLength(content, "utf8") <= privateCliOutputByteLimit) {
    writeLine(stream, content);
    return true;
  }
  const failure: PrivateExistingProjectInventoryResult = {
    outcome: "blocked",
    exitCode: 2,
    diagnostics: [
      {
        code: "CLI_OUTPUT_TOO_LARGE",
        level: "error",
        message: `The command output exceeds ${privateCliOutputByteLimit} UTF-8 bytes. Reduce the supported instruction files before retrying.`,
      },
    ],
    targets: null,
  };
  writeLine(stream, formatExistingProjectInventory(failure, format));
  return false;
}

export function writeLine(
  stream: PrivateLocalCliIo["stdout"] | PrivateLocalCliIo["stderr"],
  content: string,
): void {
  stream.write(`${content}\n`);
}
