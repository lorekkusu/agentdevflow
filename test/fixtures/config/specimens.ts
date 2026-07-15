import type { CandidateProjectConfig } from "../../../src/config/candidate.js";

export const fastCandidateConfig = {
  schemaVersion: 0,
  preset: "fast",
  providers: [
    {
      id: "codex-primary",
      product: "codex",
      surface: "cli",
    },
  ],
  roles: {
    developer: "codex-primary",
    reviewer: "codex-primary",
    steward: "codex-primary",
  },
  tracker: { mode: "none" },
  review: {
    requiredBeforeMerge: true,
    reviewerSeparation: "same-provider-allowed",
    artifactTypes: ["ReviewVerdict"],
  },
} satisfies CandidateProjectConfig;

export const balancedCandidateConfig = {
  schemaVersion: 0,
  preset: "balanced",
  providers: [
    {
      id: "cursor-steward",
      product: "cursor",
      surface: "ide",
    },
    {
      id: "codex-developer",
      product: "codex",
      surface: "cli",
    },
    {
      id: "claude-reviewer",
      product: "claude-code",
      surface: "cli",
    },
  ],
  roles: {
    developer: "codex-developer",
    reviewer: "claude-reviewer",
    steward: "cursor-steward",
  },
  tracker: { mode: "local" },
  review: {
    requiredBeforeMerge: true,
    reviewerSeparation: "distinct-provider-instance",
    artifactTypes: ["ReviewVerdict", "BlockingFinding"],
  },
} satisfies CandidateProjectConfig;

export const reorderedBalancedCandidateConfig = {
  ...balancedCandidateConfig,
  providers: [...balancedCandidateConfig.providers].reverse(),
  review: {
    ...balancedCandidateConfig.review,
    artifactTypes: [...balancedCandidateConfig.review.artifactTypes].reverse(),
  },
} satisfies CandidateProjectConfig;
