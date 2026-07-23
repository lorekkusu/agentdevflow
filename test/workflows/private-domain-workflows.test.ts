import assert from "node:assert/strict";
import test from "node:test";

import {
  compilePrivateDomainWorkflow,
  type PrivateDomainCapabilityObservation,
  type PrivateDomainWorkflowCompilationResult,
  type PrivateDomainWorkflowDefinition,
} from "../../src/compiler/private-domain-workflow.js";
import {
  createPrivateIssueToReviewedPullRequestDefinition,
  privateIssueToPullRequestCapabilityObservations,
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

test("compiles the draft pull-request path", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "draft",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const result = compileIssueWorkflow(definition);

  expectSuccess(result);
  assert.equal(result.compilation.policyValidation.safe, true);
  assert.deepEqual(result.compilation.budget, {
    nodeCount: 11,
    artifactTypeCount: 10,
    theoreticalMaxStates: "11264",
    configuredMaxStates: 32768,
  });
  assert.equal(
    result.compilation.definition.transitions.find((transition) =>
      transition.id.includes("create-draft"),
    )?.guard,
    "pullRequest.initialState == draft",
  );
  assert.equal(result.compilation.capabilityResolutions.length, 7);
  assert.equal(
    result.compilation.definition.transitions.find(
      (transition) => transition.id === "07-ensure-pull-request-ready",
    )?.from,
    "ci-passed",
  );
});

test("compiles an immediately ready pull request", () => {
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
    auxiliaryReview: "disabled",
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

test("re-enters draft readiness idempotently after review repair", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "draft",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const transitions = new Map(
    definition.transitions.map((transition) => [transition.id, transition]),
  );
  const path = [
    "01-plan-work-item",
    "02-work-item-delegated",
    "03-create-draft-pull-request",
    "04-ci-passed",
    "07-ensure-pull-request-ready",
    "08-start-independent-review",
    "10-independent-changes-repair",
    "06-repair-reobserve",
    "04-ci-passed",
    "07-ensure-pull-request-ready",
    "08-start-independent-review",
    "11-independent-approved",
    "12-reviewed-authorize",
    "13-external-merge",
  ] as const;
  let currentNode = definition.initialNode;

  for (const transitionId of path) {
    const transition = transitions.get(transitionId);
    assert.ok(transition, `Missing transition: ${transitionId}`);
    assert.equal(
      transition.from,
      currentNode,
      `Transition ${transitionId} cannot follow ${currentNode}.`,
    );
    currentNode = transition.to;
  }

  assert.equal(
    path.filter(
      (transitionId) => transitionId === "07-ensure-pull-request-ready",
    ).length,
    2,
  );
  assert.equal(currentNode, "merged");
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

test("requires the advisory merge procedure to be present explicitly", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const observations = privateIssueToPullRequestCapabilityObservations.filter(
    (observation) => observation.capability !== "pull-request.merge",
  );
  const result = compileIssueWorkflow(definition, observations);

  expectFailure(result);
  assert.equal(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "CAPABILITY_UNAVAILABLE" &&
        diagnostic.message.includes("pull-request.merge"),
    ),
    true,
  );
});

test("rejects malformed capability observations instead of treating them as available", () => {
  const malformed = [
    {
      binding: "developer",
      capability: "project-instructions",
      mechanism: "",
    },
  ] as unknown as readonly PrivateDomainCapabilityObservation[];
  const result = compilePrivateDomainWorkflow(
    privateLocalReviewedChangeDefinition,
    { capabilityObservations: malformed },
  );

  expectFailure(result);
  assert.equal(
    result.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "CAPABILITY_OBSERVATION_INVALID" &&
        diagnostic.path === "$.capabilities[0]",
    ),
    true,
  );
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === "CAPABILITY_UNAVAILABLE",
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
    auxiliaryReview: "disabled",
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
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const result = compilePrivateDomainWorkflow(definition, {
    capabilityObservations: privateIssueToPullRequestCapabilityObservations,
    maxAbstractStates: 11_263,
  });

  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      stage: "budget",
      code: "STATE_SPACE_BUDGET_EXCEEDED",
      path: "$.workflow",
      message:
        "Workflow candidate/issue-to-reviewed-pull-request/draft/disabled/squash@1 has a theoretical 11264 abstract states, exceeding the configured limit 11263.",
      budget: {
        nodeCount: 11,
        artifactTypeCount: 10,
        theoreticalMaxStates: "11264",
        configuredMaxStates: 11_263,
      },
    },
  ]);
});
