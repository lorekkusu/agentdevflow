import { convergePrivateLegacyCandidate } from "../../../src/project/private-legacy-candidate-convergence.js";
import { resolvePrivateDomainProject } from "../../../src/project/private-domain-project-resolution.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../../../src/workflows/private-local-reviewed-change.js";
import {
  balancedCandidateConfig,
  fastCandidateConfig,
} from "../config/specimens.js";

const capabilityBindings = [
  {
    binding: "developer",
    target: { kind: "responsibility", responsibility: "developer" },
  },
  {
    binding: "reviewer",
    target: { kind: "responsibility", responsibility: "reviewer" },
  },
] as const;

const specimens = [fastCandidateConfig, balancedCandidateConfig] as const;
const output = specimens.map((specimen) => {
  const convergence = convergePrivateLegacyCandidate(specimen, {
    workflow: { family: "local-reviewed-change" },
    capabilityBindings,
  });
  if (!convergence.ok) {
    throw new Error(`Legacy ${specimen.preset} convergence failed.`);
  }
  const project = resolvePrivateDomainProject(convergence.convergence.intent, {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
  });
  if (!project.ok) {
    throw new Error(`Expanded ${specimen.preset} project resolution failed.`);
  }
  return {
    preset: specimen.preset,
    sourceConfigurationDigest:
      convergence.convergence.sourceConfigurationDigest,
    convergenceDigest: convergence.convergence.convergenceDigest,
    expansionDigest: project.resolution.preset.expansionDigest,
    definitionId: project.resolution.workflow.definitionId,
    manifestDigest: project.manifestPackage.digest,
    resolutionDigest: project.resolutionDigest,
  };
});

const strictSource = convergePrivateLegacyCandidate(balancedCandidateConfig, {
  workflow: { family: "local-reviewed-change" },
  capabilityBindings,
});
if (!strictSource.ok) {
  throw new Error("Strict diagnostic fixture source convergence failed.");
}
const strict = resolvePrivateDomainProject(
  { ...strictSource.convergence.intent, preset: "strict" },
  { capabilityObservations: privateLocalReviewedChangeCapabilityObservations },
);
if (strict.ok || strict.diagnostics[0]?.code !== "PRESET_UNAVAILABLE") {
  throw new Error("Strict did not fail with PRESET_UNAVAILABLE.");
}

console.log(
  JSON.stringify(
    {
      expansions: output,
      strictDiagnostic: strict.diagnostics[0].code,
    },
    null,
    2,
  ),
);
