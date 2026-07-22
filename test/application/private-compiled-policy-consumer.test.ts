import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePrivateCompiledPolicy } from "../../src/application/private-compiled-policy-consumer.js";
import type { CandidateRole } from "../../src/config/candidate.js";
import type { PrivateDomainCapabilityObservation } from "../../src/compiler/private-domain-workflow.js";
import {
  createPrivateExecutionEvidenceEnvelope,
  createPrivateExecutionManifestPackage,
  createPrivateExecutionPayloadDigest,
  type PrivateExecutionManifestPackage,
  type PrivateExecutionTrace,
  type PrivateExecutionTraceEvent,
} from "../../src/execution/private-execution-contract.js";
import { createPrivateExecutionPayloadPackage } from "../../src/execution/private-typed-evidence.js";
import { serializePrivateExecutionTrace } from "../../src/execution/private-execution-transport.js";
import { compilePrivateDomainProjectDocument } from "../../src/interface/private-domain-project-document.js";
import type { PrivateDomainProjectIntent } from "../../src/project/private-domain-project-resolution.js";
import { privateIssueToPullRequestCapabilityObservations } from "../../src/workflows/private-issue-to-reviewed-pull-request.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../../src/workflows/private-local-reviewed-change.js";

const defaultBindings: Readonly<Record<CandidateRole, string>> = {
  developer: "developer",
  reviewer: "reviewer",
  steward: "steward",
};

function localIntent(): PrivateDomainProjectIntent {
  return {
    revision: 1,
    preset: "balanced",
    providers: [
      { id: "codex-steward", product: "codex", surface: "cli" },
      { id: "cursor-developer", product: "cursor", surface: "ide" },
      { id: "claude-reviewer", product: "claude-code", surface: "cli" },
    ],
    roles: {
      steward: "codex-steward",
      developer: "cursor-developer",
      reviewer: "claude-reviewer",
    },
    tracker: { mode: "none" },
    workflow: { family: "local-reviewed-change" },
    capabilityBindings: [
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
    ],
  };
}

function issueIntent(): PrivateDomainProjectIntent {
  return {
    ...localIntent(),
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
}

function document(intent: PrivateDomainProjectIntent): string {
  return `${JSON.stringify(intent, null, 2)}\n`;
}

function subject(label: string): string {
  return createPrivateExecutionPayloadDigest({ subject: label });
}

function manifestFor(
  content: string,
  observations: readonly PrivateDomainCapabilityObservation[],
): PrivateExecutionManifestPackage {
  const compiled = compilePrivateDomainProjectDocument(content, {
    capabilityObservations: observations,
  });
  assert.equal(compiled.ok, true);
  if (!compiled.ok) {
    assert.fail("Expected fixture project compilation to succeed.");
  }
  return createPrivateExecutionManifestPackage(
    compiled.project.workflowCompilation,
  );
}

function eventFor(
  packageValue: PrivateExecutionManifestPackage,
  stepId: string,
  subjectDigest: string,
  binding?: string,
): PrivateExecutionTraceEvent {
  const step = packageValue.manifest.steps.find((item) => item.id === stepId);
  if (step === undefined) {
    throw new Error(`Unknown fixture step: ${stepId}.`);
  }
  const producer = {
    responsibility: step.responsibility,
    binding: binding ?? defaultBindings[step.responsibility],
    principal: `${step.responsibility}-principal`,
    executionContext: `${step.id}-context`,
  } as const;
  const payloads = step.produces.flatMap((artifact) => {
    const requirement = packageValue.manifest.evidenceRequirements.find(
      (candidate) => candidate.artifact === artifact,
    );
    if (requirement === undefined) return [];
    let payload: unknown;
    switch (requirement.schema) {
      case "ci-result@2":
        payload = {
          status: "passed",
          requiredChecksDigest: createPrivateExecutionPayloadDigest({
            requiredChecks: "fixture",
          }),
          observationDigest: createPrivateExecutionPayloadDigest({
            observation: "fixture",
          }),
        };
        break;
      case "merge-authorization@1":
        payload = {
          evidenceDigest: createPrivateExecutionPayloadDigest({
            authorizationEvidence: subjectDigest,
          }),
          mergeMethod: "squash",
        };
        break;
      case "review-verdict@1":
        payload = {
          verdict: "approved",
          reviewerPrincipal: producer.principal,
          reviewerExecutionContext: producer.executionContext,
        };
        break;
      case "reviewer-isolation@1": {
        const referenceStep = packageValue.manifest.steps.find((candidate) =>
          candidate.produces.includes(requirement.referenceArtifact ?? ""),
        );
        if (referenceStep === undefined) {
          throw new Error("Reviewer-isolation fixture has no reference step.");
        }
        payload = {
          developerPrincipal: `${referenceStep.responsibility}-principal`,
          developerExecutionContext: `${referenceStep.id}-context`,
          reviewerPrincipal: producer.principal,
          reviewerExecutionContext: producer.executionContext,
          reviewerContextObservedFresh: true,
        };
        break;
      }
    }
    return [
      createPrivateExecutionPayloadPackage({
        schema: requirement.schema,
        artifact,
        subjectDigest,
        payload,
      }),
    ];
  });
  return {
    stepId,
    subjectDigest,
    evidence: step.produces.map((artifact) => {
      const payloadPackage = payloads.find(
        (candidate) => candidate.artifact === artifact,
      );
      return createPrivateExecutionEvidenceEnvelope(packageValue, {
        stepId,
        artifact,
        subjectDigest,
        payloadDigest:
          payloadPackage?.digest ??
          createPrivateExecutionPayloadDigest({
            stepId,
            artifact,
            subjectDigest,
          }),
        producer,
        enforcement: {
          strength: "advisory",
          mechanism: "fixture-observation",
        },
      });
    }),
    payloads,
  };
}

function traceBytes(
  packageValue: PrivateExecutionManifestPackage,
  events: readonly PrivateExecutionTraceEvent[],
): Uint8Array {
  const trace: PrivateExecutionTrace = {
    revision: 2,
    manifestDigest: packageValue.digest,
    events,
  };
  const serialized = serializePrivateExecutionTrace(trace);
  assert.equal(serialized.ok, true);
  if (!serialized.ok) {
    assert.fail("Expected fixture trace serialization to succeed.");
  }
  return serialized.bytes;
}

test("validates a deterministic local review and rework trace", () => {
  const content = document(localIntent());
  const manifest = manifestFor(
    content,
    privateLocalReviewedChangeCapabilityObservations,
  );
  const firstRevision = subject("local-a");
  const secondRevision = subject("local-b");
  const bytes = traceBytes(manifest, [
    eventFor(manifest, "01-plan-implement", firstRevision),
    eventFor(manifest, "02-implement-review", firstRevision),
    eventFor(manifest, "03-review-rework", secondRevision),
    eventFor(manifest, "02-implement-review", secondRevision),
    eventFor(manifest, "04-review-accept", secondRevision),
  ]);

  const first = evaluatePrivateCompiledPolicy(content, {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
    traceBytes: bytes,
  });
  const second = evaluatePrivateCompiledPolicy(content, {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
    traceBytes: bytes,
  });

  assert.deepEqual(second, first);
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.outcome, "trace-valid");
    assert.equal(first.project.workflowFamily, "local-reviewed-change");
    assert.equal(first.trace.finalNode, "accepted");
    assert.deepEqual(first.trace.appliedSteps, [
      "01-plan-implement",
      "02-implement-review",
      "03-review-rework",
      "02-implement-review",
      "04-review-accept",
    ]);
  }
});

test("validates an issue-to-ready-pull-request trace through merge", () => {
  const content = document(issueIntent());
  const manifest = manifestFor(
    content,
    privateIssueToPullRequestCapabilityObservations,
  );
  const revision = subject("issue-ready");
  const result = evaluatePrivateCompiledPolicy(content, {
    capabilityObservations: privateIssueToPullRequestCapabilityObservations,
    traceBytes: traceBytes(manifest, [
      eventFor(manifest, "01-plan-work-item", revision),
      eventFor(manifest, "02-work-item-delegated", revision),
      eventFor(manifest, "03-create-ready-pull-request", revision),
      eventFor(manifest, "04-ci-passed", revision),
      eventFor(manifest, "07-ci-independent-review", revision),
      eventFor(manifest, "11-independent-approved", revision),
      eventFor(manifest, "12-reviewed-authorize", revision),
      eventFor(manifest, "13-external-merge", revision),
    ]),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(
      result.project.workflowFamily,
      "issue-to-reviewed-pull-request",
    );
    assert.equal(result.trace.finalNode, "merged");
  }
});

test("blocks non-canonical trace bytes before policy replay", () => {
  const content = document(localIntent());
  const manifest = manifestFor(
    content,
    privateLocalReviewedChangeCapabilityObservations,
  );
  const canonical = traceBytes(manifest, []);
  const bytes = new Uint8Array(canonical.length + 1);
  bytes.set(canonical);
  bytes[canonical.length] = 10;

  const result = evaluatePrivateCompiledPolicy(content, {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
    traceBytes: bytes,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostics[0]?.stage, "trace-transport");
    assert.equal(
      result.diagnostics[0]?.diagnostic.code,
      "TRANSPORT_NON_CANONICAL",
    );
  }
});

test("blocks a trace compiled for a contradictory project", () => {
  const localContent = document(localIntent());
  const issueContent = document(issueIntent());
  const issueManifest = manifestFor(
    issueContent,
    privateIssueToPullRequestCapabilityObservations,
  );
  const result = evaluatePrivateCompiledPolicy(localContent, {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
    traceBytes: traceBytes(issueManifest, []),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostics[0]?.stage, "policy");
    assert.equal(
      result.diagnostics[0]?.diagnostic.code,
      "TRACE_MANIFEST_MISMATCH",
    );
  }
});

test("blocks missing evidence with the existing replay diagnostic", () => {
  const content = document(localIntent());
  const manifest = manifestFor(
    content,
    privateLocalReviewedChangeCapabilityObservations,
  );
  const revision = subject("missing-plan");
  const event = eventFor(manifest, "01-plan-implement", revision);
  const result = evaluatePrivateCompiledPolicy(content, {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
    traceBytes: traceBytes(manifest, [{ ...event, evidence: [] }]),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostics[0]?.stage, "policy");
    assert.equal(result.diagnostics[0]?.diagnostic.code, "EVIDENCE_MISSING");
  }
});

test("blocks stale review evidence after returning to implementation", () => {
  const content = document(localIntent());
  const manifest = manifestFor(
    content,
    privateLocalReviewedChangeCapabilityObservations,
  );
  const firstRevision = subject("stale-a");
  const secondRevision = subject("stale-b");
  const staleAcceptance = eventFor(
    manifest,
    "04-review-accept",
    firstRevision,
  );
  const result = evaluatePrivateCompiledPolicy(content, {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
    traceBytes: traceBytes(manifest, [
      eventFor(manifest, "01-plan-implement", firstRevision),
      eventFor(manifest, "02-implement-review", firstRevision),
      eventFor(manifest, "03-review-rework", secondRevision),
      eventFor(manifest, "02-implement-review", secondRevision),
      { ...staleAcceptance, subjectDigest: secondRevision },
    ]),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostics[0]?.stage, "policy");
    assert.ok(
      result.diagnostics.some(
        (item) => item.diagnostic.code === "EVIDENCE_SUBJECT_MISMATCH",
      ),
    );
  }
});

test("blocks invalid project bytes before trace decoding", () => {
  const result = evaluatePrivateCompiledPolicy("{\"revision\":2}", {
    capabilityObservations: privateLocalReviewedChangeCapabilityObservations,
    traceBytes: new Uint8Array(),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostics[0]?.stage, "project");
    assert.equal(result.diagnostics[0]?.diagnostic.code, "SCHEMA_INVALID");
  }
});

test("blocks malformed caller-supplied capability observations", () => {
  const observations = [
    {
      binding: "developer",
      capability: "project-instructions",
      strength: "bogus",
      mechanism: "",
    },
    {
      binding: "reviewer",
      capability: "project-instructions",
      strength: "bogus",
      mechanism: "",
    },
  ] as unknown as readonly PrivateDomainCapabilityObservation[];
  const result = evaluatePrivateCompiledPolicy(document(localIntent()), {
    capabilityObservations: observations,
    traceBytes: new Uint8Array(),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostics[0]?.stage, "project");
    const diagnostic = result.diagnostics[0]?.diagnostic;
    assert.equal(diagnostic?.code, "WORKFLOW_RESOLUTION_FAILED");
    const cause = diagnostic?.cause;
    assert.equal(cause?.code, "WORKFLOW_COMPILATION_FAILED");
    if (cause?.code === "WORKFLOW_COMPILATION_FAILED") {
      assert.equal(
        cause.causes.some(
          (item) => item.code === "CAPABILITY_OBSERVATION_INVALID",
        ),
        true,
      );
    }
  }
});
