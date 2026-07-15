import { createHash } from "node:crypto";

import {
  candidateArtifactTypes,
  candidatePresets,
  candidateProviderProducts,
  candidateProviderSurfaces,
  candidateReviewSeparations,
  candidateRoles,
  candidateTrackerModes,
  type CandidateArtifactType,
  type CandidateConfigDiagnostic,
  type CandidateConfigNormalizationResult,
  type CandidatePreset,
  type CandidateProviderInstance,
  type CandidateProviderProduct,
  type CandidateProviderSurface,
  type CandidateReviewSeparation,
  type CandidateRoleBindings,
  type CandidateTrackerMode,
  type NormalizedCandidateProjectConfig,
} from "./candidate.js";

type UnknownRecord = Record<string, unknown>;

const providerIdentifierPattern = /^[a-z][a-z0-9-]*$/u;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addDiagnostic(
  diagnostics: CandidateConfigDiagnostic[],
  diagnostic: CandidateConfigDiagnostic,
): void {
  diagnostics.push(diagnostic);
}

function validateKnownFields(
  value: UnknownRecord,
  allowedFields: ReadonlySet<string>,
  path: string,
  diagnostics: CandidateConfigDiagnostic[],
): void {
  for (const field of Object.keys(value).sort()) {
    if (!allowedFields.has(field)) {
      addDiagnostic(diagnostics, {
        code: "UNKNOWN_FIELD",
        path: `${path}.${field}`,
        message: `Unknown field ${path}.${field}.`,
      });
    }
  }
}

function requiredString(
  value: UnknownRecord,
  field: string,
  path: string,
  diagnostics: CandidateConfigDiagnostic[],
): string | undefined {
  const fieldPath = `${path}.${field}`;
  if (!(field in value)) {
    addDiagnostic(diagnostics, {
      code: "MISSING_REQUIRED_FIELD",
      path: fieldPath,
      message: `Required field ${fieldPath} is missing.`,
    });
    return undefined;
  }
  const candidate = value[field];
  if (typeof candidate !== "string") {
    addDiagnostic(diagnostics, {
      code: "INVALID_TYPE",
      path: fieldPath,
      message: `${fieldPath} must be a string.`,
    });
    return undefined;
  }
  return candidate;
}

function requiredBoolean(
  value: UnknownRecord,
  field: string,
  path: string,
  diagnostics: CandidateConfigDiagnostic[],
): boolean | undefined {
  const fieldPath = `${path}.${field}`;
  if (!(field in value)) {
    addDiagnostic(diagnostics, {
      code: "MISSING_REQUIRED_FIELD",
      path: fieldPath,
      message: `Required field ${fieldPath} is missing.`,
    });
    return undefined;
  }
  const candidate = value[field];
  if (typeof candidate !== "boolean") {
    addDiagnostic(diagnostics, {
      code: "INVALID_TYPE",
      path: fieldPath,
      message: `${fieldPath} must be a boolean.`,
    });
    return undefined;
  }
  return candidate;
}

function requiredEnum<T extends string>(
  value: UnknownRecord,
  field: string,
  path: string,
  allowedValues: readonly T[],
  diagnostics: CandidateConfigDiagnostic[],
): T | undefined {
  const candidate = requiredString(value, field, path, diagnostics);
  if (candidate === undefined) {
    return undefined;
  }
  if (!allowedValues.includes(candidate as T)) {
    const fieldPath = `${path}.${field}`;
    addDiagnostic(diagnostics, {
      code: "INVALID_VALUE",
      path: fieldPath,
      message: `${fieldPath} must be one of: ${allowedValues.join(", ")}.`,
    });
    return undefined;
  }
  return candidate as T;
}

function validateSchemaVersion(
  root: UnknownRecord,
  diagnostics: CandidateConfigDiagnostic[],
): 0 | undefined {
  const path = "$.schemaVersion";
  if (!("schemaVersion" in root)) {
    addDiagnostic(diagnostics, {
      code: "MISSING_REQUIRED_FIELD",
      path,
      message: `Required field ${path} is missing.`,
    });
    return undefined;
  }
  if (typeof root.schemaVersion !== "number") {
    addDiagnostic(diagnostics, {
      code: "INVALID_TYPE",
      path,
      message: `${path} must be a number.`,
    });
    return undefined;
  }
  if (root.schemaVersion !== 0) {
    addDiagnostic(diagnostics, {
      code: "UNSUPPORTED_SCHEMA_VERSION",
      path,
      message: "Only fixture schema version 0 is supported.",
    });
    return undefined;
  }
  return 0;
}

function validateProviders(
  root: UnknownRecord,
  diagnostics: CandidateConfigDiagnostic[],
): CandidateProviderInstance[] | undefined {
  const path = "$.providers";
  if (!("providers" in root)) {
    addDiagnostic(diagnostics, {
      code: "MISSING_REQUIRED_FIELD",
      path,
      message: `Required field ${path} is missing.`,
    });
    return undefined;
  }
  if (!Array.isArray(root.providers)) {
    addDiagnostic(diagnostics, {
      code: "INVALID_TYPE",
      path,
      message: `${path} must be an array.`,
    });
    return undefined;
  }
  if (root.providers.length === 0) {
    addDiagnostic(diagnostics, {
      code: "INVALID_VALUE",
      path,
      message: `${path} must contain at least one provider instance.`,
    });
  }

  const providers: CandidateProviderInstance[] = [];
  const providerIds = new Set<string>();
  for (const [index, providerValue] of root.providers.entries()) {
    const providerPath = `${path}[${index}]`;
    if (!isRecord(providerValue)) {
      addDiagnostic(diagnostics, {
        code: "INVALID_TYPE",
        path: providerPath,
        message: `${providerPath} must be an object.`,
      });
      continue;
    }
    validateKnownFields(
      providerValue,
      new Set(["id", "product", "surface"]),
      providerPath,
      diagnostics,
    );
    const id = requiredString(providerValue, "id", providerPath, diagnostics);
    const product = requiredEnum<CandidateProviderProduct>(
      providerValue,
      "product",
      providerPath,
      candidateProviderProducts,
      diagnostics,
    );
    const surface = requiredEnum<CandidateProviderSurface>(
      providerValue,
      "surface",
      providerPath,
      candidateProviderSurfaces,
      diagnostics,
    );

    if (id !== undefined && !providerIdentifierPattern.test(id)) {
      addDiagnostic(diagnostics, {
        code: "INVALID_IDENTIFIER",
        path: `${providerPath}.id`,
        message:
          "Provider ids must start with a lowercase letter and contain only lowercase letters, digits, and hyphens.",
      });
    }
    if (id !== undefined && providerIds.has(id)) {
      addDiagnostic(diagnostics, {
        code: "DUPLICATE_VALUE",
        path: `${providerPath}.id`,
        message: `Provider id ${id} is duplicated.`,
      });
    }
    if (id !== undefined) {
      providerIds.add(id);
    }
    if (
      id !== undefined &&
      providerIdentifierPattern.test(id) &&
      product !== undefined &&
      surface !== undefined
    ) {
      providers.push({ id, product, surface });
    }
  }

  return providers.sort((left, right) => compareText(left.id, right.id));
}

function validateRoles(
  root: UnknownRecord,
  diagnostics: CandidateConfigDiagnostic[],
): CandidateRoleBindings | undefined {
  const path = "$.roles";
  if (!("roles" in root)) {
    addDiagnostic(diagnostics, {
      code: "MISSING_REQUIRED_FIELD",
      path,
      message: `Required field ${path} is missing.`,
    });
    return undefined;
  }
  if (!isRecord(root.roles)) {
    addDiagnostic(diagnostics, {
      code: "INVALID_TYPE",
      path,
      message: `${path} must be an object.`,
    });
    return undefined;
  }
  validateKnownFields(root.roles, new Set(candidateRoles), path, diagnostics);
  const developer = requiredString(root.roles, "developer", path, diagnostics);
  const reviewer = requiredString(root.roles, "reviewer", path, diagnostics);
  const steward = requiredString(root.roles, "steward", path, diagnostics);
  if (
    developer === undefined ||
    reviewer === undefined ||
    steward === undefined
  ) {
    return undefined;
  }
  return { developer, reviewer, steward };
}

function validateTracker(
  root: UnknownRecord,
  diagnostics: CandidateConfigDiagnostic[],
): CandidateTrackerMode | undefined {
  const path = "$.tracker";
  if (!("tracker" in root)) {
    addDiagnostic(diagnostics, {
      code: "MISSING_REQUIRED_FIELD",
      path,
      message: `Required field ${path} is missing.`,
    });
    return undefined;
  }
  if (!isRecord(root.tracker)) {
    addDiagnostic(diagnostics, {
      code: "INVALID_TYPE",
      path,
      message: `${path} must be an object.`,
    });
    return undefined;
  }
  validateKnownFields(root.tracker, new Set(["mode"]), path, diagnostics);
  return requiredEnum<CandidateTrackerMode>(
    root.tracker,
    "mode",
    path,
    candidateTrackerModes,
    diagnostics,
  );
}

interface ValidatedReview {
  readonly requiredBeforeMerge: boolean;
  readonly reviewerSeparation: CandidateReviewSeparation;
  readonly artifactTypes: readonly CandidateArtifactType[];
}

function validateArtifactTypes(
  review: UnknownRecord,
  diagnostics: CandidateConfigDiagnostic[],
): CandidateArtifactType[] | undefined {
  const path = "$.review.artifactTypes";
  if (!("artifactTypes" in review)) {
    addDiagnostic(diagnostics, {
      code: "MISSING_REQUIRED_FIELD",
      path,
      message: `Required field ${path} is missing.`,
    });
    return undefined;
  }
  if (!Array.isArray(review.artifactTypes)) {
    addDiagnostic(diagnostics, {
      code: "INVALID_TYPE",
      path,
      message: `${path} must be an array.`,
    });
    return undefined;
  }

  const artifacts: CandidateArtifactType[] = [];
  const seen = new Set<string>();
  for (const [index, artifact] of review.artifactTypes.entries()) {
    const artifactPath = `${path}[${index}]`;
    if (typeof artifact !== "string") {
      addDiagnostic(diagnostics, {
        code: "INVALID_TYPE",
        path: artifactPath,
        message: `${artifactPath} must be a string.`,
      });
      continue;
    }
    if (!candidateArtifactTypes.includes(artifact as CandidateArtifactType)) {
      addDiagnostic(diagnostics, {
        code: "INVALID_VALUE",
        path: artifactPath,
        message: `${artifactPath} must be one of: ${candidateArtifactTypes.join(", ")}.`,
      });
      continue;
    }
    if (seen.has(artifact)) {
      addDiagnostic(diagnostics, {
        code: "DUPLICATE_VALUE",
        path: artifactPath,
        message: `Artifact type ${artifact} is duplicated.`,
      });
      continue;
    }
    seen.add(artifact);
    artifacts.push(artifact as CandidateArtifactType);
  }
  return artifacts.sort();
}

function validateReview(
  root: UnknownRecord,
  diagnostics: CandidateConfigDiagnostic[],
): ValidatedReview | undefined {
  const path = "$.review";
  if (!("review" in root)) {
    addDiagnostic(diagnostics, {
      code: "MISSING_REQUIRED_FIELD",
      path,
      message: `Required field ${path} is missing.`,
    });
    return undefined;
  }
  if (!isRecord(root.review)) {
    addDiagnostic(diagnostics, {
      code: "INVALID_TYPE",
      path,
      message: `${path} must be an object.`,
    });
    return undefined;
  }
  validateKnownFields(
    root.review,
    new Set(["artifactTypes", "requiredBeforeMerge", "reviewerSeparation"]),
    path,
    diagnostics,
  );
  const requiredBeforeMerge = requiredBoolean(
    root.review,
    "requiredBeforeMerge",
    path,
    diagnostics,
  );
  const reviewerSeparation = requiredEnum<CandidateReviewSeparation>(
    root.review,
    "reviewerSeparation",
    path,
    candidateReviewSeparations,
    diagnostics,
  );
  const artifactTypes = validateArtifactTypes(root.review, diagnostics);
  if (
    requiredBeforeMerge === undefined ||
    reviewerSeparation === undefined ||
    artifactTypes === undefined
  ) {
    return undefined;
  }
  if (
    requiredBeforeMerge &&
    !artifactTypes.includes("ReviewVerdict")
  ) {
    addDiagnostic(diagnostics, {
      code: "REVIEW_VERDICT_REQUIRED",
      path: "$.review.artifactTypes",
      message:
        "ReviewVerdict must be declared when review is required before merge.",
    });
  }
  return { requiredBeforeMerge, reviewerSeparation, artifactTypes };
}

function validateProviderReferences(
  providers: readonly CandidateProviderInstance[],
  roles: CandidateRoleBindings,
  review: ValidatedReview,
  diagnostics: CandidateConfigDiagnostic[],
): void {
  const providerIds = new Set(providers.map((provider) => provider.id));
  for (const role of candidateRoles) {
    const providerId = roles[role];
    if (!providerIds.has(providerId)) {
      addDiagnostic(diagnostics, {
        code: "UNKNOWN_PROVIDER_REFERENCE",
        path: `$.roles.${role}`,
        message: `Role ${role} references unknown provider instance ${providerId}.`,
      });
    }
  }
  if (
    review.reviewerSeparation === "distinct-provider-instance" &&
    roles.reviewer === roles.developer
  ) {
    addDiagnostic(diagnostics, {
      code: "REVIEWER_SEPARATION_REQUIRED",
      path: "$.roles.reviewer",
      message:
        "The reviewer must use a different provider instance from the developer for the selected review separation.",
    });
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function compareDiagnostics(
  left: CandidateConfigDiagnostic,
  right: CandidateConfigDiagnostic,
): number {
  return (
    compareText(left.path, right.path) ||
    compareText(left.code, right.code) ||
    compareText(left.message, right.message)
  );
}

export function normalizeCandidateProjectConfig(
  input: unknown,
): CandidateConfigNormalizationResult {
  const diagnostics: CandidateConfigDiagnostic[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "INVALID_TYPE",
          path: "$",
          message: "Candidate project configuration must be an object.",
        },
      ],
    };
  }

  validateKnownFields(
    input,
    new Set([
      "preset",
      "providers",
      "review",
      "roles",
      "schemaVersion",
      "tracker",
    ]),
    "$",
    diagnostics,
  );
  const schemaVersion = validateSchemaVersion(input, diagnostics);
  const preset = requiredEnum<CandidatePreset>(
    input,
    "preset",
    "$",
    candidatePresets,
    diagnostics,
  );
  const providers = validateProviders(input, diagnostics);
  const roles = validateRoles(input, diagnostics);
  const trackerMode = validateTracker(input, diagnostics);
  const review = validateReview(input, diagnostics);

  if (providers && roles && review) {
    validateProviderReferences(providers, roles, review, diagnostics);
  }

  diagnostics.sort(compareDiagnostics);
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  if (
    schemaVersion === undefined ||
    preset === undefined ||
    providers === undefined ||
    roles === undefined ||
    trackerMode === undefined ||
    review === undefined
  ) {
    throw new Error("Candidate configuration validation is inconsistent.");
  }

  const config: NormalizedCandidateProjectConfig = {
    schemaVersion,
    preset,
    providers,
    roles: {
      developer: roles.developer,
      reviewer: roles.reviewer,
      steward: roles.steward,
    },
    tracker: { mode: trackerMode },
    review: {
      requiredBeforeMerge: review.requiredBeforeMerge,
      reviewerSeparation: review.reviewerSeparation,
      artifactTypes: review.artifactTypes,
    },
  };
  const canonicalJson = JSON.stringify(canonicalize(config));
  const digest = createHash("sha256").update(canonicalJson).digest("hex");
  return { ok: true, config, canonicalJson, digest };
}
