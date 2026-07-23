import { createHash } from "node:crypto";

import type {
  DisplayDiagnostic,
  PrivateRuleCommandResult,
  PrivateRuleRecord,
  PrivateRuleSummary,
} from "../cli/private-local-cli-output.js";
import {
  flattenPrivateProjectGuidanceRules,
  privateProjectGuidanceFileMaxBytes,
  privateProjectGuidanceRulePath,
  readPrivateProjectGuidance,
  type PrivateProjectGuidanceDiagnostic,
  type PrivateProjectGuidanceRule,
} from "../guidance/private-project-guidance.js";
import type { PrivateCliInvocation } from "../interface/private-cli-arguments.js";
import { createPrivateConvergentMutationIntent } from "../workspace/private-convergent-intent.js";
import {
  PrivateFilesystemWorkspace,
  PrivateFilesystemWorkspaceError,
} from "../workspace/private-filesystem-workspace.js";

type PrivateRuleInvocation = Extract<
  PrivateCliInvocation,
  { readonly command: "rule" }
>;

export interface ExecutePrivateRuleCommandOptions {
  readonly invocation: PrivateRuleInvocation;
  readonly workspace: PrivateFilesystemWorkspace;
  readonly stdinContent?: string;
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function summary(rule: PrivateProjectGuidanceRule): PrivateRuleSummary {
  return {
    id: rule.id,
    scope: rule.scope,
    path: rule.path,
  };
}

function record(rule: PrivateProjectGuidanceRule): PrivateRuleRecord {
  return { ...summary(rule), content: rule.content };
}

function displayDiagnostic(
  diagnostic: PrivateProjectGuidanceDiagnostic,
): DisplayDiagnostic {
  return {
    code: diagnostic.code,
    level: "error",
    message: diagnostic.message,
    path: diagnostic.path,
  };
}

function blocked(
  operation: PrivateRuleInvocation["operation"],
  diagnostics: readonly DisplayDiagnostic[],
): PrivateRuleCommandResult {
  return {
    operation,
    outcome: "blocked",
    exitCode: 2,
    diagnostics,
  };
}

function operationDiagnostic(options: {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}): DisplayDiagnostic {
  return {
    code: options.code,
    level: "error",
    message: options.message,
    ...(options.path === undefined ? {} : { path: options.path }),
  };
}

function errorCode(error: unknown): string {
  return error instanceof PrivateFilesystemWorkspaceError
    ? error.code
    : error instanceof Error &&
        "code" in error &&
        typeof error.code === "string"
      ? error.code
      : "UNKNOWN";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function inputContent(
  invocation: Extract<
    PrivateRuleInvocation,
    { readonly operation: "add" | "update" }
  >,
  workspace: PrivateFilesystemWorkspace,
  stdinContent: string | undefined,
):
  Promise<
    | { readonly ok: true; readonly content: string }
    | { readonly ok: false; readonly diagnostic: DisplayDiagnostic }
  > {
  if (invocation.input.kind === "stdin") {
    if (stdinContent === undefined) {
      return {
        ok: false,
        diagnostic: operationDiagnostic({
          code: "RULE_INPUT_READ_FAILED",
          message: "Rule content could not be read from standard input.",
        }),
      };
    }
    if (
      Buffer.byteLength(stdinContent, "utf8") >
      privateProjectGuidanceFileMaxBytes
    ) {
      return {
        ok: false,
        diagnostic: operationDiagnostic({
          code: "RULE_INPUT_TOO_LARGE",
          message: `Rule content exceeds ${privateProjectGuidanceFileMaxBytes} UTF-8 bytes.`,
        }),
      };
    }
    return { ok: true, content: stdinContent };
  }

  try {
    const content = await workspace.readBounded(
      invocation.input.path,
      privateProjectGuidanceFileMaxBytes,
    );
    if (content === null) {
      return {
        ok: false,
        diagnostic: operationDiagnostic({
          code: "RULE_INPUT_READ_FAILED",
          message:
            "The repository-relative --file path must identify a readable regular UTF-8 file.",
          path: invocation.input.path,
        }),
      };
    }
    return { ok: true, content };
  } catch (error) {
    return {
      ok: false,
      diagnostic: operationDiagnostic({
        code: "RULE_INPUT_READ_FAILED",
        message: `Rule input could not be read (${errorCode(error)}): ${errorMessage(error)}`,
        path: invocation.input.path,
      }),
    };
  }
}

function mutationDigest(options: {
  readonly operation: "add" | "remove" | "update";
  readonly path: string;
  readonly beforeDigest: string | null;
  readonly afterDigest: string | null;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        revision: 1,
        operation: options.operation,
        path: options.path,
        beforeDigest: options.beforeDigest,
        afterDigest: options.afterDigest,
      }),
    )
    .digest("hex");
}

async function loadRules(
  invocation: PrivateRuleInvocation,
  workspace: PrivateFilesystemWorkspace,
): Promise<
  | { readonly ok: true; readonly rules: readonly PrivateProjectGuidanceRule[] }
  | { readonly ok: false; readonly result: PrivateRuleCommandResult }
> {
  const observed = await readPrivateProjectGuidance(workspace);
  if (!observed.ok) {
    return {
      ok: false,
      result: blocked(
        invocation.operation,
        observed.diagnostics.map(displayDiagnostic),
      ),
    };
  }
  return {
    ok: true,
    rules: flattenPrivateProjectGuidanceRules(observed.guidance),
  };
}

function findRule(
  rules: readonly PrivateProjectGuidanceRule[],
  id: string,
): PrivateProjectGuidanceRule | undefined {
  return rules.find((rule) => rule.id === id);
}

export async function executePrivateRuleCommand(
  options: ExecutePrivateRuleCommandOptions,
): Promise<PrivateRuleCommandResult> {
  const { invocation, workspace } = options;
  const loaded = await loadRules(invocation, workspace);
  if (!loaded.ok) {
    return loaded.result;
  }
  const rules = [...loaded.rules].sort(
    (left, right) =>
      compareText(left.id, right.id) ||
      compareText(left.scope, right.scope) ||
      compareText(left.path, right.path),
  );

  if (invocation.operation === "list") {
    return {
      operation: "list",
      outcome: "success",
      exitCode: 0,
      diagnostics: [],
      rules: rules.map(summary),
    };
  }

  const existing = findRule(rules, invocation.ruleId);
  if (invocation.operation === "show") {
    return existing === undefined
      ? blocked("show", [
          operationDiagnostic({
            code: "RULE_NOT_FOUND",
            message: `Rule id ${invocation.ruleId} does not exist.`,
          }),
        ])
      : {
          operation: "show",
          outcome: "success",
          exitCode: 0,
          diagnostics: [],
          rule: record(existing),
        };
  }

  if (invocation.operation === "add" && existing !== undefined) {
    return blocked("add", [
      operationDiagnostic({
        code: "RULE_ALREADY_EXISTS",
        message: `Rule id ${invocation.ruleId} already exists.`,
        path: existing.path,
      }),
    ]);
  }
  if (invocation.operation !== "add" && existing === undefined) {
    return blocked(invocation.operation, [
      operationDiagnostic({
        code: "RULE_NOT_FOUND",
        message: `Rule id ${invocation.ruleId} does not exist.`,
      }),
    ]);
  }

  if (invocation.operation === "remove") {
    const rule = existing as PrivateProjectGuidanceRule;
    try {
      const outcome = await workspace.removeAtomically(rule.path, {
        beforeDigest: digest(rule.content),
        afterDigest: null,
      });
      if (outcome !== "applied") {
        return blocked("remove", [
          operationDiagnostic({
            code: "RULE_STATE_CHANGED",
            message:
              "The canonical rule changed after it was read. Rerun the command against current state.",
            path: rule.path,
          }),
        ]);
      }
      return {
        operation: "remove",
        outcome: "success",
        exitCode: 0,
        diagnostics: [],
        rule: summary(rule),
      };
    } catch (error) {
      return blocked("remove", [
        operationDiagnostic({
          code: "RULE_MUTATION_FAILED",
          message: `Canonical rule removal failed (${errorCode(error)}): ${errorMessage(error)}`,
          path: rule.path,
        }),
      ]);
    }
  }

  if (
    invocation.operation !== "add" &&
    invocation.operation !== "update"
  ) {
    throw new Error("Private rule command narrowing failed.");
  }
  const input = await inputContent(
    invocation,
    workspace,
    options.stdinContent,
  );
  if (!input.ok) {
    return blocked(invocation.operation, [input.diagnostic]);
  }

  if (invocation.operation === "add") {
    const path = privateProjectGuidanceRulePath(
      invocation.scope,
      invocation.ruleId,
    );
    try {
      if (!(await workspace.createExclusively(path, input.content))) {
        return blocked("add", [
          operationDiagnostic({
            code: "RULE_STATE_CHANGED",
            message:
              "The canonical rule target appeared after validation. Rerun the command against current state.",
            path,
          }),
        ]);
      }
      return {
        operation: "add",
        outcome: "success",
        exitCode: 0,
        diagnostics: [],
        rule: { id: invocation.ruleId, scope: invocation.scope, path },
      };
    } catch (error) {
      return blocked("add", [
        operationDiagnostic({
          code: "RULE_MUTATION_FAILED",
          message: `Canonical rule creation failed (${errorCode(error)}): ${errorMessage(error)}`,
          path,
        }),
      ]);
    }
  }

  const rule = existing as PrivateProjectGuidanceRule;
  const beforeDigest = digest(rule.content);
  const afterDigest = digest(input.content);
  if (beforeDigest === afterDigest) {
    return {
      operation: "update",
      outcome: "success",
      exitCode: 0,
      diagnostics: [],
      rule: summary(rule),
    };
  }
  const operationDigest = mutationDigest({
    operation: "update",
    path: rule.path,
    beforeDigest,
    afterDigest,
  });
  const intent = createPrivateConvergentMutationIntent({
    planDigest: operationDigest,
    targetPath: rule.path,
    targetDigest: afterDigest,
  });
  try {
    const outcome = await workspace.writeConvergently(
      intent,
      input.content,
      { beforeDigest, afterDigest },
    );
    if (outcome === "drift") {
      return blocked("update", [
        operationDiagnostic({
          code: "RULE_STATE_CHANGED",
          message:
            "The canonical rule changed after it was read. Rerun the command against current state.",
          path: rule.path,
        }),
      ]);
    }
    return {
      operation: "update",
      outcome: "success",
      exitCode: 0,
      diagnostics: [],
      rule: summary(rule),
    };
  } catch (error) {
    return blocked("update", [
      operationDiagnostic({
        code: "RULE_MUTATION_FAILED",
        message: `Canonical rule update failed (${errorCode(error)}): ${errorMessage(error)}`,
        path: rule.path,
      }),
    ]);
  }
}
