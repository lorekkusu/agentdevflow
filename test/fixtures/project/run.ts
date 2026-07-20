import {
  resolvePrivateDomainProject,
  type PrivateDomainProjectIntent,
} from "../../../src/project/private-domain-project-resolution.js";
import { privateIssueToPullRequestCapabilityObservations } from "../../../src/workflows/private-issue-to-reviewed-pull-request.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../../../src/workflows/private-local-reviewed-change.js";

const readyLinear: PrivateDomainProjectIntent = {
  revision: 1,
  preset: "balanced",
  providers: [
    { id: "codex-steward", product: "codex", surface: "cli" },
    { id: "cursor-developer", product: "cursor", surface: "ide" },
    { id: "codex-reviewer", product: "codex", surface: "cli" },
  ],
  roles: {
    steward: "codex-steward",
    developer: "cursor-developer",
    reviewer: "codex-reviewer",
  },
  tracker: { mode: "linear" },
  workflow: {
    family: "issue-to-reviewed-pull-request",
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  },
  capabilityBindings: [
    { binding: "tracker", target: { kind: "tracker" } },
    {
      binding: "developer",
      target: { kind: "responsibility", responsibility: "developer" },
    },
    {
      binding: "pull-request-host",
      target: { kind: "external", id: "github" },
    },
    { binding: "ci", target: { kind: "external", id: "github-actions" } },
    {
      binding: "reviewer",
      target: { kind: "responsibility", responsibility: "reviewer" },
    },
  ],
};

const draftAuxiliary: PrivateDomainProjectIntent = {
  ...readyLinear,
  providers: [
    { id: "claude-steward", product: "claude-code", surface: "cli" },
    { id: "cursor-developer", product: "cursor", surface: "ide" },
    { id: "claude-reviewer", product: "claude-code", surface: "cli" },
  ],
  roles: {
    steward: "claude-steward",
    developer: "cursor-developer",
    reviewer: "claude-reviewer",
  },
  tracker: { mode: "github-issues" },
  workflow: {
    family: "issue-to-reviewed-pull-request",
    initialState: "draft",
    auxiliaryReview: "enabled",
    mergeMethod: "squash",
  },
  capabilityBindings: [
    ...readyLinear.capabilityBindings,
    {
      binding: "auxiliary-reviewer",
      target: { kind: "external", id: "automated-review-service" },
    },
  ],
};

const local: PrivateDomainProjectIntent = {
  revision: 1,
  preset: "balanced",
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
  capabilityBindings: [
    {
      binding: "developer",
      target: { kind: "responsibility", responsibility: "developer" },
    },
    {
      binding: "reviewer",
      target: { kind: "responsibility", responsibility: "reviewer" },
    },
  ],
};

const specimens = [
  {
    name: "codex-cursor-linear-ready",
    intent: readyLinear,
    observations: privateIssueToPullRequestCapabilityObservations,
  },
  {
    name: "claude-cursor-github-draft-auxiliary",
    intent: draftAuxiliary,
    observations: privateIssueToPullRequestCapabilityObservations,
  },
  {
    name: "local-reviewed-change",
    intent: local,
    observations: privateLocalReviewedChangeCapabilityObservations,
  },
] as const;

const output = specimens.map((specimen) => {
  const result = resolvePrivateDomainProject(specimen.intent, {
    capabilityObservations: specimen.observations,
  });
  if (!result.ok) {
    throw new Error(`Project resolution fixture ${specimen.name} failed.`);
  }
  return {
    name: specimen.name,
    preset: result.resolution.preset.name,
    workflowFamily: result.resolution.workflow.family,
    tracker: result.resolution.tracker.mode,
    intentDigest: result.resolution.intentDigest,
    manifestDigest: result.manifestPackage.digest,
    resolutionDigest: result.resolutionDigest,
    providerCount: result.normalizedIntent.providers.length,
    capabilityTargetCount: result.resolution.capabilityTargets.length,
  };
});

console.log(JSON.stringify(output, null, 2));
