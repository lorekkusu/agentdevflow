import assert from "node:assert/strict";
import test from "node:test";

import type { PrivateDomainCapabilityObservation } from "../../src/compiler/private-domain-workflow.js";
import {
  resolvePrivateDomainProject,
  type PrivateDomainCapabilityBinding,
  type PrivateDomainProjectIntent,
  type PrivateDomainProjectResolutionResult,
} from "../../src/project/private-domain-project-resolution.js";
import { privateIssueToPullRequestCapabilityObservations } from "../../src/workflows/private-issue-to-reviewed-pull-request.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../../src/workflows/private-local-reviewed-change.js";

function expectSuccess(
  result: PrivateDomainProjectResolutionResult,
): asserts result is Extract<PrivateDomainProjectResolutionResult, { ok: true }> {
  assert.equal(result.ok, true);
}

function expectFailure(
  result: PrivateDomainProjectResolutionResult,
): asserts result is Extract<PrivateDomainProjectResolutionResult, { ok: false }> {
  assert.equal(result.ok, false);
}

function readyLinearIntent(): PrivateDomainProjectIntent {
  return {
    revision: 1,
    preset: "balanced",
    providers: [
      { id: "codex-steward", product: "codex", surface: "cli" },
      { id: "cursor-developer", product: "cursor", surface: "ide" },
      { id: "codex-reviewer", product: "codex", surface: "cli" },
    ],
    roles: {
      steward: "codex-steward",
      developer: "cursor-developer",
      reviewer: "codex-reviewer",
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
        binding: "tracker",
        target: { kind: "tracker" },
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
        binding: "ci",
        target: { kind: "external", id: "github-actions" },
      },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
    ],
  };
}

function draftAuxiliaryIntent(): PrivateDomainProjectIntent {
  const base = readyLinearIntent();
  return {
    ...base,
    providers: [
      { id: "claude-steward", product: "claude-code", surface: "cli" },
      { id: "cursor-developer", product: "cursor", surface: "ide" },
      { id: "claude-reviewer", product: "claude-code", surface: "cli" },
    ],
    roles: {
      steward: "claude-steward",
      developer: "cursor-developer",
      reviewer: "claude-reviewer",
    },
    tracker: { mode: "github-issues" },
    workflow: {
      family: "issue-to-reviewed-pull-request",
      initialState: "draft",
      auxiliaryReview: "enabled",
      mergeMethod: "squash",
    },
    capabilityBindings: [
      ...base.capabilityBindings,
      {
        binding: "auxiliary-reviewer",
        target: { kind: "external", id: "automated-review-service" },
      },
    ],
  };
}

function localIntent(): PrivateDomainProjectIntent {
  return {
    revision: 1,
    preset: "balanced",
    providers: [
      { id: "codex-primary", product: "codex", surface: "cli" },
      { id: "claude-reviewer", product: "claude-code", surface: "cli" },
    ],
    roles: {
      steward: "codex-primary",
      developer: "codex-primary",
      reviewer: "claude-reviewer",
    },
    tracker: { mode: "none" },
    workflow: { family: "local-reviewed-change" },
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
}

function resolveIssue(intent: PrivateDomainProjectIntent) {
  return resolvePrivateDomainProject(intent, {
    capabilityObservations: privateIssueToPullRequestCapabilityObservations,
  });
}

function replaceBindings(
  intent: PrivateDomainProjectIntent,
  capabilityBindings: readonly PrivateDomainCapabilityBinding[],
): PrivateDomainProjectIntent {
  return { ...intent, capabilityBindings };
}

test("resolves the Codex, Cursor, Linear, and immediately ready workflow specimen", () => {
  const result = resolveIssue(readyLinearIntent());

  expectSuccess(result);
  assert.equal(
    result.resolution.workflow.definitionId,
    "candidate/issue-to-reviewed-pull-request/ready/disabled/squash/preset-balanced",
  );
  assert.equal(result.resolution.tracker.mode, "linear");
  assert.equal(result.workflowCompilation.definition.transitions.length, 11);
  assert.deepEqual(
    result.resolution.responsibilities.map((item) => [
      item.responsibility,
      item.provider.id,
    ]),
    [
      ["developer", "cursor-developer"],
      ["reviewer", "codex-reviewer"],
      ["steward", "codex-steward"],
    ],
  );
  assert.deepEqual(
    result.resolution.capabilityTargets.map((item) => [
      item.binding,
      item.kind,
    ]),
    [
      ["ci", "external"],
      ["developer", "responsibility"],
      ["pull-request-host", "external"],
      ["reviewer", "responsibility"],
      ["tracker", "tracker"],
    ],
  );
});

test("resolves a draft workflow with auxiliary review without provider data in the workflow compilation", () => {
  const result = resolveIssue(draftAuxiliaryIntent());

  expectSuccess(result);
  assert.equal(result.resolution.tracker.mode, "github-issues");
  assert.equal(result.workflowCompilation.definition.transitions.length, 14);
  assert.equal(result.workflowCompilation.capabilityResolutions.length, 7);
  assert.equal(
    JSON.stringify(result.workflowCompilation).includes("claude-code"),
    false,
  );
  assert.equal(
    JSON.stringify(result.workflowCompilation).includes("cursor"),
    false,
  );
  assert.equal(
    result.resolution.capabilityTargets.some(
      (item) =>
        item.binding === "auxiliary-reviewer" &&
        item.kind === "external" &&
        item.id === "automated-review-service",
    ),
    true,
  );
});

test("resolves a local workflow without issue, pull-request, CI, or merge capability bindings", () => {
  const result = resolvePrivateDomainProject(localIntent(), {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
  });

  expectSuccess(result);
  assert.equal(result.resolution.workflow.family, "local-reviewed-change");
  assert.equal(result.resolution.tracker.mode, "none");
  assert.deepEqual(
    result.resolution.capabilityTargets.map((target) => target.binding),
    ["developer", "reviewer"],
  );
  assert.equal(
    JSON.stringify(result.workflowCompilation.definition).includes("pull-request"),
    false,
  );
});

test("normalizes reordered providers, bindings, and capability observations deterministically", () => {
  const original = readyLinearIntent();
  const reordered: PrivateDomainProjectIntent = {
    ...original,
    providers: [...original.providers].reverse(),
    capabilityBindings: [...original.capabilityBindings].reverse(),
  };
  const observations = [
    ...privateIssueToPullRequestCapabilityObservations,
  ].reverse();
  const first = resolveIssue(original);
  const second = resolvePrivateDomainProject(reordered, {
    capabilityObservations: observations,
  });

  expectSuccess(first);
  expectSuccess(second);
  assert.equal(second.intentCanonicalJson, first.intentCanonicalJson);
  assert.equal(
    second.workflowCompilation.compilationDigest,
    first.workflowCompilation.compilationDigest,
  );
  assert.equal(second.resolutionCanonicalJson, first.resolutionCanonicalJson);
  assert.equal(second.resolutionDigest, first.resolutionDigest);
});

test("changes the project resolution digest for a material provider binding change", () => {
  const original = readyLinearIntent();
  const changed: PrivateDomainProjectIntent = {
    ...original,
    roles: { ...original.roles, reviewer: "codex-steward" },
  };
  const first = resolveIssue(original);
  const second = resolveIssue(changed);

  expectSuccess(first);
  expectSuccess(second);
  assert.equal(
    second.workflowCompilation.compilationDigest,
    first.workflowCompilation.compilationDigest,
  );
  assert.notEqual(second.resolutionDigest, first.resolutionDigest);
});

test("rejects a role that references an unknown provider", () => {
  const original = readyLinearIntent();
  const result = resolveIssue({
    ...original,
    roles: { ...original.roles, reviewer: "missing-reviewer" },
  });

  expectFailure(result);
  assert.equal(result.diagnostics[0]?.code, "PROVIDER_REFERENCE_UNKNOWN");
  assert.equal(result.diagnostics[0]?.path, "$.roles.reviewer");
});

test("rejects duplicate provider and capability binding identifiers", () => {
  const original = readyLinearIntent();
  const result = resolveIssue({
    ...original,
    providers: [...original.providers, original.providers[0]!],
    capabilityBindings: [
      ...original.capabilityBindings,
      original.capabilityBindings[0]!,
    ],
  });

  expectFailure(result);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code).sort(),
    ["CAPABILITY_BINDING_DUPLICATED", "PROVIDER_DUPLICATED"],
  );
});

test("rejects local tracker modes for the issue workflow", () => {
  const original = readyLinearIntent();
  const result = resolveIssue({ ...original, tracker: { mode: "none" } });

  expectFailure(result);
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "TRACKER_INCOMPATIBLE",
    ),
    true,
  );
});

test("rejects hosted tracker modes for the local workflow", () => {
  const original = localIntent();
  const result = resolvePrivateDomainProject(
    { ...original, tracker: { mode: "linear" } },
    { capabilityObservations: privateLocalReviewedChangeCapabilityObservations },
  );

  expectFailure(result);
  assert.equal(result.diagnostics[0]?.code, "TRACKER_INCOMPATIBLE");
});

test("rejects missing and unexpected logical capability bindings", () => {
  const original = readyLinearIntent();
  const withoutCi = original.capabilityBindings.filter(
    (binding) => binding.binding !== "ci",
  );
  const result = resolveIssue(
    replaceBindings(original, [
      ...withoutCi,
      { binding: "unused", target: { kind: "external", id: "unused" } },
    ]),
  );

  expectFailure(result);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code).sort(),
    ["CAPABILITY_BINDING_MISSING", "CAPABILITY_BINDING_UNEXPECTED"],
  );
});

test("rejects a developer capability routed to the reviewer responsibility", () => {
  const original = readyLinearIntent();
  const bindings = original.capabilityBindings.map((binding) =>
    binding.binding === "developer"
      ? {
          binding: "developer",
          target: {
            kind: "responsibility" as const,
            responsibility: "reviewer" as const,
          },
        }
      : binding,
  );
  const result = resolveIssue(replaceBindings(original, bindings));

  expectFailure(result);
  assert.equal(result.diagnostics[0]?.code, "CAPABILITY_TARGET_INVALID");
});

test("rejects an external capability routed to a responsibility", () => {
  const original = readyLinearIntent();
  const bindings = original.capabilityBindings.map((binding) =>
    binding.binding === "ci"
      ? {
          binding: "ci",
          target: {
            kind: "responsibility" as const,
            responsibility: "steward" as const,
          },
        }
      : binding,
  );
  const result = resolveIssue(replaceBindings(original, bindings));

  expectFailure(result);
  assert.equal(result.diagnostics[0]?.code, "CAPABILITY_TARGET_INVALID");
});

test("preserves domain compiler capability failures without producing a resolution", () => {
  const observations: readonly PrivateDomainCapabilityObservation[] =
    privateIssueToPullRequestCapabilityObservations.filter(
      (observation) => observation.binding !== "ci",
    );
  const result = resolvePrivateDomainProject(readyLinearIntent(), {
    capabilityObservations: observations,
  });

  expectFailure(result);
  assert.equal(result.diagnostics[0]?.code, "WORKFLOW_COMPILATION_FAILED");
  const diagnostic = result.diagnostics[0];
  assert.equal(
    diagnostic?.code === "WORKFLOW_COMPILATION_FAILED" &&
      diagnostic.causes.some(
        (cause) => cause.code === "CAPABILITY_UNAVAILABLE",
      ),
    true,
  );
});
