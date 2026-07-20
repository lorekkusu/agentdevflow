import {
  compilePrivateExecutionManifest,
  createPrivateExecutionEvidenceEnvelope,
  createPrivateExecutionPayloadDigest,
} from "../../../src/execution/private-execution-contract.js";
import { createPrivateExecutionPayloadPackage } from "../../../src/execution/private-typed-evidence.js";
import {
  createPrivateIssueToReviewedPullRequestDefinition,
  privateIssueToPullRequestCapabilityObservations,
} from "../../../src/workflows/private-issue-to-reviewed-pull-request.js";
import {
  privateLocalReviewedChangeCapabilityObservations,
  privateLocalReviewedChangeDefinition,
} from "../../../src/workflows/private-local-reviewed-change.js";

const specimens = [
  {
    name: "issue-to-pr-draft-with-auxiliary-review",
    definition: createPrivateIssueToReviewedPullRequestDefinition({
      initialState: "draft",
      auxiliaryReview: "enabled",
      mergeMethod: "squash",
    }),
    observations: privateIssueToPullRequestCapabilityObservations,
  },
  {
    name: "issue-to-pr-ready-without-auxiliary-review",
    definition: createPrivateIssueToReviewedPullRequestDefinition({
      initialState: "ready",
      auxiliaryReview: "disabled",
      mergeMethod: "squash",
    }),
    observations: privateIssueToPullRequestCapabilityObservations,
  },
  {
    name: "local-reviewed-change",
    definition: privateLocalReviewedChangeDefinition,
    observations: privateLocalReviewedChangeCapabilityObservations,
  },
] as const;

const output = specimens.map((specimen) => {
  const result = compilePrivateExecutionManifest(specimen.definition, {
    capabilityObservations: specimen.observations,
  });
  if (!result.ok) {
    throw new Error(`Execution manifest fixture ${specimen.name} failed.`);
  }
  const firstProducingStep = result.package.manifest.steps.find(
    (step) => step.produces.length > 0,
  );
  const firstArtifact = firstProducingStep?.produces[0];
  if (!firstProducingStep || !firstArtifact) {
    throw new Error(`Execution manifest fixture ${specimen.name} has no evidence step.`);
  }
  const subjectDigest = createPrivateExecutionPayloadDigest({
    specimen: specimen.name,
  });
  const evidence = createPrivateExecutionEvidenceEnvelope(result.package, {
    stepId: firstProducingStep.id,
    artifact: firstArtifact,
    subjectDigest,
    payloadDigest: createPrivateExecutionPayloadDigest({
      specimen: specimen.name,
      artifact: firstArtifact,
    }),
    producer: {
      responsibility: firstProducingStep.responsibility,
      binding: firstProducingStep.responsibility,
      principal: `${firstProducingStep.responsibility}-fixture-principal`,
      executionContext: `${firstProducingStep.id}-fixture-context`,
    },
    enforcement: {
      strength: "advisory",
      mechanism: "fixture-observation",
    },
  });
  const firstRequirement = result.package.manifest.evidenceRequirements[0];
  const typedStep = result.package.manifest.steps.find((step) =>
    step.produces.includes(firstRequirement?.artifact ?? ""),
  );
  if (firstRequirement === undefined || typedStep === undefined) {
    throw new Error(
      `Execution manifest fixture ${specimen.name} has no typed evidence step.`,
    );
  }
  let typedPayload: unknown;
  switch (firstRequirement.schema) {
    case "ci-result@2":
      typedPayload = {
        status: "passed",
        requiredChecksDigest: createPrivateExecutionPayloadDigest({
          requiredChecks: specimen.name,
        }),
        observationDigest: createPrivateExecutionPayloadDigest({
          observation: specimen.name,
        }),
      };
      break;
    case "merge-authorization@1":
      typedPayload = {
        evidenceDigest: createPrivateExecutionPayloadDigest({
          evidence: specimen.name,
        }),
        mergeMethod: "squash",
      };
      break;
    case "review-verdict@1":
      typedPayload = {
        verdict: "approved",
        reviewerPrincipal: "reviewer-fixture-principal",
        reviewerExecutionContext: `${typedStep.id}-fixture-context`,
      };
      break;
    case "reviewer-isolation@1":
      typedPayload = {
        developerPrincipal: "developer-fixture-principal",
        developerExecutionContext: "developer-fixture-context",
        reviewerPrincipal: "reviewer-fixture-principal",
        reviewerExecutionContext: `${typedStep.id}-fixture-context`,
        reviewerContextObservedFresh: true,
      };
      break;
  }
  const typedPackage = createPrivateExecutionPayloadPackage({
    schema: firstRequirement.schema,
    artifact: firstRequirement.artifact,
    subjectDigest,
    payload: typedPayload,
  });
  return {
    name: specimen.name,
    workflowCompilationDigest: result.workflow.compilationDigest,
    manifestDigest: result.package.digest,
    manifestByteLength: Buffer.byteLength(result.package.canonicalJson),
    stepCount: result.package.manifest.steps.length,
    artifactCount: result.package.manifest.artifacts.length,
    capabilityCount: result.package.manifest.capabilities.length,
    evidenceRequirementCount:
      result.package.manifest.evidenceRequirements.length,
    firstEvidenceDigest: evidence.digest,
    firstTypedPayloadDigest: typedPackage.digest,
  };
});

console.log(JSON.stringify(output, null, 2));
