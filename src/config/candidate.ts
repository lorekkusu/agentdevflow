export const candidatePresets = ["balanced", "fast"] as const;
export type CandidatePreset = (typeof candidatePresets)[number];

export const candidateProviderProducts = [
  "claude-code",
  "codex",
  "cursor",
] as const;
export type CandidateProviderProduct =
  (typeof candidateProviderProducts)[number];

export const candidateProviderSurfaces = ["cli", "ide"] as const;
export type CandidateProviderSurface =
  (typeof candidateProviderSurfaces)[number];

export const candidateRoles = ["developer", "reviewer", "steward"] as const;
export type CandidateRole = (typeof candidateRoles)[number];

export const candidateTrackerModes = ["local", "none"] as const;
export type CandidateTrackerMode = (typeof candidateTrackerModes)[number];

export const candidateReviewSeparations = [
  "distinct-provider-instance",
  "same-provider-allowed",
] as const;
export type CandidateReviewSeparation =
  (typeof candidateReviewSeparations)[number];

export const candidateArtifactTypes = [
  "BlockingFinding",
  "ReviewVerdict",
] as const;
export type CandidateArtifactType =
  (typeof candidateArtifactTypes)[number];

export interface CandidateProviderInstance {
  readonly id: string;
  readonly product: CandidateProviderProduct;
  readonly surface: CandidateProviderSurface;
}

export interface CandidateRoleBindings {
  readonly developer: string;
  readonly reviewer: string;
  readonly steward: string;
}

export interface CandidateTrackerConfig {
  readonly mode: CandidateTrackerMode;
}

export interface CandidateReviewConfig {
  readonly requiredBeforeMerge: boolean;
  readonly reviewerSeparation: CandidateReviewSeparation;
  readonly artifactTypes: readonly CandidateArtifactType[];
}

/**
 * Fixture-only input used to discover a future ProjectConfig contract.
 * It is not a public API or a serialized configuration format.
 */
export interface CandidateProjectConfig {
  readonly schemaVersion: 0;
  readonly preset: CandidatePreset;
  readonly providers: readonly CandidateProviderInstance[];
  readonly roles: CandidateRoleBindings;
  readonly tracker: CandidateTrackerConfig;
  readonly review: CandidateReviewConfig;
}

export interface NormalizedCandidateProjectConfig {
  readonly schemaVersion: 0;
  readonly preset: CandidatePreset;
  readonly providers: readonly CandidateProviderInstance[];
  readonly roles: CandidateRoleBindings;
  readonly tracker: CandidateTrackerConfig;
  readonly review: CandidateReviewConfig;
}

export type CandidateConfigDiagnosticCode =
  | "DUPLICATE_VALUE"
  | "INVALID_IDENTIFIER"
  | "INVALID_TYPE"
  | "INVALID_VALUE"
  | "MISSING_REQUIRED_FIELD"
  | "REVIEWER_SEPARATION_REQUIRED"
  | "REVIEW_VERDICT_REQUIRED"
  | "UNKNOWN_FIELD"
  | "UNKNOWN_PROVIDER_REFERENCE"
  | "UNSUPPORTED_SCHEMA_VERSION";

export interface CandidateConfigDiagnostic {
  readonly code: CandidateConfigDiagnosticCode;
  readonly path: string;
  readonly message: string;
}

export type CandidateConfigNormalizationResult =
  | {
      readonly ok: true;
      readonly config: NormalizedCandidateProjectConfig;
      readonly canonicalJson: string;
      readonly digest: string;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly CandidateConfigDiagnostic[];
    };
