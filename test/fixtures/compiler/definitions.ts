import type { PrivateWorkflowDefinition } from "../../../src/compiler/private-model.js";

export const directBypassDefinition: PrivateWorkflowDefinition = {
  id: "fixture/balanced-direct-bypass",
  revision: 1,
  preset: "balanced",
  nodes: ["plan", "implement", "review", "merge"],
  initialNode: "plan",
  artifactTypes: ["BlockingFinding", "ReviewVerdict"],
  capabilityRequirements: [
    {
      id: "project-guidance",
      capability: "project-instructions",
      providerScope: "all-provider-instances",
      requiredStrength: "advisory",
    },
  ],
  transitions: [
    {
      id: "01-plan-implement",
      from: "plan",
      to: "implement",
      role: "steward",
    },
    {
      id: "02-implement-merge-bypass",
      from: "implement",
      to: "merge",
      role: "developer",
    },
    {
      id: "03-implement-review",
      from: "implement",
      to: "review",
      role: "developer",
      produces: ["ReviewVerdict"],
    },
    {
      id: "04-review-merge",
      from: "review",
      to: "merge",
      role: "reviewer",
    },
  ],
};

export const staleEvidenceDefinition: PrivateWorkflowDefinition = {
  id: "fixture/balanced-stale-evidence",
  revision: 1,
  preset: "balanced",
  nodes: ["plan", "implement", "review", "reimplement", "merge"],
  initialNode: "plan",
  artifactTypes: ["BlockingFinding", "ReviewVerdict"],
  capabilityRequirements: [
    {
      id: "project-guidance",
      capability: "project-instructions",
      providerScope: "all-provider-instances",
      requiredStrength: "advisory",
    },
  ],
  transitions: [
    {
      id: "01-plan-implement",
      from: "plan",
      to: "implement",
      role: "steward",
    },
    {
      id: "02-implement-review",
      from: "implement",
      to: "review",
      role: "developer",
      produces: ["ReviewVerdict"],
    },
    {
      id: "03-review-reimplement",
      from: "review",
      to: "reimplement",
      role: "reviewer",
      invalidates: ["ReviewVerdict"],
    },
    {
      id: "04-reimplement-merge",
      from: "reimplement",
      to: "merge",
      role: "developer",
    },
  ],
};
