import type {
  PrivateDomainCapabilityObservation,
  PrivateDomainTransition,
  PrivateDomainWorkflowDefinition,
} from "../compiler/private-domain-workflow.js";

export const privateIssueToPullRequestArtifactTypes = [
  "AuxiliaryReviewResult",
  "BlockingFinding",
  "CiResult",
  "DelegationReceipt",
  "MergeAuthorization",
  "MergeReceipt",
  "Plan",
  "PullRequestSnapshot",
  "ReviewVerdict",
  "ReviewerIsolationEvidence",
  "WorkItemRef",
] as const;

export type PrivateIssueToPullRequestArtifact =
  (typeof privateIssueToPullRequestArtifactTypes)[number];

export type PrivatePullRequestInitialState = "draft" | "ready";

export interface PrivateIssueToPullRequestOptions {
  readonly initialState: PrivatePullRequestInitialState;
  readonly auxiliaryReview: "disabled" | "enabled";
  readonly mergeMethod: "squash";
}

export interface PrivateRevisionBoundEvidence {
  readonly revision: string;
}

export interface PrivatePlanEvidence {
  readonly planDigest: string;
  readonly workflowDigest: string;
}

export interface PrivateWorkItemRef {
  readonly tracker: "github-issues" | "linear" | "local";
  readonly identity: string;
}

export interface PrivateDelegationReceipt {
  readonly planDigest: string;
  readonly developerBinding: string;
}

export interface PrivatePullRequestSnapshot extends PrivateRevisionBoundEvidence {
  readonly identity: string;
  readonly state: PrivatePullRequestInitialState;
}

export interface PrivateCiResult extends PrivateRevisionBoundEvidence {
  readonly status: "failed" | "passed";
  readonly requiredChecksDigest: string;
  readonly observationDigest: string;
}

export interface PrivateAuxiliaryReviewResult
  extends PrivateRevisionBoundEvidence {
  readonly outcome: "blocking-findings" | "clear" | "revision-changed";
}

export interface PrivateBlockingFinding extends PrivateRevisionBoundEvidence {
  readonly findingDigest: string;
}

export interface PrivateReviewVerdict extends PrivateRevisionBoundEvidence {
  readonly verdict: "approved" | "changes-requested";
  readonly reviewerPrincipal: string;
  readonly reviewerExecutionContext: string;
  readonly reviewerContextObservedFresh: boolean;
}

export interface PrivateReviewerIsolationEvidence
  extends PrivateRevisionBoundEvidence {
  readonly developerPrincipal: string;
  readonly developerExecutionContext: string;
  readonly reviewerPrincipal: string;
  readonly reviewerExecutionContext: string;
  readonly reviewerContextObservedFresh: boolean;
}

export interface PrivateMergeAuthorization extends PrivateRevisionBoundEvidence {
  readonly evidenceDigest: string;
  readonly mergeMethod: "squash";
}

export interface PrivateMergeReceipt extends PrivateRevisionBoundEvidence {
  readonly pullRequestIdentity: string;
  readonly mergeMethod: "squash";
}

export interface PrivateReviewIndependenceRequirement {
  readonly distinctPrincipal: boolean;
  readonly freshExecutionContext: boolean;
}

export interface PrivateReviewIndependenceObservation {
  readonly developerPrincipal: string;
  readonly developerExecutionContext: string;
  readonly pullRequestRevision: string;
  readonly review: PrivateReviewVerdict;
}

export type PrivateReviewIndependenceDiagnosticCode =
  | "REVIEW_REVISION_MISMATCH"
  | "REVIEWER_CONTEXT_NOT_DISTINCT"
  | "REVIEWER_CONTEXT_NOT_FRESH"
  | "REVIEWER_PRINCIPAL_NOT_DISTINCT";

export interface PrivateReviewIndependenceDiagnostic {
  readonly code: PrivateReviewIndependenceDiagnosticCode;
  readonly message: string;
}

const revisionBoundArtifacts: readonly PrivateIssueToPullRequestArtifact[] = [
  "AuxiliaryReviewResult",
  "BlockingFinding",
  "CiResult",
  "MergeAuthorization",
  "PullRequestSnapshot",
  "ReviewVerdict",
  "ReviewerIsolationEvidence",
];

const sharedTransitions: readonly PrivateDomainTransition[] = [
  {
    id: "01-plan-work-item",
    from: "plan",
    to: "work-item",
    role: "steward",
    produces: ["Plan"],
  },
  {
    id: "02-work-item-delegated",
    from: "work-item",
    to: "delegated",
    role: "steward",
    produces: ["DelegationReceipt", "WorkItemRef"],
    requiresCapabilities: ["create-work-item", "delegate-implementation"],
  },
  {
    id: "04-ci-passed",
    from: "pull-request-observed",
    to: "ci-passed",
    role: "steward",
    produces: ["CiResult"],
    requiresCapabilities: ["observe-ci"],
  },
  {
    id: "05-ci-failed-repair",
    from: "pull-request-observed",
    to: "repair",
    role: "developer",
    invalidates: revisionBoundArtifacts,
    requiresCapabilities: ["observe-ci"],
  },
  {
    id: "06-repair-reobserve",
    from: "repair",
    to: "pull-request-observed",
    role: "developer",
    invalidates: revisionBoundArtifacts,
    produces: ["PullRequestSnapshot"],
  },
  {
    id: "10-independent-changes-repair",
    from: "independent-review",
    to: "repair",
    role: "reviewer",
    produces: ["BlockingFinding"],
    requiresCapabilities: ["run-independent-review"],
  },
  {
    id: "11-independent-approved",
    from: "independent-review",
    to: "reviewed",
    role: "reviewer",
    produces: ["ReviewerIsolationEvidence", "ReviewVerdict"],
    requiresCapabilities: ["run-independent-review"],
  },
  {
    id: "12-reviewed-authorize",
    from: "reviewed",
    to: "merge-authorized",
    role: "steward",
    produces: ["MergeAuthorization"],
  },
  {
    id: "13-external-merge",
    from: "merge-authorized",
    to: "merged",
    role: "steward",
    produces: ["MergeReceipt"],
    requiresCapabilities: ["merge-pull-request"],
  },
];

function capabilityRequirements(auxiliaryReview: "disabled" | "enabled") {
  return [
    {
      id: "create-work-item",
      binding: "tracker",
      capability: "tracker.work-item.create",
      requiredStrength: "guarded",
    },
    {
      id: "delegate-implementation",
      binding: "developer",
      capability: "development.task.delegate",
      requiredStrength: "advisory",
    },
    {
      id: "create-pull-request",
      binding: "pull-request-host",
      capability: "pull-request.create",
      requiredStrength: "guarded",
    },
    {
      id: "observe-ci",
      binding: "ci",
      capability: "ci.result.observe",
      requiredStrength: "guarded",
    },
    ...(auxiliaryReview === "enabled"
      ? [
          {
            id: "run-auxiliary-review",
            binding: "auxiliary-reviewer",
            capability: "review.auxiliary.run",
            requiredStrength: "guarded" as const,
          },
        ]
      : []),
    {
      id: "run-independent-review",
      binding: "reviewer",
      capability: "review.independent.run",
      requiredStrength: "advisory",
    },
    {
      id: "merge-pull-request",
      binding: "pull-request-host",
      capability: "pull-request.merge",
      requiredStrength: "guarded",
    },
  ] as const;
}

export function createPrivateIssueToReviewedPullRequestDefinition(
  options: PrivateIssueToPullRequestOptions,
): PrivateDomainWorkflowDefinition {
  const createPullRequest: PrivateDomainTransition = {
    id:
      options.initialState === "draft"
        ? "03-create-draft-pull-request"
        : "03-create-ready-pull-request",
    from: "delegated",
    to: "pull-request-observed",
    role: "developer",
    produces: ["PullRequestSnapshot"],
    requiresCapabilities: ["create-pull-request"],
    guard: `pullRequest.initialState == ${options.initialState}`,
  };
  const reviewTransitions: readonly PrivateDomainTransition[] =
    options.auxiliaryReview === "enabled"
      ? [
          {
            id: "07-ci-auxiliary-review",
            from: "ci-passed",
            to: "auxiliary-review",
            role: "steward",
            requiresCapabilities: ["run-auxiliary-review"],
          },
          {
            id: "08-auxiliary-clear",
            from: "auxiliary-review",
            to: "independent-review",
            role: "reviewer",
            produces: ["AuxiliaryReviewResult"],
          },
          {
            id: "08-auxiliary-blocking-repair",
            from: "auxiliary-review",
            to: "repair",
            role: "reviewer",
            produces: ["AuxiliaryReviewResult", "BlockingFinding"],
          },
          {
            id: "08-auxiliary-autofix-reobserve",
            from: "auxiliary-review",
            to: "pull-request-observed",
            role: "reviewer",
            invalidates: revisionBoundArtifacts,
            produces: ["PullRequestSnapshot"],
          },
        ]
      : [
          {
            id: "07-ci-independent-review",
            from: "ci-passed",
            to: "independent-review",
            role: "steward",
          },
        ];

  return {
    id: `candidate/issue-to-reviewed-pull-request/${options.initialState}/${options.auxiliaryReview}/${options.mergeMethod}`,
    revision: 1,
    nodes: [
      "plan",
      "work-item",
      "delegated",
      "pull-request-observed",
      "repair",
      "ci-passed",
      ...(options.auxiliaryReview === "enabled" ? ["auxiliary-review"] : []),
      "independent-review",
      "reviewed",
      "merge-authorized",
      "merged",
    ],
    initialNode: "plan",
    artifactTypes: privateIssueToPullRequestArtifactTypes,
    transitions: [createPullRequest, ...sharedTransitions, ...reviewTransitions],
    policies: [
      {
        id: "authorization-forbids-blocking-finding",
        kind: "forbids-valid-artifact",
        at: "merge-authorized",
        artifact: "BlockingFinding",
      },
      {
        id: "authorization-requires-ci",
        kind: "requires-valid-artifact",
        at: "merge-authorized",
        artifact: "CiResult",
      },
      {
        id: "authorization-requires-independent-review",
        kind: "requires-valid-artifact",
        at: "merge-authorized",
        artifact: "ReviewerIsolationEvidence",
      },
      {
        id: "authorization-requires-review-verdict",
        kind: "requires-valid-artifact",
        at: "merge-authorized",
        artifact: "ReviewVerdict",
      },
      {
        id: "merge-requires-authorization",
        kind: "requires-valid-artifact",
        at: "merged",
        artifact: "MergeAuthorization",
      },
    ],
    capabilityRequirements: capabilityRequirements(options.auxiliaryReview),
    evidenceRequirements: [
      {
        id: "ci-result-payload",
        artifact: "CiResult",
        schema: "ci-result@2",
      },
      {
        id: "merge-authorization-payload",
        artifact: "MergeAuthorization",
        schema: "merge-authorization@1",
      },
      {
        id: "review-verdict-payload",
        artifact: "ReviewVerdict",
        schema: "review-verdict@1",
      },
      {
        id: "reviewer-isolation-payload",
        artifact: "ReviewerIsolationEvidence",
        schema: "reviewer-isolation@1",
        referenceArtifact: "PullRequestSnapshot",
      },
    ],
  };
}

export const privateIssueToPullRequestCapabilityObservations: readonly PrivateDomainCapabilityObservation[] = [
  {
    binding: "tracker",
    capability: "tracker.work-item.create",
    strength: "guarded",
    mechanism: "approved-external-adapter",
  },
  {
    binding: "developer",
    capability: "development.task.delegate",
    strength: "advisory",
    mechanism: "compiled-procedure",
  },
  {
    binding: "pull-request-host",
    capability: "pull-request.create",
    strength: "guarded",
    mechanism: "approved-external-adapter",
  },
  {
    binding: "ci",
    capability: "ci.result.observe",
    strength: "guarded",
    mechanism: "hosted-check-observation",
  },
  {
    binding: "auxiliary-reviewer",
    capability: "review.auxiliary.run",
    strength: "guarded",
    mechanism: "approved-external-adapter",
  },
  {
    binding: "reviewer",
    capability: "review.independent.run",
    strength: "advisory",
    mechanism: "compiled-procedure",
  },
  {
    binding: "pull-request-host",
    capability: "pull-request.merge",
    strength: "guarded",
    mechanism: "approved-external-adapter",
  },
];

export function validatePrivateReviewIndependence(
  requirement: PrivateReviewIndependenceRequirement,
  observation: PrivateReviewIndependenceObservation,
): readonly PrivateReviewIndependenceDiagnostic[] {
  const diagnostics: PrivateReviewIndependenceDiagnostic[] = [];
  if (observation.review.revision !== observation.pullRequestRevision) {
    diagnostics.push({
      code: "REVIEW_REVISION_MISMATCH",
      message: `Review revision ${observation.review.revision} does not match pull-request revision ${observation.pullRequestRevision}.`,
    });
  }
  if (
    requirement.distinctPrincipal &&
    observation.review.reviewerPrincipal === observation.developerPrincipal
  ) {
    diagnostics.push({
      code: "REVIEWER_PRINCIPAL_NOT_DISTINCT",
      message: "Reviewer principal must differ from the Developer principal.",
    });
  }
  if (
    requirement.freshExecutionContext &&
    observation.review.reviewerExecutionContext ===
      observation.developerExecutionContext
  ) {
    diagnostics.push({
      code: "REVIEWER_CONTEXT_NOT_DISTINCT",
      message: "Reviewer execution context must differ from the Developer execution context.",
    });
  }
  if (
    requirement.freshExecutionContext &&
    !observation.review.reviewerContextObservedFresh
  ) {
    diagnostics.push({
      code: "REVIEWER_CONTEXT_NOT_FRESH",
      message: "Reviewer execution context is not observed as fresh.",
    });
  }
  return diagnostics.sort((left, right) => left.code.localeCompare(right.code));
}
