import type { ArtifactType, WorkflowNodeId } from "../policy/model.js";
import type { PrivateDomainCapabilityObservation } from "../compiler/private-domain-workflow.js";
import {
  createPrivateExecutionManifestPackage,
  replayPrivateExecutionTrace,
  type PrivateExecutionDiagnostic,
} from "../execution/private-execution-contract.js";
import {
  parsePrivateExecutionTrace,
  type PrivateExecutionTransportDiagnostic,
  type PrivateExecutionTransportLimits,
} from "../execution/private-execution-transport.js";
import {
  compilePrivateDomainProjectDocument,
  type PrivateDomainProjectDocumentDiagnostic,
  type PrivateDomainProjectDocumentLimits,
} from "../interface/private-domain-project-document.js";

export const privateCompiledPolicyConsumerRevision = 1;

export interface PrivateCompiledPolicyConsumerOptions
  extends PrivateDomainProjectDocumentLimits {
  readonly capabilityObservations: readonly PrivateDomainCapabilityObservation[];
  readonly traceBytes: Uint8Array;
  readonly traceLimits?: PrivateExecutionTransportLimits;
}

export type PrivateCompiledPolicyConsumerDiagnostic =
  | {
      readonly stage: "project";
      readonly diagnostic: PrivateDomainProjectDocumentDiagnostic;
    }
  | {
      readonly stage: "trace-transport";
      readonly diagnostic: PrivateExecutionTransportDiagnostic;
    }
  | {
      readonly stage: "policy";
      readonly diagnostic: PrivateExecutionDiagnostic;
    };

export type PrivateCompiledPolicyConsumerResult =
  | {
      readonly ok: true;
      readonly outcome: "trace-valid";
      readonly revision: 1;
      readonly project: {
        readonly contentDigest: string;
        readonly resolutionDigest: string;
        readonly workflowFamily:
          | "issue-to-reviewed-pull-request"
          | "local-reviewed-change";
        readonly definitionId: string;
        readonly definitionRevision: number;
        readonly compilationDigest: string;
      };
      readonly manifestDigest: string;
      readonly trace: {
        readonly contentDigest: string;
        readonly finalNode: WorkflowNodeId;
        readonly appliedSteps: readonly string[];
        readonly activeArtifacts: readonly ArtifactType[];
      };
    }
  | {
      readonly ok: false;
      readonly outcome: "blocked";
      readonly revision: 1;
      readonly diagnostics: readonly PrivateCompiledPolicyConsumerDiagnostic[];
    };

export function evaluatePrivateCompiledPolicy(
  projectDocumentContent: string,
  options: PrivateCompiledPolicyConsumerOptions,
): PrivateCompiledPolicyConsumerResult {
  const project = compilePrivateDomainProjectDocument(projectDocumentContent, {
    capabilityObservations: options.capabilityObservations,
    ...(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes }),
    ...(options.maxNestingDepth === undefined
      ? {}
      : { maxNestingDepth: options.maxNestingDepth }),
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
  });
  if (!project.ok) {
    return {
      ok: false,
      outcome: "blocked",
      revision: privateCompiledPolicyConsumerRevision,
      diagnostics: project.diagnostics.map((diagnostic) => ({
        stage: "project",
        diagnostic,
      })),
    };
  }

  const trace = parsePrivateExecutionTrace(
    options.traceBytes,
    options.traceLimits,
  );
  if (!trace.ok) {
    return {
      ok: false,
      outcome: "blocked",
      revision: privateCompiledPolicyConsumerRevision,
      diagnostics: trace.diagnostics.map((diagnostic) => ({
        stage: "trace-transport",
        diagnostic,
      })),
    };
  }

  const manifestPackage = createPrivateExecutionManifestPackage(
    project.project.workflowCompilation,
  );
  const replay = replayPrivateExecutionTrace(manifestPackage, trace.value);
  if (!replay.ok) {
    return {
      ok: false,
      outcome: "blocked",
      revision: privateCompiledPolicyConsumerRevision,
      diagnostics: replay.diagnostics.map((diagnostic) => ({
        stage: "policy",
        diagnostic,
      })),
    };
  }

  return {
    ok: true,
    outcome: "trace-valid",
    revision: privateCompiledPolicyConsumerRevision,
    project: {
      contentDigest: project.document.contentDigest,
      resolutionDigest: project.project.resolutionDigest,
      workflowFamily: project.project.resolution.workflow.family,
      definitionId: project.project.resolution.workflow.definitionId,
      definitionRevision: project.project.resolution.workflow.definitionRevision,
      compilationDigest: project.project.resolution.workflow.compilationDigest,
    },
    manifestDigest: manifestPackage.digest,
    trace: {
      contentDigest: trace.contentDigest,
      finalNode: replay.finalNode,
      appliedSteps: replay.appliedSteps,
      activeArtifacts: replay.activeEvidence.map(
        (envelope) => envelope.artifact,
      ),
    },
  };
}
