import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePrivateCliArguments,
  type PrivateCliArgumentResult,
} from "../../src/interface/private-cli-arguments.js";
import {
  balancedInitArguments,
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

test("represents all five candidate commands without filesystem discovery", () => {
  const digest = "a".repeat(64);
  const cases = [
    ["check", "--config", "project.jsonc"],
    ["diff", "--config", "project.jsonc"],
    [
      "doctor",
      "--config",
      "project.jsonc",
      "--observations",
      "observations.json",
    ],
    ["render", "--config", "project.jsonc", "--approve-plan", digest],
    balancedInitArguments,
  ] as const;

  const commands = cases.map((args) => {
    const result = parsePrivateCliArguments(args);
    expectSuccess(result);
    return result.invocation.command;
  });
  assert.deepEqual(commands, ["check", "diff", "doctor", "render", "init"]);
});

test("maps complete Balanced flags to the existing normalized configuration", () => {
  const result = parsePrivateCliArguments(balancedInitArguments);
  expectSuccess(result);
  assert.equal(result.invocation.command, "init");
  if (result.invocation.command !== "init") return;
  assert.equal(
    result.invocation.configurationDigest,
    "3e37b935270c34b4e412183203c1a5873b2eeb5a080ee81fa24caebaeb604068",
  );
  assert.deepEqual(
    result.invocation.configuration.providers.map(({ id }) => id),
    ["claude-reviewer", "codex-developer", "cursor-steward"],
  );
  assert.deepEqual(result.invocation.configuration.review.artifactTypes, [
    "BlockingFinding",
    "ReviewVerdict",
  ]);
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
  assert.deepEqual(second.invocation.configuration, first.invocation.configuration);
  assert.equal(
    second.invocation.canonicalConfigurationJson,
    first.invocation.canonicalConfigurationJson,
  );
  assert.equal(
    second.invocation.configurationDigest,
    first.invocation.configurationDigest,
  );
});

test("retains an explicit initialization approval path without reading it", () => {
  const result = parsePrivateCliArguments([
    ...balancedInitArguments,
    "--approval",
    "approval.json",
  ]);
  expectSuccess(result);
  assert.equal(result.invocation.command, "init");
  if (result.invocation.command !== "init") return;
  assert.equal(result.invocation.approvalPath, "approval.json");
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
    ["check"],
    ["check", "--unknown"],
    ["render", "--config", "project.jsonc", "--approve-plan", "not-a-digest"],
    [...balancedInitArguments, "--provider", "invalid"],
    [...balancedInitArguments, "--approval="],
  ] as const;

  const codes = cases.map((args) => {
    const result = parsePrivateCliArguments(args);
    expectFailure(result);
    return result.diagnostics[0]?.code;
  });
  assert.deepEqual(codes, [
    "MISSING_COMMAND",
    "UNKNOWN_COMMAND",
    "MISSING_REQUIRED_OPTION",
    "INVALID_ARGUMENTS",
    "INVALID_OPTION_VALUE",
    "INVALID_OPTION_VALUE",
    "INVALID_OPTION_VALUE",
  ]);
});

test("surfaces normalized configuration failures from flag input", () => {
  const sharedReviewer = balancedInitArguments.map((value) =>
    value === "claude-reviewer" ? "codex-developer" : value,
  );
  const result = parsePrivateCliArguments(sharedReviewer);
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      code: "INVALID_CONFIGURATION",
      path: "$.roles.reviewer",
      message:
        "The reviewer must use a different provider instance from the developer for the selected review separation.",
    },
  ]);
});
