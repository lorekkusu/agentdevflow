import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDiff,
  formatRuleResult,
  privateCliOutputByteLimit,
  writeBoundedOutput,
  writeBoundedRuleOutput,
} from "../../src/cli/private-local-cli-output.js";

test("replaces oversized JSON output with one bounded blocked report", () => {
  let written = "";
  const accepted = writeBoundedOutput(
    { write: (content) => { written += content; } },
    "diff",
    "json",
    "x".repeat(privateCliOutputByteLimit + 1),
  );

  assert.equal(accepted, false);
  assert.ok(Buffer.byteLength(written, "utf8") < privateCliOutputByteLimit);
  const report = JSON.parse(written) as {
    readonly schemaVersion: number;
    readonly exitCode: number;
    readonly diagnostics: readonly { readonly code: string }[];
  };
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.exitCode, 2);
  assert.equal(report.diagnostics[0]?.code, "CLI_OUTPUT_TOO_LARGE");
});

test("renders complete human diff content as reviewable numbered lines", () => {
  const formatted = formatDiff({
    outcome: "changes-required",
    candidateExitCode: 1,
    snapshotDigest: "a".repeat(64),
    planDigest: "b".repeat(64),
    diagnostics: [],
    changes: [
      {
        kind: "managed-output",
        path: "AGENTS.md",
        action: "create",
        beforeDigest: null,
        afterDigest: "c".repeat(64),
        beforeContent: null,
        afterContent: "# Agent instructions\nRun tests.\n",
      },
    ],
  });

  assert.match(formatted, /before-content: <absent>/u);
  assert.match(
    formatted,
    /after-content:\n    1 \| # Agent instructions\n    2 \| Run tests\.\n  after-final-newline: yes/u,
  );
  assert.doesNotMatch(formatted, /content-json/u);
});

test("formats rule lists in stable id order for human and JSON output", () => {
  const result = {
    operation: "list",
    outcome: "success",
    exitCode: 0,
    diagnostics: [],
    rules: [
      {
        id: "run-tests",
        scope: "developer",
        path: ".agentdevflow/rules/developer/run-tests.md",
      },
      {
        id: "review-before-merge",
        scope: "reviewer",
        path: ".agentdevflow/rules/reviewer/review-before-merge.md",
      },
    ],
  } as const;

  assert.equal(
    formatRuleResult(result),
    [
      "agentdevflow rule list: success",
      "diagnostics: none",
      "rules: 2",
      "rule 1:",
      "  id: review-before-merge",
      "  scope: reviewer",
      "  path: .agentdevflow/rules/reviewer/review-before-merge.md",
      "rule 2:",
      "  id: run-tests",
      "  scope: developer",
      "  path: .agentdevflow/rules/developer/run-tests.md",
    ].join("\n"),
  );

  assert.deepEqual(JSON.parse(formatRuleResult(result, "json")), {
    schemaVersion: 1,
    command: "rule",
    operation: "list",
    outcome: "success",
    exitCode: 0,
    diagnostics: [],
    rules: [
      {
        id: "review-before-merge",
        scope: "reviewer",
        path: ".agentdevflow/rules/reviewer/review-before-merge.md",
      },
      {
        id: "run-tests",
        scope: "developer",
        path: ".agentdevflow/rules/developer/run-tests.md",
      },
    ],
  });
});

test("formats a shown rule with reviewable content and a versioned JSON record", () => {
  const result = {
    operation: "show",
    outcome: "success",
    exitCode: 0,
    diagnostics: [],
    rule: {
      id: "run-tests",
      scope: "developer",
      path: ".agentdevflow/rules/developer/run-tests.md",
      content: "Run the required checks.\tDo not skip failures.\n",
    },
  } as const;

  assert.equal(
    formatRuleResult(result),
    [
      "agentdevflow rule show: success",
      "diagnostics: none",
      "rule:",
      "  id: run-tests",
      "  scope: developer",
      "  path: .agentdevflow/rules/developer/run-tests.md",
      "  content:",
      "    1 | Run the required checks.\\tDo not skip failures.",
      "  content-final-newline: yes",
    ].join("\n"),
  );
  assert.deepEqual(JSON.parse(formatRuleResult(result, "json")), {
    schemaVersion: 1,
    command: "rule",
    operation: "show",
    outcome: "success",
    exitCode: 0,
    diagnostics: [],
    rule: result.rule,
  });
});

test("formats mutation success without echoing rule content", () => {
  const result = {
    operation: "add",
    outcome: "success",
    exitCode: 0,
    diagnostics: [],
    rule: {
      id: "run-tests",
      scope: "developer",
      path: ".agentdevflow/rules/developer/run-tests.md",
    },
  } as const;

  assert.equal(
    formatRuleResult(result),
    [
      "agentdevflow rule add: success",
      "diagnostics: none",
      "rule:",
      "  id: run-tests",
      "  scope: developer",
      "  path: .agentdevflow/rules/developer/run-tests.md",
    ].join("\n"),
  );
  assert.deepEqual(JSON.parse(formatRuleResult(result, "json")), {
    schemaVersion: 1,
    command: "rule",
    operation: "add",
    outcome: "success",
    exitCode: 0,
    diagnostics: [],
    rule: result.rule,
  });
});

test("formats blocked rule results with sorted diagnostics and null data", () => {
  const result = {
    operation: "show",
    outcome: "blocked",
    exitCode: 2,
    diagnostics: [
      {
        code: "RULE_NOT_FOUND",
        level: "error",
        message: "Rule run-tests does not exist.",
        path: ".agentdevflow/rules",
      },
      {
        code: "RULE_AGGREGATE_LAYOUT_UNSUPPORTED",
        level: "error",
        message: "Move the aggregate rule before retrying.",
        path: ".agentdevflow/rules/shared.md",
      },
    ],
  } as const;

  assert.equal(
    formatRuleResult(result),
    [
      "agentdevflow rule show: blocked",
      "diagnostics:",
      "  [error] RULE_AGGREGATE_LAYOUT_UNSUPPORTED (.agentdevflow/rules/shared.md): Move the aggregate rule before retrying.",
      "  [error] RULE_NOT_FOUND (.agentdevflow/rules): Rule run-tests does not exist.",
      "rule: unavailable",
    ].join("\n"),
  );
  assert.deepEqual(JSON.parse(formatRuleResult(result, "json")), {
    schemaVersion: 1,
    command: "rule",
    operation: "show",
    outcome: "blocked",
    exitCode: 2,
    diagnostics: [
      {
        code: "RULE_AGGREGATE_LAYOUT_UNSUPPORTED",
        level: "error",
        message: "Move the aggregate rule before retrying.",
        path: ".agentdevflow/rules/shared.md",
      },
      {
        code: "RULE_NOT_FOUND",
        level: "error",
        message: "Rule run-tests does not exist.",
        path: ".agentdevflow/rules",
      },
    ],
    rule: null,
  });
});

test("represents an empty rule list without ambiguity", () => {
  const formatted = formatRuleResult({
    operation: "list",
    outcome: "success",
    exitCode: 0,
    diagnostics: [],
    rules: [],
  });

  assert.equal(
    formatted,
    [
      "agentdevflow rule list: success",
      "diagnostics: none",
      "rules: none",
    ].join("\n"),
  );
});

test("replaces oversized rule JSON with an operation-specific blocked report", () => {
  let written = "";
  const accepted = writeBoundedRuleOutput(
    { write: (content) => { written += content; } },
    "list",
    "json",
    "x".repeat(privateCliOutputByteLimit + 1),
  );

  assert.equal(accepted, false);
  assert.ok(Buffer.byteLength(written, "utf8") < privateCliOutputByteLimit);
  assert.deepEqual(JSON.parse(written), {
    schemaVersion: 1,
    command: "rule",
    operation: "list",
    outcome: "blocked",
    exitCode: 2,
    diagnostics: [
      {
        code: "CLI_OUTPUT_TOO_LARGE",
        level: "error",
        message:
          "The command output exceeds 1048576 UTF-8 bytes. Narrow the managed input before retrying.",
      },
    ],
    rules: null,
  });
});
