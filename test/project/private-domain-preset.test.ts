import assert from "node:assert/strict";
import test from "node:test";

import type { PrivateDomainWorkflowDefinition } from "../../src/compiler/private-domain-workflow.js";
import {
  expandPrivateDomainPreset,
  type PrivateDomainPresetExpansionResult,
} from "../../src/project/private-domain-preset.js";
import {
  resolvePrivateDomainProject,
  type PrivateDomainProjectIntent,
  type PrivateDomainProjectResolutionResult,
} from "../../src/project/private-domain-project-resolution.js";
import { createPrivateIssueToReviewedPullRequestDefinition } from "../../src/workflows/private-issue-to-reviewed-pull-request.js";
import {
  privateLocalReviewedChangeCapabilityObservations,
  privateLocalReviewedChangeDefinition,
} from "../../src/workflows/private-local-reviewed-change.js";

const localBindings = [
  {
    binding: "developer",
    target: { kind: "responsibility", responsibility: "developer" },
  },
  {
    binding: "reviewer",
    target: { kind: "responsibility", responsibility: "reviewer" },
  },
] as const;

function expectExpansionSuccess(
  result: PrivateDomainPresetExpansionResult,
): asserts result is Extract<PrivateDomainPresetExpansionResult, { ok: true }> {
  assert.equal(result.ok, true);
}

function expectResolutionSuccess(
  result: PrivateDomainProjectResolutionResult,
): asserts result is Extract<PrivateDomainProjectResolutionResult, { ok: true }> {
  assert.equal(result.ok, true);
}

function localIntent(
  preset: "balanced" | "fast" | "strict",
): PrivateDomainProjectIntent {
  return {
    revision: 1,
    preset,
    providers: [
      { id: "codex-primary", product: "codex" },
      { id: "claude-reviewer", product: "claude-code" },
    ],
    roles: {
      steward: "codex-primary",
      developer: "codex-primary",
      reviewer: "claude-reviewer",
    },
    tracker: { mode: "none" },
    workflow: { family: "local-reviewed-change" },
    capabilityBindings: localBindings,
  };
}

test("expands Fast as a basic-review minimum without adding family-specific assumptions", () => {
  const first = expandPrivateDomainPreset(
    "fast",
    "local-reviewed-change",
    privateLocalReviewedChangeDefinition,
  );
  const second = expandPrivateDomainPreset(
    "fast",
    "local-reviewed-change",
    privateLocalReviewedChangeDefinition,
  );

  expectExpansionSuccess(first);
  expectExpansionSuccess(second);
  assert.deepEqual(second.expansion, first.expansion);
  assert.equal(
    first.expansion.definition.id,
    "candidate/local-reviewed-change/preset-fast",
  );
  assert.equal(
    first.expansion.definition.artifactTypes.includes(
      "ReviewerIsolationEvidence",
    ),
    false,
  );
  assert.equal(
    first.expansion.profile.blockingFindingsForbiddenAtCompletion,
    false,
  );
});

test("expands Balanced into explicit local finding and reviewer-isolation gates", () => {
  const result = expandPrivateDomainPreset(
    "balanced",
    "local-reviewed-change",
    privateLocalReviewedChangeDefinition,
  );

  expectExpansionSuccess(result);
  assert.equal(
    result.expansion.definition.id,
    "candidate/local-reviewed-change/preset-balanced",
  );
  assert.deepEqual(result.expansion.definition.artifactTypes, [
    "AcceptanceAuthorization",
    "BlockingFinding",
    "Plan",
    "ReviewVerdict",
    "ReviewerIsolationEvidence",
    "VerificationEvidence",
  ]);
  assert.equal(
    result.expansion.definition.policies.some(
      (policy) =>
        policy.kind === "forbids-valid-artifact" &&
        policy.artifact === "BlockingFinding",
    ),
    true,
  );
  assert.equal(
    result.expansion.definition.policies.some(
      (policy) =>
        policy.kind === "requires-valid-artifact" &&
        policy.artifact === "ReviewerIsolationEvidence",
    ),
    true,
  );
});

test("keeps pull-request readiness explicit while issue profiles remain distinct", () => {
  const base = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const result = expandPrivateDomainPreset(
    "balanced",
    "issue-to-reviewed-pull-request",
    base,
  );

  expectExpansionSuccess(result);
  assert.match(result.expansion.definition.id, /\/ready\/disabled\/squash/u);
  assert.equal(
    result.expansion.definition.transitions.some(
      (transition) => transition.id === "03-create-ready-pull-request",
    ),
    true,
  );
  assert.equal(
    result.expansion.definition.policies.some(
      (policy) => policy.artifact === "ReviewerIsolationEvidence",
    ),
    true,
  );

  const fast = expandPrivateDomainPreset(
    "fast",
    "issue-to-reviewed-pull-request",
    base,
  );
  expectExpansionSuccess(fast);
  assert.equal(
    fast.expansion.definition.transitions.some(
      (transition) => transition.id === "03-create-ready-pull-request",
    ),
    true,
  );
  assert.equal(
    fast.expansion.definition.artifactTypes.includes(
      "ReviewerIsolationEvidence",
    ),
    false,
  );
  assert.equal(
    fast.expansion.definition.policies.some(
      (policy) =>
        policy.artifact === "ReviewerIsolationEvidence" ||
        policy.artifact === "BlockingFinding",
    ),
    false,
  );
  assert.notEqual(
    fast.expansion.expansionDigest,
    result.expansion.expansionDigest,
  );
});

test("fails Strict closed until executable high-risk evidence exists", () => {
  const result = expandPrivateDomainPreset(
    "strict",
    "local-reviewed-change",
    privateLocalReviewedChangeDefinition,
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.diagnostics, [
    {
      code: "PRESET_UNAVAILABLE",
      path: "$.preset",
      message:
        "Strict is unavailable until high-risk evidence and stronger completion gates have executable semantics.",
    },
  ]);
});

test("rejects a base workflow that does not meet the selected minimum", () => {
  const incompatible: PrivateDomainWorkflowDefinition = {
    id: "candidate/incompatible",
    revision: 1,
    nodes: ["start", "done"],
    initialNode: "start",
    artifactTypes: [],
    transitions: [
      { id: "finish", from: "start", to: "done", role: "steward" },
    ],
    policies: [],
    capabilityRequirements: [],
  };
  const result = expandPrivateDomainPreset(
    "fast",
    "local-reviewed-change",
    incompatible,
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics[0]?.code, "PRESET_WORKFLOW_INCOMPATIBLE");
});

test("compiles Fast and Balanced local presets through the existing generic seams", () => {
  const fast = resolvePrivateDomainProject(localIntent("fast"), {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
  });
  const balanced = resolvePrivateDomainProject(localIntent("balanced"), {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
  });

  expectResolutionSuccess(fast);
  expectResolutionSuccess(balanced);
  assert.equal(fast.resolution.preset.name, "fast");
  assert.equal(balanced.resolution.preset.name, "balanced");
  assert.notEqual(
    balanced.workflowCompilation.compilationDigest,
    fast.workflowCompilation.compilationDigest,
  );
  assert.equal(balanced.workflowCompilation.definition.policies.length, 5);
  assert.equal(fast.workflowCompilation.definition.policies.length, 3);
});

test("returns a preset diagnostic before compiling Strict", () => {
  const result = resolvePrivateDomainProject(localIntent("strict"), {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics[0]?.code, "PRESET_UNAVAILABLE");
  assert.equal(result.diagnostics[0]?.path, "$.preset");
});
