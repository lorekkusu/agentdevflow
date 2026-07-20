import {
  createPrivateExecutionEvidenceEnvelope,
  createPrivateExecutionPayloadDigest,
  type PrivateExecutionEvidenceEnvelope,
  type PrivateExecutionManifestPackage,
} from "../../execution/private-execution-contract.js";
import {
  createPrivateExecutionPayloadPackage,
  type PrivateExecutionPayloadPackage,
} from "../../execution/private-typed-evidence.js";

export const privateGitHubCheckRunsObservationRevision = 1;
export const privateGitHubCheckRunsApiVersion = "2026-03-10";
export const privateGitHubCheckRunsMaxObservedRuns = 10_000;
export const privateGitHubCheckRunsMaxRequiredChecks = 256;

export type PrivateGitHubCheckRunStatus =
  | "completed"
  | "expected"
  | "failure"
  | "in_progress"
  | "pending"
  | "queued"
  | "requested"
  | "waiting";

export type PrivateGitHubCheckRunConclusion =
  | "action_required"
  | "cancelled"
  | "failure"
  | "neutral"
  | "skipped"
  | "stale"
  | "success"
  | "timed_out";

export interface PrivateGitHubRequiredCheck {
  readonly kind: "check-run";
  readonly name: string;
  readonly appId: number;
}

export interface PrivateGitHubCheckRunObservation {
  readonly id: number;
  readonly name: string;
  readonly headSha: string;
  readonly status: PrivateGitHubCheckRunStatus;
  readonly conclusion: PrivateGitHubCheckRunConclusion | null;
  readonly app: {
    readonly id: number;
    readonly slug: string;
  };
}

export interface PrivateGitHubCheckRunsSnapshot {
  readonly revision: 1;
  readonly apiVersion: typeof privateGitHubCheckRunsApiVersion;
  readonly repository: {
    readonly id: number;
    readonly fullName: string;
  };
  readonly requestedHeadSha: string;
  readonly collection: {
    readonly method: "complete-latest-check-runs";
    readonly filter: "latest";
    readonly paginationComplete: true;
    readonly pageCount: number;
    readonly totalCheckRunCount: number;
  };
  readonly authorization: {
    readonly kind: "github-checks-read";
    readonly responseOriginVerified: true;
  };
  readonly checkRuns: readonly PrivateGitHubCheckRunObservation[];
}

export interface AcquirePrivateGitHubCiEvidenceOptions {
  readonly manifestPackage: PrivateExecutionManifestPackage;
  readonly stepId: string;
  readonly repository: {
    readonly id: number;
    readonly fullName: string;
  };
  readonly headSha: string;
  readonly requiredChecks: readonly PrivateGitHubRequiredCheck[];
  readonly observer: {
    readonly binding: string;
    readonly principal: string;
    readonly executionContext: string;
  };
  readonly snapshot: unknown;
}

export type PrivateGitHubCiEvidenceDiagnosticCode =
  | "CHECK_CONCLUSION_FAILED"
  | "CHECK_HEAD_MISMATCH"
  | "CHECK_INCOMPLETE"
  | "EVIDENCE_CREATION_FAILED"
  | "HEAD_SHA_MISMATCH"
  | "REPOSITORY_MISMATCH"
  | "REQUIRED_CHECK_AMBIGUOUS"
  | "REQUIRED_CHECK_DUPLICATED"
  | "REQUIRED_CHECK_INVALID"
  | "REQUIRED_CHECK_MISSING"
  | "REQUIRED_CHECK_SOURCE_MISMATCH"
  | "SNAPSHOT_INVALID"
  | "UNSUPPORTED_STATUS_SOURCE";

export interface PrivateGitHubCiEvidenceDiagnostic {
  readonly code: PrivateGitHubCiEvidenceDiagnosticCode;
  readonly message: string;
  readonly checkName?: string;
  readonly appId?: number;
}

export interface PrivateGitHubCiEvidenceReceipt {
  readonly revision: 1;
  readonly adapter: "github-check-runs";
  readonly repositoryId: number;
  readonly repositoryFullName: string;
  readonly headSha: string;
  readonly requiredChecksDigest: string;
  readonly observationDigest: string;
  readonly payloadDigest: string;
  readonly envelopeDigest: string;
  readonly acceptedCheckRunIds: readonly number[];
}

export type PrivateGitHubCiEvidenceResult =
  | {
      readonly ok: true;
      readonly subjectDigest: string;
      readonly payloadPackage: PrivateExecutionPayloadPackage;
      readonly evidenceEnvelope: PrivateExecutionEvidenceEnvelope;
      readonly receipt: PrivateGitHubCiEvidenceReceipt;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateGitHubCiEvidenceDiagnostic[];
    };

const shaPattern = /^[a-f0-9]{40}$/u;
const statuses = new Set<unknown>([
  "completed",
  "expected",
  "failure",
  "in_progress",
  "pending",
  "queued",
  "requested",
  "waiting",
]);
const conclusions = new Set<unknown>([
  "action_required",
  "cancelled",
  "failure",
  "neutral",
  "skipped",
  "stale",
  "success",
  "timed_out",
]);
const passingConclusions = new Set<unknown>([
  "neutral",
  "skipped",
  "success",
]);

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: unknown, expected: readonly string[]): boolean {
  return (
    isRecord(value) &&
    JSON.stringify(Object.keys(value).sort(compareText)) ===
      JSON.stringify([...expected].sort(compareText))
  );
}

function boundedText(value: unknown, maxLength = 512): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value === value.trim() &&
    value.length <= maxLength
  );
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function validateCheckRun(value: unknown): value is PrivateGitHubCheckRunObservation {
  return (
    hasExactKeys(value, ["app", "conclusion", "headSha", "id", "name", "status"]) &&
    isRecord(value) &&
    positiveSafeInteger(value.id) &&
    boundedText(value.name, 256) &&
    typeof value.headSha === "string" &&
    shaPattern.test(value.headSha) &&
    statuses.has(value.status) &&
    (value.conclusion === null || conclusions.has(value.conclusion)) &&
    hasExactKeys(value.app, ["id", "slug"]) &&
    isRecord(value.app) &&
    positiveSafeInteger(value.app.id) &&
    boundedText(value.app.slug, 128)
  );
}

function validateSnapshot(value: unknown): value is PrivateGitHubCheckRunsSnapshot {
  if (
    !hasExactKeys(value, [
      "apiVersion",
      "authorization",
      "checkRuns",
      "collection",
      "repository",
      "requestedHeadSha",
      "revision",
    ]) ||
    !isRecord(value) ||
    value.revision !== privateGitHubCheckRunsObservationRevision ||
    value.apiVersion !== privateGitHubCheckRunsApiVersion ||
    !hasExactKeys(value.repository, ["fullName", "id"]) ||
    !isRecord(value.repository) ||
    !positiveSafeInteger(value.repository.id) ||
    !boundedText(value.repository.fullName, 256) ||
    typeof value.requestedHeadSha !== "string" ||
    !shaPattern.test(value.requestedHeadSha) ||
    !hasExactKeys(value.collection, [
      "filter",
      "method",
      "pageCount",
      "paginationComplete",
      "totalCheckRunCount",
    ]) ||
    !isRecord(value.collection) ||
    value.collection.method !== "complete-latest-check-runs" ||
    value.collection.filter !== "latest" ||
    value.collection.paginationComplete !== true ||
    !positiveSafeInteger(value.collection.pageCount) ||
    Number(value.collection.pageCount) > privateGitHubCheckRunsMaxObservedRuns ||
    !Number.isSafeInteger(value.collection.totalCheckRunCount) ||
    Number(value.collection.totalCheckRunCount) < 0 ||
    !hasExactKeys(value.authorization, ["kind", "responseOriginVerified"]) ||
    !isRecord(value.authorization) ||
    value.authorization.kind !== "github-checks-read" ||
    value.authorization.responseOriginVerified !== true ||
    !Array.isArray(value.checkRuns) ||
    value.checkRuns.length > privateGitHubCheckRunsMaxObservedRuns ||
    !value.checkRuns.every(validateCheckRun) ||
    value.collection.totalCheckRunCount !== value.checkRuns.length
  ) {
    return false;
  }
  const ids = value.checkRuns.map((run) => run.id);
  return new Set(ids).size === ids.length;
}

function diagnostic(
  code: PrivateGitHubCiEvidenceDiagnosticCode,
  message: string,
  check?: PrivateGitHubRequiredCheck,
): PrivateGitHubCiEvidenceDiagnostic {
  return {
    code,
    message,
    ...(check === undefined
      ? {}
      : { checkName: check.name, appId: check.appId }),
  };
}

function compareDiagnostics(
  left: PrivateGitHubCiEvidenceDiagnostic,
  right: PrivateGitHubCiEvidenceDiagnostic,
): number {
  return (
    compareText(left.checkName ?? "", right.checkName ?? "") ||
    (left.appId ?? -1) - (right.appId ?? -1) ||
    compareText(left.code, right.code) ||
    compareText(left.message, right.message)
  );
}

function normalizedRequirements(
  value: unknown,
):
  | { readonly ok: true; readonly requirements: readonly PrivateGitHubRequiredCheck[] }
  | { readonly ok: false; readonly diagnostics: readonly PrivateGitHubCiEvidenceDiagnostic[] } {
  const diagnostics: PrivateGitHubCiEvidenceDiagnostic[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(value) || value.length > privateGitHubCheckRunsMaxRequiredChecks) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "REQUIRED_CHECK_INVALID",
          `GitHub required checks must be an array with at most ${privateGitHubCheckRunsMaxRequiredChecks} entries.`,
        ),
      ],
    };
  }
  const requirements: PrivateGitHubRequiredCheck[] = [];
  for (const candidate of value) {
    if (
      !hasExactKeys(candidate, ["appId", "kind", "name"]) ||
      !isRecord(candidate)
    ) {
      diagnostics.push(
        diagnostic(
          "REQUIRED_CHECK_INVALID",
          "GitHub required check is malformed.",
        ),
      );
      continue;
    }
    if (candidate.kind !== "check-run") {
      diagnostics.push(
        diagnostic(
          "UNSUPPORTED_STATUS_SOURCE",
          "This adapter accepts Check Runs only; commit statuses require a separate adapter.",
        ),
      );
      continue;
    }
    const requirement = candidate as unknown as PrivateGitHubRequiredCheck;
    if (!boundedText(requirement.name, 256) || !positiveSafeInteger(requirement.appId)) {
      diagnostics.push(
        diagnostic(
          "REQUIRED_CHECK_INVALID",
          "GitHub required check needs a bounded name and a positive expected App id.",
          requirement,
        ),
      );
      continue;
    }
    const key = `${requirement.name}\u0000${requirement.appId}`;
    if (seen.has(key)) {
      diagnostics.push(
        diagnostic(
          "REQUIRED_CHECK_DUPLICATED",
          `GitHub required check ${requirement.name} from App ${requirement.appId} is duplicated.`,
          requirement,
        ),
      );
    }
    seen.add(key);
    requirements.push({
      kind: "check-run",
      name: requirement.name,
      appId: requirement.appId,
    });
  }
  if (value.length === 0) {
    diagnostics.push(
      diagnostic(
        "REQUIRED_CHECK_INVALID",
        "At least one GitHub required Check Run must be configured.",
      ),
    );
  }
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: diagnostics.sort(compareDiagnostics) };
  }
  return {
    ok: true,
    requirements: requirements.sort(
      (left, right) =>
        compareText(left.name, right.name) || left.appId - right.appId,
    ),
  };
}

export function createPrivateGitHubRevisionSubjectDigest(
  repositoryId: number,
  headSha: string,
): string {
  if (!positiveSafeInteger(repositoryId) || !shaPattern.test(headSha)) {
    throw new Error("GitHub revision subject inputs are invalid.");
  }
  return createPrivateExecutionPayloadDigest({
    revision: 1,
    kind: "github-repository-commit",
    repositoryId,
    headSha,
  });
}

export function acquirePrivateGitHubCiEvidence(
  options: AcquirePrivateGitHubCiEvidenceOptions,
): PrivateGitHubCiEvidenceResult {
  const requirementResult = normalizedRequirements(options.requiredChecks);
  if (!requirementResult.ok) return requirementResult;
  if (!validateSnapshot(options.snapshot)) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "SNAPSHOT_INVALID",
          "GitHub Check Runs snapshot is malformed, incomplete, or uses an unsupported acquisition contract.",
        ),
      ],
    };
  }
  const snapshot = options.snapshot;
  const diagnostics: PrivateGitHubCiEvidenceDiagnostic[] = [];
  if (
    !positiveSafeInteger(options.repository.id) ||
    !boundedText(options.repository.fullName, 256) ||
    snapshot.repository.id !== options.repository.id ||
    snapshot.repository.fullName !== options.repository.fullName
  ) {
    diagnostics.push(
      diagnostic(
        "REPOSITORY_MISMATCH",
        "GitHub Check Runs snapshot is bound to another repository.",
      ),
    );
  }
  if (!shaPattern.test(options.headSha) || snapshot.requestedHeadSha !== options.headSha) {
    diagnostics.push(
      diagnostic(
        "HEAD_SHA_MISMATCH",
        "GitHub Check Runs snapshot is not bound to the expected full head SHA.",
      ),
    );
  }

  const acceptedRuns: PrivateGitHubCheckRunObservation[] = [];
  for (const requirement of requirementResult.requirements) {
    const sameName = snapshot.checkRuns.filter(
      (run) => run.name === requirement.name,
    );
    const matches = sameName.filter((run) => run.app.id === requirement.appId);
    if (matches.length === 0) {
      diagnostics.push(
        diagnostic(
          sameName.length === 0
            ? "REQUIRED_CHECK_MISSING"
            : "REQUIRED_CHECK_SOURCE_MISMATCH",
          sameName.length === 0
            ? `Required GitHub Check Run ${requirement.name} is missing.`
            : `Required GitHub Check Run ${requirement.name} was not produced by expected App ${requirement.appId}.`,
          requirement,
        ),
      );
      continue;
    }
    if (matches.length !== 1) {
      diagnostics.push(
        diagnostic(
          "REQUIRED_CHECK_AMBIGUOUS",
          `Required GitHub Check Run ${requirement.name} from App ${requirement.appId} has ${matches.length} observations.`,
          requirement,
        ),
      );
      continue;
    }
    const run = matches[0]!;
    if (run.headSha !== options.headSha) {
      diagnostics.push(
        diagnostic(
          "CHECK_HEAD_MISMATCH",
          `Required GitHub Check Run ${requirement.name} is bound to another head SHA.`,
          requirement,
        ),
      );
      continue;
    }
    if (run.status !== "completed" || run.conclusion === null) {
      diagnostics.push(
        diagnostic(
          "CHECK_INCOMPLETE",
          `Required GitHub Check Run ${requirement.name} is not complete.`,
          requirement,
        ),
      );
      continue;
    }
    if (!passingConclusions.has(run.conclusion)) {
      diagnostics.push(
        diagnostic(
          "CHECK_CONCLUSION_FAILED",
          `Required GitHub Check Run ${requirement.name} concluded ${run.conclusion}.`,
          requirement,
        ),
      );
      continue;
    }
    acceptedRuns.push(run);
  }
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: diagnostics.sort(compareDiagnostics) };
  }

  const normalizedRuns = [...snapshot.checkRuns].sort(
    (left, right) =>
      compareText(left.name, right.name) ||
      left.app.id - right.app.id ||
      left.id - right.id,
  );
  const requiredChecksDigest = createPrivateExecutionPayloadDigest({
    revision: 1,
    source: "github-check-runs",
    requiredChecks: requirementResult.requirements,
  });
  const observationDigest = createPrivateExecutionPayloadDigest({
    revision: snapshot.revision,
    apiVersion: snapshot.apiVersion,
    repository: snapshot.repository,
    requestedHeadSha: snapshot.requestedHeadSha,
    collection: snapshot.collection,
    authorization: snapshot.authorization,
    checkRuns: normalizedRuns,
  });
  const subjectDigest = createPrivateGitHubRevisionSubjectDigest(
    options.repository.id,
    options.headSha,
  );
  try {
    const payloadPackage = createPrivateExecutionPayloadPackage({
      schema: "ci-result@2",
      artifact: "CiResult",
      subjectDigest,
      payload: {
        status: "passed",
        requiredChecksDigest,
        observationDigest,
      },
    });
    const evidenceEnvelope = createPrivateExecutionEvidenceEnvelope(
      options.manifestPackage,
      {
        stepId: options.stepId,
        artifact: "CiResult",
        subjectDigest,
        payloadDigest: payloadPackage.digest,
        producer: {
          responsibility: "steward",
          binding: options.observer.binding,
          principal: options.observer.principal,
          executionContext: options.observer.executionContext,
        },
        enforcement: {
          strength: "guarded",
          mechanism: "github-check-runs-read-with-pinned-app",
        },
      },
    );
    return {
      ok: true,
      subjectDigest,
      payloadPackage,
      evidenceEnvelope,
      receipt: {
        revision: 1,
        adapter: "github-check-runs",
        repositoryId: options.repository.id,
        repositoryFullName: options.repository.fullName,
        headSha: options.headSha,
        requiredChecksDigest,
        observationDigest,
        payloadDigest: payloadPackage.digest,
        envelopeDigest: evidenceEnvelope.digest,
        acceptedCheckRunIds: acceptedRuns.map((run) => run.id).sort((a, b) => a - b),
      },
    };
  } catch {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "EVIDENCE_CREATION_FAILED",
          "GitHub CI observation does not fit the selected execution manifest step.",
        ),
      ],
    };
  }
}
