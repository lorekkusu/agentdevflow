export type WorkflowNodeId = string;
export type ArtifactType = string;

export interface WorkflowTransition {
  readonly id: string;
  readonly from: WorkflowNodeId;
  readonly to: WorkflowNodeId;
  readonly produces?: readonly ArtifactType[];
  readonly invalidates?: readonly ArtifactType[];
  readonly guard?: string;
}

export interface FiniteWorkflow {
  readonly nodes: readonly WorkflowNodeId[];
  readonly initialNode: WorkflowNodeId;
  readonly initialArtifacts?: readonly ArtifactType[];
  readonly transitions: readonly WorkflowTransition[];
}

export interface RequiresValidArtifactPolicy {
  readonly id: string;
  readonly kind: "requires-valid-artifact";
  readonly at: WorkflowNodeId;
  readonly artifact: ArtifactType;
}

export interface ForbidsValidArtifactPolicy {
  readonly id: string;
  readonly kind: "forbids-valid-artifact";
  readonly at: WorkflowNodeId;
  readonly artifact: ArtifactType;
}

export type SafetyPolicy =
  | RequiresValidArtifactPolicy
  | ForbidsValidArtifactPolicy;

export interface CounterexampleStep {
  readonly transition: string;
  readonly from: WorkflowNodeId;
  readonly to: WorkflowNodeId;
  readonly produces: readonly ArtifactType[];
  readonly invalidates: readonly ArtifactType[];
  readonly guard?: string;
  readonly validArtifactsAfter: readonly ArtifactType[];
}

export interface PolicyViolation {
  readonly code:
    | "MISSING_REQUIRED_ARTIFACT"
    | "FORBIDDEN_ARTIFACT_PRESENT";
  readonly policy: string;
  readonly node: WorkflowNodeId;
  readonly artifact: ArtifactType;
  readonly message: string;
  readonly validArtifacts: readonly ArtifactType[];
  readonly counterexample: readonly CounterexampleStep[];
  readonly guardBlind: boolean;
  readonly limitation?: string;
}

export interface PolicyValidationResult {
  readonly safe: boolean;
  readonly exploredStates: number;
  readonly violations: readonly PolicyViolation[];
}
