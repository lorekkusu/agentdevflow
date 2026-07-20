import {
  compilePrivateExecutionManifest,
  createPrivateExecutionEvidenceEnvelope,
  createPrivateExecutionPayloadDigest,
  replayPrivateExecutionTrace,
  type PrivateExecutionTrace,
} from "../../../src/execution/private-execution-contract.js";
import {
  parsePrivateExecutionManifestPackage,
  parsePrivateExecutionTrace,
  serializePrivateExecutionEvidenceEnvelope,
  serializePrivateExecutionManifestPackage,
  serializePrivateExecutionPayloadPackage,
  serializePrivateExecutionTrace,
} from "../../../src/execution/private-execution-transport.js";
import { createPrivateExecutionPayloadPackage } from "../../../src/execution/private-typed-evidence.js";
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
if (!compiled.ok) throw new Error("Transport fixture manifest did not compile.");

const subjectDigest = createPrivateExecutionPayloadDigest({
  revision: "transport-fixture",
});
const payloadPackage = createPrivateExecutionPayloadPackage({
  schema: "ci-result@2",
  artifact: "CiResult",
  subjectDigest,
  payload: {
    status: "passed",
    requiredChecksDigest: createPrivateExecutionPayloadDigest({
      checks: "required",
    }),
    observationDigest: createPrivateExecutionPayloadDigest({
      observation: "transport-fixture",
    }),
  },
});
const planStep = compiled.package.manifest.steps.find(
  (step) => step.id === "01-plan-work-item",
);
if (planStep === undefined) throw new Error("Transport fixture plan step is absent.");
const planEnvelope = createPrivateExecutionEvidenceEnvelope(compiled.package, {
  stepId: planStep.id,
  artifact: "Plan",
  subjectDigest,
  payloadDigest: createPrivateExecutionPayloadDigest({ plan: "fixture" }),
  producer: {
    responsibility: planStep.responsibility,
    binding: "steward",
    principal: "steward-fixture-principal",
    executionContext: "plan-fixture-context",
  },
  enforcement: {
    strength: "advisory",
    mechanism: "fixture-observation",
  },
});
const trace: PrivateExecutionTrace = {
  revision: 2,
  manifestDigest: compiled.package.digest,
  events: [
    {
      stepId: planStep.id,
      subjectDigest,
      evidence: [planEnvelope],
      payloads: [],
    },
  ],
};

const manifestTransport = serializePrivateExecutionManifestPackage(
  compiled.package,
);
const payloadTransport = serializePrivateExecutionPayloadPackage(payloadPackage);
const envelopeTransport = serializePrivateExecutionEvidenceEnvelope(planEnvelope);
const traceTransport = serializePrivateExecutionTrace(trace);
if (
  !manifestTransport.ok ||
  !payloadTransport.ok ||
  !envelopeTransport.ok ||
  !traceTransport.ok
) {
  throw new Error("Transport fixture serialization failed.");
}
const parsedManifest = parsePrivateExecutionManifestPackage(
  manifestTransport.bytes,
);
const parsedTrace = parsePrivateExecutionTrace(traceTransport.bytes);
if (!parsedManifest.ok || !parsedTrace.ok) {
  throw new Error("Transport fixture parsing failed.");
}
const replay = replayPrivateExecutionTrace(
  parsedManifest.value,
  parsedTrace.value,
);
if (!replay.ok) throw new Error("Transport fixture replay failed.");

console.log(
  JSON.stringify(
    {
      manifest: {
        byteLength: manifestTransport.byteLength,
        contentDigest: manifestTransport.contentDigest,
      },
      payloadPackage: {
        byteLength: payloadTransport.byteLength,
        contentDigest: payloadTransport.contentDigest,
      },
      evidenceEnvelope: {
        byteLength: envelopeTransport.byteLength,
        contentDigest: envelopeTransport.contentDigest,
      },
      trace: {
        byteLength: traceTransport.byteLength,
        contentDigest: traceTransport.contentDigest,
      },
      replayFinalNode: replay.finalNode,
    },
    null,
    2,
  ),
);
