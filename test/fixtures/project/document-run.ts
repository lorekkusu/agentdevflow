import {
  compilePrivateDomainProjectDocument,
  privateDomainProjectIntentJsonSchemaDigest,
} from "../../../src/interface/private-domain-project-document.js";
import type { PrivateDomainProjectIntent } from "../../../src/project/private-domain-project-resolution.js";
import { privateIssueToPullRequestCapabilityObservations } from "../../../src/workflows/private-issue-to-reviewed-pull-request.js";

const intent: PrivateDomainProjectIntent = {
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

const content = JSON.stringify(intent, null, 2)
  .replace("{\n", "{\n  // Private fixture.\n")
  .replace(/\n\}$/u, ",\n}\n");
const result = compilePrivateDomainProjectDocument(content, {
  capabilityObservations: privateIssueToPullRequestCapabilityObservations,
});
if (!result.ok) {
  throw new Error("Private project document fixture failed.");
}

console.log(
  JSON.stringify(
    {
      syntax: result.document.syntax,
      contentDigest: result.document.contentDigest,
      schemaDigest: privateDomainProjectIntentJsonSchemaDigest,
      intentDigest: result.project.resolution.intentDigest,
      workflowCompilationDigest:
        result.project.workflowCompilation.compilationDigest,
      resolutionDigest: result.project.resolutionDigest,
    },
    null,
    2,
  ),
);
