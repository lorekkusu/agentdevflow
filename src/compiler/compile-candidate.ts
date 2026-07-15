import { createHash } from "node:crypto";

import type {
  CandidateArtifactType,
  CandidateConfigDiagnostic,
  NormalizedCandidateProjectConfig,
} from "../config/candidate.js";
import { normalizeCandidateProjectConfig } from "../config/normalize-candidate.js";
import type {
  FiniteWorkflow,
  SafetyPolicy,
  WorkflowTransition,
} from "../policy/model.js";
import { validatePolicySafety } from "../policy/validator.js";
import { builtInDefinitionForPreset } from "./built-in-definitions.js";
import type {
  CandidateCompilation,
  CandidateCompilationResult,
  CandidateCompilerOptions,
  CompilerDiagnostic,
  PrivateCapabilityAvailability,
  PrivateCapabilityResolution,
  PrivateCapabilityRequirement,
  PrivateEnforcementStrength,
  PrivateTransitionDefinition,
  PrivateWorkflowDefinition,
  PrivateWorkflowIR,
  StateSpaceBudgetResult,
} from "./private-model.js";

const defaultMaxAbstractStates = 128;

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

function normalizeTransition(
  transition: PrivateTransitionDefinition,
): PrivateTransitionDefinition {
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
  };
}

function createPrivateWorkflowIR(
  config: NormalizedCandidateProjectConfig,
  definition: PrivateWorkflowDefinition,
): PrivateWorkflowIR {
  return {
    definitionId: definition.id,
    definitionRevision: definition.revision,
    preset: definition.preset,
    nodes: sortedUnique(definition.nodes),
    initialNode: definition.initialNode,
    artifactTypes: sortedUnique(definition.artifactTypes),
    capabilityRequirements: [...definition.capabilityRequirements].sort(
      (left, right) => compareText(left.id, right.id),
    ),
    transitions: definition.transitions
      .map(normalizeTransition)
      .sort((left, right) => compareText(left.id, right.id)),
    providers: config.providers.map((provider) => ({ ...provider })),
    roleBindings: {
      developer: config.roles.developer,
      reviewer: config.roles.reviewer,
      steward: config.roles.steward,
    },
    tracker: { mode: config.tracker.mode },
  };
}

const strengthRank: Readonly<Record<PrivateEnforcementStrength, number>> = {
  advisory: 0,
  guarded: 1,
  enforced: 2,
};

function resolveCapabilities(
  config: NormalizedCandidateProjectConfig,
  requirements: readonly PrivateCapabilityRequirement[],
  availability: readonly PrivateCapabilityAvailability[],
):
  | { readonly ok: true; readonly resolutions: PrivateCapabilityResolution[] }
  | { readonly ok: false; readonly diagnostics: CompilerDiagnostic[] } {
  const availabilityByKey = new Map<string, PrivateCapabilityAvailability>();
  for (const item of availability) {
    const key = `${item.providerId}\u0000${item.capability}`;
    if (availabilityByKey.has(key)) {
      throw new Error(
        `Capability availability is duplicated for ${item.providerId} and ${item.capability}.`,
      );
    }
    availabilityByKey.set(key, item);
  }

  const resolutions: PrivateCapabilityResolution[] = [];
  const diagnostics: CompilerDiagnostic[] = [];
  for (const requirement of requirements) {
    for (const provider of config.providers) {
      const key = `${provider.id}\u0000${requirement.capability}`;
      const observed = availabilityByKey.get(key);
      const path = `$.providers[id=${provider.id}]`;
      if (!observed) {
        diagnostics.push({
          stage: "capability",
          code: "CAPABILITY_UNAVAILABLE",
          path,
          message: `Provider instance ${provider.id} has no observed ${requirement.capability} capability for requirement ${requirement.id}.`,
          requirement,
          providerId: provider.id,
        });
        continue;
      }
      if (
        strengthRank[observed.strength] <
        strengthRank[requirement.requiredStrength]
      ) {
        diagnostics.push({
          stage: "capability",
          code: "CAPABILITY_STRENGTH_INSUFFICIENT",
          path,
          message: `Provider instance ${provider.id} offers ${requirement.capability} at ${observed.strength} strength through ${observed.mechanism}, below required ${requirement.requiredStrength} strength.`,
          requirement,
          providerId: provider.id,
          availability: observed,
        });
        continue;
      }
      resolutions.push({
        requirementId: requirement.id,
        providerId: provider.id,
        capability: requirement.capability,
        requiredStrength: requirement.requiredStrength,
        observedStrength: observed.strength,
        mechanism: observed.mechanism,
      });
    }
  }
  diagnostics.sort(
    (left, right) =>
      compareText(left.path, right.path) ||
      compareText(left.code, right.code) ||
      compareText(left.message, right.message),
  );
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  resolutions.sort(
    (left, right) =>
      compareText(left.providerId, right.providerId) ||
      compareText(left.requirementId, right.requirementId),
  );
  return { ok: true, resolutions };
}

function compilePolicies(
  config: NormalizedCandidateProjectConfig,
): SafetyPolicy[] {
  const policies: SafetyPolicy[] = [];
  if (config.review.requiredBeforeMerge) {
    policies.push({
      id: "merge-requires-review-verdict",
      kind: "requires-valid-artifact",
      at: "merge",
      artifact: "ReviewVerdict",
    });
  }
  if (config.review.artifactTypes.includes("BlockingFinding")) {
    policies.push({
      id: "merge-forbids-blocking-finding",
      kind: "forbids-valid-artifact",
      at: "merge",
      artifact: "BlockingFinding",
    });
  }
  return policies.sort((left, right) => compareText(left.id, right.id));
}

function finiteWorkflowFromIR(workflow: PrivateWorkflowIR): FiniteWorkflow {
  return {
    nodes: workflow.nodes,
    initialNode: workflow.initialNode,
    transitions: workflow.transitions.map(
      (transition): WorkflowTransition => ({
        id: transition.id,
        from: transition.from,
        to: transition.to,
        ...(transition.produces
          ? { produces: transition.produces }
          : {}),
        ...(transition.invalidates
          ? { invalidates: transition.invalidates }
          : {}),
      }),
    ),
  };
}

function collectArtifactTypes(
  workflow: PrivateWorkflowIR,
  policies: readonly SafetyPolicy[],
): string[] {
  return sortedUnique([
    ...workflow.artifactTypes,
    ...workflow.transitions.flatMap((transition) => [
      ...(transition.produces ?? []),
      ...(transition.invalidates ?? []),
    ]),
    ...policies.map((policy) => policy.artifact),
  ]);
}

function stateSpaceBudget(
  workflow: PrivateWorkflowIR,
  policies: readonly SafetyPolicy[],
  configuredMaxStates: number,
): StateSpaceBudgetResult {
  const artifactTypeCount = collectArtifactTypes(workflow, policies).length;
  const theoreticalMaxStates =
    BigInt(workflow.nodes.length) * (1n << BigInt(artifactTypeCount));
  return {
    nodeCount: workflow.nodes.length,
    artifactTypeCount,
    theoreticalMaxStates: theoreticalMaxStates.toString(),
    configuredMaxStates,
  };
}

function configurationDiagnostics(
  diagnostics: readonly CandidateConfigDiagnostic[],
): CompilerDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    stage: "configuration",
    code: `CONFIG_${diagnostic.code}`,
    path: diagnostic.path,
    message: diagnostic.message,
  }));
}

function validateDefinitionResolution(
  config: NormalizedCandidateProjectConfig,
  definition: PrivateWorkflowDefinition,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const invalidDefinition = (message: string): void => {
    diagnostics.push({
      stage: "resolution",
      code: "INVALID_WORKFLOW_DEFINITION",
      path: "$.workflow",
      message,
    });
  };
  if (definition.id.trim().length === 0) {
    invalidDefinition("Workflow definition id must not be empty.");
  }
  if (!Number.isSafeInteger(definition.revision) || definition.revision <= 0) {
    invalidDefinition("Workflow definition revision must be a positive safe integer.");
  }
  const duplicateChecks: readonly [string, readonly string[]][] = [
    ["node", definition.nodes],
    ["transition id", definition.transitions.map((transition) => transition.id)],
    ["artifact type", definition.artifactTypes],
    [
      "capability requirement id",
      definition.capabilityRequirements.map((requirement) => requirement.id),
    ],
  ];
  for (const [description, values] of duplicateChecks) {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) {
        invalidDefinition(`Workflow definition has duplicate ${description}: ${value}.`);
      }
      seen.add(value);
    }
  }
  const definitionArtifacts = new Set(definition.artifactTypes);
  for (const transition of definition.transitions) {
    for (const artifact of [
      ...(transition.produces ?? []),
      ...(transition.invalidates ?? []),
    ]) {
      if (!definitionArtifacts.has(artifact)) {
        invalidDefinition(
          `Transition ${transition.id} uses undeclared workflow artifact type ${artifact}.`,
        );
      }
    }
  }
  if (definition.preset !== config.preset) {
    diagnostics.push({
      stage: "resolution",
      code: "PRESET_DEFINITION_MISMATCH",
      path: "$.preset",
      message: `Preset ${config.preset} cannot resolve workflow definition ${definition.id} for ${definition.preset}.`,
    });
  }
  const declaredArtifacts = new Set<CandidateArtifactType>(
    config.review.artifactTypes,
  );
  for (const artifact of sortedUnique(definition.artifactTypes)) {
    if (!declaredArtifacts.has(artifact as CandidateArtifactType)) {
      diagnostics.push({
        stage: "resolution",
        code: "MISSING_ARTIFACT_TYPE",
        path: "$.review.artifactTypes",
        message: `Workflow definition ${definition.id}@${definition.revision} requires undeclared artifact type ${artifact}.`,
      });
    }
  }
  return diagnostics.sort(
    (left, right) =>
      compareText(left.path, right.path) ||
      compareText(left.code, right.code) ||
      compareText(left.message, right.message),
  );
}

function validateCompilerOptions(options: CandidateCompilerOptions): number {
  const maxAbstractStates =
    options.maxAbstractStates ?? defaultMaxAbstractStates;
  if (!Number.isSafeInteger(maxAbstractStates) || maxAbstractStates <= 0) {
    throw new Error("maxAbstractStates must be a positive safe integer.");
  }
  return maxAbstractStates;
}

/** Internal evidence seam. It does not expose a user-defined workflow format. */
export function compileCandidateWithDefinition(
  input: unknown,
  definition: PrivateWorkflowDefinition,
  options: CandidateCompilerOptions = {},
): CandidateCompilationResult {
  const maxAbstractStates = validateCompilerOptions(options);
  const normalized = normalizeCandidateProjectConfig(input);
  if (!normalized.ok) {
    return {
      ok: false,
      diagnostics: configurationDiagnostics(normalized.diagnostics),
    };
  }

  const resolutionDiagnostics = validateDefinitionResolution(
    normalized.config,
    definition,
  );
  if (resolutionDiagnostics.length > 0) {
    return { ok: false, diagnostics: resolutionDiagnostics };
  }

  const workflow = createPrivateWorkflowIR(normalized.config, definition);
  const policies = compilePolicies(normalized.config);
  const capabilityResult = resolveCapabilities(
    normalized.config,
    workflow.capabilityRequirements,
    options.capabilityAvailability ?? [],
  );
  if (!capabilityResult.ok) {
    return { ok: false, diagnostics: capabilityResult.diagnostics };
  }
  const budget = stateSpaceBudget(workflow, policies, maxAbstractStates);
  if (BigInt(budget.theoreticalMaxStates) > BigInt(maxAbstractStates)) {
    return {
      ok: false,
      diagnostics: [
        {
          stage: "budget",
          code: "STATE_SPACE_BUDGET_EXCEEDED",
          path: "$.workflow",
          message: `Workflow ${definition.id}@${definition.revision} has a theoretical ${budget.theoreticalMaxStates} abstract states, exceeding the configured limit ${maxAbstractStates}.`,
          budget,
        },
      ],
    };
  }

  let policyValidation;
  try {
    policyValidation = validatePolicySafety(
      finiteWorkflowFromIR(workflow),
      policies,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      diagnostics: [
        {
          stage: "resolution",
          code: "INVALID_WORKFLOW_DEFINITION",
          path: "$.workflow",
          message,
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

  const compilerDigest = digest({
    configDigest: normalized.digest,
    workflow,
    policies,
    capabilityResolutions: capabilityResult.resolutions,
  });
  const compilation: CandidateCompilation = {
    configDigest: normalized.digest,
    compilerDigest,
    workflow,
    policies,
    capabilityResolutions: capabilityResult.resolutions,
    budget,
    policyValidation,
  };
  return { ok: true, compilation };
}

export function compileCandidateProjectConfig(
  input: unknown,
  options: CandidateCompilerOptions = {},
): CandidateCompilationResult {
  const normalized = normalizeCandidateProjectConfig(input);
  if (!normalized.ok) {
    return {
      ok: false,
      diagnostics: configurationDiagnostics(normalized.diagnostics),
    };
  }
  return compileCandidateWithDefinition(
    normalized.config,
    builtInDefinitionForPreset(normalized.config.preset),
    options,
  );
}
