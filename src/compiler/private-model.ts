import type {
  CandidateConfigDiagnostic,
  CandidatePreset,
  CandidateRole,
  NormalizedCandidateProjectConfig,
} from "../config/candidate.js";
import type {
  ArtifactType,
  PolicyValidationResult,
  PolicyViolation,
  SafetyPolicy,
  WorkflowNodeId,
} from "../policy/model.js";

export interface PrivateTransitionDefinition {
  readonly id: string;
  readonly from: WorkflowNodeId;
  readonly to: WorkflowNodeId;
  readonly role: CandidateRole;
  readonly produces?: readonly ArtifactType[];
  readonly invalidates?: readonly ArtifactType[];
}

export type PrivateCapability = "project-instructions";
export type PrivateEnforcementStrength =
  | "advisory"
  | "guarded"
  | "enforced";

export interface PrivateCapabilityRequirement {
  readonly id: string;
  readonly capability: PrivateCapability;
  readonly providerScope: "all-provider-instances";
  readonly requiredStrength: PrivateEnforcementStrength;
}

export interface PrivateCapabilityAvailability {
  readonly providerId: string;
  readonly capability: PrivateCapability;
  readonly strength: PrivateEnforcementStrength;
  readonly mechanism: string;
}

export interface PrivateCapabilityResolution {
  readonly requirementId: string;
  readonly providerId: string;
  readonly capability: PrivateCapability;
  readonly requiredStrength: PrivateEnforcementStrength;
  readonly observedStrength: PrivateEnforcementStrength;
  readonly mechanism: string;
}

/** Internal built-in definition. This is not a public workflow DSL. */
export interface PrivateWorkflowDefinition {
  readonly id: string;
  readonly revision: number;
  readonly preset: CandidatePreset;
  readonly nodes: readonly WorkflowNodeId[];
  readonly initialNode: WorkflowNodeId;
  readonly artifactTypes: readonly ArtifactType[];
  readonly capabilityRequirements: readonly PrivateCapabilityRequirement[];
  readonly transitions: readonly PrivateTransitionDefinition[];
}

export interface PrivateWorkflowIR {
  readonly definitionId: string;
  readonly definitionRevision: number;
  readonly preset: CandidatePreset;
  readonly nodes: readonly WorkflowNodeId[];
  readonly initialNode: WorkflowNodeId;
  readonly artifactTypes: readonly ArtifactType[];
  readonly capabilityRequirements: readonly PrivateCapabilityRequirement[];
  readonly transitions: readonly PrivateTransitionDefinition[];
  readonly providers: NormalizedCandidateProjectConfig["providers"];
  readonly roleBindings: NormalizedCandidateProjectConfig["roles"];
  readonly tracker: NormalizedCandidateProjectConfig["tracker"];
}

export interface StateSpaceBudgetResult {
  readonly nodeCount: number;
  readonly artifactTypeCount: number;
  readonly theoreticalMaxStates: string;
  readonly configuredMaxStates: number;
}

export type CompilerDiagnostic =
  | {
      readonly stage: "configuration";
      readonly code: `CONFIG_${CandidateConfigDiagnostic["code"]}`;
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly stage: "resolution";
      readonly code:
        | "INVALID_WORKFLOW_DEFINITION"
        | "MISSING_ARTIFACT_TYPE"
        | "PRESET_DEFINITION_MISMATCH";
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly stage: "capability";
      readonly code:
        | "CAPABILITY_STRENGTH_INSUFFICIENT"
        | "CAPABILITY_UNAVAILABLE";
      readonly path: string;
      readonly message: string;
      readonly requirement: PrivateCapabilityRequirement;
      readonly providerId: string;
      readonly availability?: PrivateCapabilityAvailability;
    }
  | {
      readonly stage: "budget";
      readonly code: "STATE_SPACE_BUDGET_EXCEEDED";
      readonly path: "$.workflow";
      readonly message: string;
      readonly budget: StateSpaceBudgetResult;
    }
  | {
      readonly stage: "policy";
      readonly code: "UNSAFE_WORKFLOW";
      readonly path: string;
      readonly message: string;
      readonly violation: PolicyViolation;
    };

export interface CandidateCompilation {
  readonly configDigest: string;
  readonly compilerDigest: string;
  readonly workflow: PrivateWorkflowIR;
  readonly policies: readonly SafetyPolicy[];
  readonly capabilityResolutions: readonly PrivateCapabilityResolution[];
  readonly budget: StateSpaceBudgetResult;
  readonly policyValidation: PolicyValidationResult;
}

export type CandidateCompilationResult =
  | {
      readonly ok: true;
      readonly compilation: CandidateCompilation;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly CompilerDiagnostic[];
    };

export interface CandidateCompilerOptions {
  readonly maxAbstractStates?: number;
  readonly capabilityAvailability?: readonly PrivateCapabilityAvailability[];
}
