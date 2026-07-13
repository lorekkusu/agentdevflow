import type {
  FiniteWorkflow,
  SafetyPolicy,
} from "../../../src/policy/model.js";

export const reviewPolicy: SafetyPolicy = {
  id: "merge-requires-review-verdict",
  kind: "requires-valid-artifact",
  at: "merge",
  artifact: "ReviewVerdict",
};

export const safeBaseline: FiniteWorkflow = {
  nodes: ["plan", "implement", "review", "merge"],
  initialNode: "plan",
  transitions: [
    { id: "01-plan-implement", from: "plan", to: "implement" },
    {
      id: "02-implement-review",
      from: "implement",
      to: "review",
      produces: ["ReviewVerdict"],
    },
    { id: "03-review-merge", from: "review", to: "merge" },
  ],
};

export const directReviewBypass: FiniteWorkflow = {
  nodes: ["plan", "implement", "review", "merge"],
  initialNode: "plan",
  transitions: [
    { id: "01-plan-implement", from: "plan", to: "implement" },
    { id: "02-implement-merge", from: "implement", to: "merge" },
    {
      id: "03-implement-review",
      from: "implement",
      to: "review",
      produces: ["ReviewVerdict"],
    },
    { id: "04-review-merge", from: "review", to: "merge" },
  ],
};

export const staleReviewVerdict: FiniteWorkflow = {
  nodes: ["plan", "implement", "review", "reimplement", "merge"],
  initialNode: "plan",
  transitions: [
    { id: "01-plan-implement", from: "plan", to: "implement" },
    {
      id: "02-implement-review",
      from: "implement",
      to: "review",
      produces: ["ReviewVerdict"],
    },
    {
      id: "03-review-reimplement",
      from: "review",
      to: "reimplement",
      invalidates: ["ReviewVerdict"],
    },
    { id: "04-reimplement-merge", from: "reimplement", to: "merge" },
  ],
};

export const safeReviewReworkCycle: FiniteWorkflow = {
  nodes: ["plan", "implement", "review", "merge"],
  initialNode: "plan",
  transitions: [
    { id: "01-plan-implement", from: "plan", to: "implement" },
    {
      id: "02-implement-review",
      from: "implement",
      to: "review",
      produces: ["ReviewVerdict"],
    },
    {
      id: "03-review-implement",
      from: "review",
      to: "implement",
      invalidates: ["ReviewVerdict"],
    },
    { id: "04-review-merge", from: "review", to: "merge" },
  ],
};

export const guardedFalsePositive: FiniteWorkflow = {
  nodes: ["plan", "implement", "review", "merge"],
  initialNode: "plan",
  transitions: [
    {
      id: "01-plan-implement",
      from: "plan",
      to: "implement",
      guard: "risk != low",
    },
    {
      id: "02-implement-merge-fast",
      from: "implement",
      to: "merge",
      guard: "risk == low",
    },
    {
      id: "03-implement-review-strict",
      from: "implement",
      to: "review",
      guard: "risk != low",
      produces: ["ReviewVerdict"],
    },
    { id: "04-review-merge", from: "review", to: "merge" },
  ],
};
