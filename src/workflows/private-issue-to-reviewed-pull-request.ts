import type {
  PrivateDomainCapabilityObservation,
  PrivateDomainTransition,
  PrivateDomainWorkflowDefinition,
} from "../compiler/private-domain-workflow.js";

export const privateIssueToPullRequestArtifactTypes = [
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
  readonly auxiliaryReview: "disabled";
  readonly mergeMethod: "squash";
}

const revisionBoundArtifacts: readonly PrivateIssueToPullRequestArtifact[] = [
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
    role: "steward",
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

function capabilityRequirements() {
  return [
    {
      id: "create-work-item",
      binding: "tracker",
      capability: "tracker.work-item.create",
    },
    {
      id: "delegate-implementation",
      binding: "developer",
      capability: "development.task.delegate",
    },
    {
      id: "create-pull-request",
      binding: "pull-request-host",
      capability: "pull-request.create",
    },
    {
      id: "observe-ci",
      binding: "ci",
      capability: "ci.result.observe",
    },
    {
      id: "run-independent-review",
      binding: "reviewer",
      capability: "review.independent.run",
    },
    {
      id: "merge-pull-request",
      binding: "pull-request-host",
      capability: "pull-request.merge",
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
  const reviewEntryNode =
    options.initialState === "draft" ? "pull-request-ready" : "ci-passed";
  const readinessTransitions: readonly PrivateDomainTransition[] =
    options.initialState === "draft"
      ? [
          {
            id: "07-ensure-pull-request-ready",
            from: "ci-passed",
            to: "pull-request-ready",
            role: "steward",
            requiresCapabilities: ["mark-pull-request-ready"],
          },
        ]
      : [];
  const reviewTransition: PrivateDomainTransition = {
    id: "08-start-independent-review",
    from: reviewEntryNode,
    to: "independent-review",
    role: "steward",
  };

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
      ...(options.initialState === "draft" ? ["pull-request-ready"] : []),
      "independent-review",
      "reviewed",
      "merge-authorized",
      "merged",
    ],
    initialNode: "plan",
    artifactTypes: privateIssueToPullRequestArtifactTypes,
    transitions: [
      createPullRequest,
      ...sharedTransitions,
      ...readinessTransitions,
      reviewTransition,
    ],
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
    capabilityRequirements: [
      ...capabilityRequirements(),
      ...(options.initialState === "draft"
        ? [
            {
              id: "mark-pull-request-ready",
              binding: "pull-request-host",
              capability: "pull-request.mark-ready",
            },
          ]
        : []),
    ],
  };
}

export const privateIssueToPullRequestCapabilityObservations: readonly PrivateDomainCapabilityObservation[] = [
  {
    binding: "tracker",
    capability: "tracker.work-item.create",
    mechanism: "compiled-procedure",
  },
  {
    binding: "developer",
    capability: "development.task.delegate",
    mechanism: "compiled-procedure",
  },
  {
    binding: "pull-request-host",
    capability: "pull-request.create",
    mechanism: "compiled-procedure",
  },
  {
    binding: "ci",
    capability: "ci.result.observe",
    mechanism: "compiled-procedure",
  },
  {
    binding: "reviewer",
    capability: "review.independent.run",
    mechanism: "compiled-procedure",
  },
  {
    binding: "pull-request-host",
    capability: "pull-request.merge",
    mechanism: "compiled-procedure",
  },
  {
    binding: "pull-request-host",
    capability: "pull-request.mark-ready",
    mechanism: "compiled-procedure",
  },
];
