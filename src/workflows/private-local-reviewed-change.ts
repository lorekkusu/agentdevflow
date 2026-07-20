import type {
  PrivateDomainCapabilityObservation,
  PrivateDomainWorkflowDefinition,
} from "../compiler/private-domain-workflow.js";

export const privateLocalReviewedChangeDefinition: PrivateDomainWorkflowDefinition = {
  id: "candidate/local-reviewed-change",
  revision: 1,
  nodes: ["plan", "implement", "review", "accepted"],
  initialNode: "plan",
  artifactTypes: [
    "AcceptanceAuthorization",
    "Plan",
    "ReviewVerdict",
    "VerificationEvidence",
  ],
  transitions: [
    {
      id: "01-plan-implement",
      from: "plan",
      to: "implement",
      role: "steward",
      produces: ["Plan"],
    },
    {
      id: "02-implement-review",
      from: "implement",
      to: "review",
      role: "developer",
      produces: ["VerificationEvidence"],
      requiresCapabilities: ["developer-guidance"],
    },
    {
      id: "03-review-rework",
      from: "review",
      to: "implement",
      role: "reviewer",
      invalidates: [
        "AcceptanceAuthorization",
        "ReviewVerdict",
        "VerificationEvidence",
      ],
      requiresCapabilities: ["reviewer-guidance"],
    },
    {
      id: "04-review-accept",
      from: "review",
      to: "accepted",
      role: "reviewer",
      produces: ["AcceptanceAuthorization", "ReviewVerdict"],
      requiresCapabilities: ["reviewer-guidance"],
    },
  ],
  policies: [
    {
      id: "acceptance-requires-authorization",
      kind: "requires-valid-artifact",
      at: "accepted",
      artifact: "AcceptanceAuthorization",
    },
    {
      id: "acceptance-requires-review",
      kind: "requires-valid-artifact",
      at: "accepted",
      artifact: "ReviewVerdict",
    },
    {
      id: "acceptance-requires-verification",
      kind: "requires-valid-artifact",
      at: "accepted",
      artifact: "VerificationEvidence",
    },
  ],
  capabilityRequirements: [
    {
      id: "developer-guidance",
      binding: "developer",
      capability: "project-instructions",
      requiredStrength: "advisory",
    },
    {
      id: "reviewer-guidance",
      binding: "reviewer",
      capability: "project-instructions",
      requiredStrength: "advisory",
    },
  ],
  evidenceRequirements: [
    {
      id: "review-verdict-payload",
      artifact: "ReviewVerdict",
      schema: "review-verdict@1",
    },
  ],
};

export const privateLocalReviewedChangeCapabilityObservations: readonly PrivateDomainCapabilityObservation[] = [
  {
    binding: "developer",
    capability: "project-instructions",
    strength: "advisory",
    mechanism: "instruction-file",
  },
  {
    binding: "reviewer",
    capability: "project-instructions",
    strength: "advisory",
    mechanism: "instruction-file",
  },
];
