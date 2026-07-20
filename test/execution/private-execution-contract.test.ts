import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateRole } from "../../src/config/candidate.js";
import type { PrivateDomainWorkflowDefinition } from "../../src/compiler/private-domain-workflow.js";
import {
  compilePrivateExecutionManifest,
  createPrivateExecutionEvidenceEnvelope,
  createPrivateExecutionPayloadDigest,
  replayPrivateExecutionTrace,
  type PrivateExecutionManifestCompilationResult,
  type PrivateExecutionManifestPackage,
  type PrivateExecutionTrace,
  type PrivateExecutionTraceEvent,
} from "../../src/execution/private-execution-contract.js";
import {
  createPrivateExecutionPayloadPackage,
  validatePrivateExecutionPayloadPackage,
} from "../../src/execution/private-typed-evidence.js";
import {
  createPrivateIssueToReviewedPullRequestDefinition,
  privateIssueToPullRequestCapabilityObservations,
} from "../../src/workflows/private-issue-to-reviewed-pull-request.js";
import {
  privateLocalReviewedChangeCapabilityObservations,
  privateLocalReviewedChangeDefinition,
} from "../../src/workflows/private-local-reviewed-change.js";

function expectManifestSuccess(
  result: PrivateExecutionManifestCompilationResult,
): asserts result is Extract<
  PrivateExecutionManifestCompilationResult,
  { ok: true }
> {
  assert.equal(result.ok, true);
}

function compileIssueManifest(options: {
  readonly initialState: "draft" | "ready";
  readonly auxiliaryReview: "disabled" | "enabled";
}) {
  return compilePrivateExecutionManifest(
    createPrivateIssueToReviewedPullRequestDefinition({
      ...options,
      mergeMethod: "squash",
    }),
    {
      capabilityObservations:
        privateIssueToPullRequestCapabilityObservations,
    },
  );
}

function subject(label: string): string {
  return createPrivateExecutionPayloadDigest({ subject: label });
}

const defaultBindings: Readonly<Record<CandidateRole, string>> = {
  developer: "developer",
  reviewer: "reviewer",
  steward: "steward",
};

function eventFor(
  packageValue: PrivateExecutionManifestPackage,
  stepId: string,
  subjectDigest: string,
  binding?: string,
): PrivateExecutionTraceEvent {
  const step = packageValue.manifest.steps.find((item) => item.id === stepId);
  if (!step) {
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

function traceFor(
  packageValue: PrivateExecutionManifestPackage,
  events: readonly PrivateExecutionTraceEvent[],
): PrivateExecutionTrace {
  return {
    revision: 2,
    manifestDigest: packageValue.digest,
    events,
  };
}

test("produces a deterministic issue-to-pull-request execution manifest", () => {
  const definition = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "draft",
    auxiliaryReview: "enabled",
    mergeMethod: "squash",
  });
  const reordered: PrivateDomainWorkflowDefinition = {
    ...definition,
    nodes: [...definition.nodes].reverse(),
    artifactTypes: [...definition.artifactTypes].reverse(),
    transitions: [...definition.transitions].reverse(),
    policies: [...definition.policies].reverse(),
    capabilityRequirements: [...definition.capabilityRequirements].reverse(),
    evidenceRequirements: [...(definition.evidenceRequirements ?? [])].reverse(),
  };
  const first = compilePrivateExecutionManifest(definition, {
    capabilityObservations: privateIssueToPullRequestCapabilityObservations,
  });
  const second = compilePrivateExecutionManifest(reordered, {
    capabilityObservations: [
      ...privateIssueToPullRequestCapabilityObservations,
    ].reverse(),
  });

  expectManifestSuccess(first);
  expectManifestSuccess(second);
  assert.deepEqual(second.package, first.package);
  assert.equal(first.package.manifest.revision, 2);
  assert.equal(first.package.manifest.steps.length, 14);
  assert.equal(first.package.manifest.capabilities.length, 7);
  assert.deepEqual(
    first.package.manifest.steps.find(
      (step) => step.id === "02-work-item-delegated",
    )?.capabilityRequirements,
    ["create-work-item", "delegate-implementation"],
  );
  assert.equal(JSON.parse(first.package.canonicalJson).revision, 2);
});

test("replays a complete draft pull-request trace with auxiliary review", () => {
  const compiled = compileIssueManifest({
    initialState: "draft",
    auxiliaryReview: "enabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("revision-a");
  const trace = traceFor(compiled.package, [
    eventFor(compiled.package, "01-plan-work-item", revision),
    eventFor(compiled.package, "02-work-item-delegated", revision),
    eventFor(compiled.package, "03-create-draft-pull-request", revision),
    eventFor(compiled.package, "04-ci-passed", revision, "ci"),
    eventFor(compiled.package, "07-ci-auxiliary-review", revision),
    eventFor(compiled.package, "08-auxiliary-clear", revision, "auxiliary-reviewer"),
    eventFor(compiled.package, "11-independent-approved", revision),
    eventFor(compiled.package, "12-reviewed-authorize", revision),
    eventFor(compiled.package, "13-external-merge", revision),
  ]);
  const result = replayPrivateExecutionTrace(compiled.package, trace);

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected a valid execution trace.");
  }
  assert.equal(result.finalNode, "merged");
  assert.deepEqual(
    result.activeEvidence.map((envelope) => envelope.artifact),
    [
      "AuxiliaryReviewResult",
      "CiResult",
      "DelegationReceipt",
      "MergeAuthorization",
      "MergeReceipt",
      "Plan",
      "PullRequestSnapshot",
      "ReviewVerdict",
      "ReviewerIsolationEvidence",
      "WorkItemRef",
    ],
  );
});

test("replays a ready pull request without auxiliary review", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("revision-ready");
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      eventFor(compiled.package, "01-plan-work-item", revision),
      eventFor(compiled.package, "02-work-item-delegated", revision),
      eventFor(compiled.package, "03-create-ready-pull-request", revision),
      eventFor(compiled.package, "04-ci-passed", revision),
      eventFor(compiled.package, "07-ci-independent-review", revision),
      eventFor(compiled.package, "11-independent-approved", revision),
      eventFor(compiled.package, "12-reviewed-authorize", revision),
      eventFor(compiled.package, "13-external-merge", revision),
    ]),
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.finalNode, "merged");
    assert.equal(
      result.activeEvidence.some(
        (envelope) => envelope.artifact === "AuxiliaryReviewResult",
      ),
      false,
    );
  }
});

test("replays a local no-pull-request rework cycle through the same contract", () => {
  const compiled = compilePrivateExecutionManifest(
    privateLocalReviewedChangeDefinition,
    {
      capabilityObservations:
        privateLocalReviewedChangeCapabilityObservations,
    },
  );
  expectManifestSuccess(compiled);
  const firstRevision = subject("local-a");
  const secondRevision = subject("local-b");
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      eventFor(compiled.package, "01-plan-implement", firstRevision),
      eventFor(compiled.package, "02-implement-review", firstRevision),
      eventFor(compiled.package, "03-review-rework", secondRevision),
      eventFor(compiled.package, "02-implement-review", secondRevision),
      eventFor(compiled.package, "04-review-accept", secondRevision),
    ]),
  );

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected a valid local execution trace.");
  }
  assert.equal(result.finalNode, "accepted");
  const serialized = compiled.package.canonicalJson;
  assert.equal(serialized.includes("PullRequest"), false);
  assert.equal(serialized.includes("WorkItem"), false);
  assert.equal(serialized.includes("CiResult"), false);
  assert.equal(serialized.includes("Merge"), false);
});

test("rejects out-of-order execution before applying partial evidence", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("revision-a");
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      eventFor(compiled.package, "02-work-item-delegated", revision),
    ]),
  );

  assert.deepEqual(result, {
    ok: false,
    diagnostics: [
      {
        code: "STEP_OUT_OF_ORDER",
        message:
          "Execution step 02-work-item-delegated starts at work-item, but the trace is at plan.",
        eventIndex: 0,
        stepId: "02-work-item-delegated",
      },
    ],
  });
});

test("rejects missing and duplicate produced evidence deterministically", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("revision-a");
  const first = eventFor(compiled.package, "01-plan-work-item", revision);
  const second = eventFor(
    compiled.package,
    "02-work-item-delegated",
    revision,
  );
  const duplicated = second.evidence[0];
  assert.ok(duplicated);
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      first,
      {
        ...second,
        evidence: [duplicated, duplicated],
      },
    ]),
  );

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected duplicate and missing evidence diagnostics.");
  }
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    ["EVIDENCE_ARTIFACT_DUPLICATED", "EVIDENCE_MISSING"],
  );
});

test("rejects stale evidence reuse after auxiliary autofix", () => {
  const compiled = compileIssueManifest({
    initialState: "draft",
    auxiliaryReview: "enabled",
  });
  expectManifestSuccess(compiled);
  const firstRevision = subject("revision-a");
  const secondRevision = subject("revision-b");
  const firstCi = eventFor(
    compiled.package,
    "04-ci-passed",
    firstRevision,
  );
  const staleCiEnvelope = firstCi.evidence[0];
  assert.ok(staleCiEnvelope);
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      eventFor(compiled.package, "01-plan-work-item", firstRevision),
      eventFor(compiled.package, "02-work-item-delegated", firstRevision),
      eventFor(compiled.package, "03-create-draft-pull-request", firstRevision),
      firstCi,
      eventFor(compiled.package, "07-ci-auxiliary-review", firstRevision),
      eventFor(
        compiled.package,
        "08-auxiliary-autofix-reobserve",
        secondRevision,
      ),
      {
        stepId: "04-ci-passed",
        subjectDigest: secondRevision,
        evidence: [staleCiEnvelope],
        payloads: firstCi.payloads,
      },
    ]),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => diagnostic.code),
      ["EVIDENCE_SUBJECT_MISMATCH"],
    );
  }
});

test("rejects evidence bound to another manifest", () => {
  const draft = compileIssueManifest({
    initialState: "draft",
    auxiliaryReview: "disabled",
  });
  const ready = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(draft);
  expectManifestSuccess(ready);
  const revision = subject("revision-a");
  const foreign = eventFor(
    draft.package,
    "01-plan-work-item",
    revision,
  ).evidence[0];
  assert.ok(foreign);
  const result = replayPrivateExecutionTrace(
    ready.package,
    traceFor(ready.package, [
      {
        stepId: "01-plan-work-item",
        subjectDigest: revision,
        evidence: [foreign],
        payloads: [],
      },
    ]),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => diagnostic.code),
      ["EVIDENCE_MANIFEST_MISMATCH"],
    );
  }
});

test("rejects a tampered evidence envelope", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("revision-a");
  const event = eventFor(compiled.package, "01-plan-work-item", revision);
  const envelope = event.evidence[0];
  assert.ok(envelope);
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      {
        ...event,
        evidence: [
          {
            ...envelope,
            payloadDigest: subject("tampered-payload"),
          },
        ],
      },
    ]),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => diagnostic.code),
      ["EVIDENCE_ENVELOPE_INVALID"],
    );
  }
});

test("requires a typed payload package for every manifest evidence requirement", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("typed-payload-missing");
  const ci = eventFor(compiled.package, "04-ci-passed", revision);
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      eventFor(compiled.package, "01-plan-work-item", revision),
      eventFor(compiled.package, "02-work-item-delegated", revision),
      eventFor(
        compiled.package,
        "03-create-ready-pull-request",
        revision,
      ),
      { ...ci, payloads: [] },
    ]),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    ["EVIDENCE_PAYLOAD_MISSING"],
  );
});

test("rejects a typed payload bound to another subject", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("typed-subject-current");
  const foreignSubject = subject("typed-subject-foreign");
  const ci = eventFor(compiled.package, "04-ci-passed", revision);
  const originalEnvelope = ci.evidence[0];
  assert.ok(originalEnvelope);
  const payloadPackage = createPrivateExecutionPayloadPackage({
    schema: "ci-result@2",
    artifact: "CiResult",
    subjectDigest: foreignSubject,
    payload: {
      status: "passed",
      requiredChecksDigest: subject("required-checks"),
      observationDigest: subject("ci-observation"),
    },
  });
  const envelope = createPrivateExecutionEvidenceEnvelope(compiled.package, {
    stepId: ci.stepId,
    artifact: "CiResult",
    subjectDigest: revision,
    payloadDigest: payloadPackage.digest,
    producer: originalEnvelope.producer,
    enforcement: originalEnvelope.enforcement,
  });
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      eventFor(compiled.package, "01-plan-work-item", revision),
      eventFor(compiled.package, "02-work-item-delegated", revision),
      eventFor(
        compiled.package,
        "03-create-ready-pull-request",
        revision,
      ),
      { ...ci, evidence: [envelope], payloads: [payloadPackage] },
    ]),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    ["EVIDENCE_PAYLOAD_SUBJECT_MISMATCH"],
  );
});

test("rejects review payload producer observations that disagree with the envelope", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("typed-review-producer");
  const review = eventFor(
    compiled.package,
    "11-independent-approved",
    revision,
  );
  const originalVerdictEnvelope = review.evidence.find(
    (envelope) => envelope.artifact === "ReviewVerdict",
  );
  assert.ok(originalVerdictEnvelope);
  const badVerdict = createPrivateExecutionPayloadPackage({
    schema: "review-verdict@1",
    artifact: "ReviewVerdict",
    subjectDigest: revision,
    payload: {
      verdict: "approved",
      reviewerPrincipal: "foreign-reviewer",
      reviewerExecutionContext: "foreign-context",
    },
  });
  const verdictEnvelope = createPrivateExecutionEvidenceEnvelope(
    compiled.package,
    {
      stepId: review.stepId,
      artifact: "ReviewVerdict",
      subjectDigest: revision,
      payloadDigest: badVerdict.digest,
      producer: originalVerdictEnvelope.producer,
      enforcement: originalVerdictEnvelope.enforcement,
    },
  );
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      eventFor(compiled.package, "01-plan-work-item", revision),
      eventFor(compiled.package, "02-work-item-delegated", revision),
      eventFor(
        compiled.package,
        "03-create-ready-pull-request",
        revision,
      ),
      eventFor(compiled.package, "04-ci-passed", revision),
      eventFor(compiled.package, "07-ci-independent-review", revision),
      {
        ...review,
        evidence: review.evidence.map((envelope) =>
          envelope.artifact === "ReviewVerdict"
            ? verdictEnvelope
            : envelope,
        ),
        payloads: [
          ...review.payloads.filter(
            (payload) => payload.artifact !== "ReviewVerdict",
          ),
          badVerdict,
        ],
      },
    ]),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    ["EVIDENCE_PAYLOAD_PRODUCER_MISMATCH"],
  );
});

test("rejects a Reviewer sharing the active change producer principal and context", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("typed-review-isolation");
  const review = eventFor(
    compiled.package,
    "11-independent-approved",
    revision,
  );
  const producer = {
    responsibility: "reviewer" as const,
    binding: "reviewer",
    principal: "developer-principal",
    executionContext: "03-create-ready-pull-request-context",
  };
  const verdict = createPrivateExecutionPayloadPackage({
    schema: "review-verdict@1",
    artifact: "ReviewVerdict",
    subjectDigest: revision,
    payload: {
      verdict: "approved",
      reviewerPrincipal: producer.principal,
      reviewerExecutionContext: producer.executionContext,
    },
  });
  const isolation = createPrivateExecutionPayloadPackage({
    schema: "reviewer-isolation@1",
    artifact: "ReviewerIsolationEvidence",
    subjectDigest: revision,
    payload: {
      developerPrincipal: "developer-principal",
      developerExecutionContext: "03-create-ready-pull-request-context",
      reviewerPrincipal: producer.principal,
      reviewerExecutionContext: producer.executionContext,
      reviewerContextObservedFresh: true,
    },
  });
  const evidence = [
    createPrivateExecutionEvidenceEnvelope(compiled.package, {
      stepId: review.stepId,
      artifact: "ReviewVerdict",
      subjectDigest: revision,
      payloadDigest: verdict.digest,
      producer,
      enforcement: {
        strength: "advisory",
        mechanism: "fixture-observation",
      },
    }),
    createPrivateExecutionEvidenceEnvelope(compiled.package, {
      stepId: review.stepId,
      artifact: "ReviewerIsolationEvidence",
      subjectDigest: revision,
      payloadDigest: isolation.digest,
      producer,
      enforcement: {
        strength: "advisory",
        mechanism: "fixture-observation",
      },
    }),
  ];
  const result = replayPrivateExecutionTrace(
    compiled.package,
    traceFor(compiled.package, [
      eventFor(compiled.package, "01-plan-work-item", revision),
      eventFor(compiled.package, "02-work-item-delegated", revision),
      eventFor(
        compiled.package,
        "03-create-ready-pull-request",
        revision,
      ),
      eventFor(compiled.package, "04-ci-passed", revision),
      eventFor(compiled.package, "07-ci-independent-review", revision),
      { ...review, evidence, payloads: [verdict, isolation] },
    ]),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    ["REVIEWER_ISOLATION_FAILED", "REVIEWER_ISOLATION_FAILED"],
  );
});

test("canonicalizes typed payload packages and rejects unknown fields", () => {
  const subjectDigest = subject("typed-canonicalization");
  const first = createPrivateExecutionPayloadPackage({
    schema: "review-verdict@1",
    artifact: "ReviewVerdict",
    subjectDigest,
    payload: {
      verdict: "approved",
      reviewerPrincipal: "reviewer",
      reviewerExecutionContext: "clean-context",
    },
  });
  const second = createPrivateExecutionPayloadPackage({
    schema: "review-verdict@1",
    artifact: "ReviewVerdict",
    subjectDigest,
    payload: {
      reviewerExecutionContext: "clean-context",
      reviewerPrincipal: "reviewer",
      verdict: "approved",
    },
  });

  assert.deepEqual(second, first);
  assert.equal(
    validatePrivateExecutionPayloadPackage({
      ...first,
      payload: { ...first.payload, unexpected: true },
    }).ok,
    false,
  );
});

test("rejects a producer responsibility that does not match the step", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("revision-a");

  assert.throws(
    () =>
      createPrivateExecutionEvidenceEnvelope(compiled.package, {
        stepId: "01-plan-work-item",
        artifact: "Plan",
        subjectDigest: revision,
        payloadDigest: subject("plan"),
        producer: {
          responsibility: "developer",
          binding: "developer",
          principal: "developer-principal",
          executionContext: "developer-context",
        },
        enforcement: {
          strength: "advisory",
          mechanism: "fixture-observation",
        },
      }),
    /requires steward responsibility/u,
  );
});

test("rejects malformed caller-supplied evidence without throwing", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const revision = subject("revision-a");
  const malformedTrace = traceFor(compiled.package, [
    {
      stepId: "01-plan-work-item",
      subjectDigest: revision,
      evidence: [null],
      payloads: [],
    } as unknown as PrivateExecutionTraceEvent,
  ]);

  assert.doesNotThrow(() =>
    replayPrivateExecutionTrace(compiled.package, malformedTrace),
  );
  assert.deepEqual(
    replayPrivateExecutionTrace(compiled.package, malformedTrace),
    {
      ok: false,
      diagnostics: [
        {
          code: "EVIDENCE_ENVELOPE_INVALID",
          message: "Execution event contains a malformed evidence envelope.",
          eventIndex: 0,
          stepId: "01-plan-work-item",
        },
        {
          code: "EVIDENCE_MISSING",
          message:
            "Execution step 01-plan-work-item requires produced evidence for Plan.",
          eventIndex: 0,
          stepId: "01-plan-work-item",
          artifact: "Plan",
        },
      ],
    },
  );
});

test("rejects a manifest package whose bytes no longer match", () => {
  const compiled = compileIssueManifest({
    initialState: "ready",
    auxiliaryReview: "disabled",
  });
  expectManifestSuccess(compiled);
  const tampered: PrivateExecutionManifestPackage = {
    ...compiled.package,
    manifest: {
      ...compiled.package.manifest,
      initialNode: "delegated",
    },
  };
  const result = replayPrivateExecutionTrace(tampered, {
    revision: 2,
    manifestDigest: tampered.digest,
    events: [],
  });

  assert.deepEqual(result, {
    ok: false,
    diagnostics: [
      {
        code: "MANIFEST_PACKAGE_INVALID",
        message:
          "Private execution manifest package bytes or digest do not match the manifest.",
      },
    ],
  });
});

test("does not produce a manifest for an unsafe workflow", () => {
  const base = createPrivateIssueToReviewedPullRequestDefinition({
    initialState: "ready",
    auxiliaryReview: "disabled",
    mergeMethod: "squash",
  });
  const unsafe: PrivateDomainWorkflowDefinition = {
    ...base,
    id: "fixture/execution-direct-merge",
    transitions: [
      ...base.transitions,
      {
        id: "03-direct-merge",
        from: "delegated",
        to: "merged",
        role: "developer",
      },
    ],
  };
  const result = compilePrivateExecutionManifest(unsafe, {
    capabilityObservations: privateIssueToPullRequestCapabilityObservations,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "UNSAFE_WORKFLOW",
      ),
      true,
    );
  }
});

test("does not produce a manifest with an undeclared capability reference", () => {
  const base = privateLocalReviewedChangeDefinition;
  const malformed: PrivateDomainWorkflowDefinition = {
    ...base,
    id: "fixture/execution-unknown-capability",
    transitions: base.transitions.map((transition) =>
      transition.id === "02-implement-review"
        ? {
            ...transition,
            requiresCapabilities: ["unknown-capability"],
          }
        : transition,
    ),
  };
  const result = compilePrivateExecutionManifest(malformed, {
    capabilityObservations:
      privateLocalReviewedChangeCapabilityObservations,
  });

  assert.deepEqual(result, {
    ok: false,
    diagnostics: [
      {
        stage: "definition",
        code: "INVALID_WORKFLOW_DEFINITION",
        path: "$.workflow",
        message:
          "Transition 02-implement-review references undeclared capability requirement unknown-capability.",
      },
    ],
  });
});

test("does not produce a manifest with an invalid typed evidence requirement", () => {
  const base = privateLocalReviewedChangeDefinition;
  const malformed: PrivateDomainWorkflowDefinition = {
    ...base,
    id: "fixture/execution-invalid-evidence-requirement",
    evidenceRequirements: [
      ...(base.evidenceRequirements ?? []),
      {
        id: "unknown-artifact-payload",
        artifact: "UnknownEvidence",
        schema: "review-verdict@1",
      },
    ],
  };
  const result = compilePrivateExecutionManifest(malformed, {
    capabilityObservations:
      privateLocalReviewedChangeCapabilityObservations,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(
    result.diagnostics.some((diagnostic) =>
      diagnostic.message.includes(
        "uses undeclared artifact type UnknownEvidence",
      ),
    ),
    true,
  );

  const mismatched = compilePrivateExecutionManifest(
    {
      ...base,
      id: "fixture/execution-mismatched-evidence-schema",
      evidenceRequirements: [
        {
          id: "wrong-review-payload",
          artifact: "ReviewVerdict",
          schema: "ci-result@2",
        },
      ],
    },
    {
      capabilityObservations:
        privateLocalReviewedChangeCapabilityObservations,
    },
  );
  assert.equal(mismatched.ok, false);
  if (!mismatched.ok) {
    assert.equal(
      mismatched.diagnostics.some((diagnostic) =>
        diagnostic.message.includes(
          "schema ci-result@2 does not apply to artifact ReviewVerdict",
        ),
      ),
      true,
    );
  }
});
