import {
  acquirePrivateGitHubCiEvidence,
  privateGitHubCheckRunsApiVersion,
} from "../../../src/adapters/github/private-github-check-runs-evidence.js";
import { compilePrivateExecutionManifest } from "../../../src/execution/private-execution-contract.js";
import {
  serializePrivateExecutionEvidenceEnvelope,
  serializePrivateExecutionPayloadPackage,
} from "../../../src/execution/private-execution-transport.js";
import {
  createPrivateIssueToReviewedPullRequestDefinition,
  privateIssueToPullRequestCapabilityObservations,
} from "../../../src/workflows/private-issue-to-reviewed-pull-request.js";

const compiled = compilePrivateExecutionManifest(
  createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  }),
  { capabilityObservations: privateIssueToPullRequestCapabilityObservations },
);
if (!compiled.ok) throw new Error("GitHub CI evidence fixture did not compile.");

const headSha = "0123456789abcdef0123456789abcdef01234567";
const result = acquirePrivateGitHubCiEvidence({
  manifestPackage: compiled.package,
  stepId: "04-ci-passed",
  repository: { id: 42, fullName: "example/agentdevflow" },
  headSha,
  requiredChecks: [
    { kind: "check-run", name: "build", appId: 15368 },
    { kind: "check-run", name: "test", appId: 15368 },
  ],
  observer: {
    binding: "steward",
    principal: "steward-fixture-principal",
    executionContext: "trusted-github-read-context",
  },
  snapshot: {
    revision: 1,
    apiVersion: privateGitHubCheckRunsApiVersion,
    repository: { id: 42, fullName: "example/agentdevflow" },
    requestedHeadSha: headSha,
    collection: {
      method: "complete-latest-check-runs",
      filter: "latest",
      paginationComplete: true,
      pageCount: 1,
      totalCheckRunCount: 2,
    },
    authorization: {
      kind: "github-checks-read",
      responseOriginVerified: true,
    },
    checkRuns: [
      {
        id: 101,
        name: "build",
        headSha,
        status: "completed",
        conclusion: "success",
        app: { id: 15368, slug: "github-actions" },
      },
      {
        id: 102,
        name: "test",
        headSha,
        status: "completed",
        conclusion: "neutral",
        app: { id: 15368, slug: "github-actions" },
      },
    ],
  },
});
if (!result.ok) throw new Error("GitHub CI evidence fixture was rejected.");

const payloadTransport = serializePrivateExecutionPayloadPackage(
  result.payloadPackage,
);
const envelopeTransport = serializePrivateExecutionEvidenceEnvelope(
  result.evidenceEnvelope,
);
if (!payloadTransport.ok || !envelopeTransport.ok) {
  throw new Error("GitHub CI evidence transport fixture was rejected.");
}

console.log(
  JSON.stringify(
    {
      subjectDigest: result.subjectDigest,
      requiredChecksDigest: result.receipt.requiredChecksDigest,
      observationDigest: result.receipt.observationDigest,
      payloadDigest: result.receipt.payloadDigest,
      envelopeDigest: result.receipt.envelopeDigest,
      acceptedCheckRunIds: result.receipt.acceptedCheckRunIds,
      payloadTransportDigest: payloadTransport.contentDigest,
      envelopeTransportDigest: envelopeTransport.contentDigest,
    },
    null,
    2,
  ),
);
