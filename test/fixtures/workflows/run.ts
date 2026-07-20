import { compilePrivateDomainWorkflow } from "../../../src/compiler/private-domain-workflow.js";
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
  const result = compilePrivateDomainWorkflow(specimen.definition, {
    capabilityObservations: specimen.observations,
  });
  if (!result.ok) {
    throw new Error(`Domain workflow fixture ${specimen.name} failed.`);
  }
  return {
    name: specimen.name,
    definition: `${result.compilation.definition.id}@${result.compilation.definition.revision}`,
    compilationDigest: result.compilation.compilationDigest,
    budget: result.compilation.budget,
    exploredStates: result.compilation.policyValidation.exploredStates,
    capabilityCount: result.compilation.capabilityResolutions.length,
  };
});

console.log(JSON.stringify(output, null, 2));
