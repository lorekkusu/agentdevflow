import assert from "node:assert/strict";
import test from "node:test";

import type { PrivateDomainWorkflowDefinition } from "../../src/compiler/private-domain-workflow.js";
import {
  createPrivateExecutionEvidenceEnvelope,
  createPrivateExecutionManifestPackage,
  createPrivateExecutionPayloadDigest,
  replayPrivateExecutionTrace,
  type PrivateExecutionManifestPackage,
  type PrivateExecutionTraceEvent,
} from "../../src/execution/private-execution-contract.js";
import { createPrivateExecutionPayloadPackage } from "../../src/execution/private-typed-evidence.js";
import { convergePrivateLegacyCandidate } from "../../src/project/private-legacy-candidate-convergence.js";
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
import {
  balancedCandidateConfig,
  fastCandidateConfig,
} from "../fixtures/config/specimens.js";

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
    capabilityBindings: localBindings,
  };
}

function eventFor(
  packageValue: PrivateExecutionManifestPackage,
  stepId: string,
  subjectDigest: string,
): PrivateExecutionTraceEvent {
  const step = packageValue.manifest.steps.find((item) => item.id === stepId);
  if (step === undefined) {
    throw new Error(`Unknown preset fixture step ${stepId}.`);
  }
  const producer = {
    responsibility: step.responsibility,
    binding: step.responsibility,
    principal: `${step.responsibility}-principal`,
    executionContext: `${stepId}-context`,
  } as const;
  const payloads = step.produces.flatMap((artifact) => {
    const requirement = packageValue.manifest.evidenceRequirements.find(
      (candidate) => candidate.artifact === artifact,
    );
    if (requirement === undefined) return [];
    let payload: unknown;
    switch (requirement.schema) {
      case "ci-result@2":
        payload = {
          status: "passed",
          requiredChecksDigest: createPrivateExecutionPayloadDigest({
            requiredChecks: "preset-fixture",
          }),
          observationDigest: createPrivateExecutionPayloadDigest({
            observation: "preset-fixture",
          }),
        };
        break;
      case "merge-authorization@1":
        payload = {
          evidenceDigest: createPrivateExecutionPayloadDigest({
            evidence: subjectDigest,
          }),
          mergeMethod: "squash",
        };
        break;
      case "review-verdict@1":
        payload = {
          verdict: "approved",
          reviewerPrincipal: producer.principal,
          reviewerExecutionContext: producer.executionContext,
        };
        break;
      case "reviewer-isolation@1": {
        const referenceStep = packageValue.manifest.steps.find((candidate) =>
          candidate.produces.includes(requirement.referenceArtifact ?? ""),
        );
        if (referenceStep === undefined) {
          throw new Error("Preset fixture has no reviewer reference step.");
        }
        payload = {
          developerPrincipal: `${referenceStep.responsibility}-principal`,
          developerExecutionContext: `${referenceStep.id}-context`,
          reviewerPrincipal: producer.principal,
          reviewerExecutionContext: producer.executionContext,
          reviewerContextObservedFresh: true,
        };
        break;
      }
    }
    return [
      createPrivateExecutionPayloadPackage({
        schema: requirement.schema,
        artifact,
        subjectDigest,
        payload,
      }),
    ];
  });
  return {
    stepId,
    subjectDigest,
    evidence: step.produces.map((artifact) => {
      const payloadPackage = payloads.find(
        (candidate) => candidate.artifact === artifact,
      );
      return createPrivateExecutionEvidenceEnvelope(packageValue, {
        stepId,
        artifact,
        subjectDigest,
        payloadDigest:
          payloadPackage?.digest ??
          createPrivateExecutionPayloadDigest({
            artifact,
            stepId,
            subjectDigest,
          }),
        producer,
        enforcement: {
          strength: "advisory",
          mechanism: "preset-fixture",
        },
      });
    }),
    payloads,
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

test("keeps pull-request readiness and auxiliary review explicit outside the preset", () => {
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
    result.expansion.definition.nodes.includes("auxiliary-review"),
    false,
  );
  assert.equal(
    result.expansion.definition.transitions.some(
      (transition) => transition.id === "03-create-ready-pull-request",
    ),
    true,
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
  const fastManifest = createPrivateExecutionManifestPackage(
    fast.workflowCompilation,
  );
  const balancedManifest = createPrivateExecutionManifestPackage(
    balanced.workflowCompilation,
  );
  assert.equal(fast.resolution.preset.name, "fast");
  assert.equal(balanced.resolution.preset.name, "balanced");
  assert.notEqual(balancedManifest.digest, fastManifest.digest);
  assert.equal(balancedManifest.manifest.policies.length, 5);
  assert.equal(fastManifest.manifest.policies.length, 3);
});

test("replays a Balanced local rework cycle without stale blocking evidence", () => {
  const project = resolvePrivateDomainProject(localIntent("balanced"), {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
  });
  expectResolutionSuccess(project);
  const manifestPackage = createPrivateExecutionManifestPackage(
    project.workflowCompilation,
  );
  const firstRevision = createPrivateExecutionPayloadDigest({
    revision: "local-a",
  });
  const secondRevision = createPrivateExecutionPayloadDigest({
    revision: "local-b",
  });
  const result = replayPrivateExecutionTrace(manifestPackage, {
    revision: 2,
    manifestDigest: manifestPackage.digest,
    events: [
      eventFor(manifestPackage, "01-plan-implement", firstRevision),
      eventFor(manifestPackage, "02-implement-review", firstRevision),
      eventFor(manifestPackage, "03-review-rework", secondRevision),
      eventFor(manifestPackage, "02-implement-review", secondRevision),
      eventFor(manifestPackage, "04-review-accept", secondRevision),
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.finalNode, "accepted");
  assert.equal(
    result.activeEvidence.some(
      (evidence) => evidence.artifact === "BlockingFinding",
    ),
    false,
  );
  assert.equal(
    result.activeEvidence.some(
      (evidence) => evidence.artifact === "ReviewerIsolationEvidence",
    ),
    true,
  );
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

test("converges canonical legacy Fast and Balanced specimens only with explicit workflow choices", () => {
  const fast = convergePrivateLegacyCandidate(fastCandidateConfig, {
    workflow: { family: "local-reviewed-change" },
    capabilityBindings: localBindings,
  });
  const balanced = convergePrivateLegacyCandidate(balancedCandidateConfig, {
    workflow: { family: "local-reviewed-change" },
    capabilityBindings: localBindings,
  });

  assert.equal(fast.ok, true);
  assert.equal(balanced.ok, true);
  if (!fast.ok || !balanced.ok) return;
  assert.equal(fast.convergence.intent.preset, "fast");
  assert.equal(balanced.convergence.intent.preset, "balanced");
  assert.equal(
    fast.convergence.sourceConfigurationDigest,
    "81a59c0f4e09645c3c80875374017304dc263caac48002d10d20a2aefd46c8fd",
  );
  assert.equal(
    balanced.convergence.sourceConfigurationDigest,
    "3e37b935270c34b4e412183203c1a5873b2eeb5a080ee81fa24caebaeb604068",
  );
});

test("refuses to infer hosted tracker intent from the legacy local tracker field", () => {
  const result = convergePrivateLegacyCandidate(balancedCandidateConfig, {
    workflow: {
      family: "issue-to-reviewed-pull-request",
      initialState: "ready",
      auxiliaryReview: "disabled",
      mergeMethod: "squash",
    },
    capabilityBindings: [],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.diagnostics[0]?.code, "LEGACY_TRACKER_INCOMPATIBLE");
});

test("rejects legacy review fields that contradict their preset label", () => {
  const result = convergePrivateLegacyCandidate(
    { ...balancedCandidateConfig, preset: "fast" },
    {
      workflow: { family: "local-reviewed-change" },
      capabilityBindings: localBindings,
    },
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(
    result.diagnostics[0]?.code,
    "LEGACY_PRESET_PROFILE_MISMATCH",
  );
});
