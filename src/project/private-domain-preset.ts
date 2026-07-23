import { createHash } from "node:crypto";

import type { PrivateDomainWorkflowDefinition } from "../compiler/private-domain-workflow.js";

export const privateDomainPresetExpansionRevision = 1;
export const privateDomainPresets = ["balanced", "fast", "strict"] as const;
export type PrivateDomainPreset = (typeof privateDomainPresets)[number];

export type PrivateDomainPresetWorkflowFamily =
  | "issue-to-reviewed-pull-request"
  | "local-reviewed-change";

export interface PrivateDomainPresetProfile {
  readonly reviewVerdictRequired: true;
  readonly blockingFindingsForbiddenAtCompletion: boolean;
  readonly reviewerIsolationEvidenceRequired: boolean;
}

export interface PrivateDomainPresetExpansion {
  readonly revision: 1;
  readonly preset: "balanced" | "fast";
  readonly profile: PrivateDomainPresetProfile;
  readonly definition: PrivateDomainWorkflowDefinition;
  readonly expansionDigest: string;
}

export type PrivateDomainPresetExpansionDiagnostic =
  | {
      readonly code: "PRESET_UNAVAILABLE";
      readonly path: "$.preset";
      readonly message: string;
    }
  | {
      readonly code: "PRESET_WORKFLOW_INCOMPATIBLE";
      readonly path: "$.preset";
      readonly message: string;
    };

export type PrivateDomainPresetExpansionResult =
  | { readonly ok: true; readonly expansion: PrivateDomainPresetExpansion }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainPresetExpansionDiagnostic[];
    };

const fastProfile: PrivateDomainPresetProfile = {
  reviewVerdictRequired: true,
  blockingFindingsForbiddenAtCompletion: false,
  reviewerIsolationEvidenceRequired: false,
};

const balancedProfile: PrivateDomainPresetProfile = {
  reviewVerdictRequired: true,
  blockingFindingsForbiddenAtCompletion: true,
  reviewerIsolationEvidenceRequired: true,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.keys(record)
        .sort(compareText)
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function withPresetIdentity(
  definition: PrivateDomainWorkflowDefinition,
  preset: "balanced" | "fast",
): PrivateDomainWorkflowDefinition {
  return {
    ...definition,
    id: `${definition.id}/preset-${preset}`,
  };
}

function balancedLocalDefinition(
  definition: PrivateDomainWorkflowDefinition,
): PrivateDomainWorkflowDefinition {
  return {
    ...definition,
    artifactTypes: sortedUnique([
      ...definition.artifactTypes,
      "BlockingFinding",
      "ReviewerIsolationEvidence",
    ]),
    transitions: definition.transitions.map((transition) => {
      if (transition.id === "02-implement-review") {
        return {
          ...transition,
          invalidates: sortedUnique([
            ...(transition.invalidates ?? []),
            "BlockingFinding",
          ]),
        };
      }
      if (transition.id === "03-review-rework") {
        return {
          ...transition,
          produces: sortedUnique([
            ...(transition.produces ?? []),
            "BlockingFinding",
          ]),
          invalidates: sortedUnique([
            ...(transition.invalidates ?? []),
            "ReviewerIsolationEvidence",
          ]),
        };
      }
      if (transition.id === "04-review-accept") {
        return {
          ...transition,
          produces: sortedUnique([
            ...(transition.produces ?? []),
            "ReviewerIsolationEvidence",
          ]),
        };
      }
      return transition;
    }),
    policies: [
      ...definition.policies,
      {
        id: "acceptance-forbids-blocking-finding",
        kind: "forbids-valid-artifact",
        at: "accepted",
        artifact: "BlockingFinding",
      },
      {
        id: "acceptance-requires-reviewer-isolation",
        kind: "requires-valid-artifact",
        at: "accepted",
        artifact: "ReviewerIsolationEvidence",
      },
    ],
  };
}

function fastIssueDefinition(
  definition: PrivateDomainWorkflowDefinition,
): PrivateDomainWorkflowDefinition {
  return {
    ...definition,
    artifactTypes: definition.artifactTypes.filter(
      (artifact) => artifact !== "ReviewerIsolationEvidence",
    ),
    transitions: definition.transitions.map((transition) => {
      const produces = transition.produces?.filter(
        (artifact) => artifact !== "ReviewerIsolationEvidence",
      );
      const invalidates = transition.invalidates?.filter(
        (artifact) => artifact !== "ReviewerIsolationEvidence",
      );
      return {
        ...transition,
        ...(produces === undefined ? {} : { produces }),
        ...(invalidates === undefined ? {} : { invalidates }),
      };
    }),
    policies: definition.policies.filter(
      (policy) =>
        policy.artifact !== "BlockingFinding" &&
        policy.artifact !== "ReviewerIsolationEvidence",
    ),
  };
}

function hasArtifactPolicy(
  definition: PrivateDomainWorkflowDefinition,
  kind: "forbids-valid-artifact" | "requires-valid-artifact",
  artifact: string,
): boolean {
  return definition.policies.some(
    (policy) => policy.kind === kind && policy.artifact === artifact,
  );
}

function satisfiesProfile(
  definition: PrivateDomainWorkflowDefinition,
  profile: PrivateDomainPresetProfile,
): boolean {
  return (
    hasArtifactPolicy(
      definition,
      "requires-valid-artifact",
      "ReviewVerdict",
    ) &&
    (!profile.blockingFindingsForbiddenAtCompletion ||
      hasArtifactPolicy(
        definition,
        "forbids-valid-artifact",
        "BlockingFinding",
      )) &&
    (!profile.reviewerIsolationEvidenceRequired ||
      hasArtifactPolicy(
        definition,
        "requires-valid-artifact",
        "ReviewerIsolationEvidence",
      ))
  );
}

export function expandPrivateDomainPreset(
  preset: PrivateDomainPreset,
  workflowFamily: PrivateDomainPresetWorkflowFamily,
  baseDefinition: PrivateDomainWorkflowDefinition,
): PrivateDomainPresetExpansionResult {
  if (preset === "strict") {
    return {
      ok: false,
      diagnostics: [
        {
          code: "PRESET_UNAVAILABLE",
          path: "$.preset",
          message:
            "Strict is unavailable until a safety-property set is accepted and has executable semantics.",
        },
      ],
    };
  }

  const profile = preset === "balanced" ? balancedProfile : fastProfile;
  const overlaidDefinition =
    preset === "fast" && workflowFamily === "issue-to-reviewed-pull-request"
      ? fastIssueDefinition(baseDefinition)
      : preset === "balanced" && workflowFamily === "local-reviewed-change"
        ? balancedLocalDefinition(baseDefinition)
        : baseDefinition;
  const definition = withPresetIdentity(overlaidDefinition, preset);

  if (!satisfiesProfile(definition, profile)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "PRESET_WORKFLOW_INCOMPATIBLE",
          path: "$.preset",
          message: `Workflow ${baseDefinition.id} does not satisfy the ${preset} preset profile.`,
        },
      ],
    };
  }

  const expansionWithoutDigest = {
    revision: privateDomainPresetExpansionRevision,
    preset,
    profile,
    definition,
  } as const;
  return {
    ok: true,
    expansion: {
      ...expansionWithoutDigest,
      expansionDigest: digest(expansionWithoutDigest),
    },
  };
}
