import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePrivateCliArguments,
  type PrivateCliArgumentResult,
} from "../../src/interface/private-cli-arguments.js";
import { privateProjectGuidanceRuleIdMaxLength } from "../../src/guidance/private-project-guidance.js";
import {
  balancedInitArguments,
  ownerIssueInitArguments,
  reorderedBalancedInitArguments,
} from "../fixtures/interface/specimens.js";

function expectSuccess(
  result: PrivateCliArgumentResult,
): asserts result is Extract<PrivateCliArgumentResult, { ok: true }> {
  assert.equal(result.ok, true);
}

function expectFailure(
  result: PrivateCliArgumentResult,
): asserts result is Extract<PrivateCliArgumentResult, { ok: false }> {
  assert.equal(result.ok, false);
}

test("represents every supported top-level command without filesystem discovery", () => {
  const digest = "a".repeat(64);
  const cases = [
    [
      "check",
      "--config",
      "project.jsonc",
      "--repository",
      ".",
      "--lock",
      ".agentdevflow/render-lock.json",
    ],
    [
      "onboard",
      "--config",
      "project.jsonc",
      "--repository",
      ".",
      "--lock",
      ".agentdevflow/render-lock.json",
    ],
    [
      "diff",
      "--config",
      "project.jsonc",
      "--repository",
      ".",
      "--lock",
      ".agentdevflow/render-lock.json",
    ],
    [
      "render",
      "--config",
      "project.jsonc",
      "--repository",
      ".",
      "--lock",
      ".agentdevflow/render-lock.json",
      "--approve-plan",
      digest,
    ],
    balancedInitArguments,
    ["rule", "list"],
  ] as const;

  const commands = cases.map((args) => {
    const result = parsePrivateCliArguments(args);
    expectSuccess(result);
    return result.invocation.command;
  });
  assert.deepEqual(commands, [
    "check",
    "onboard",
    "diff",
    "render",
    "init",
    "rule",
  ]);
});

test("retains explicit repository, configuration, and lock paths", () => {
  const result = parsePrivateCliArguments([
    "check",
    "--repository",
    "repository",
    "--config",
    "project.jsonc",
    "--lock",
    ".state/render-lock.json",
  ]);
  expectSuccess(result);
  assert.deepEqual(result.invocation, {
    command: "check",
    projectConfigPath: "project.jsonc",
    repositoryPath: "repository",
    lockPath: ".state/render-lock.json",
    outputFormat: "human",
  });
});

test("retains the selected configuration path for onboard", () => {
  const result = parsePrivateCliArguments([
    "onboard",
    "--repository",
    "repository",
    "--config",
    "project.jsonc",
    "--lock",
    ".state/render-lock.json",
  ]);
  expectSuccess(result);
  assert.deepEqual(result.invocation, {
    command: "onboard",
    agent: null,
    acceptWithoutConfirmation: false,
    projectConfigPath: "project.jsonc",
    repositoryPath: "repository",
    lockPath: ".state/render-lock.json",
    outputFormat: "human",
  });
});

test("parses bounded manual and Codex onboarding selections", () => {
  const manual = parsePrivateCliArguments([
    "onboard",
    "--agent",
    "manual",
    "--json",
  ]);
  expectSuccess(manual);
  assert.equal(manual.invocation.command, "onboard");
  assert.equal(manual.invocation.agent, "manual");
  assert.equal(manual.invocation.acceptWithoutConfirmation, false);
  assert.equal(manual.invocation.outputFormat, "json");

  const codex = parsePrivateCliArguments([
    "onboard",
    "--agent",
    "codex",
    "--yes",
  ]);
  expectSuccess(codex);
  assert.equal(codex.invocation.command, "onboard");
  assert.equal(codex.invocation.agent, "codex");
  assert.equal(codex.invocation.acceptWithoutConfirmation, true);
});

test("rejects ambiguous or unsupported onboarding selections", () => {
  for (const args of [
    ["onboard", "--agent", "claude"],
    ["onboard", "--yes"],
    ["onboard", "--agent", "manual", "--yes"],
    ["onboard", "--agent", "codex", "--json"],
    ["onboard", "--json"],
  ]) {
    const result = parsePrivateCliArguments(args);
    assert.equal(result.ok, false, args.join(" "));
  }
});

test("binds private render approval to an explicit exact plan snapshot", () => {
  const digest = "b".repeat(64);
  const result = parsePrivateCliArguments([
    "render",
    "--repository",
    "repository",
    "--config",
    "project.jsonc",
    "--lock",
    ".state/render-lock.json",
    "--approve-plan",
    digest,
  ]);
  expectSuccess(result);
  assert.deepEqual(result.invocation, {
    command: "render",
    projectConfigPath: "project.jsonc",
    repositoryPath: "repository",
    lockPath: ".state/render-lock.json",
    approvedPlanSnapshotDigest: digest,
    existingTargetReplacements: [],
    outputFormat: "human",
  });
});

test("normalizes exact existing-target replacement inputs for diff and render", () => {
  const agentsDigest = "a".repeat(64);
  const claudeDigest = "b".repeat(64);
  for (const [command, additional] of [
    ["diff", []],
    ["render", ["--approve-plan", "c".repeat(64)]],
  ] as const) {
    const result = parsePrivateCliArguments([
      command,
      ...additional,
      "--replace-existing",
      `CLAUDE.md=${claudeDigest}`,
      "--replace-existing",
      `AGENTS.md=${agentsDigest}`,
    ]);
    expectSuccess(result);
    assert.equal(
      result.invocation.command === "diff" ||
        result.invocation.command === "render",
      true,
    );
    if (
      result.invocation.command !== "diff" &&
      result.invocation.command !== "render"
    ) {
      continue;
    }
    assert.deepEqual(result.invocation.existingTargetReplacements, [
      { path: "AGENTS.md", observedDigest: agentsDigest },
      { path: "CLAUDE.md", observedDigest: claudeDigest },
    ]);
  }
});

test("rejects malformed or duplicate existing-target replacement inputs", () => {
  const digest = "a".repeat(64);
  for (const values of [
    ["AGENTS.md=not-a-digest"],
    [`../AGENTS.md=${digest}`],
    [`nested/../AGENTS.md=${digest}`],
    [`AGENTS.md=${digest}`, `AGENTS.md=${digest}`],
  ]) {
    const result = parsePrivateCliArguments([
      "diff",
      ...values.flatMap((value) => ["--replace-existing", value]),
    ]);
    expectFailure(result);
    assert.equal(result.diagnostics[0]?.code, "INVALID_OPTION_VALUE");
  }
});

test("maps complete Balanced flags to the active revision-1 local intent", () => {
  const result = parsePrivateCliArguments(balancedInitArguments);
  expectSuccess(result);
  assert.equal(result.invocation.command, "init");
  if (result.invocation.command !== "init") return;
  assert.deepEqual(
    result.invocation.intent.providers.map(({ id }) => id),
    ["claude-reviewer", "codex-developer", "cursor-steward"],
  );
  assert.equal(result.invocation.intent.revision, 1);
  assert.equal(
    result.invocation.intent.workflow.family,
    "local-reviewed-change",
  );
  assert.deepEqual(result.invocation.intent.capabilityBindings, [
    {
      binding: "developer",
      target: { kind: "responsibility", responsibility: "developer" },
    },
    {
      binding: "reviewer",
      target: { kind: "responsibility", responsibility: "reviewer" },
    },
  ]);
  assert.deepEqual(
    JSON.parse(result.invocation.configurationContent),
    result.invocation.intent,
  );
});

test("maps the bounded Linear workflow flags to the owner workflow intent", () => {
  const result = parsePrivateCliArguments(ownerIssueInitArguments);
  expectSuccess(result);
  assert.equal(result.invocation.command, "init");
  if (result.invocation.command !== "init") return;
  assert.deepEqual(result.invocation.intent, {
    revision: 1,
    preset: "balanced",
    providers: [
      { id: "codex-control", product: "codex" },
      { id: "cursor-developer", product: "cursor" },
    ],
    roles: {
      developer: "cursor-developer",
      reviewer: "codex-control",
      steward: "codex-control",
    },
    tracker: { mode: "linear" },
    workflow: {
      family: "issue-to-reviewed-pull-request",
      initialState: "ready",
      auxiliaryReview: "disabled",
      mergeMethod: "squash",
    },
    capabilityBindings: [
      {
        binding: "ci",
        target: { kind: "external", id: "github-actions" },
      },
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "pull-request-host",
        target: { kind: "external", id: "github" },
      },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
      { binding: "tracker", target: { kind: "tracker" } },
    ],
  });
  assert.deepEqual(
    JSON.parse(result.invocation.configurationContent),
    result.invocation.intent,
  );
});

test("requires the bounded issue workflow service bindings", () => {
  const missingCi = ownerIssueInitArguments.filter(
    (value, index, values) =>
      value !== "--ci" && values[index - 1] !== "--ci",
  );
  const missingState = ownerIssueInitArguments.filter(
    (value, index, values) =>
      value !== "--pull-request-state" &&
      values[index - 1] !== "--pull-request-state",
  );
  const localWithIssueOptions = [
    ...balancedInitArguments,
    "--pull-request-state",
    "ready",
  ];

  for (const [args, option] of [
    [missingCi, "--ci"],
    [missingState, "--pull-request-state"],
  ] as const) {
    const result = parsePrivateCliArguments(args);
    expectFailure(result);
    assert.equal(result.diagnostics[0]?.code, "MISSING_REQUIRED_OPTION");
    assert.equal(result.diagnostics[0]?.option, option);
  }

  const localResult = parsePrivateCliArguments(localWithIssueOptions);
  expectFailure(localResult);
  assert.equal(localResult.diagnostics[0]?.code, "INVALID_ARGUMENTS");
});

test("normalizes reorder-equivalent flag sequences identically", () => {
  const first = parsePrivateCliArguments(balancedInitArguments);
  const second = parsePrivateCliArguments(reorderedBalancedInitArguments);
  expectSuccess(first);
  expectSuccess(second);
  assert.equal(first.invocation.command, "init");
  assert.equal(second.invocation.command, "init");
  if (first.invocation.command !== "init" || second.invocation.command !== "init") {
    return;
  }
  assert.deepEqual(second.invocation.intent, first.invocation.intent);
  assert.equal(
    second.invocation.configurationContent,
    first.invocation.configurationContent,
  );
});

test("retains explicit initialization repository, configuration, and lock paths", () => {
  const result = parsePrivateCliArguments(balancedInitArguments);
  expectSuccess(result);
  assert.equal(result.invocation.command, "init");
  if (result.invocation.command !== "init") return;
  assert.equal(result.invocation.repositoryPath, ".");
  assert.equal(result.invocation.projectConfigPath, "project-config.jsonc");
  assert.equal(
    result.invocation.lockPath,
    ".agentdevflow/render-lock.json",
  );
});

test("rejects duplicate singleton options instead of accepting last-wins", () => {
  const first = parsePrivateCliArguments([
    "check",
    "--config",
    "first.jsonc",
    "--config",
    "second.jsonc",
  ]);
  const second = parsePrivateCliArguments([
    "check",
    "--config",
    "first.jsonc",
    "--config",
    "second.jsonc",
  ]);
  expectFailure(first);
  expectFailure(second);
  assert.deepEqual(second.diagnostics, first.diagnostics);
  assert.deepEqual(first.diagnostics, [
    {
      code: "DUPLICATE_OPTION",
      option: "--config",
      message: "Option --config must not be repeated.",
    },
  ]);
});

test("rejects unknown, missing, and malformed candidate inputs", () => {
  const cases = [
    [],
    ["unknown"],
    ["doctor"],
    ["check", "--unknown"],
    [
      "render",
      "--config",
      "project.jsonc",
      "--repository",
      ".",
      "--lock",
      ".agentdevflow/render-lock.json",
      "--approve-plan",
      "not-a-digest",
    ],
    [...balancedInitArguments, "--provider", "invalid"],
    ownerIssueInitArguments.map((value, index, values) =>
      values[index - 1] === "--tracker" ? "none" : value,
    ),
  ] as const;

  const codes = cases.map((args) => {
    const result = parsePrivateCliArguments(args);
    expectFailure(result);
    return result.diagnostics[0]?.code;
  });
  assert.deepEqual(codes, [
    "MISSING_COMMAND",
    "UNKNOWN_COMMAND",
    "UNKNOWN_COMMAND",
    "INVALID_ARGUMENTS",
    "INVALID_OPTION_VALUE",
    "INVALID_OPTION_VALUE",
    "INVALID_OPTION_VALUE",
  ]);
});

test("rejects the removed provider surface component", () => {
  const result = parsePrivateCliArguments([
    ...balancedInitArguments,
    "--provider",
    "legacy-codex,codex,cli",
  ]);

  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      code: "INVALID_OPTION_VALUE",
      option: "--provider",
      message: "Option --provider must use id,product form.",
    },
  ]);
});

test("applies exact-root beta defaults and selects versioned JSON output", () => {
  const result = parsePrivateCliArguments(["check", "--json"]);
  expectSuccess(result);
  assert.deepEqual(result.invocation, {
    command: "check",
    projectConfigPath: "agentdevflow.config.jsonc",
    repositoryPath: ".",
    lockPath: ".agentdevflow/lock.json",
    outputFormat: "json",
  });
});

test("surfaces revision-1 project resolution failures from flag input", () => {
  const unknownReviewer = balancedInitArguments.map((value, index, values) =>
    values[index - 1] === "--reviewer" ? "missing-reviewer" : value,
  );
  const result = parsePrivateCliArguments(unknownReviewer);
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      code: "INVALID_CONFIGURATION",
      path: "$.roles.reviewer",
      message: "Responsibility reviewer references unknown provider missing-reviewer.",
    },
  ]);
});

test("parses the complete rule command family into typed invocations", () => {
  const cases = [
    {
      args: ["rule", "list"],
      invocation: {
        command: "rule",
        operation: "list",
        projectConfigPath: "agentdevflow.config.jsonc",
        repositoryPath: ".",
        outputFormat: "human",
      },
    },
    {
      args: ["rule", "show", "review-required", "--json"],
      invocation: {
        command: "rule",
        operation: "show",
        projectConfigPath: "agentdevflow.config.jsonc",
        repositoryPath: ".",
        ruleId: "review-required",
        outputFormat: "json",
      },
    },
    {
      args: [
        "rule",
        "add",
        "run-tests",
        "--scope",
        "developer",
        "--file",
        "guidance/run-tests.md",
        "--repository",
        "project",
        "--config",
        "custom-project.jsonc",
        "--json",
      ],
      invocation: {
        command: "rule",
        operation: "add",
        projectConfigPath: "custom-project.jsonc",
        repositoryPath: "project",
        ruleId: "run-tests",
        scope: "developer",
        input: { kind: "file", path: "guidance/run-tests.md" },
        outputFormat: "json",
      },
    },
    {
      args: ["rule", "update", "run-tests", "--stdin"],
      invocation: {
        command: "rule",
        operation: "update",
        projectConfigPath: "agentdevflow.config.jsonc",
        repositoryPath: ".",
        ruleId: "run-tests",
        input: { kind: "stdin" },
        outputFormat: "human",
      },
    },
    {
      args: [
        "rule",
        "remove",
        "run-tests",
        "--repository",
        "project",
        "--json",
      ],
      invocation: {
        command: "rule",
        operation: "remove",
        projectConfigPath: "agentdevflow.config.jsonc",
        repositoryPath: "project",
        ruleId: "run-tests",
        outputFormat: "json",
      },
    },
  ] as const;

  for (const specimen of cases) {
    const result = parsePrivateCliArguments(specimen.args);
    expectSuccess(result);
    assert.deepEqual(result.invocation, specimen.invocation);
  }
});

test("accepts each closed rule scope", () => {
  for (const scope of ["shared", "steward", "developer", "reviewer"] as const) {
    const result = parsePrivateCliArguments([
      "rule",
      "add",
      `${scope}-guidance`,
      "--scope",
      scope,
      "--stdin",
    ]);
    expectSuccess(result);
    assert.equal(result.invocation.command, "rule");
    if (
      result.invocation.command !== "rule" ||
      result.invocation.operation !== "add"
    ) {
      return;
    }
    assert.equal(result.invocation.scope, scope);
  }
});

test("requires exactly one rule content source", () => {
  const cases = [
    ["rule", "add", "run-tests", "--scope", "developer"],
    [
      "rule",
      "add",
      "run-tests",
      "--scope",
      "developer",
      "--file",
      "rule.md",
      "--stdin",
    ],
    ["rule", "update", "run-tests"],
    [
      "rule",
      "update",
      "run-tests",
      "--file",
      "rule.md",
      "--stdin",
    ],
  ] as const;

  for (const args of cases) {
    const result = parsePrivateCliArguments(args);
    expectFailure(result);
    assert.deepEqual(result.diagnostics, [
      {
        code: "INVALID_ARGUMENTS",
        message: "Exactly one of --file or --stdin is required.",
      },
    ]);
  }
});

test("rejects unsafe rule ids and absolute content paths", () => {
  const unsafeIds = [
    "../escape",
    "Uppercase",
    "two_words",
    "two--words",
    "trailing-",
    ".hidden",
    "rule-\u{1f4a5}",
    "a".repeat(privateProjectGuidanceRuleIdMaxLength + 1),
    "aux",
    "com1",
    "con",
    "lpt9",
    "nul",
    "prn",
  ];
  for (const ruleId of unsafeIds) {
    const result = parsePrivateCliArguments(["rule", "show", ruleId]);
    expectFailure(result);
    assert.equal(result.diagnostics[0]?.code, "INVALID_RULE_ID");
  }
  expectSuccess(
    parsePrivateCliArguments([
      "rule",
      "show",
      "a".repeat(privateProjectGuidanceRuleIdMaxLength),
    ]),
  );

  for (const path of ["/tmp/rule.md", "C:\\temp\\rule.md"]) {
    const result = parsePrivateCliArguments([
      "rule",
      "update",
      "run-tests",
      "--file",
      path,
    ]);
    expectFailure(result);
    assert.deepEqual(result.diagnostics, [
      {
        code: "INVALID_OPTION_VALUE",
        option: "--file",
        message: "Option --file must be a repository-relative path.",
      },
    ]);
  }
});

test("rejects an empty rule content file option", () => {
  const result = parsePrivateCliArguments([
    "rule",
    "update",
    "run-tests",
    "--file",
    "",
  ]);
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      code: "INVALID_OPTION_VALUE",
      option: "--file",
      message: "Option --file must not be empty.",
    },
  ]);
});

test("rejects missing, unknown, and extra rule command syntax", () => {
  const cases = [
    {
      args: ["rule"],
      code: "MISSING_RULE_OPERATION",
    },
    {
      args: ["rule", "rename", "run-tests"],
      code: "UNKNOWN_RULE_OPERATION",
    },
    {
      args: ["rule", "show"],
      code: "INVALID_ARGUMENTS",
    },
    {
      args: ["rule", "list", "extra"],
      code: "INVALID_ARGUMENTS",
    },
    {
      args: ["rule", "remove", "run-tests", "extra"],
      code: "INVALID_ARGUMENTS",
    },
    {
      args: ["rule", "add", "run-tests", "--scope", "project", "--stdin"],
      code: "INVALID_OPTION_VALUE",
    },
    {
      args: ["rule", "show", "run-tests", "--unknown"],
      code: "INVALID_ARGUMENTS",
    },
  ] as const;

  for (const specimen of cases) {
    const result = parsePrivateCliArguments(specimen.args);
    expectFailure(result);
    assert.equal(result.diagnostics[0]?.code, specimen.code);
  }
});

test("rejects duplicate rule options deterministically", () => {
  const result = parsePrivateCliArguments([
    "rule",
    "add",
    "run-tests",
    "--scope",
    "developer",
    "--scope",
    "reviewer",
    "--stdin",
  ]);
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      code: "DUPLICATE_OPTION",
      option: "--scope",
      message: "Option --scope must not be repeated.",
    },
  ]);
});
