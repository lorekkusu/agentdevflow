import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePrivateCliArguments,
  type PrivateCliArgumentResult,
} from "../../src/interface/private-cli-arguments.js";
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

test("represents all four beta commands without filesystem discovery", () => {
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
  ] as const;

  const commands = cases.map((args) => {
    const result = parsePrivateCliArguments(args);
    expectSuccess(result);
    return result.invocation.command;
  });
  assert.deepEqual(commands, ["check", "diff", "render", "init"]);
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
    outputFormat: "human",
  });
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
