import type { CandidatePreset } from "../config/candidate.js";
import type { PrivateWorkflowDefinition } from "./private-model.js";

export const fastWorkflowDefinition: PrivateWorkflowDefinition = {
  id: "builtin/fast",
  revision: 1,
  preset: "fast",
  nodes: ["plan", "implement", "review", "merge"],
  initialNode: "plan",
  artifactTypes: ["ReviewVerdict"],
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
      id: "03-review-merge",
      from: "review",
      to: "merge",
      role: "reviewer",
    },
  ],
};

export const balancedWorkflowDefinition: PrivateWorkflowDefinition = {
  id: "builtin/balanced",
  revision: 1,
  preset: "balanced",
  nodes: ["plan", "implement", "review", "reconcile", "merge"],
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
      id: "03-review-merge",
      from: "review",
      to: "merge",
      role: "reviewer",
    },
    {
      id: "04-review-reconcile",
      from: "review",
      to: "reconcile",
      role: "reviewer",
      produces: ["BlockingFinding"],
    },
    {
      id: "05-reconcile-implement",
      from: "reconcile",
      to: "implement",
      role: "steward",
      invalidates: ["BlockingFinding", "ReviewVerdict"],
    },
  ],
};

const definitionsByPreset: Readonly<
  Record<CandidatePreset, PrivateWorkflowDefinition>
> = {
  balanced: balancedWorkflowDefinition,
  fast: fastWorkflowDefinition,
};

export function builtInDefinitionForPreset(
  preset: CandidatePreset,
): PrivateWorkflowDefinition {
  return definitionsByPreset[preset];
}
