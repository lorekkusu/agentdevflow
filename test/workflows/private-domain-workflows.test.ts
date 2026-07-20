import assert from "node:assert/strict";
import test from "node:test";

import {
  compilePrivateDomainWorkflow,
  type PrivateDomainWorkflowCompilationResult,
  type PrivateDomainWorkflowDefinition,
} from "../../src/compiler/private-domain-workflow.js";
import {
  createPrivateIssueToReviewedPullRequestDefinition,
  privateIssueToPullRequestCapabilityObservations,
  validatePrivateReviewIndependence,
} from "../../src/workflows/private-issue-to-reviewed-pull-request.js";
import {
  privateLocalReviewedChangeCapabilityObservations,
  privateLocalReviewedChangeDefinition,
} from "../../src/workflows/private-local-reviewed-change.js";

function expectSuccess(
  result: PrivateDomainWorkflowCompilationResult,
): asserts result is Extract<
  PrivateDomainWorkflowCompilationResult,
  { ok: true }
> {
  assert.equal(result.ok, true);
}

function expectFailure(
  result: PrivateDomainWorkflowCompilationResult,
): asserts result is Extract<
  PrivateDomainWorkflowCompilationResult,
  { ok: false }
> {
  assert.equal(result.ok, false);
}

function compileIssueWorkflow(
  definition: PrivateDomainWorkflowDefinition,
  observations = privateIssueToPullRequestCapabilityObservations,
) {
  return compilePrivateDomainWorkflow(definition, {
    capabilityObservations: observations,
  });
}

test("compiles the draft pull-request path with auxiliary review", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "draft",
    auxiliaryReview: "enabled",
    mergeMethod: "squash",
  });
  const result = compileIssueWorkflow(definition);

  expectSuccess(result);
  assert.equal(result.compilation.policyValidation.safe, true);
  assert.deepEqual(result.compilation.budget, {
    nodeCount: 11,
    artifactTypeCount: 11,
    theoreticalMaxStates: "22528",
    configuredMaxStates: 32768,
  });
  assert.equal(
    result.compilation.definition.transitions.find((transition) =>
      transition.id.includes("create-draft"),
    )?.guard,
    "pullRequest.initialState == draft",
  );
  assert.equal(result.compilation.capabilityResolutions.length, 7);
});

test("compiles an immediately ready pull request without auxiliary review", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const result = compileIssueWorkflow(definition);

  expectSuccess(result);
  assert.equal(result.compilation.policyValidation.safe, true);
  assert.equal(
    result.compilation.definition.transitions.find((transition) =>
      transition.id.includes("create-ready"),
    )?.guard,
    "pullRequest.initialState == ready",
  );
  assert.equal(
    result.compilation.definition.transitions.some((transition) =>
      transition.id.includes("auxiliary"),
    ),
    false,
  );
  assert.equal(result.compilation.capabilityResolutions.length, 6);
});

test("accepts the unbounded CI repair and review rework cycles", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "draft",
    auxiliaryReview: "enabled",
    mergeMethod: "squash",
  });
  const result = compileIssueWorkflow(definition);

  expectSuccess(result);
  assert.equal(result.compilation.policyValidation.safe, true);
  assert.ok(result.compilation.policyValidation.exploredStates < 40);
  assert.equal(
    result.compilation.definition.transitions.some(
      (transition) =>
        transition.from === "repair" &&
        transition.to === "pull-request-observed",
    ),
    true,
  );
});

test("invalidates revision-bound evidence after auxiliary autofix", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "draft",
    auxiliaryReview: "enabled",
    mergeMethod: "squash",
  });
  const transition = definition.transitions.find(
    (item) => item.id === "08-auxiliary-autofix-reobserve",
  );

  assert.deepEqual(transition?.invalidates, [
    "AuxiliaryReviewResult",
    "BlockingFinding",
    "CiResult",
    "MergeAuthorization",
    "PullRequestSnapshot",
    "ReviewVerdict",
    "ReviewerIsolationEvidence",
  ]);
  assert.deepEqual(transition?.produces, ["PullRequestSnapshot"]);
  expectSuccess(compileIssueWorkflow(definition));
});

test("routes non-mutating auxiliary blocking findings to repair", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "enabled",
    mergeMethod: "squash",
  });
  const transition = definition.transitions.find(
    (item) => item.id === "08-auxiliary-blocking-repair",
  );

  assert.equal(transition?.to, "repair");
  assert.deepEqual(transition?.produces, [
    "AuxiliaryReviewResult",
    "BlockingFinding",
  ]);
  expectSuccess(compileIssueWorkflow(definition));
});

test("rejects a stale CI result after a revision-changing repair", () => {
  const base = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const unsafe: PrivateDomainWorkflowDefinition = {
    ...base,
    id: "fixture/issue-to-pr-stale-ci",
    transitions: [
      ...base.transitions.filter(
        (transition) =>
          transition.id !== "05-ci-failed-repair" &&
          transition.id !== "10-independent-changes-repair",
      ),
      {
        id: "11-reviewed-repair-new-revision",
        from: "reviewed",
        to: "repair",
        role: "reviewer",
        invalidates: [
          "CiResult",
          "MergeAuthorization",
          "ReviewVerdict",
          "ReviewerIsolationEvidence",
        ],
      },
      {
        id: "12-repair-review-without-ci",
        from: "repair",
        to: "independent-review",
        role: "developer",
      },
    ],
  };
  const result = compileIssueWorkflow(unsafe);

  expectFailure(result);
  const ciDiagnostic = result.diagnostics.find(
    (diagnostic) =>
      diagnostic.stage === "policy" &&
      diagnostic.violation.policy === "authorization-requires-ci",
  );
  assert.equal(ciDiagnostic?.stage, "policy");
  if (ciDiagnostic?.stage !== "policy") {
    assert.fail("Expected a stale-CI policy diagnostic.");
  }
  assert.deepEqual(
    ciDiagnostic.violation.counterexample
      .slice(-4)
      .map((step) => step.transition),
    [
      "11-reviewed-repair-new-revision",
      "12-repair-review-without-ci",
      "11-independent-approved",
      "12-reviewed-authorize",
    ],
  );
});

test("rejects stale review evidence after rework", () => {
  const base = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const unsafe: PrivateDomainWorkflowDefinition = {
    ...base,
    id: "fixture/issue-to-pr-stale-review",
    transitions: [
      ...base.transitions.filter(
        (transition) =>
          transition.id !== "05-ci-failed-repair" &&
          transition.id !== "10-independent-changes-repair",
      ),
      {
        id: "11-reviewed-repair-invalidates-review",
        from: "reviewed",
        to: "repair",
        role: "reviewer",
        invalidates: [
          "MergeAuthorization",
          "ReviewVerdict",
          "ReviewerIsolationEvidence",
        ],
      },
      {
        id: "12-repair-reviewed-bypass",
        from: "repair",
        to: "reviewed",
        role: "developer",
      },
    ],
  };
  const result = compileIssueWorkflow(unsafe);

  expectFailure(result);
  assert.deepEqual(
    result.diagnostics
      .filter((diagnostic) => diagnostic.stage === "policy")
      .map((diagnostic) =>
        diagnostic.stage === "policy" ? diagnostic.violation.policy : "",
      ),
    [
      "authorization-requires-independent-review",
      "authorization-requires-review-verdict",
    ],
  );
});

test("rejects a direct merge bypass before CI and review", () => {
  const base = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const unsafe: PrivateDomainWorkflowDefinition = {
    ...base,
    id: "fixture/issue-to-pr-direct-merge",
    transitions: [
      ...base.transitions,
      {
        id: "03-delegated-merge-bypass",
        from: "delegated",
        to: "merged",
        role: "developer",
      },
    ],
  };
  const result = compileIssueWorkflow(unsafe);

  expectFailure(result);
  const diagnostic = result.diagnostics.find(
    (item) =>
      item.stage === "policy" &&
      item.violation.policy === "merge-requires-authorization",
  );
  assert.equal(diagnostic?.stage, "policy");
  if (diagnostic?.stage !== "policy") {
    assert.fail("Expected a merge-authorization policy diagnostic.");
  }
  assert.deepEqual(
    diagnostic.violation.counterexample.map((step) => step.transition),
    ["01-plan-work-item", "02-work-item-delegated", "03-delegated-merge-bypass"],
  );
});

test("rejects the Developer execution context as an independent review", () => {
  const diagnostics = validatePrivateReviewIndependence(
    { distinctPrincipal: true, freshExecutionContext: true },
    {
      developerPrincipal: "developer-principal",
      developerExecutionContext: "shared-context",
      pullRequestRevision: "revision-b",
      review: {
        revision: "revision-a",
        verdict: "approved",
        reviewerPrincipal: "developer-principal",
        reviewerExecutionContext: "shared-context",
        reviewerContextObservedFresh: false,
      },
    },
  );

  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.code),
    [
      "REVIEW_REVISION_MISMATCH",
      "REVIEWER_CONTEXT_NOT_DISTINCT",
      "REVIEWER_CONTEXT_NOT_FRESH",
      "REVIEWER_PRINCIPAL_NOT_DISTINCT",
    ],
  );
  assert.deepEqual(
    validatePrivateReviewIndependence(
      { distinctPrincipal: true, freshExecutionContext: true },
      {
        developerPrincipal: "developer-principal",
        developerExecutionContext: "developer-context",
        pullRequestRevision: "revision-b",
        review: {
          revision: "revision-b",
          verdict: "approved",
          reviewerPrincipal: "reviewer-principal",
          reviewerExecutionContext: "fresh-review-context",
          reviewerContextObservedFresh: true,
        },
      },
    ),
    [],
  );
});

test("does not let advisory merge capability satisfy a guarded requirement", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const observations = privateIssueToPullRequestCapabilityObservations.map(
    (observation) =>
      observation.capability === "pull-request.merge"
        ? { ...observation, strength: "advisory" as const }
        : observation,
  );
  const result = compileIssueWorkflow(definition, observations);

  expectFailure(result);
  assert.equal(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "CAPABILITY_STRENGTH_INSUFFICIENT" &&
        diagnostic.message.includes("pull-request.merge"),
    ),
    true,
  );
});

test("compiles a local reviewed change without issue or pull-request assumptions", () => {
  const result = compilePrivateDomainWorkflow(
    privateLocalReviewedChangeDefinition,
    {
      capabilityObservations:
        privateLocalReviewedChangeCapabilityObservations,
    },
  );

  expectSuccess(result);
  assert.equal(result.compilation.policyValidation.safe, true);
  const serialized = JSON.stringify(result.compilation.definition);
  assert.equal(serialized.includes("PullRequest"), false);
  assert.equal(serialized.includes("WorkItem"), false);
  assert.equal(serialized.includes("CiResult"), false);
  assert.equal(serialized.includes("Merge"), false);
  assert.deepEqual(
    result.compilation.definition.transitions.find(
      (transition) => transition.id === "03-review-rework",
    )?.invalidates,
    ["AcceptanceAuthorization", "ReviewVerdict", "VerificationEvidence"],
  );
  assert.deepEqual(result.compilation.budget, {
    nodeCount: 4,
    artifactTypeCount: 4,
    theoreticalMaxStates: "64",
    configuredMaxStates: 32768,
  });
});

test("normalizes reorder-equivalent domain definitions deterministically", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "draft",
    auxiliaryReview: "enabled",
    mergeMethod: "squash",
  });
  const reordered: PrivateDomainWorkflowDefinition = {
    ...definition,
    nodes: [...definition.nodes].reverse(),
    artifactTypes: [...definition.artifactTypes].reverse(),
    transitions: [...definition.transitions].reverse(),
    policies: [...definition.policies].reverse(),
    capabilityRequirements: [...definition.capabilityRequirements].reverse(),
  };
  const first = compileIssueWorkflow(definition);
  const second = compileIssueWorkflow(
    reordered,
    [...privateIssueToPullRequestCapabilityObservations].reverse(),
  );

  expectSuccess(first);
  expectSuccess(second);
  assert.deepEqual(second.compilation, first.compilation);
});

test("enforces the explicit theoretical state-space budget", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "draft",
    auxiliaryReview: "enabled",
    mergeMethod: "squash",
  });
  const result = compilePrivateDomainWorkflow(definition, {
    capabilityObservations: privateIssueToPullRequestCapabilityObservations,
    maxAbstractStates: 22_527,
  });

  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      stage: "budget",
      code: "STATE_SPACE_BUDGET_EXCEEDED",
      path: "$.workflow",
      message:
        "Workflow candidate/issue-to-reviewed-pull-request/draft/enabled/squash@1 has a theoretical 22528 abstract states, exceeding the configured limit 22527.",
      budget: {
        nodeCount: 11,
        artifactTypeCount: 11,
        theoreticalMaxStates: "22528",
        configuredMaxStates: 22_527,
      },
    },
  ]);
});
