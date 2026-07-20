import assert from "node:assert/strict";
import test from "node:test";

import {
  acquirePrivateGitHubCiEvidence,
  createPrivateGitHubRevisionSubjectDigest,
  privateGitHubCheckRunsApiVersion,
  type PrivateGitHubCheckRunConclusion,
  type PrivateGitHubCheckRunsSnapshot,
  type PrivateGitHubRequiredCheck,
} from "../../src/adapters/github/private-github-check-runs-evidence.js";
import {
  compilePrivateExecutionManifest,
  createPrivateExecutionEvidenceEnvelope,
  createPrivateExecutionPayloadDigest,
  replayPrivateExecutionTrace,
  type PrivateExecutionManifestPackage,
  type PrivateExecutionTraceEvent,
} from "../../src/execution/private-execution-contract.js";
import {
  createPrivateIssueToReviewedPullRequestDefinition,
  privateIssueToPullRequestCapabilityObservations,
} from "../../src/workflows/private-issue-to-reviewed-pull-request.js";
import type { PrivateCiResultPayload } from "../../src/execution/private-typed-evidence.js";

const repository = { id: 42, fullName: "example/agentdevflow" } as const;
const headSha = "0123456789abcdef0123456789abcdef01234567";
const requiredChecks: readonly PrivateGitHubRequiredCheck[] = [
  { kind: "check-run", name: "build", appId: 15368 },
  { kind: "check-run", name: "test", appId: 15368 },
];

function compileManifest(): PrivateExecutionManifestPackage {
  const result = compilePrivateExecutionManifest(
    createPrivateIssueToReviewedPullRequestDefinition({
      initialState: "ready",
      auxiliaryReview: "disabled",
      mergeMethod: "squash",
    }),
    { capabilityObservations: privateIssueToPullRequestCapabilityObservations },
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("GitHub adapter fixture did not compile.");
  return result.package;
}

function snapshot(
  conclusions: readonly PrivateGitHubCheckRunConclusion[] = [
    "success",
    "neutral",
  ],
): PrivateGitHubCheckRunsSnapshot {
  return {
    revision: 1,
    apiVersion: privateGitHubCheckRunsApiVersion,
    repository,
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
        conclusion: conclusions[0] ?? "success",
        app: { id: 15368, slug: "github-actions" },
      },
      {
        id: 102,
        name: "test",
        headSha,
        status: "completed",
        conclusion: conclusions[1] ?? "success",
        app: { id: 15368, slug: "github-actions" },
      },
    ],
  };
}

function acquire(overrides: {
  readonly packageValue?: PrivateExecutionManifestPackage;
  readonly stepId?: string;
  readonly repositoryValue?: { readonly id: number; readonly fullName: string };
  readonly headShaValue?: string;
  readonly requirements?: readonly PrivateGitHubRequiredCheck[];
  readonly snapshotValue?: unknown;
} = {}) {
  return acquirePrivateGitHubCiEvidence({
    manifestPackage: overrides.packageValue ?? compileManifest(),
    stepId: overrides.stepId ?? "04-ci-passed",
    repository: overrides.repositoryValue ?? repository,
    headSha: overrides.headShaValue ?? headSha,
    requiredChecks: overrides.requirements ?? requiredChecks,
    observer: {
      binding: "steward",
      principal: "steward-principal",
      executionContext: "trusted-github-read-context",
    },
    snapshot: overrides.snapshotValue ?? snapshot(),
  });
}

function opaqueEvent(
  packageValue: PrivateExecutionManifestPackage,
  stepId: string,
  subjectDigest: string,
): PrivateExecutionTraceEvent {
  const step = packageValue.manifest.steps.find((item) => item.id === stepId);
  if (step === undefined) throw new Error(`Unknown fixture step ${stepId}.`);
  const producer = {
    responsibility: step.responsibility,
    binding: step.responsibility,
    principal: `${step.responsibility}-principal`,
    executionContext: `${stepId}-context`,
  } as const;
  return {
    stepId,
    subjectDigest,
    evidence: step.produces.map((artifact) =>
      createPrivateExecutionEvidenceEnvelope(packageValue, {
        stepId,
        artifact,
        subjectDigest,
        payloadDigest: createPrivateExecutionPayloadDigest({ stepId, artifact }),
        producer,
        enforcement: { strength: "advisory", mechanism: "fixture-observation" },
      }),
    ),
    payloads: [],
  };
}

test("creates revision-bound CI evidence from pinned GitHub Check Runs", () => {
  const packageValue = compileManifest();
  const result = acquire({ packageValue });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.payloadPackage.schema, "ci-result@2");
  assert.equal(result.payloadPackage.artifact, "CiResult");
  const payload = result.payloadPackage.payload as PrivateCiResultPayload;
  assert.equal(payload.status, "passed");
  assert.equal(
    result.subjectDigest,
    createPrivateGitHubRevisionSubjectDigest(repository.id, headSha),
  );
  assert.equal(
    payload.observationDigest,
    result.receipt.observationDigest,
  );
  assert.equal(result.evidenceEnvelope.payloadDigest, result.receipt.payloadDigest);
  assert.equal(result.evidenceEnvelope.digest, result.receipt.envelopeDigest);
  assert.deepEqual(result.receipt.acceptedCheckRunIds, [101, 102]);

  const trace = {
    revision: 2,
    manifestDigest: packageValue.digest,
    events: [
      opaqueEvent(packageValue, "01-plan-work-item", result.subjectDigest),
      opaqueEvent(packageValue, "02-work-item-delegated", result.subjectDigest),
      opaqueEvent(packageValue, "03-create-ready-pull-request", result.subjectDigest),
      {
        stepId: "04-ci-passed",
        subjectDigest: result.subjectDigest,
        evidence: [result.evidenceEnvelope],
        payloads: [result.payloadPackage],
      },
    ],
  } as const;
  const replay = replayPrivateExecutionTrace(packageValue, trace);
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.finalNode, "ci-passed");
});

test("treats GitHub success, neutral, and skipped conclusions as passing", () => {
  for (const conclusion of ["success", "neutral", "skipped"] as const) {
    const result = acquire({ snapshotValue: snapshot([conclusion, conclusion]) });
    assert.equal(result.ok, true, conclusion);
  }
});

test("normalizes requirement and observation ordering deterministically", () => {
  const first = acquire();
  const base = snapshot();
  const second = acquire({
    requirements: [...requiredChecks].reverse(),
    snapshotValue: { ...base, checkRuns: [...base.checkRuns].reverse() },
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(second, first);
});

test("rejects failed and incomplete required checks without partial evidence", () => {
  for (const conclusion of [
    "action_required",
    "cancelled",
    "failure",
    "stale",
    "timed_out",
  ] as const) {
    const result = acquire({ snapshotValue: snapshot([conclusion, "success"]) });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.diagnostics[0]?.code, "CHECK_CONCLUSION_FAILED");
    }
  }
  const pending = snapshot();
  const result = acquire({
    snapshotValue: {
      ...pending,
      checkRuns: pending.checkRuns.map((run, index) =>
        index === 0
          ? { ...run, status: "in_progress", conclusion: null }
          : run,
      ),
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.diagnostics[0]?.code, "CHECK_INCOMPLETE");
});

test("rejects missing, wrong-source, and ambiguous required checks", () => {
  const base = snapshot();
  const missing = acquire({
    snapshotValue: {
      ...base,
      collection: { ...base.collection, totalCheckRunCount: 1 },
      checkRuns: base.checkRuns.slice(0, 1),
    },
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.diagnostics[0]?.code, "REQUIRED_CHECK_MISSING");

  const wrongSource = acquire({
    snapshotValue: {
      ...base,
      checkRuns: base.checkRuns.map((run) =>
        run.name === "build" ? { ...run, app: { id: 7, slug: "other" } } : run,
      ),
    },
  });
  assert.equal(wrongSource.ok, false);
  if (!wrongSource.ok) {
    assert.equal(wrongSource.diagnostics[0]?.code, "REQUIRED_CHECK_SOURCE_MISMATCH");
  }

  const duplicateRun = { ...base.checkRuns[0]!, id: 103 };
  const ambiguous = acquire({
    snapshotValue: {
      ...base,
      collection: { ...base.collection, totalCheckRunCount: 3 },
      checkRuns: [...base.checkRuns, duplicateRun],
    },
  });
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) {
    assert.equal(ambiguous.diagnostics[0]?.code, "REQUIRED_CHECK_AMBIGUOUS");
  }
});

test("rejects repository, requested SHA, and per-run SHA mismatches", () => {
  const wrongRepository = acquire({
    repositoryValue: { id: 99, fullName: repository.fullName },
  });
  assert.equal(wrongRepository.ok, false);
  if (!wrongRepository.ok) {
    assert.equal(wrongRepository.diagnostics[0]?.code, "REPOSITORY_MISMATCH");
  }

  const otherSha = "abcdef0123456789abcdef0123456789abcdef01";
  const wrongRequest = acquire({ headShaValue: otherSha });
  assert.equal(wrongRequest.ok, false);
  if (!wrongRequest.ok) {
    assert.equal(wrongRequest.diagnostics[0]?.code, "HEAD_SHA_MISMATCH");
  }

  const base = snapshot();
  const wrongRun = acquire({
    snapshotValue: {
      ...base,
      checkRuns: base.checkRuns.map((run, index) =>
        index === 0 ? { ...run, headSha: otherSha } : run,
      ),
    },
  });
  assert.equal(wrongRun.ok, false);
  if (!wrongRun.ok) {
    assert.equal(wrongRun.diagnostics[0]?.code, "CHECK_HEAD_MISMATCH");
  }
});

test("fails closed for incomplete acquisition and unsupported commit statuses", () => {
  const base = snapshot();
  for (const snapshotValue of [
    {
      ...base,
      collection: { ...base.collection, paginationComplete: false },
    },
    {
      ...base,
      collection: { ...base.collection, method: "single-ref-page" },
    },
    {
      ...base,
      collection: { ...base.collection, filter: "all" },
    },
    {
      ...base,
      authorization: { ...base.authorization, responseOriginVerified: false },
    },
    {
      ...base,
      checkRuns: base.checkRuns.map((run, index) =>
        index === 0 ? { ...run, status: "startup_failure" } : run,
      ),
    },
  ]) {
    const result = acquire({ snapshotValue });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.diagnostics[0]?.code, "SNAPSHOT_INVALID");
  }

  const unsupported = acquire({
    requirements: [
      { kind: "commit-status", name: "build", appId: 15368 },
    ] as unknown as readonly PrivateGitHubRequiredCheck[],
  });
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) {
    assert.equal(unsupported.diagnostics[0]?.code, "UNSUPPORTED_STATUS_SOURCE");
  }
});

test("rejects duplicate or unpinned required-check configuration", () => {
  const duplicated = acquire({ requirements: [requiredChecks[0]!, requiredChecks[0]!] });
  assert.equal(duplicated.ok, false);
  if (!duplicated.ok) {
    assert.equal(duplicated.diagnostics[0]?.code, "REQUIRED_CHECK_DUPLICATED");
  }
  const unpinned = acquire({
    requirements: [
      { kind: "check-run", name: "build", appId: 0 },
    ],
  });
  assert.equal(unpinned.ok, false);
  if (!unpinned.ok) {
    assert.equal(unpinned.diagnostics[0]?.code, "REQUIRED_CHECK_INVALID");
  }
});

test("changes the observation binding when any captured check run changes", () => {
  const first = acquire();
  const base = snapshot();
  const changed = acquire({
    snapshotValue: {
      ...base,
      checkRuns: base.checkRuns.map((run, index) =>
        index === 0 ? { ...run, app: { ...run.app, slug: "renamed-app" } } : run,
      ),
    },
  });
  assert.equal(first.ok, true);
  assert.equal(changed.ok, true);
  if (!first.ok || !changed.ok) return;
  assert.notEqual(changed.receipt.observationDigest, first.receipt.observationDigest);
  assert.notEqual(changed.payloadPackage.digest, first.payloadPackage.digest);
  assert.notEqual(changed.evidenceEnvelope.digest, first.evidenceEnvelope.digest);
});

test("rejects a manifest step that cannot produce CI evidence", () => {
  const result = acquire({ stepId: "01-plan-work-item" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.diagnostics[0]?.code, "EVIDENCE_CREATION_FAILED");
  }
});
