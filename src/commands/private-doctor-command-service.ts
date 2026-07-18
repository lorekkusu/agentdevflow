import {
  candidateProviderProducts,
  candidateProviderSurfaces,
  type CandidateProviderInstance,
  type CandidateProviderProduct,
  type CandidateProviderSurface,
} from "../config/candidate.js";
import type {
  PrivateCapability,
  PrivateCapabilityAvailability,
  PrivateCapabilityRequirement,
  PrivateEnforcementStrength,
} from "../compiler/private-model.js";

export const privateDoctorObservationRevision = 1;

export type PrivateDoctorEvidenceSource = "manual" | "probe";
export type PrivateDoctorEvidenceFreshness = "current" | "stale" | "unknown";

export interface PrivateDoctorEvidence {
  readonly source: PrivateDoctorEvidenceSource;
  readonly reference: string;
  readonly freshness: PrivateDoctorEvidenceFreshness;
}

export interface PrivateDoctorCapabilityObservation {
  readonly capability: PrivateCapability;
  readonly strength: PrivateEnforcementStrength;
  readonly mechanism: string;
}

export interface PrivateDoctorProviderObservation {
  readonly providerId: string;
  readonly product: CandidateProviderProduct;
  readonly surface: CandidateProviderSurface;
  readonly version: string | null;
  readonly executionContext: string;
  readonly principal: string | null;
  readonly capabilities: readonly PrivateDoctorCapabilityObservation[];
  readonly evidence: PrivateDoctorEvidence;
}

export const privateDoctorEnvironmentCapabilities = [
  "filesystem-read",
  "filesystem-write",
  "network-access",
  "process-execution",
] as const;
export type PrivateDoctorEnvironmentCapability =
  (typeof privateDoctorEnvironmentCapabilities)[number];

export type PrivateDoctorEnvironmentAvailability =
  | "available"
  | "unavailable"
  | "unknown";

export interface PrivateDoctorEnvironmentObservation {
  readonly capability: PrivateDoctorEnvironmentCapability;
  readonly availability: PrivateDoctorEnvironmentAvailability;
  readonly evidence: PrivateDoctorEvidence;
}

export interface PrivateDoctorObservationEnvelope {
  readonly revision: number;
  readonly providerObservations: readonly PrivateDoctorProviderObservation[];
  readonly environmentObservations: readonly PrivateDoctorEnvironmentObservation[];
}

export type PrivateDoctorOutcome = "healthy" | "degraded" | "blocked";
export type PrivateDoctorDiagnosticLevel = "warning" | "error";

export interface PrivateDoctorDiagnostic {
  readonly code: string;
  readonly level: PrivateDoctorDiagnosticLevel;
  readonly message: string;
  readonly providerId?: string;
  readonly capability?: PrivateCapability | PrivateDoctorEnvironmentCapability;
}

export interface ExecutePrivateDoctorCommandOptions {
  readonly providers: readonly CandidateProviderInstance[];
  readonly capabilityRequirements: readonly PrivateCapabilityRequirement[];
  readonly requiredEnvironment: readonly PrivateDoctorEnvironmentCapability[];
  readonly observations: unknown;
}

export interface PrivateDoctorCommandResult {
  readonly outcome: PrivateDoctorOutcome;
  readonly candidateExitCode: 0 | 1 | 2;
  readonly diagnostics: readonly PrivateDoctorDiagnostic[];
  readonly providerReports: readonly PrivateDoctorProviderObservation[];
  readonly environmentReports: readonly PrivateDoctorEnvironmentObservation[];
  readonly capabilityAvailability: readonly PrivateCapabilityAvailability[];
}

const capabilities = new Set<PrivateCapability>(["project-instructions"]);
const strengths = new Set<PrivateEnforcementStrength>([
  "advisory",
  "guarded",
  "enforced",
]);
const evidenceSources = new Set<PrivateDoctorEvidenceSource>([
  "manual",
  "probe",
]);
const freshnessValues = new Set<PrivateDoctorEvidenceFreshness>([
  "current",
  "stale",
  "unknown",
]);
const environmentCapabilities = new Set<PrivateDoctorEnvironmentCapability>(
  privateDoctorEnvironmentCapabilities,
);
const environmentAvailability = new Set<PrivateDoctorEnvironmentAvailability>([
  "available",
  "unavailable",
  "unknown",
]);
const products = new Set<CandidateProviderProduct>(candidateProviderProducts);
const surfaces = new Set<CandidateProviderSurface>(candidateProviderSurfaces);
const strengthRank: Readonly<Record<PrivateEnforcementStrength, number>> = {
  advisory: 0,
  guarded: 1,
  enforced: 2,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  description: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${description} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  description: string,
): void {
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(`${description} has unexpected or missing fields.`);
  }
}

function requireNonEmptyString(value: unknown, description: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${description} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireNullableString(value: unknown, description: string): string | null {
  return value === null ? null : requireNonEmptyString(value, description);
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  description: string,
): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new Error(`${description} is unsupported: ${String(value)}.`);
  }
  return value as T;
}

function parseEvidence(value: unknown, description: string): PrivateDoctorEvidence {
  const evidence = requireRecord(value, description);
  requireExactKeys(evidence, ["source", "reference", "freshness"], description);
  return {
    source: requireEnum(
      evidence.source,
      evidenceSources,
      `${description} source`,
    ),
    reference: requireNonEmptyString(
      evidence.reference,
      `${description} reference`,
    ),
    freshness: requireEnum(
      evidence.freshness,
      freshnessValues,
      `${description} freshness`,
    ),
  };
}

function parseCapabilityObservation(
  value: unknown,
  index: number,
): PrivateDoctorCapabilityObservation {
  const description = `Private doctor capability observation ${index}`;
  const observation = requireRecord(value, description);
  requireExactKeys(
    observation,
    ["capability", "strength", "mechanism"],
    description,
  );
  return {
    capability: requireEnum(
      observation.capability,
      capabilities,
      `${description} capability`,
    ),
    strength: requireEnum(
      observation.strength,
      strengths,
      `${description} strength`,
    ),
    mechanism: requireNonEmptyString(
      observation.mechanism,
      `${description} mechanism`,
    ),
  };
}

function parseProviderObservation(
  value: unknown,
  index: number,
): PrivateDoctorProviderObservation {
  const description = `Private doctor provider observation ${index}`;
  const observation = requireRecord(value, description);
  requireExactKeys(
    observation,
    [
      "providerId",
      "product",
      "surface",
      "version",
      "executionContext",
      "principal",
      "capabilities",
      "evidence",
    ],
    description,
  );
  if (!Array.isArray(observation.capabilities)) {
    throw new Error(`${description} capabilities must be an array.`);
  }
  return {
    providerId: requireNonEmptyString(
      observation.providerId,
      `${description} provider id`,
    ),
    product: requireEnum(
      observation.product,
      products,
      `${description} product`,
    ),
    surface: requireEnum(
      observation.surface,
      surfaces,
      `${description} surface`,
    ),
    version: requireNullableString(
      observation.version,
      `${description} version`,
    ),
    executionContext: requireNonEmptyString(
      observation.executionContext,
      `${description} execution context`,
    ),
    principal: requireNullableString(
      observation.principal,
      `${description} principal`,
    ),
    capabilities: observation.capabilities.map(parseCapabilityObservation),
    evidence: parseEvidence(observation.evidence, `${description} evidence`),
  };
}

function parseEnvironmentObservation(
  value: unknown,
  index: number,
): PrivateDoctorEnvironmentObservation {
  const description = `Private doctor environment observation ${index}`;
  const observation = requireRecord(value, description);
  requireExactKeys(
    observation,
    ["capability", "availability", "evidence"],
    description,
  );
  return {
    capability: requireEnum(
      observation.capability,
      environmentCapabilities,
      `${description} capability`,
    ),
    availability: requireEnum(
      observation.availability,
      environmentAvailability,
      `${description} availability`,
    ),
    evidence: parseEvidence(observation.evidence, `${description} evidence`),
  };
}

export function parsePrivateDoctorObservationEnvelope(
  value: unknown,
): PrivateDoctorObservationEnvelope {
  const envelope = requireRecord(value, "Private doctor observation envelope");
  requireExactKeys(
    envelope,
    ["revision", "providerObservations", "environmentObservations"],
    "Private doctor observation envelope",
  );
  if (envelope.revision !== privateDoctorObservationRevision) {
    throw new Error(
      `Unsupported private doctor observation revision: ${String(envelope.revision)}.`,
    );
  }
  if (!Array.isArray(envelope.providerObservations)) {
    throw new Error("Private doctor provider observations must be an array.");
  }
  if (!Array.isArray(envelope.environmentObservations)) {
    throw new Error("Private doctor environment observations must be an array.");
  }
  return {
    revision: privateDoctorObservationRevision,
    providerObservations: envelope.providerObservations.map(
      parseProviderObservation,
    ),
    environmentObservations: envelope.environmentObservations.map(
      parseEnvironmentObservation,
    ),
  };
}

function diagnostic(
  code: string,
  level: PrivateDoctorDiagnosticLevel,
  message: string,
  context: {
    readonly providerId?: string;
    readonly capability?:
      | PrivateCapability
      | PrivateDoctorEnvironmentCapability;
  } = {},
): PrivateDoctorDiagnostic {
  return { code, level, message, ...context };
}

function compareDiagnostics(
  left: PrivateDoctorDiagnostic,
  right: PrivateDoctorDiagnostic,
): number {
  return (
    compareText(left.code, right.code) ||
    compareText(left.providerId ?? "", right.providerId ?? "") ||
    compareText(left.capability ?? "", right.capability ?? "") ||
    compareText(left.message, right.message)
  );
}

function validateStaticInputs(
  options: ExecutePrivateDoctorCommandOptions,
): string | null {
  const providerIds = new Set<string>();
  for (const provider of options.providers) {
    if (
      typeof provider.id !== "string" ||
      provider.id.length === 0 ||
      providerIds.has(provider.id) ||
      !products.has(provider.product) ||
      !surfaces.has(provider.surface)
    ) {
      return "Private doctor providers are malformed or duplicated.";
    }
    providerIds.add(provider.id);
  }
  const requirementIds = new Set<string>();
  for (const requirement of options.capabilityRequirements) {
    if (
      typeof requirement.id !== "string" ||
      requirement.id.length === 0 ||
      requirementIds.has(requirement.id) ||
      !capabilities.has(requirement.capability) ||
      requirement.providerScope !== "all-provider-instances" ||
      !strengths.has(requirement.requiredStrength)
    ) {
      return "Private doctor capability requirements are malformed or duplicated.";
    }
    requirementIds.add(requirement.id);
  }
  const requiredEnvironment = new Set<PrivateDoctorEnvironmentCapability>();
  for (const capability of options.requiredEnvironment) {
    if (
      !environmentCapabilities.has(capability) ||
      requiredEnvironment.has(capability)
    ) {
      return "Private doctor environment requirements are malformed or duplicated.";
    }
    requiredEnvironment.add(capability);
  }
  return null;
}

function finish(options: {
  readonly diagnostics: readonly PrivateDoctorDiagnostic[];
  readonly providerReports: readonly PrivateDoctorProviderObservation[];
  readonly environmentReports: readonly PrivateDoctorEnvironmentObservation[];
  readonly capabilityAvailability: readonly PrivateCapabilityAvailability[];
}): PrivateDoctorCommandResult {
  const diagnostics = [...options.diagnostics].sort(compareDiagnostics);
  const blocked = diagnostics.some((item) => item.level === "error");
  const degraded = diagnostics.some((item) => item.level === "warning");
  const outcome: PrivateDoctorOutcome = blocked
    ? "blocked"
    : degraded
      ? "degraded"
      : "healthy";
  return {
    outcome,
    candidateExitCode: outcome === "healthy" ? 0 : outcome === "degraded" ? 1 : 2,
    diagnostics,
    providerReports: [...options.providerReports].sort((left, right) =>
      compareText(left.providerId, right.providerId),
    ),
    environmentReports: [...options.environmentReports].sort((left, right) =>
      compareText(left.capability, right.capability),
    ),
    capabilityAvailability: blocked
      ? []
      : [...options.capabilityAvailability].sort(
          (left, right) =>
            compareText(left.providerId, right.providerId) ||
            compareText(left.capability, right.capability),
        ),
  };
}

export function executePrivateDoctorCommand(
  options: ExecutePrivateDoctorCommandOptions,
): PrivateDoctorCommandResult {
  const staticInputError = validateStaticInputs(options);
  if (staticInputError !== null) {
    return finish({
      diagnostics: [
        diagnostic("DOCTOR_INPUT_INVALID", "error", staticInputError),
      ],
      providerReports: [],
      environmentReports: [],
      capabilityAvailability: [],
    });
  }

  let observations: PrivateDoctorObservationEnvelope;
  try {
    observations = parsePrivateDoctorObservationEnvelope(options.observations);
  } catch (error) {
    return finish({
      diagnostics: [
        diagnostic(
          "DOCTOR_OBSERVATIONS_INVALID",
          "error",
          `Private doctor observations are invalid: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
      providerReports: [],
      environmentReports: [],
      capabilityAvailability: [],
    });
  }

  const diagnostics: PrivateDoctorDiagnostic[] = [];
  const providerById = new Map<string, PrivateDoctorProviderObservation>();
  const duplicateProviderIds = new Set<string>();
  for (const observation of observations.providerObservations) {
    if (providerById.has(observation.providerId)) {
      duplicateProviderIds.add(observation.providerId);
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_OBSERVATION_DUPLICATE",
          "error",
          `Provider observation is duplicated: ${observation.providerId}`,
          { providerId: observation.providerId },
        ),
      );
      continue;
    }
    providerById.set(observation.providerId, observation);
  }

  const availability: PrivateCapabilityAvailability[] = [];
  for (const provider of [...options.providers].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    const observation = providerById.get(provider.id);
    if (!observation) {
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_OBSERVATION_MISSING",
          "error",
          `Provider instance has no observation: ${provider.id}`,
          { providerId: provider.id },
        ),
      );
      continue;
    }
    if (
      observation.product !== provider.product ||
      observation.surface !== provider.surface
    ) {
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_IDENTITY_MISMATCH",
          "error",
          `Provider observation identity does not match configuration: ${provider.id}`,
          { providerId: provider.id },
        ),
      );
      continue;
    }
    if (observation.evidence.freshness === "stale") {
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_OBSERVATION_STALE",
          "error",
          `Provider observation is stale: ${provider.id}`,
          { providerId: provider.id },
        ),
      );
      continue;
    }
    if (observation.evidence.freshness === "unknown") {
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_FRESHNESS_UNKNOWN",
          "error",
          `Provider observation freshness is unknown: ${provider.id}`,
          { providerId: provider.id },
        ),
      );
      continue;
    }
    if (observation.evidence.source === "manual") {
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_OBSERVATION_MANUAL",
          "warning",
          `Provider observation is asserted manually: ${provider.id}`,
          { providerId: provider.id },
        ),
      );
    }
    if (observation.version === null) {
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_VERSION_UNKNOWN",
          "warning",
          `Provider version is unknown: ${provider.id}`,
          { providerId: provider.id },
        ),
      );
    }
    if (observation.principal === null) {
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_PRINCIPAL_UNKNOWN",
          "warning",
          `Provider principal is unknown: ${provider.id}`,
          { providerId: provider.id },
        ),
      );
    }

    const capabilityByName = new Map<
      PrivateCapability,
      PrivateDoctorCapabilityObservation
    >();
    for (const capability of observation.capabilities) {
      if (capabilityByName.has(capability.capability)) {
        diagnostics.push(
          diagnostic(
            "DOCTOR_CAPABILITY_OBSERVATION_DUPLICATE",
            "error",
            `Capability observation is duplicated for provider ${provider.id}: ${capability.capability}`,
            { providerId: provider.id, capability: capability.capability },
          ),
        );
        continue;
      }
      capabilityByName.set(capability.capability, capability);
    }
    for (const requirement of options.capabilityRequirements) {
      const observed = capabilityByName.get(requirement.capability);
      if (!observed) {
        diagnostics.push(
          diagnostic(
            "DOCTOR_CAPABILITY_UNAVAILABLE",
            "error",
            `Provider ${provider.id} has no observed ${requirement.capability} capability for requirement ${requirement.id}.`,
            { providerId: provider.id, capability: requirement.capability },
          ),
        );
        continue;
      }
      if (
        strengthRank[observed.strength] <
        strengthRank[requirement.requiredStrength]
      ) {
        diagnostics.push(
          diagnostic(
            "DOCTOR_CAPABILITY_STRENGTH_INSUFFICIENT",
            "error",
            `Provider ${provider.id} offers ${requirement.capability} at ${observed.strength} strength through ${observed.mechanism}, below required ${requirement.requiredStrength} strength.`,
            { providerId: provider.id, capability: requirement.capability },
          ),
        );
        continue;
      }
      if (
        !availability.some(
          (item) =>
            item.providerId === provider.id &&
            item.capability === requirement.capability,
        )
      ) {
        availability.push({
          providerId: provider.id,
          capability: requirement.capability,
          strength: observed.strength,
          mechanism: observed.mechanism,
        });
      }
    }
  }

  for (const observation of observations.providerObservations) {
    if (
      !duplicateProviderIds.has(observation.providerId) &&
      !options.providers.some((provider) => provider.id === observation.providerId)
    ) {
      diagnostics.push(
        diagnostic(
          "DOCTOR_PROVIDER_OBSERVATION_UNEXPECTED",
          "warning",
          `Provider observation is not referenced by configuration: ${observation.providerId}`,
          { providerId: observation.providerId },
        ),
      );
    }
  }

  const environmentByCapability = new Map<
    PrivateDoctorEnvironmentCapability,
    PrivateDoctorEnvironmentObservation
  >();
  for (const observation of observations.environmentObservations) {
    if (environmentByCapability.has(observation.capability)) {
      diagnostics.push(
        diagnostic(
          "DOCTOR_ENVIRONMENT_OBSERVATION_DUPLICATE",
          "error",
          `Environment observation is duplicated: ${observation.capability}`,
          { capability: observation.capability },
        ),
      );
      continue;
    }
    environmentByCapability.set(observation.capability, observation);
  }
  const requiredEnvironment = new Set(options.requiredEnvironment);
  for (const capability of privateDoctorEnvironmentCapabilities) {
    const observation = environmentByCapability.get(capability);
    const required = requiredEnvironment.has(capability);
    if (!observation) {
      if (required) {
        diagnostics.push(
          diagnostic(
            "DOCTOR_ENVIRONMENT_OBSERVATION_MISSING",
            "error",
            `Required environment capability has no observation: ${capability}`,
            { capability },
          ),
        );
      }
      continue;
    }
    const level: PrivateDoctorDiagnosticLevel = required ? "error" : "warning";
    if (observation.evidence.freshness !== "current") {
      diagnostics.push(
        diagnostic(
          observation.evidence.freshness === "stale"
            ? "DOCTOR_ENVIRONMENT_OBSERVATION_STALE"
            : "DOCTOR_ENVIRONMENT_FRESHNESS_UNKNOWN",
          level,
          `Environment observation is ${observation.evidence.freshness}: ${capability}`,
          { capability },
        ),
      );
    }
    if (observation.evidence.source === "manual") {
      diagnostics.push(
        diagnostic(
          "DOCTOR_ENVIRONMENT_OBSERVATION_MANUAL",
          "warning",
          `Environment observation is asserted manually: ${capability}`,
          { capability },
        ),
      );
    }
    if (observation.availability !== "available") {
      diagnostics.push(
        diagnostic(
          observation.availability === "unavailable"
            ? "DOCTOR_ENVIRONMENT_UNAVAILABLE"
            : "DOCTOR_ENVIRONMENT_AVAILABILITY_UNKNOWN",
          level,
          `Environment capability is ${observation.availability}: ${capability}`,
          { capability },
        ),
      );
    }
  }

  return finish({
    diagnostics,
    providerReports: observations.providerObservations,
    environmentReports: observations.environmentObservations,
    capabilityAvailability: availability,
  });
}
