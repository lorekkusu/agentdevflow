import { createHash } from "node:crypto";

import type { CandidateRole } from "../config/candidate.js";
import type {
  ArtifactType,
  PolicyValidationResult,
  PolicyViolation,
  SafetyPolicy,
  WorkflowNodeId,
  WorkflowTransition,
} from "../policy/model.js";
import { validatePolicySafety } from "../policy/validator.js";

export interface PrivateDomainTransition {
  readonly id: string;
  readonly from: WorkflowNodeId;
  readonly to: WorkflowNodeId;
  readonly role: CandidateRole;
  readonly produces?: readonly ArtifactType[];
  readonly invalidates?: readonly ArtifactType[];
  readonly requiresCapabilities?: readonly string[];
  readonly guard?: string;
}

export interface PrivateDomainCapabilityRequirement {
  readonly id: string;
  readonly binding: string;
  readonly capability: string;
}

export interface PrivateDomainCapabilityObservation {
  readonly binding: string;
  readonly capability: string;
  readonly mechanism: string;
}

export interface PrivateDomainCapabilityResolution {
  readonly requirementId: string;
  readonly binding: string;
  readonly capability: string;
  readonly mechanism: string;
}

/** Internal domain fixture. This is not a public workflow definition format. */
export interface PrivateDomainWorkflowDefinition {
  readonly id: string;
  readonly revision: number;
  readonly nodes: readonly WorkflowNodeId[];
  readonly initialNode: WorkflowNodeId;
  readonly artifactTypes: readonly ArtifactType[];
  readonly transitions: readonly PrivateDomainTransition[];
  readonly policies: readonly SafetyPolicy[];
  readonly capabilityRequirements: readonly PrivateDomainCapabilityRequirement[];
}

export interface PrivateDomainWorkflowBudget {
  readonly nodeCount: number;
  readonly artifactTypeCount: number;
  readonly theoreticalMaxStates: string;
  readonly configuredMaxStates: number;
}

export type PrivateDomainWorkflowDiagnostic =
  | {
      readonly stage: "definition";
      readonly code: "INVALID_WORKFLOW_DEFINITION";
      readonly path: "$.workflow";
      readonly message: string;
    }
  | {
      readonly stage: "capability";
      readonly code:
        | "CAPABILITY_OBSERVATION_INVALID"
        | "CAPABILITY_OBSERVATION_DUPLICATED"
        | "CAPABILITY_UNAVAILABLE";
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly stage: "budget";
      readonly code: "STATE_SPACE_BUDGET_EXCEEDED";
      readonly path: "$.workflow";
      readonly message: string;
      readonly budget: PrivateDomainWorkflowBudget;
    }
  | {
      readonly stage: "policy";
      readonly code: "UNSAFE_WORKFLOW";
      readonly path: string;
      readonly message: string;
      readonly violation: PolicyViolation;
    };

export interface PrivateDomainWorkflowCompilation {
  readonly definition: PrivateDomainWorkflowDefinition;
  readonly capabilityResolutions: readonly PrivateDomainCapabilityResolution[];
  readonly budget: PrivateDomainWorkflowBudget;
  readonly policyValidation: PolicyValidationResult;
  readonly compilationDigest: string;
}

export type PrivateDomainWorkflowCompilationResult =
  | {
      readonly ok: true;
      readonly compilation: PrivateDomainWorkflowCompilation;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainWorkflowDiagnostic[];
    };

export interface PrivateDomainWorkflowCompilerOptions {
  readonly maxAbstractStates?: number;
  readonly capabilityObservations?: readonly PrivateDomainCapabilityObservation[];
}

const defaultMaxAbstractStates = 32_768;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
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

function digest(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
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

function boundedNonEmptyText(
  value: unknown,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isCapabilityObservation(
  value: unknown,
): value is PrivateDomainCapabilityObservation {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["binding", "capability", "mechanism"])
  ) {
    return false;
  }
  return (
    boundedNonEmptyText(value.binding, 128) &&
    boundedNonEmptyText(value.capability, 128) &&
    boundedNonEmptyText(value.mechanism, 512)
  );
}

function validateDefinition(
  definition: PrivateDomainWorkflowDefinition,
): PrivateDomainWorkflowDiagnostic[] {
  const diagnostics: PrivateDomainWorkflowDiagnostic[] = [];
  const invalid = (message: string): void => {
    diagnostics.push({
      stage: "definition",
      code: "INVALID_WORKFLOW_DEFINITION",
      path: "$.workflow",
      message,
    });
  };

  if (!nonEmpty(definition.id)) {
    invalid("Workflow definition id must not be empty.");
  }
  if (!Number.isSafeInteger(definition.revision) || definition.revision <= 0) {
    invalid("Workflow definition revision must be a positive safe integer.");
  }

  const duplicateChecks: readonly [string, readonly string[]][] = [
    ["node", definition.nodes],
    ["artifact type", definition.artifactTypes],
    ["transition id", definition.transitions.map((item) => item.id)],
    ["policy id", definition.policies.map((item) => item.id)],
    [
      "capability requirement id",
      definition.capabilityRequirements.map((item) => item.id),
    ],
  ];
  for (const [description, values] of duplicateChecks) {
    const seen = new Set<string>();
    for (const value of values) {
      if (!nonEmpty(value)) {
        invalid(`Workflow definition ${description} must not be empty.`);
      }
      if (seen.has(value)) {
        invalid(`Workflow definition has duplicate ${description}: ${value}.`);
      }
      seen.add(value);
    }
  }

  const nodes = new Set(definition.nodes);
  const artifacts = new Set(definition.artifactTypes);
  const capabilityRequirements = new Set(
    definition.capabilityRequirements.map((requirement) => requirement.id),
  );
  if (!nodes.has(definition.initialNode)) {
    invalid(`Initial node is not declared: ${definition.initialNode}.`);
  }

  for (const transition of definition.transitions) {
    if (!nodes.has(transition.from) || !nodes.has(transition.to)) {
      invalid(`Transition ${transition.id} references an undeclared node.`);
    }
    if (transition.guard !== undefined && !nonEmpty(transition.guard)) {
      invalid(`Transition ${transition.id} has an empty guard description.`);
    }
    for (const artifact of [
      ...(transition.produces ?? []),
      ...(transition.invalidates ?? []),
    ]) {
      if (!artifacts.has(artifact)) {
        invalid(
          `Transition ${transition.id} uses undeclared artifact type ${artifact}.`,
        );
      }
    }
    for (const requirementId of transition.requiresCapabilities ?? []) {
      if (!capabilityRequirements.has(requirementId)) {
        invalid(
          `Transition ${transition.id} references undeclared capability requirement ${requirementId}.`,
        );
      }
    }
  }

  for (const policy of definition.policies) {
    if (!nodes.has(policy.at)) {
      invalid(`Policy ${policy.id} references undeclared node ${policy.at}.`);
    }
    if (!artifacts.has(policy.artifact)) {
      invalid(`Policy ${policy.id} uses undeclared artifact type ${policy.artifact}.`);
    }
  }

  for (const requirement of definition.capabilityRequirements) {
    if (!nonEmpty(requirement.binding)) {
      invalid(`Capability requirement ${requirement.id} has an empty binding.`);
    }
    if (!nonEmpty(requirement.capability)) {
      invalid(`Capability requirement ${requirement.id} has an empty capability.`);
    }
  }

  return diagnostics.sort((left, right) =>
    compareText(left.message, right.message),
  );
}

function normalizeTransition(
  transition: PrivateDomainTransition,
): PrivateDomainTransition {
  return {
    id: transition.id,
    from: transition.from,
    to: transition.to,
    role: transition.role,
    ...(transition.produces
      ? { produces: sortedUnique(transition.produces) }
      : {}),
    ...(transition.invalidates
      ? { invalidates: sortedUnique(transition.invalidates) }
      : {}),
    ...(transition.requiresCapabilities
      ? {
          requiresCapabilities: sortedUnique(
            transition.requiresCapabilities,
          ),
        }
      : {}),
    ...(transition.guard ? { guard: transition.guard } : {}),
  };
}

function normalizeDefinition(
  definition: PrivateDomainWorkflowDefinition,
): PrivateDomainWorkflowDefinition {
  return {
    id: definition.id,
    revision: definition.revision,
    nodes: sortedUnique(definition.nodes),
    initialNode: definition.initialNode,
    artifactTypes: sortedUnique(definition.artifactTypes),
    transitions: definition.transitions
      .map(normalizeTransition)
      .sort((left, right) => compareText(left.id, right.id)),
    policies: [...definition.policies].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    capabilityRequirements: [...definition.capabilityRequirements].sort(
      (left, right) => compareText(left.id, right.id),
    ),
  };
}

function resolveCapabilities(
  requirements: readonly PrivateDomainCapabilityRequirement[],
  observations: readonly PrivateDomainCapabilityObservation[],
):
  | {
      readonly ok: true;
      readonly resolutions: readonly PrivateDomainCapabilityResolution[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainWorkflowDiagnostic[];
    } {
  const observationsByKey = new Map<string, PrivateDomainCapabilityObservation>();
  const diagnostics: PrivateDomainWorkflowDiagnostic[] = [];
  for (let index = 0; index < observations.length; index += 1) {
    const observationValue: unknown = observations[index];
    if (!isCapabilityObservation(observationValue)) {
      diagnostics.push({
        stage: "capability",
        code: "CAPABILITY_OBSERVATION_INVALID",
        path: `$.capabilities[${index}]`,
        message:
          "Capability observation must contain exact bounded binding, capability, and mechanism values.",
      });
      continue;
    }
    const observation = observationValue;
    const key = `${observation.binding}\u0000${observation.capability}`;
    if (observationsByKey.has(key)) {
      diagnostics.push({
        stage: "capability",
        code: "CAPABILITY_OBSERVATION_DUPLICATED",
        path: `$.capabilities[binding=${observation.binding},capability=${observation.capability}]`,
        message: `Capability observation is duplicated for binding ${observation.binding} and capability ${observation.capability}.`,
      });
      continue;
    }
    observationsByKey.set(key, observation);
  }

  const resolutions: PrivateDomainCapabilityResolution[] = [];
  for (const requirement of requirements) {
    const key = `${requirement.binding}\u0000${requirement.capability}`;
    const observation = observationsByKey.get(key);
    const path = `$.capabilities[requirement=${requirement.id}]`;
    if (!observation) {
      diagnostics.push({
        stage: "capability",
        code: "CAPABILITY_UNAVAILABLE",
        path,
        message: `Binding ${requirement.binding} has no observed ${requirement.capability} capability for requirement ${requirement.id}.`,
      });
      continue;
    }
    resolutions.push({
      requirementId: requirement.id,
      binding: requirement.binding,
      capability: requirement.capability,
      mechanism: observation.mechanism,
    });
  }

  if (diagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: diagnostics.sort(
        (left, right) =>
          compareText(left.path, right.path) ||
          compareText(left.code, right.code) ||
          compareText(left.message, right.message),
      ),
    };
  }
  return {
    ok: true,
    resolutions: resolutions.sort(
      (left, right) =>
        compareText(left.binding, right.binding) ||
        compareText(left.requirementId, right.requirementId),
    ),
  };
}

function budgetFor(
  definition: PrivateDomainWorkflowDefinition,
  configuredMaxStates: number,
): PrivateDomainWorkflowBudget {
  const theoreticalMaxStates =
    BigInt(definition.nodes.length) *
    (1n << BigInt(definition.artifactTypes.length));
  return {
    nodeCount: definition.nodes.length,
    artifactTypeCount: definition.artifactTypes.length,
    theoreticalMaxStates: theoreticalMaxStates.toString(),
    configuredMaxStates,
  };
}

function finiteWorkflowFromDefinition(
  definition: PrivateDomainWorkflowDefinition,
): {
  readonly nodes: readonly WorkflowNodeId[];
  readonly initialNode: WorkflowNodeId;
  readonly transitions: readonly WorkflowTransition[];
} {
  return {
    nodes: definition.nodes,
    initialNode: definition.initialNode,
    transitions: definition.transitions.map((transition) => ({
      id: transition.id,
      from: transition.from,
      to: transition.to,
      ...(transition.produces
        ? { produces: transition.produces }
        : {}),
      ...(transition.invalidates
        ? { invalidates: transition.invalidates }
        : {}),
      ...(transition.guard ? { guard: transition.guard } : {}),
    })),
  };
}

export function compilePrivateDomainWorkflow(
  input: PrivateDomainWorkflowDefinition,
  options: PrivateDomainWorkflowCompilerOptions = {},
): PrivateDomainWorkflowCompilationResult {
  const configuredMaxStates =
    options.maxAbstractStates ?? defaultMaxAbstractStates;
  if (!Number.isSafeInteger(configuredMaxStates) || configuredMaxStates <= 0) {
    throw new Error("maxAbstractStates must be a positive safe integer.");
  }

  const definitionDiagnostics = validateDefinition(input);
  if (definitionDiagnostics.length > 0) {
    return { ok: false, diagnostics: definitionDiagnostics };
  }
  const definition = normalizeDefinition(input);
  const capabilityResult = resolveCapabilities(
    definition.capabilityRequirements,
    options.capabilityObservations ?? [],
  );
  if (!capabilityResult.ok) {
    return capabilityResult;
  }

  const budget = budgetFor(definition, configuredMaxStates);
  if (BigInt(budget.theoreticalMaxStates) > BigInt(configuredMaxStates)) {
    return {
      ok: false,
      diagnostics: [
        {
          stage: "budget",
          code: "STATE_SPACE_BUDGET_EXCEEDED",
          path: "$.workflow",
          message: `Workflow ${definition.id}@${definition.revision} has a theoretical ${budget.theoreticalMaxStates} abstract states, exceeding the configured limit ${configuredMaxStates}.`,
          budget,
        },
      ],
    };
  }

  let policyValidation: PolicyValidationResult;
  try {
    policyValidation = validatePolicySafety(
      finiteWorkflowFromDefinition(definition),
      definition.policies,
    );
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          stage: "definition",
          code: "INVALID_WORKFLOW_DEFINITION",
          path: "$.workflow",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
  if (!policyValidation.safe) {
    return {
      ok: false,
      diagnostics: policyValidation.violations.map((violation) => ({
        stage: "policy",
        code: "UNSAFE_WORKFLOW",
        path: `$.policies.${violation.policy}`,
        message: violation.message,
        violation,
      })),
    };
  }

  const compilationDigest = digest({
    definition,
    capabilityResolutions: capabilityResult.resolutions,
  });
  return {
    ok: true,
    compilation: {
      definition,
      capabilityResolutions: capabilityResult.resolutions,
      budget,
      policyValidation,
      compilationDigest,
    },
  };
}
