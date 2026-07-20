import { createHash } from "node:crypto";

import type { CandidateConfigDiagnostic } from "../config/candidate.js";
import { normalizeCandidateProjectConfig } from "../config/normalize-candidate.js";
import type {
  PrivateDomainCapabilityBinding,
  PrivateDomainProjectIntent,
  PrivateDomainWorkflowIntent,
} from "./private-domain-project-resolution.js";

export const privateLegacyCandidateConvergenceRevision = 1;

export interface PrivateLegacyCandidateConvergenceChoices {
  readonly workflow: PrivateDomainWorkflowIntent;
  readonly capabilityBindings: readonly PrivateDomainCapabilityBinding[];
}

export interface PrivateLegacyCandidateConvergence {
  readonly revision: 1;
  readonly sourceConfigurationDigest: string;
  readonly intent: PrivateDomainProjectIntent;
  readonly convergenceDigest: string;
}

export type PrivateLegacyCandidateConvergenceDiagnostic =
  | {
      readonly code: "LEGACY_CONFIGURATION_INVALID";
      readonly path: "$";
      readonly message: string;
      readonly causes: readonly CandidateConfigDiagnostic[];
    }
  | {
      readonly code:
        | "LEGACY_PRESET_PROFILE_MISMATCH"
        | "LEGACY_TRACKER_INCOMPATIBLE";
      readonly path: "$.preset" | "$.tracker.mode";
      readonly message: string;
    };

export type PrivateLegacyCandidateConvergenceResult =
  | {
      readonly ok: true;
      readonly convergence: PrivateLegacyCandidateConvergence;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateLegacyCandidateConvergenceDiagnostic[];
    };

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function profileMatches(
  preset: "balanced" | "fast",
  review: {
    readonly requiredBeforeMerge: boolean;
    readonly reviewerSeparation:
      | "distinct-provider-instance"
      | "same-provider-allowed";
    readonly artifactTypes: readonly ("BlockingFinding" | "ReviewVerdict")[];
  },
): boolean {
  if (!review.requiredBeforeMerge) {
    return false;
  }
  if (preset === "fast") {
    return (
      review.reviewerSeparation === "same-provider-allowed" &&
      review.artifactTypes.length === 1 &&
      review.artifactTypes[0] === "ReviewVerdict"
    );
  }
  return (
    review.reviewerSeparation === "distinct-provider-instance" &&
    review.artifactTypes.length === 2 &&
    review.artifactTypes[0] === "BlockingFinding" &&
    review.artifactTypes[1] === "ReviewVerdict"
  );
}

export function convergePrivateLegacyCandidate(
  input: unknown,
  choices: PrivateLegacyCandidateConvergenceChoices,
): PrivateLegacyCandidateConvergenceResult {
  const normalized = normalizeCandidateProjectConfig(input);
  if (!normalized.ok) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "LEGACY_CONFIGURATION_INVALID",
          path: "$",
          message:
            "The schema-version-0 candidate configuration is invalid.",
          causes: normalized.diagnostics,
        },
      ],
    };
  }

  if (!profileMatches(normalized.config.preset, normalized.config.review)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "LEGACY_PRESET_PROFILE_MISMATCH",
          path: "$.preset",
          message: `The schema-version-0 review fields do not match the ${normalized.config.preset} preset profile.`,
        },
      ],
    };
  }

  if (choices.workflow.family !== "local-reviewed-change") {
    return {
      ok: false,
      diagnostics: [
        {
          code: "LEGACY_TRACKER_INCOMPATIBLE",
          path: "$.tracker.mode",
          message:
            "Schema-version-0 local and none tracker modes cannot select the issue-to-reviewed-pull-request workflow without new explicit tracker intent.",
        },
      ],
    };
  }

  const intent: PrivateDomainProjectIntent = {
    revision: 1,
    preset: normalized.config.preset,
    providers: normalized.config.providers,
    roles: normalized.config.roles,
    tracker: normalized.config.tracker,
    workflow: choices.workflow,
    capabilityBindings: choices.capabilityBindings,
  };
  const convergenceWithoutDigest = {
    revision: privateLegacyCandidateConvergenceRevision,
    sourceConfigurationDigest: normalized.digest,
    intent,
  } as const;

  return {
    ok: true,
    convergence: {
      ...convergenceWithoutDigest,
      convergenceDigest: digest(convergenceWithoutDigest),
    },
  };
}
