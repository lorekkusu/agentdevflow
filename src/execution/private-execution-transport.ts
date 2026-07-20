import { createHash } from "node:crypto";

import { candidateRoles } from "../config/candidate.js";
import {
  privateDomainEvidenceArtifactBySchema,
  privateDomainEvidenceSchemas,
} from "../compiler/private-domain-workflow.js";
import {
  privateExecutionEvidenceRevision,
  privateExecutionManifestRevision,
  privateExecutionTraceRevision,
  type PrivateExecutionEvidenceEnvelope,
  type PrivateExecutionManifestPackage,
  type PrivateExecutionTrace,
} from "./private-execution-contract.js";
import {
  validatePrivateExecutionPayloadPackage,
  type PrivateExecutionPayloadPackage,
} from "./private-typed-evidence.js";

export const privateExecutionTransportDefaultMaxBytes = 2_097_152;
export const privateExecutionTransportDefaultMaxNestingDepth = 32;
export const privateExecutionTransportDefaultMaxValues = 32_768;

export interface PrivateExecutionTransportLimits {
  readonly maxBytes?: number;
  readonly maxNestingDepth?: number;
  readonly maxValues?: number;
}

export type PrivateExecutionTransportDiagnosticCode =
  | "TRANSPORT_INVALID_UTF8"
  | "TRANSPORT_NESTING_LIMIT_EXCEEDED"
  | "TRANSPORT_NON_CANONICAL"
  | "TRANSPORT_SYNTAX_INVALID"
  | "TRANSPORT_TOO_LARGE"
  | "TRANSPORT_UNSAFE_PROPERTY_NAME"
  | "TRANSPORT_VALUE_INVALID"
  | "TRANSPORT_VALUE_LIMIT_EXCEEDED";

export interface PrivateExecutionTransportDiagnostic {
  readonly code: PrivateExecutionTransportDiagnosticCode;
  readonly message: string;
}

export type PrivateExecutionTransportResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly bytes: Uint8Array;
      readonly byteLength: number;
      readonly contentDigest: string;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateExecutionTransportDiagnostic[];
    };

type Validator<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

const sha256Pattern = /^[a-f0-9]{64}$/u;
const roles = new Set<unknown>(candidateRoles);
const enforcementStrengths = new Set<unknown>([
  "advisory",
  "guarded",
  "enforced",
]);
const policyKinds = new Set<unknown>([
  "forbids-valid-artifact",
  "requires-valid-artifact",
]);

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

function digestBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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

function boundedText(value: unknown, maxLength = 512): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => boundedText(item));
}

function sortedUniqueTextArray(value: unknown): value is readonly string[] {
  return (
    stringArray(value) &&
    value.every((item, index) => index === 0 || value[index - 1]! < item)
  );
}

function checkedLimit(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return selected;
}

function diagnostic(
  code: PrivateExecutionTransportDiagnosticCode,
  message: string,
): PrivateExecutionTransportResult<never> {
  return { ok: false, diagnostics: [{ code, message }] };
}

function inspectParsedValue(
  root: unknown,
  maxNestingDepth: number,
  maxValues: number,
): PrivateExecutionTransportDiagnostic | undefined {
  const pending: { readonly value: unknown; readonly depth: number }[] = [
    { value: root, depth: 1 },
  ];
  let valueCount = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    valueCount += 1;
    if (valueCount > maxValues) {
      return {
        code: "TRANSPORT_VALUE_LIMIT_EXCEEDED",
        message: `Private execution transport exceeds the configured value limit ${maxValues}.`,
      };
    }
    if (current.depth > maxNestingDepth) {
      return {
        code: "TRANSPORT_NESTING_LIMIT_EXCEEDED",
        message: `Private execution transport exceeds the configured nesting limit ${maxNestingDepth}.`,
      };
    }
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        pending.push({
          value: current.value[index],
          depth: current.depth + 1,
        });
      }
      continue;
    }
    if (isRecord(current.value)) {
      const keys = Object.keys(current.value).sort(compareText);
      if (keys.includes("__proto__")) {
        return {
          code: "TRANSPORT_UNSAFE_PROPERTY_NAME",
          message: "Private execution transport does not accept the __proto__ property.",
        };
      }
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index];
        if (key !== undefined) {
          pending.push({
            value: current.value[key],
            depth: current.depth + 1,
          });
        }
      }
    }
  }
  return undefined;
}

function validateStep(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const expected = [
    "capabilityRequirements",
    "from",
    "id",
    "invalidates",
    "produces",
    "responsibility",
    "to",
    ...(value.guard === undefined ? [] : ["guard"]),
  ];
  return (
    hasExactKeys(value, expected) &&
    boundedText(value.id) &&
    boundedText(value.from) &&
    boundedText(value.to) &&
    roles.has(value.responsibility) &&
    sortedUniqueTextArray(value.produces) &&
    sortedUniqueTextArray(value.invalidates) &&
    sortedUniqueTextArray(value.capabilityRequirements) &&
    (value.guard === undefined || boundedText(value.guard))
  );
}

function validatePolicy(value: unknown): boolean {
  return (
    hasExactKeys(value, ["artifact", "at", "id", "kind"]) &&
    isRecord(value) &&
    boundedText(value.id) &&
    policyKinds.has(value.kind) &&
    boundedText(value.at) &&
    boundedText(value.artifact)
  );
}

function validateCapability(value: unknown): boolean {
  return (
    hasExactKeys(value, [
      "binding",
      "capability",
      "mechanism",
      "observedStrength",
      "requiredStrength",
      "requirementId",
    ]) &&
    isRecord(value) &&
    boundedText(value.requirementId) &&
    boundedText(value.binding) &&
    boundedText(value.capability) &&
    enforcementStrengths.has(value.requiredStrength) &&
    enforcementStrengths.has(value.observedStrength) &&
    boundedText(value.mechanism)
  );
}

function validateEvidenceRequirement(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const expected = [
    "artifact",
    "id",
    "schema",
    ...(value.referenceArtifact === undefined ? [] : ["referenceArtifact"]),
  ];
  return (
    hasExactKeys(value, expected) &&
    boundedText(value.id) &&
    boundedText(value.artifact) &&
    typeof value.schema === "string" &&
    privateDomainEvidenceSchemas.includes(
      value.schema as (typeof privateDomainEvidenceSchemas)[number],
    ) &&
    (value.referenceArtifact === undefined ||
      boundedText(value.referenceArtifact)) &&
    privateDomainEvidenceArtifactBySchema[
      value.schema as (typeof privateDomainEvidenceSchemas)[number]
    ] === value.artifact &&
    ((value.schema === "reviewer-isolation@1" &&
      value.referenceArtifact !== undefined) ||
      (value.schema !== "reviewer-isolation@1" &&
        value.referenceArtifact === undefined))
  );
}

function validateManifestPackage(
  value: unknown,
): Validator<PrivateExecutionManifestPackage> {
  if (
    !hasExactKeys(value, ["canonicalJson", "digest", "manifest"]) ||
    !isRecord(value) ||
    typeof value.canonicalJson !== "string" ||
    typeof value.digest !== "string" ||
    !sha256Pattern.test(value.digest) ||
    !hasExactKeys(value.manifest, [
      "artifacts",
      "capabilities",
      "compilationDigest",
      "definition",
      "evidenceRequirements",
      "initialNode",
      "policies",
      "revision",
      "steps",
    ]) ||
    !isRecord(value.manifest)
  ) {
    return { ok: false, message: "Execution manifest package shape is invalid." };
  }
  const manifest = value.manifest;
  if (
    manifest.revision !== privateExecutionManifestRevision ||
    typeof manifest.compilationDigest !== "string" ||
    !sha256Pattern.test(manifest.compilationDigest) ||
    !hasExactKeys(manifest.definition, ["id", "revision"]) ||
    !isRecord(manifest.definition) ||
    !boundedText(manifest.definition.id) ||
    !positiveSafeInteger(manifest.definition.revision) ||
    !boundedText(manifest.initialNode) ||
    !sortedUniqueTextArray(manifest.artifacts) ||
    !Array.isArray(manifest.steps) ||
    !manifest.steps.every(validateStep) ||
    !Array.isArray(manifest.policies) ||
    !manifest.policies.every(validatePolicy) ||
    !Array.isArray(manifest.capabilities) ||
    !manifest.capabilities.every(validateCapability) ||
    !Array.isArray(manifest.evidenceRequirements) ||
    !manifest.evidenceRequirements.every(validateEvidenceRequirement)
  ) {
    return { ok: false, message: "Execution manifest value is invalid." };
  }
  const artifacts = manifest.artifacts as readonly string[];
  const steps = manifest.steps as readonly Readonly<Record<string, unknown>>[];
  const policies = manifest.policies as readonly Readonly<Record<string, unknown>>[];
  const capabilities = manifest.capabilities as readonly Readonly<
    Record<string, unknown>
  >[];
  const evidenceRequirements = manifest.evidenceRequirements as readonly Readonly<
    Record<string, unknown>
  >[];
  const artifactSet = new Set(artifacts);
  const stepIds = steps.map((step) => step.id as string);
  const policyIds = policies.map((policy) => policy.id as string);
  const capabilityIds = capabilities.map(
    (capability) => capability.requirementId as string,
  );
  const requirementIds = evidenceRequirements.map(
    (requirement) => requirement.id as string,
  );
  const requirementArtifacts = evidenceRequirements.map(
    (requirement) => requirement.artifact as string,
  );
  const isSortedById = (values: readonly string[]): boolean =>
    values.every((item, index) => index === 0 || values[index - 1]! < item);
  const capabilitiesSorted = capabilities.every((capability, index) => {
    if (index === 0) return true;
    const previous = capabilities[index - 1]!;
    const previousKey = `${String(previous.binding)}\u0000${String(previous.requirementId)}`;
    const currentKey = `${String(capability.binding)}\u0000${String(capability.requirementId)}`;
    return previousKey < currentKey;
  });
  const capabilitySet = new Set(capabilityIds);
  const nodeSet = new Set<string>([manifest.initialNode as string]);
  for (const step of steps) {
    nodeSet.add(step.from as string);
    nodeSet.add(step.to as string);
  }
  if (
    !isSortedById(stepIds) ||
    !isSortedById(policyIds) ||
    !isSortedById(requirementIds) ||
    new Set(capabilityIds).size !== capabilityIds.length ||
    new Set(requirementArtifacts).size !== requirementArtifacts.length ||
    !capabilitiesSorted ||
    steps.some(
      (step) =>
        (step.produces as readonly string[]).some(
          (artifact) => !artifactSet.has(artifact),
        ) ||
        (step.invalidates as readonly string[]).some(
          (artifact) => !artifactSet.has(artifact),
        ) ||
        (step.capabilityRequirements as readonly string[]).some(
          (requirementId) => !capabilitySet.has(requirementId),
        ),
    ) ||
    policies.some(
      (policy) =>
        !artifactSet.has(policy.artifact as string) ||
        !nodeSet.has(policy.at as string),
    ) ||
    evidenceRequirements.some(
      (requirement) =>
        !artifactSet.has(requirement.artifact as string) ||
        (requirement.referenceArtifact !== undefined &&
          !artifactSet.has(requirement.referenceArtifact as string)),
    )
  ) {
    return {
      ok: false,
      message: "Execution manifest normalization or references are invalid.",
    };
  }
  const manifestJson = canonicalJson(manifest);
  if (
    value.canonicalJson !== manifestJson ||
    value.digest !== digestText(manifestJson)
  ) {
    return {
      ok: false,
      message: "Execution manifest package bytes or digest are inconsistent.",
    };
  }
  return { ok: true, value: value as unknown as PrivateExecutionManifestPackage };
}

function evidenceDigestBase(value: Readonly<Record<string, unknown>>): unknown {
  return {
    revision: value.revision,
    manifestDigest: value.manifestDigest,
    definitionId: value.definitionId,
    definitionRevision: value.definitionRevision,
    stepId: value.stepId,
    artifact: value.artifact,
    subjectDigest: value.subjectDigest,
    payloadDigest: value.payloadDigest,
    producer: value.producer,
    enforcement: value.enforcement,
  };
}

function validateEvidenceEnvelope(
  value: unknown,
): Validator<PrivateExecutionEvidenceEnvelope> {
  if (
    !hasExactKeys(value, [
      "artifact",
      "definitionId",
      "definitionRevision",
      "digest",
      "enforcement",
      "manifestDigest",
      "payloadDigest",
      "producer",
      "revision",
      "stepId",
      "subjectDigest",
    ]) ||
    !isRecord(value) ||
    !hasExactKeys(value.producer, [
      "binding",
      "executionContext",
      "principal",
      "responsibility",
    ]) ||
    !isRecord(value.producer) ||
    !hasExactKeys(value.enforcement, ["mechanism", "strength"]) ||
    !isRecord(value.enforcement) ||
    value.revision !== privateExecutionEvidenceRevision ||
    typeof value.manifestDigest !== "string" ||
    !sha256Pattern.test(value.manifestDigest) ||
    !boundedText(value.definitionId) ||
    !positiveSafeInteger(value.definitionRevision) ||
    !boundedText(value.stepId) ||
    !boundedText(value.artifact) ||
    typeof value.subjectDigest !== "string" ||
    !sha256Pattern.test(value.subjectDigest) ||
    typeof value.payloadDigest !== "string" ||
    !sha256Pattern.test(value.payloadDigest) ||
    !roles.has(value.producer.responsibility) ||
    !boundedText(value.producer.binding) ||
    !boundedText(value.producer.principal) ||
    !boundedText(value.producer.executionContext) ||
    !enforcementStrengths.has(value.enforcement.strength) ||
    !boundedText(value.enforcement.mechanism) ||
    typeof value.digest !== "string" ||
    !sha256Pattern.test(value.digest)
  ) {
    return { ok: false, message: "Execution evidence envelope shape is invalid." };
  }
  if (value.digest !== digestText(canonicalJson(evidenceDigestBase(value)))) {
    return {
      ok: false,
      message: "Execution evidence envelope digest is inconsistent.",
    };
  }
  return { ok: true, value: value as unknown as PrivateExecutionEvidenceEnvelope };
}

function validatePayloadPackage(
  value: unknown,
): Validator<PrivateExecutionPayloadPackage> {
  const result = validatePrivateExecutionPayloadPackage(value);
  return result.ok
    ? { ok: true, value: result.package }
    : { ok: false, message: result.message };
}

function validateTrace(value: unknown): Validator<PrivateExecutionTrace> {
  if (
    !hasExactKeys(value, ["events", "manifestDigest", "revision"]) ||
    !isRecord(value) ||
    value.revision !== privateExecutionTraceRevision ||
    typeof value.manifestDigest !== "string" ||
    !sha256Pattern.test(value.manifestDigest) ||
    !Array.isArray(value.events)
  ) {
    return { ok: false, message: "Execution trace shape is invalid." };
  }
  for (const event of value.events) {
    if (
      !hasExactKeys(event, ["evidence", "payloads", "stepId", "subjectDigest"]) ||
      !isRecord(event) ||
      !boundedText(event.stepId) ||
      typeof event.subjectDigest !== "string" ||
      !sha256Pattern.test(event.subjectDigest) ||
      !Array.isArray(event.evidence) ||
      !Array.isArray(event.payloads)
    ) {
      return { ok: false, message: "Execution trace event shape is invalid." };
    }
    for (const envelope of event.evidence) {
      const result = validateEvidenceEnvelope(envelope);
      if (!result.ok) return result;
    }
    for (const payloadPackage of event.payloads) {
      const result = validatePayloadPackage(payloadPackage);
      if (!result.ok) return result;
    }
  }
  return { ok: true, value: value as unknown as PrivateExecutionTrace };
}

function parseTransport<T>(
  bytes: Uint8Array,
  validator: (value: unknown) => Validator<T>,
  limits: PrivateExecutionTransportLimits,
): PrivateExecutionTransportResult<T> {
  const maxBytes = checkedLimit(
    limits.maxBytes,
    privateExecutionTransportDefaultMaxBytes,
    "maxBytes",
  );
  const maxNestingDepth = checkedLimit(
    limits.maxNestingDepth,
    privateExecutionTransportDefaultMaxNestingDepth,
    "maxNestingDepth",
  );
  const maxValues = checkedLimit(
    limits.maxValues,
    privateExecutionTransportDefaultMaxValues,
    "maxValues",
  );
  if (!(bytes instanceof Uint8Array)) {
    return diagnostic(
      "TRANSPORT_VALUE_INVALID",
      "Private execution transport input must be a Uint8Array.",
    );
  }
  if (bytes.byteLength > maxBytes) {
    return diagnostic(
      "TRANSPORT_TOO_LARGE",
      `Private execution transport is ${bytes.byteLength} bytes, exceeding the configured limit ${maxBytes}.`,
    );
  }

  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return diagnostic(
      "TRANSPORT_INVALID_UTF8",
      "Private execution transport is not valid UTF-8.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return diagnostic(
      "TRANSPORT_SYNTAX_INVALID",
      "Private execution transport is not valid strict JSON.",
    );
  }
  const inspectionFailure = inspectParsedValue(
    parsed,
    maxNestingDepth,
    maxValues,
  );
  if (inspectionFailure !== undefined) {
    return { ok: false, diagnostics: [inspectionFailure] };
  }
  let canonical: string;
  try {
    canonical = canonicalJson(parsed);
  } catch {
    return diagnostic(
      "TRANSPORT_VALUE_INVALID",
      "Private execution transport value cannot be canonicalized.",
    );
  }
  if (content !== canonical) {
    return diagnostic(
      "TRANSPORT_NON_CANONICAL",
      "Private execution transport bytes are valid JSON but not exact canonical JSON.",
    );
  }
  let validated: Validator<T>;
  try {
    validated = validator(parsed);
  } catch {
    return diagnostic(
      "TRANSPORT_VALUE_INVALID",
      "Private execution transport value is malformed.",
    );
  }
  if (!validated.ok) {
    return diagnostic("TRANSPORT_VALUE_INVALID", validated.message);
  }
  return {
    ok: true,
    value: validated.value,
    bytes: new Uint8Array(bytes),
    byteLength: bytes.byteLength,
    contentDigest: digestBytes(bytes),
  };
}

function serializeTransport<T>(
  value: T,
  validator: (candidate: unknown) => Validator<T>,
  limits: PrivateExecutionTransportLimits,
): PrivateExecutionTransportResult<T> {
  let validated: Validator<T>;
  try {
    validated = validator(value);
  } catch {
    return diagnostic(
      "TRANSPORT_VALUE_INVALID",
      "Private execution transport value is malformed.",
    );
  }
  if (!validated.ok) {
    return diagnostic("TRANSPORT_VALUE_INVALID", validated.message);
  }
  let content: string;
  try {
    content = canonicalJson(validated.value);
  } catch {
    return diagnostic(
      "TRANSPORT_VALUE_INVALID",
      "Private execution transport value cannot be canonicalized.",
    );
  }
  return parseTransport(new TextEncoder().encode(content), validator, limits);
}

export function serializePrivateExecutionManifestPackage(
  value: PrivateExecutionManifestPackage,
  limits: PrivateExecutionTransportLimits = {},
): PrivateExecutionTransportResult<PrivateExecutionManifestPackage> {
  return serializeTransport(value, validateManifestPackage, limits);
}

export function parsePrivateExecutionManifestPackage(
  bytes: Uint8Array,
  limits: PrivateExecutionTransportLimits = {},
): PrivateExecutionTransportResult<PrivateExecutionManifestPackage> {
  return parseTransport(bytes, validateManifestPackage, limits);
}

export function serializePrivateExecutionPayloadPackage(
  value: PrivateExecutionPayloadPackage,
  limits: PrivateExecutionTransportLimits = {},
): PrivateExecutionTransportResult<PrivateExecutionPayloadPackage> {
  return serializeTransport(value, validatePayloadPackage, limits);
}

export function parsePrivateExecutionPayloadPackage(
  bytes: Uint8Array,
  limits: PrivateExecutionTransportLimits = {},
): PrivateExecutionTransportResult<PrivateExecutionPayloadPackage> {
  return parseTransport(bytes, validatePayloadPackage, limits);
}

export function serializePrivateExecutionEvidenceEnvelope(
  value: PrivateExecutionEvidenceEnvelope,
  limits: PrivateExecutionTransportLimits = {},
): PrivateExecutionTransportResult<PrivateExecutionEvidenceEnvelope> {
  return serializeTransport(value, validateEvidenceEnvelope, limits);
}

export function parsePrivateExecutionEvidenceEnvelope(
  bytes: Uint8Array,
  limits: PrivateExecutionTransportLimits = {},
): PrivateExecutionTransportResult<PrivateExecutionEvidenceEnvelope> {
  return parseTransport(bytes, validateEvidenceEnvelope, limits);
}

export function serializePrivateExecutionTrace(
  value: PrivateExecutionTrace,
  limits: PrivateExecutionTransportLimits = {},
): PrivateExecutionTransportResult<PrivateExecutionTrace> {
  return serializeTransport(value, validateTrace, limits);
}

export function parsePrivateExecutionTrace(
  bytes: Uint8Array,
  limits: PrivateExecutionTransportLimits = {},
): PrivateExecutionTransportResult<PrivateExecutionTrace> {
  return parseTransport(bytes, validateTrace, limits);
}
