import assert from "node:assert/strict";
import test from "node:test";

import {
  executePrivateDoctorCommand,
  type PrivateDoctorObservationEnvelope,
} from "../../src/commands/private-doctor-command-service.js";
import { balancedWorkflowDefinition } from "../../src/compiler/built-in-definitions.js";
import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { PrivateCapabilityRequirement } from "../../src/compiler/private-model.js";
import { balancedCandidateConfig } from "../fixtures/config/specimens.js";

const providers = balancedCandidateConfig.providers;
const requirements = balancedWorkflowDefinition.capabilityRequirements;
const requiredEnvironment = [
  "filesystem-read",
  "filesystem-write",
  "process-execution",
] as const;

function observations(): PrivateDoctorObservationEnvelope {
  return {
    revision: 1,
    providerObservations: providers.map((provider) => ({
      providerId: provider.id,
      product: provider.product,
      surface: provider.surface,
      version: `${provider.product}-fixture-1`,
      executionContext: "local-project",
      principal: "fixture-user",
      capabilities: [
        {
          capability: "project-instructions",
          strength: "advisory",
          mechanism: "instruction-file",
        },
      ],
      evidence: {
        source: "probe",
        reference: `fixture:${provider.id}`,
        freshness: "current",
      },
    })),
    environmentObservations: requiredEnvironment.map((capability) => ({
      capability,
      availability: "available",
      evidence: {
        source: "probe",
        reference: `fixture:${capability}`,
        freshness: "current",
      },
    })),
  };
}

function execute(
  envelope: unknown,
  options: {
    readonly capabilityRequirements?: readonly PrivateCapabilityRequirement[];
    readonly environment?: typeof requiredEnvironment;
  } = {},
) {
  return executePrivateDoctorCommand({
    providers,
    capabilityRequirements: options.capabilityRequirements ?? requirements,
    requiredEnvironment: options.environment ?? requiredEnvironment,
    observations: envelope,
  });
}

test("produces healthy versioned capability evidence accepted by the compiler", () => {
  const envelope = observations();
  const before = structuredClone(envelope);
  const result = execute(envelope);

  assert.equal(result.outcome, "healthy");
  assert.equal(result.candidateExitCode, 0);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.capabilityAvailability.map((item) => item.providerId),
    ["claude-reviewer", "codex-developer", "cursor-steward"],
  );
  const compilation = compileCandidateProjectConfig(balancedCandidateConfig, {
    capabilityAvailability: result.capabilityAvailability,
  });
  assert.equal(compilation.ok, true);
  assert.deepEqual(envelope, before);
});

test("keeps reports and diagnostics deterministic for reordered observations", () => {
  const original = observations();
  const reordered = {
    ...structuredClone(original),
    providerObservations: [...original.providerObservations].reverse(),
    environmentObservations: [...original.environmentObservations].reverse(),
  };

  assert.deepEqual(execute(reordered), execute(original));
});

test("reports manual and incomplete provider identity evidence as degraded", () => {
  const original = observations();
  const first = original.providerObservations[0];
  assert.notEqual(first, undefined);
  const envelope = {
    ...original,
    providerObservations: original.providerObservations.map(
      (observation, index) =>
        index === 0
          ? {
              ...observation,
              version: null,
              principal: null,
              evidence: { ...observation.evidence, source: "manual" as const },
            }
          : observation,
    ),
  };
  const result = execute(envelope);

  assert.equal(result.outcome, "degraded");
  assert.equal(result.candidateExitCode, 1);
  assert.deepEqual(
    result.diagnostics.map((item) => item.code),
    [
      "DOCTOR_PROVIDER_OBSERVATION_MANUAL",
      "DOCTOR_PROVIDER_PRINCIPAL_UNKNOWN",
      "DOCTOR_PROVIDER_VERSION_UNKNOWN",
    ],
  );
  assert.equal(result.capabilityAvailability.length, providers.length);
});

test("blocks missing, stale, mismatched, or insufficient provider evidence", () => {
  const original = observations();
  const missing = {
    ...original,
    providerObservations: original.providerObservations.slice(1),
  };
  const missingResult = execute(missing);
  assert.equal(missingResult.outcome, "blocked");
  assert.equal(
    missingResult.diagnostics.some(
      (item) => item.code === "DOCTOR_PROVIDER_OBSERVATION_MISSING",
    ),
    true,
  );
  assert.deepEqual(missingResult.capabilityAvailability, []);

  const stale = {
    ...original,
    providerObservations: original.providerObservations.map(
      (observation, index) =>
        index === 0
          ? {
              ...observation,
              evidence: {
                ...observation.evidence,
                freshness: "stale" as const,
              },
            }
          : observation,
    ),
  };
  assert.equal(execute(stale).outcome, "blocked");

  const mismatched = {
    ...original,
    providerObservations: original.providerObservations.map(
      (observation, index) =>
        index === 0
          ? { ...observation, product: "codex" as const }
          : observation,
    ),
  };
  assert.equal(execute(mismatched).outcome, "blocked");

  const guardedRequirements = requirements.map((requirement) => ({
    ...requirement,
    requiredStrength: "guarded" as const,
  }));
  const insufficient = execute(observations(), {
    capabilityRequirements: guardedRequirements,
  });
  assert.equal(insufficient.outcome, "blocked");
  assert.equal(
    insufficient.diagnostics.every(
      (item) => item.code === "DOCTOR_CAPABILITY_STRENGTH_INSUFFICIENT",
    ),
    true,
  );
});

test("distinguishes required environment failure from optional degradation", () => {
  const original = observations();
  const requiredFailure = {
    ...original,
    environmentObservations: original.environmentObservations.map(
      (observation, index) =>
        index === 0
          ? { ...observation, availability: "unavailable" as const }
          : observation,
    ),
  };
  const blocked = execute(requiredFailure);
  assert.equal(blocked.outcome, "blocked");
  assert.equal(blocked.candidateExitCode, 2);
  assert.deepEqual(blocked.capabilityAvailability, []);

  const optional = {
    ...original,
    environmentObservations: [
      ...original.environmentObservations,
      {
        capability: "network-access" as const,
        availability: "unavailable" as const,
        evidence: {
          source: "probe" as const,
          reference: "fixture:network-access",
          freshness: "current" as const,
        },
      },
    ],
  };
  const degraded = execute(optional);
  assert.equal(degraded.outcome, "degraded");
  assert.equal(degraded.candidateExitCode, 1);
  assert.equal(degraded.capabilityAvailability.length, providers.length);
});

test("fails closed for duplicate and malformed observation envelopes", () => {
  const original = observations();
  const first = original.providerObservations[0];
  assert.notEqual(first, undefined);
  const duplicate = {
    ...original,
    providerObservations: [...original.providerObservations, first],
  };
  const duplicateResult = execute(duplicate);
  assert.equal(duplicateResult.outcome, "blocked");
  assert.equal(
    duplicateResult.diagnostics.some(
      (item) => item.code === "DOCTOR_PROVIDER_OBSERVATION_DUPLICATE",
    ),
    true,
  );
  assert.deepEqual(duplicateResult.capabilityAvailability, []);

  const malformed = { ...observations(), privateExtension: true };
  const malformedResult = execute(malformed);
  assert.equal(malformedResult.outcome, "blocked");
  assert.deepEqual(
    malformedResult.diagnostics.map((item) => item.code),
    ["DOCTOR_OBSERVATIONS_INVALID"],
  );
  assert.deepEqual(malformedResult.providerReports, []);
});
