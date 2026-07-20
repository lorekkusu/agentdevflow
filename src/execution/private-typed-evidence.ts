import { createHash } from "node:crypto";

import {
  privateDomainEvidenceArtifactBySchema,
  privateDomainEvidenceSchemas,
  type PrivateDomainEvidenceSchema,
} from "../compiler/private-domain-workflow.js";
import type { ArtifactType } from "../policy/model.js";

export const privateExecutionPayloadRevision = 1;

export interface PrivateCiResultPayload {
  readonly status: "failed" | "passed";
  readonly requiredChecksDigest: string;
  readonly observationDigest: string;
}

export interface PrivateMergeAuthorizationPayload {
  readonly evidenceDigest: string;
  readonly mergeMethod: "squash";
}

export interface PrivateReviewVerdictPayload {
  readonly verdict: "approved" | "changes-requested";
  readonly reviewerPrincipal: string;
  readonly reviewerExecutionContext: string;
}

export interface PrivateReviewerIsolationPayload {
  readonly developerPrincipal: string;
  readonly developerExecutionContext: string;
  readonly reviewerPrincipal: string;
  readonly reviewerExecutionContext: string;
  readonly reviewerContextObservedFresh: true;
}

export type PrivateExecutionPayload =
  | PrivateCiResultPayload
  | PrivateMergeAuthorizationPayload
  | PrivateReviewVerdictPayload
  | PrivateReviewerIsolationPayload;

export interface PrivateExecutionPayloadPackage {
  readonly revision: 1;
  readonly schema: PrivateDomainEvidenceSchema;
  readonly artifact: ArtifactType;
  readonly subjectDigest: string;
  readonly payload: PrivateExecutionPayload;
  readonly canonicalJson: string;
  readonly digest: string;
}

export interface CreatePrivateExecutionPayloadPackageOptions {
  readonly schema: PrivateDomainEvidenceSchema;
  readonly artifact: ArtifactType;
  readonly subjectDigest: string;
  readonly payload: unknown;
}

export type PrivateExecutionPayloadValidationResult =
  | { readonly ok: true; readonly package: PrivateExecutionPayloadPackage }
  | { readonly ok: false; readonly message: string };

const sha256Pattern = /^[a-f0-9]{64}$/u;
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.keys(record)
        .sort(compareText)
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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

function boundedText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 512
  );
}

function validPayload(
  schema: PrivateDomainEvidenceSchema,
  payload: unknown,
): payload is PrivateExecutionPayload {
  if (!isRecord(payload)) {
    return false;
  }
  switch (schema) {
    case "ci-result@2":
      return (
        hasExactKeys(payload, [
          "observationDigest",
          "requiredChecksDigest",
          "status",
        ]) &&
        (payload.status === "failed" || payload.status === "passed") &&
        typeof payload.requiredChecksDigest === "string" &&
        sha256Pattern.test(payload.requiredChecksDigest) &&
        typeof payload.observationDigest === "string" &&
        sha256Pattern.test(payload.observationDigest)
      );
    case "merge-authorization@1":
      return (
        hasExactKeys(payload, ["evidenceDigest", "mergeMethod"]) &&
        typeof payload.evidenceDigest === "string" &&
        sha256Pattern.test(payload.evidenceDigest) &&
        payload.mergeMethod === "squash"
      );
    case "review-verdict@1":
      return (
        hasExactKeys(payload, [
          "reviewerExecutionContext",
          "reviewerPrincipal",
          "verdict",
        ]) &&
        (payload.verdict === "approved" ||
          payload.verdict === "changes-requested") &&
        boundedText(payload.reviewerPrincipal) &&
        boundedText(payload.reviewerExecutionContext)
      );
    case "reviewer-isolation@1":
      return (
        hasExactKeys(payload, [
          "developerExecutionContext",
          "developerPrincipal",
          "reviewerContextObservedFresh",
          "reviewerExecutionContext",
          "reviewerPrincipal",
        ]) &&
        boundedText(payload.developerPrincipal) &&
        boundedText(payload.developerExecutionContext) &&
        boundedText(payload.reviewerPrincipal) &&
        boundedText(payload.reviewerExecutionContext) &&
        payload.reviewerContextObservedFresh === true
      );
  }
}

function payloadBase(
  value: {
    readonly revision: 1;
    readonly schema: PrivateDomainEvidenceSchema;
    readonly artifact: ArtifactType;
    readonly subjectDigest: string;
    readonly payload: unknown;
  },
): unknown {
  return {
    revision: value.revision,
    schema: value.schema,
    artifact: value.artifact,
    subjectDigest: value.subjectDigest,
    payload: value.payload,
  };
}

export function validatePrivateExecutionPayloadPackage(
  value: unknown,
): PrivateExecutionPayloadValidationResult {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "artifact",
      "canonicalJson",
      "digest",
      "payload",
      "revision",
      "schema",
      "subjectDigest",
    ]) ||
    value.revision !== privateExecutionPayloadRevision ||
    typeof value.schema !== "string" ||
    !privateDomainEvidenceSchemas.includes(
      value.schema as PrivateDomainEvidenceSchema,
    ) ||
    typeof value.artifact !== "string" ||
    typeof value.subjectDigest !== "string" ||
    !sha256Pattern.test(value.subjectDigest) ||
    typeof value.canonicalJson !== "string" ||
    typeof value.digest !== "string" ||
    !sha256Pattern.test(value.digest)
  ) {
    return { ok: false, message: "Evidence payload package is malformed." };
  }

  const schema = value.schema as PrivateDomainEvidenceSchema;
  if (privateDomainEvidenceArtifactBySchema[schema] !== value.artifact) {
    return {
      ok: false,
      message: `Evidence schema ${schema} does not apply to artifact ${value.artifact}.`,
    };
  }
  if (!validPayload(schema, value.payload)) {
    return {
      ok: false,
      message: `Evidence payload for schema ${schema} is invalid.`,
    };
  }

  const packageWithoutSerialization = {
    revision: privateExecutionPayloadRevision,
    schema,
    artifact: value.artifact,
    subjectDigest: value.subjectDigest,
    payload: value.payload,
  } as const;
  const serialized = canonicalJson(payloadBase(packageWithoutSerialization));
  if (
    value.canonicalJson !== serialized ||
    value.digest !== digestText(serialized)
  ) {
    return {
      ok: false,
      message: "Evidence payload package bytes or digest are inconsistent.",
    };
  }

  return {
    ok: true,
    package: {
      ...packageWithoutSerialization,
      canonicalJson: serialized,
      digest: value.digest,
    },
  };
}

export function createPrivateExecutionPayloadPackage(
  options: CreatePrivateExecutionPayloadPackageOptions,
): PrivateExecutionPayloadPackage {
  if (
    privateDomainEvidenceArtifactBySchema[options.schema] !== options.artifact ||
    !sha256Pattern.test(options.subjectDigest) ||
    !validPayload(options.schema, options.payload)
  ) {
    throw new Error("Private execution payload options are invalid.");
  }
  const packageWithoutSerialization = {
    revision: privateExecutionPayloadRevision,
    schema: options.schema,
    artifact: options.artifact,
    subjectDigest: options.subjectDigest,
    payload: options.payload,
  } as const;
  const serialized = canonicalJson(payloadBase(packageWithoutSerialization));
  const candidate = {
    ...packageWithoutSerialization,
    canonicalJson: serialized,
    digest: digestText(serialized),
  };
  const validated = validatePrivateExecutionPayloadPackage(candidate);
  if (!validated.ok) {
    throw new Error(validated.message);
  }
  return validated.package;
}
