import { createHash } from "node:crypto";

import type { CandidateRole } from "../config/candidate.js";
import {
  compilePrivateDomainWorkflow,
  type PrivateDomainCapabilityResolution,
  type PrivateDomainEvidenceRequirement,
  type PrivateDomainWorkflowCompilation,
  type PrivateDomainWorkflowCompilerOptions,
  type PrivateDomainWorkflowDefinition,
  type PrivateDomainWorkflowDiagnostic,
} from "../compiler/private-domain-workflow.js";
import type {
  ArtifactType,
  SafetyPolicy,
  WorkflowNodeId,
} from "../policy/model.js";
import type { PrivateEnforcementStrength } from "../compiler/private-model.js";
import {
  validatePrivateExecutionPayloadPackage,
  type PrivateExecutionPayloadPackage,
  type PrivateExecutionPayloadValidationResult,
  type PrivateReviewerIsolationPayload,
  type PrivateReviewVerdictPayload,
} from "./private-typed-evidence.js";

export const privateExecutionManifestRevision = 2;
export const privateExecutionEvidenceRevision = 1;
export const privateExecutionTraceRevision = 2;

export interface PrivateExecutionStep {
  readonly id: string;
  readonly from: WorkflowNodeId;
  readonly to: WorkflowNodeId;
  readonly responsibility: CandidateRole;
  readonly produces: readonly ArtifactType[];
  readonly invalidates: readonly ArtifactType[];
  readonly capabilityRequirements: readonly string[];
  readonly guard?: string;
}

export interface PrivateExecutionManifest {
  readonly revision: number;
  readonly compilationDigest: string;
  readonly definition: {
    readonly id: string;
    readonly revision: number;
  };
  readonly initialNode: WorkflowNodeId;
  readonly artifacts: readonly ArtifactType[];
  readonly steps: readonly PrivateExecutionStep[];
  readonly policies: readonly SafetyPolicy[];
  readonly capabilities: readonly PrivateDomainCapabilityResolution[];
  readonly evidenceRequirements: readonly PrivateDomainEvidenceRequirement[];
}

export interface PrivateExecutionManifestPackage {
  readonly manifest: PrivateExecutionManifest;
  readonly canonicalJson: string;
  readonly digest: string;
}

export type PrivateExecutionManifestCompilationResult =
  | {
      readonly ok: true;
      readonly workflow: PrivateDomainWorkflowCompilation;
      readonly package: PrivateExecutionManifestPackage;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainWorkflowDiagnostic[];
    };

export interface PrivateExecutionProducer {
  readonly responsibility: CandidateRole;
  readonly binding: string;
  readonly principal: string;
  readonly executionContext: string;
}

export interface PrivateExecutionEvidenceEnvelope {
  readonly revision: number;
  readonly manifestDigest: string;
  readonly definitionId: string;
  readonly definitionRevision: number;
  readonly stepId: string;
  readonly artifact: ArtifactType;
  readonly subjectDigest: string;
  readonly payloadDigest: string;
  readonly producer: PrivateExecutionProducer;
  readonly enforcement: {
    readonly strength: PrivateEnforcementStrength;
    readonly mechanism: string;
  };
  readonly digest: string;
}

export interface CreatePrivateExecutionEvidenceOptions {
  readonly stepId: string;
  readonly artifact: ArtifactType;
  readonly subjectDigest: string;
  readonly payloadDigest: string;
  readonly producer: PrivateExecutionProducer;
  readonly enforcement: PrivateExecutionEvidenceEnvelope["enforcement"];
}

export interface PrivateExecutionTraceEvent {
  readonly stepId: string;
  readonly subjectDigest: string;
  readonly evidence: readonly PrivateExecutionEvidenceEnvelope[];
  readonly payloads: readonly PrivateExecutionPayloadPackage[];
}

export interface PrivateExecutionTrace {
  readonly revision: number;
  readonly manifestDigest: string;
  readonly events: readonly PrivateExecutionTraceEvent[];
}

export type PrivateExecutionDiagnosticCode =
  | "EVIDENCE_ARTIFACT_DUPLICATED"
  | "EVIDENCE_ENVELOPE_INVALID"
  | "EVIDENCE_MANIFEST_MISMATCH"
  | "EVIDENCE_MISSING"
  | "EVIDENCE_PAYLOAD_DUPLICATED"
  | "EVIDENCE_PAYLOAD_INVALID"
  | "EVIDENCE_PAYLOAD_MISSING"
  | "EVIDENCE_PAYLOAD_PRODUCER_MISMATCH"
  | "EVIDENCE_PAYLOAD_SCHEMA_MISMATCH"
  | "EVIDENCE_PAYLOAD_SUBJECT_MISMATCH"
  | "EVIDENCE_PAYLOAD_UNEXPECTED"
  | "EVIDENCE_RESPONSIBILITY_MISMATCH"
  | "EVIDENCE_STEP_MISMATCH"
  | "EVIDENCE_SUBJECT_MISMATCH"
  | "EVIDENCE_UNEXPECTED"
  | "MANIFEST_PACKAGE_INVALID"
  | "POLICY_FORBIDDEN_ARTIFACT_PRESENT"
  | "POLICY_MISSING_REQUIRED_ARTIFACT"
  | "REVIEWER_ISOLATION_FAILED"
  | "STEP_OUT_OF_ORDER"
  | "STEP_UNKNOWN"
  | "TRACE_EVENT_INVALID"
  | "TRACE_MANIFEST_MISMATCH"
  | "TRACE_REVISION_UNSUPPORTED";

export interface PrivateExecutionDiagnostic {
  readonly code: PrivateExecutionDiagnosticCode;
  readonly message: string;
  readonly eventIndex?: number;
  readonly stepId?: string;
  readonly artifact?: ArtifactType;
}

export type PrivateExecutionTraceResult =
  | {
      readonly ok: true;
      readonly finalNode: WorkflowNodeId;
      readonly activeEvidence: readonly PrivateExecutionEvidenceEnvelope[];
      readonly appliedSteps: readonly string[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateExecutionDiagnostic[];
    };

const sha256Pattern = /^[a-f0-9]{64}$/u;
const responsibilities = new Set<unknown>([
  "developer",
  "reviewer",
  "steward",
]);
const enforcementStrengths = new Set<unknown>([
  "advisory",
  "guarded",
  "enforced",
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

function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function digestValue(value: unknown): string {
  return digestText(canonicalJson(value));
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
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

function manifestFromCompilation(
  compilation: PrivateDomainWorkflowCompilation,
): PrivateExecutionManifest {
  return {
    revision: privateExecutionManifestRevision,
    compilationDigest: compilation.compilationDigest,
    definition: {
      id: compilation.definition.id,
      revision: compilation.definition.revision,
    },
    initialNode: compilation.definition.initialNode,
    artifacts: [...compilation.definition.artifactTypes],
    steps: compilation.definition.transitions.map((transition) => ({
      id: transition.id,
      from: transition.from,
      to: transition.to,
      responsibility: transition.role,
      produces: [...(transition.produces ?? [])],
      invalidates: [...(transition.invalidates ?? [])],
      capabilityRequirements: [
        ...(transition.requiresCapabilities ?? []),
      ],
      ...(transition.guard ? { guard: transition.guard } : {}),
    })),
    policies: [...compilation.definition.policies],
    capabilities: [...compilation.capabilityResolutions],
    evidenceRequirements: [
      ...(compilation.definition.evidenceRequirements ?? []),
    ],
  };
}

export function createPrivateExecutionManifestPackage(
  compilation: PrivateDomainWorkflowCompilation,
): PrivateExecutionManifestPackage {
  const manifest = manifestFromCompilation(compilation);
  const serialized = canonicalJson(manifest);
  return {
    manifest,
    canonicalJson: serialized,
    digest: digestText(serialized),
  };
}

export function compilePrivateExecutionManifest(
  definition: PrivateDomainWorkflowDefinition,
  options: PrivateDomainWorkflowCompilerOptions = {},
): PrivateExecutionManifestCompilationResult {
  const result = compilePrivateDomainWorkflow(definition, options);
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    workflow: result.compilation,
    package: createPrivateExecutionManifestPackage(result.compilation),
  };
}

export function createPrivateExecutionPayloadDigest(value: unknown): string {
  return digestValue(value);
}

function evidenceDigestBase(
  envelope: Omit<PrivateExecutionEvidenceEnvelope, "digest">,
): unknown {
  return {
    revision: envelope.revision,
    manifestDigest: envelope.manifestDigest,
    definitionId: envelope.definitionId,
    definitionRevision: envelope.definitionRevision,
    stepId: envelope.stepId,
    artifact: envelope.artifact,
    subjectDigest: envelope.subjectDigest,
    payloadDigest: envelope.payloadDigest,
    producer: envelope.producer,
    enforcement: envelope.enforcement,
  };
}

function stepById(
  packageValue: PrivateExecutionManifestPackage,
  stepId: string,
): PrivateExecutionStep | undefined {
  return packageValue.manifest.steps.find((step) => step.id === stepId);
}

function validateManifestPackage(
  packageValue: PrivateExecutionManifestPackage,
): string | null {
  if (
    packageValue.manifest.revision !== privateExecutionManifestRevision ||
    !sha256Pattern.test(packageValue.manifest.compilationDigest) ||
    !sha256Pattern.test(packageValue.digest)
  ) {
    return "Private execution manifest package has an unsupported revision or invalid digest.";
  }
  const serialized = canonicalJson(packageValue.manifest);
  if (
    packageValue.canonicalJson !== serialized ||
    packageValue.digest !== digestText(serialized)
  ) {
    return "Private execution manifest package bytes or digest do not match the manifest.";
  }
  return null;
}

export function createPrivateExecutionEvidenceEnvelope(
  packageValue: PrivateExecutionManifestPackage,
  options: CreatePrivateExecutionEvidenceOptions,
): PrivateExecutionEvidenceEnvelope {
  const packageFailure = validateManifestPackage(packageValue);
  if (packageFailure) {
    throw new Error(packageFailure);
  }
  const step = stepById(packageValue, options.stepId);
  if (!step) {
    throw new Error(`Execution step is not declared: ${options.stepId}.`);
  }
  if (!step.produces.includes(options.artifact)) {
    throw new Error(
      `Execution step ${options.stepId} does not produce artifact ${options.artifact}.`,
    );
  }
  if (options.producer.responsibility !== step.responsibility) {
    throw new Error(
      `Execution step ${options.stepId} requires ${step.responsibility} responsibility.`,
    );
  }
  if (
    !sha256Pattern.test(options.subjectDigest) ||
    !sha256Pattern.test(options.payloadDigest) ||
    !nonEmpty(options.producer.binding) ||
    !nonEmpty(options.producer.principal) ||
    !nonEmpty(options.producer.executionContext) ||
    !nonEmpty(options.enforcement.mechanism)
  ) {
    throw new Error("Private execution evidence options are invalid.");
  }
  const base: Omit<PrivateExecutionEvidenceEnvelope, "digest"> = {
    revision: privateExecutionEvidenceRevision,
    manifestDigest: packageValue.digest,
    definitionId: packageValue.manifest.definition.id,
    definitionRevision: packageValue.manifest.definition.revision,
    stepId: options.stepId,
    artifact: options.artifact,
    subjectDigest: options.subjectDigest,
    payloadDigest: options.payloadDigest,
    producer: { ...options.producer },
    enforcement: { ...options.enforcement },
  };
  return { ...base, digest: digestValue(evidenceDigestBase(base)) };
}

function evidenceDiagnostic(
  code: PrivateExecutionDiagnosticCode,
  message: string,
  options: {
    readonly eventIndex?: number;
    readonly stepId?: string;
    readonly artifact?: ArtifactType;
  } = {},
): PrivateExecutionDiagnostic {
  return { code, message, ...options };
}

function validateEvidenceEnvelope(
  packageValue: PrivateExecutionManifestPackage,
  step: PrivateExecutionStep,
  event: PrivateExecutionTraceEvent,
  envelope: PrivateExecutionEvidenceEnvelope,
  eventIndex: number,
): PrivateExecutionDiagnostic[] {
  const context = {
    eventIndex,
    stepId: step.id,
    artifact: envelope.artifact,
  };
  if (
    !hasExactKeys(envelope, [
      "revision",
      "manifestDigest",
      "definitionId",
      "definitionRevision",
      "stepId",
      "artifact",
      "subjectDigest",
      "payloadDigest",
      "producer",
      "enforcement",
      "digest",
    ]) ||
    !hasExactKeys(envelope.producer, [
      "responsibility",
      "binding",
      "principal",
      "executionContext",
    ]) ||
    !hasExactKeys(envelope.enforcement, ["strength", "mechanism"]) ||
    envelope.revision !== privateExecutionEvidenceRevision ||
    !sha256Pattern.test(envelope.subjectDigest) ||
    !sha256Pattern.test(envelope.payloadDigest) ||
    !sha256Pattern.test(envelope.digest) ||
    !nonEmpty(envelope.producer.binding) ||
    !nonEmpty(envelope.producer.principal) ||
    !nonEmpty(envelope.producer.executionContext) ||
    !responsibilities.has(envelope.producer.responsibility) ||
    !enforcementStrengths.has(envelope.enforcement.strength) ||
    !nonEmpty(envelope.enforcement.mechanism) ||
    envelope.digest !==
      digestValue(
        evidenceDigestBase({
          revision: envelope.revision,
          manifestDigest: envelope.manifestDigest,
          definitionId: envelope.definitionId,
          definitionRevision: envelope.definitionRevision,
          stepId: envelope.stepId,
          artifact: envelope.artifact,
          subjectDigest: envelope.subjectDigest,
          payloadDigest: envelope.payloadDigest,
          producer: envelope.producer,
          enforcement: envelope.enforcement,
        }),
      )
  ) {
    return [
      evidenceDiagnostic(
        "EVIDENCE_ENVELOPE_INVALID",
        `Evidence envelope for ${envelope.artifact} is malformed or digest-inconsistent.`,
        context,
      ),
    ];
  }

  const diagnostics: PrivateExecutionDiagnostic[] = [];
  if (
    envelope.manifestDigest !== packageValue.digest ||
    envelope.definitionId !== packageValue.manifest.definition.id ||
    envelope.definitionRevision !== packageValue.manifest.definition.revision
  ) {
    diagnostics.push(
      evidenceDiagnostic(
        "EVIDENCE_MANIFEST_MISMATCH",
        `Evidence envelope for ${envelope.artifact} is bound to another manifest or definition.`,
        context,
      ),
    );
  }
  if (envelope.stepId !== step.id) {
    diagnostics.push(
      evidenceDiagnostic(
        "EVIDENCE_STEP_MISMATCH",
        `Evidence envelope for ${envelope.artifact} is bound to step ${envelope.stepId}, not ${step.id}.`,
        context,
      ),
    );
  }
  if (envelope.subjectDigest !== event.subjectDigest) {
    diagnostics.push(
      evidenceDiagnostic(
        "EVIDENCE_SUBJECT_MISMATCH",
        `Evidence envelope for ${envelope.artifact} is not bound to the event subject digest.`,
        context,
      ),
    );
  }
  if (envelope.producer.responsibility !== step.responsibility) {
    diagnostics.push(
      evidenceDiagnostic(
        "EVIDENCE_RESPONSIBILITY_MISMATCH",
        `Evidence envelope for ${envelope.artifact} uses ${envelope.producer.responsibility} responsibility, but step ${step.id} requires ${step.responsibility}.`,
        context,
      ),
    );
  }
  return diagnostics;
}

function validateTypedPayloadConsistency(
  requirement: PrivateDomainEvidenceRequirement,
  payloadPackage: PrivateExecutionPayloadPackage,
  envelope: PrivateExecutionEvidenceEnvelope,
  activeEvidence: ReadonlyMap<ArtifactType, PrivateExecutionEvidenceEnvelope>,
  eventIndex: number,
  stepId: string,
): PrivateExecutionDiagnostic[] {
  const context = {
    eventIndex,
    stepId,
    artifact: envelope.artifact,
  };
  const diagnostics: PrivateExecutionDiagnostic[] = [];
  if (
    payloadPackage.schema !== requirement.schema ||
    payloadPackage.artifact !== requirement.artifact
  ) {
    diagnostics.push(
      evidenceDiagnostic(
        "EVIDENCE_PAYLOAD_SCHEMA_MISMATCH",
        `Evidence payload for ${envelope.artifact} does not use required schema ${requirement.schema}.`,
        context,
      ),
    );
  }
  if (payloadPackage.subjectDigest !== envelope.subjectDigest) {
    diagnostics.push(
      evidenceDiagnostic(
        "EVIDENCE_PAYLOAD_SUBJECT_MISMATCH",
        `Evidence payload for ${envelope.artifact} is not bound to the envelope subject digest.`,
        context,
      ),
    );
  }
  if (payloadPackage.digest !== envelope.payloadDigest) {
    diagnostics.push(
      evidenceDiagnostic(
        "EVIDENCE_PAYLOAD_INVALID",
        `Evidence payload digest for ${envelope.artifact} does not match the envelope.`,
        context,
      ),
    );
  }

  if (payloadPackage.schema === "review-verdict@1") {
    const payload = payloadPackage.payload as PrivateReviewVerdictPayload;
    if (
      payload.reviewerPrincipal !== envelope.producer.principal ||
      payload.reviewerExecutionContext !==
        envelope.producer.executionContext
    ) {
      diagnostics.push(
        evidenceDiagnostic(
          "EVIDENCE_PAYLOAD_PRODUCER_MISMATCH",
          "Review-verdict payload producer observations do not match the evidence envelope.",
          context,
        ),
      );
    }
  }

  if (payloadPackage.schema === "reviewer-isolation@1") {
    const payload = payloadPackage.payload as PrivateReviewerIsolationPayload;
    if (
      payload.reviewerPrincipal !== envelope.producer.principal ||
      payload.reviewerExecutionContext !==
        envelope.producer.executionContext
    ) {
      diagnostics.push(
        evidenceDiagnostic(
          "EVIDENCE_PAYLOAD_PRODUCER_MISMATCH",
          "Reviewer-isolation payload reviewer observations do not match the evidence envelope.",
          context,
        ),
      );
    }

    const referenceEvidence =
      requirement.referenceArtifact === undefined
        ? undefined
        : activeEvidence.get(requirement.referenceArtifact);
    if (
      referenceEvidence === undefined ||
      referenceEvidence.subjectDigest !== envelope.subjectDigest
    ) {
      diagnostics.push(
        evidenceDiagnostic(
          "REVIEWER_ISOLATION_FAILED",
          "Reviewer isolation requires the configured active change-producer evidence for the same subject.",
          context,
        ),
      );
    } else {
      const developer = referenceEvidence.producer;
      if (
        payload.developerPrincipal !== developer.principal ||
        payload.developerExecutionContext !== developer.executionContext
      ) {
        diagnostics.push(
          evidenceDiagnostic(
            "REVIEWER_ISOLATION_FAILED",
            "Reviewer-isolation payload change-producer observations do not match active evidence.",
            context,
          ),
        );
      }
      if (payload.reviewerPrincipal === developer.principal) {
        diagnostics.push(
          evidenceDiagnostic(
            "REVIEWER_ISOLATION_FAILED",
            "Reviewer principal must differ from the active Developer principal.",
            context,
          ),
        );
      }
      if (payload.reviewerExecutionContext === developer.executionContext) {
        diagnostics.push(
          evidenceDiagnostic(
            "REVIEWER_ISOLATION_FAILED",
            "Reviewer execution context must differ from the active Developer execution context.",
            context,
          ),
        );
      }
    }
  }

  return diagnostics;
}

function compareDiagnostics(
  left: PrivateExecutionDiagnostic,
  right: PrivateExecutionDiagnostic,
): number {
  return (
    (left.eventIndex ?? -1) - (right.eventIndex ?? -1) ||
    compareText(left.code, right.code) ||
    compareText(left.stepId ?? "", right.stepId ?? "") ||
    compareText(left.artifact ?? "", right.artifact ?? "") ||
    compareText(left.message, right.message)
  );
}

export function replayPrivateExecutionTrace(
  packageValue: PrivateExecutionManifestPackage,
  trace: PrivateExecutionTrace,
): PrivateExecutionTraceResult {
  const packageFailure = validateManifestPackage(packageValue);
  if (packageFailure) {
    return {
      ok: false,
      diagnostics: [
        evidenceDiagnostic("MANIFEST_PACKAGE_INVALID", packageFailure),
      ],
    };
  }
  if (trace.revision !== privateExecutionTraceRevision) {
    return {
      ok: false,
      diagnostics: [
        evidenceDiagnostic(
          "TRACE_REVISION_UNSUPPORTED",
          `Unsupported private execution trace revision: ${trace.revision}.`,
        ),
      ],
    };
  }
  if (trace.manifestDigest !== packageValue.digest) {
    return {
      ok: false,
      diagnostics: [
        evidenceDiagnostic(
          "TRACE_MANIFEST_MISMATCH",
          "Private execution trace is bound to another manifest.",
        ),
      ],
    };
  }

  let currentNode = packageValue.manifest.initialNode;
  const activeEvidence = new Map<ArtifactType, PrivateExecutionEvidenceEnvelope>();
  const appliedSteps: string[] = [];
  const policiesByNode = new Map<WorkflowNodeId, SafetyPolicy[]>();
  const evidenceRequirementByArtifact = new Map(
    packageValue.manifest.evidenceRequirements.map((requirement) => [
      requirement.artifact,
      requirement,
    ]),
  );
  for (const policy of packageValue.manifest.policies) {
    const existing = policiesByNode.get(policy.at) ?? [];
    existing.push(policy);
    policiesByNode.set(policy.at, existing);
  }

  for (let eventIndex = 0; eventIndex < trace.events.length; eventIndex += 1) {
    const event = trace.events[eventIndex];
    if (!event) {
      throw new Error("Private execution trace contains a missing event.");
    }
    if (
      !hasExactKeys(event, [
        "evidence",
        "payloads",
        "stepId",
        "subjectDigest",
      ]) ||
      typeof event.stepId !== "string" ||
      !nonEmpty(event.stepId) ||
      !sha256Pattern.test(event.subjectDigest) ||
      !Array.isArray(event.evidence) ||
      !Array.isArray(event.payloads)
    ) {
      return {
        ok: false,
        diagnostics: [
          evidenceDiagnostic(
            "TRACE_EVENT_INVALID",
            `Execution trace event ${eventIndex} is malformed.`,
            { eventIndex, stepId: event.stepId },
          ),
        ],
      };
    }
    const step = stepById(packageValue, event.stepId);
    if (!step) {
      return {
        ok: false,
        diagnostics: [
          evidenceDiagnostic(
            "STEP_UNKNOWN",
            `Execution step is not declared: ${event.stepId}.`,
            { eventIndex, stepId: event.stepId },
          ),
        ],
      };
    }
    if (step.from !== currentNode) {
      return {
        ok: false,
        diagnostics: [
          evidenceDiagnostic(
            "STEP_OUT_OF_ORDER",
            `Execution step ${step.id} starts at ${step.from}, but the trace is at ${currentNode}.`,
            { eventIndex, stepId: step.id },
          ),
        ],
      };
    }

    const eventDiagnostics: PrivateExecutionDiagnostic[] = [];
    const evidenceByArtifact = new Map<ArtifactType, PrivateExecutionEvidenceEnvelope>();
    const payloadByDigest = new Map<
      string,
      PrivateExecutionPayloadValidationResult
    >();
    for (const payloadValue of event.payloads) {
      if (
        !isRecord(payloadValue) ||
        typeof payloadValue.digest !== "string" ||
        !sha256Pattern.test(payloadValue.digest)
      ) {
        eventDiagnostics.push(
          evidenceDiagnostic(
            "EVIDENCE_PAYLOAD_INVALID",
            "Execution event contains a malformed evidence payload package.",
            { eventIndex, stepId: step.id },
          ),
        );
        continue;
      }
      if (payloadByDigest.has(payloadValue.digest)) {
        eventDiagnostics.push(
          evidenceDiagnostic(
            "EVIDENCE_PAYLOAD_DUPLICATED",
            `Execution event contains duplicate payload ${payloadValue.digest}.`,
            { eventIndex, stepId: step.id },
          ),
        );
        continue;
      }
      payloadByDigest.set(
        payloadValue.digest,
        validatePrivateExecutionPayloadPackage(payloadValue),
      );
    }
    for (const envelope of event.evidence) {
      if (
        typeof envelope !== "object" ||
        envelope === null ||
        Array.isArray(envelope) ||
        typeof envelope.artifact !== "string"
      ) {
        eventDiagnostics.push(
          evidenceDiagnostic(
            "EVIDENCE_ENVELOPE_INVALID",
            "Execution event contains a malformed evidence envelope.",
            { eventIndex, stepId: step.id },
          ),
        );
        continue;
      }
      if (evidenceByArtifact.has(envelope.artifact)) {
        eventDiagnostics.push(
          evidenceDiagnostic(
            "EVIDENCE_ARTIFACT_DUPLICATED",
            `Execution event contains duplicate evidence for ${envelope.artifact}.`,
            { eventIndex, stepId: step.id, artifact: envelope.artifact },
          ),
        );
        continue;
      }
      evidenceByArtifact.set(envelope.artifact, envelope);
    }
    for (const artifact of step.produces) {
      if (!evidenceByArtifact.has(artifact)) {
        eventDiagnostics.push(
          evidenceDiagnostic(
            "EVIDENCE_MISSING",
            `Execution step ${step.id} requires produced evidence for ${artifact}.`,
            { eventIndex, stepId: step.id, artifact },
          ),
        );
      }
    }
    for (const envelope of evidenceByArtifact.values()) {
      if (!step.produces.includes(envelope.artifact)) {
        eventDiagnostics.push(
          evidenceDiagnostic(
            "EVIDENCE_UNEXPECTED",
            `Execution step ${step.id} does not produce ${envelope.artifact}.`,
            {
              eventIndex,
              stepId: step.id,
              artifact: envelope.artifact,
            },
          ),
        );
        continue;
      }
      eventDiagnostics.push(
        ...validateEvidenceEnvelope(
          packageValue,
          step,
          event,
          envelope,
          eventIndex,
        ),
      );

      const requirement = evidenceRequirementByArtifact.get(
        envelope.artifact,
      );
      if (requirement !== undefined) {
        const payloadResult = payloadByDigest.get(envelope.payloadDigest);
        if (payloadResult === undefined) {
          eventDiagnostics.push(
            evidenceDiagnostic(
              "EVIDENCE_PAYLOAD_MISSING",
              `Execution event is missing required payload for ${envelope.artifact}.`,
              {
                eventIndex,
                stepId: step.id,
                artifact: envelope.artifact,
              },
            ),
          );
        } else if (!payloadResult.ok) {
          eventDiagnostics.push(
            evidenceDiagnostic(
              "EVIDENCE_PAYLOAD_INVALID",
              payloadResult.message,
              {
                eventIndex,
                stepId: step.id,
                artifact: envelope.artifact,
              },
            ),
          );
        } else {
          eventDiagnostics.push(
            ...validateTypedPayloadConsistency(
              requirement,
              payloadResult.package,
              envelope,
              activeEvidence,
              eventIndex,
              step.id,
            ),
          );
        }
      }
    }
    const referencedPayloadDigests = new Set(
      [...evidenceByArtifact.values()]
        .filter((envelope) =>
          evidenceRequirementByArtifact.has(envelope.artifact),
        )
        .map((envelope) => envelope.payloadDigest),
    );
    for (const [payloadDigest, payloadResult] of payloadByDigest) {
      if (!referencedPayloadDigests.has(payloadDigest)) {
        eventDiagnostics.push(
          evidenceDiagnostic(
            "EVIDENCE_PAYLOAD_UNEXPECTED",
            `Execution event contains unreferenced payload ${payloadDigest}.`,
            {
              eventIndex,
              stepId: step.id,
              ...(payloadResult.ok
                ? { artifact: payloadResult.package.artifact }
                : {}),
            },
          ),
        );
      }
    }
    if (eventDiagnostics.length > 0) {
      return {
        ok: false,
        diagnostics: eventDiagnostics.sort(compareDiagnostics),
      };
    }

    for (const artifact of step.invalidates) {
      activeEvidence.delete(artifact);
    }
    for (const [artifact, envelope] of evidenceByArtifact) {
      activeEvidence.set(artifact, envelope);
    }
    currentNode = step.to;
    appliedSteps.push(step.id);

    const policyDiagnostics: PrivateExecutionDiagnostic[] = [];
    for (const policy of policiesByNode.get(currentNode) ?? []) {
      const present = activeEvidence.has(policy.artifact);
      if (policy.kind === "requires-valid-artifact" && !present) {
        policyDiagnostics.push(
          evidenceDiagnostic(
            "POLICY_MISSING_REQUIRED_ARTIFACT",
            `Policy ${policy.id} requires active ${policy.artifact} at ${currentNode}.`,
            {
              eventIndex,
              stepId: step.id,
              artifact: policy.artifact,
            },
          ),
        );
      }
      if (policy.kind === "forbids-valid-artifact" && present) {
        policyDiagnostics.push(
          evidenceDiagnostic(
            "POLICY_FORBIDDEN_ARTIFACT_PRESENT",
            `Policy ${policy.id} forbids active ${policy.artifact} at ${currentNode}.`,
            {
              eventIndex,
              stepId: step.id,
              artifact: policy.artifact,
            },
          ),
        );
      }
    }
    if (policyDiagnostics.length > 0) {
      return {
        ok: false,
        diagnostics: policyDiagnostics.sort(compareDiagnostics),
      };
    }
  }

  return {
    ok: true,
    finalNode: currentNode,
    activeEvidence: [...activeEvidence.values()].sort((left, right) =>
      compareText(left.artifact, right.artifact),
    ),
    appliedSteps,
  };
}
