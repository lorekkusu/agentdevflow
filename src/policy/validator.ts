import type {
  ArtifactType,
  CounterexampleStep,
  FiniteWorkflow,
  PolicyValidationResult,
  PolicyViolation,
  SafetyPolicy,
  WorkflowNodeId,
  WorkflowTransition,
} from "./model.js";

interface AbstractState {
  readonly node: WorkflowNodeId;
  readonly validArtifacts: ReadonlySet<ArtifactType>;
}

interface DiscoveredState {
  readonly state: AbstractState;
  readonly previousKey?: string;
  readonly via?: WorkflowTransition;
}

function sortedUnique(values: readonly string[] = []): string[] {
  return [...new Set(values)].sort();
}

function stateKey(state: AbstractState): string {
  return JSON.stringify([
    state.node,
    sortedUnique([...state.validArtifacts]),
  ]);
}

function validateIdentifier(value: string, description: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${description} must not be empty.`);
  }
}

function validateModel(
  workflow: FiniteWorkflow,
  policies: readonly SafetyPolicy[],
): void {
  const nodes = new Set<string>();
  for (const node of workflow.nodes) {
    validateIdentifier(node, "Workflow node id");
    if (nodes.has(node)) {
      throw new Error(`Duplicate workflow node id: ${node}`);
    }
    nodes.add(node);
  }
  if (!nodes.has(workflow.initialNode)) {
    throw new Error(`Initial node is not declared: ${workflow.initialNode}`);
  }

  for (const artifact of workflow.initialArtifacts ?? []) {
    validateIdentifier(artifact, "Initial artifact type");
  }

  const transitionIds = new Set<string>();
  for (const transition of workflow.transitions) {
    validateIdentifier(transition.id, "Transition id");
    if (transitionIds.has(transition.id)) {
      throw new Error(`Duplicate transition id: ${transition.id}`);
    }
    transitionIds.add(transition.id);
    if (!nodes.has(transition.from) || !nodes.has(transition.to)) {
      throw new Error(
        `Transition ${transition.id} references an undeclared node.`,
      );
    }
    for (const artifact of [
      ...(transition.produces ?? []),
      ...(transition.invalidates ?? []),
    ]) {
      validateIdentifier(artifact, `Artifact type on ${transition.id}`);
    }
  }

  const policyIds = new Set<string>();
  for (const policy of policies) {
    validateIdentifier(policy.id, "Policy id");
    if (policyIds.has(policy.id)) {
      throw new Error(`Duplicate policy id: ${policy.id}`);
    }
    policyIds.add(policy.id);
    if (!nodes.has(policy.at)) {
      throw new Error(`Policy ${policy.id} references undeclared node ${policy.at}.`);
    }
    validateIdentifier(policy.artifact, `Artifact type on ${policy.id}`);
  }
}

function applyTransition(
  state: AbstractState,
  transition: WorkflowTransition,
): AbstractState {
  const validArtifacts = new Set(state.validArtifacts);
  for (const artifact of transition.invalidates ?? []) {
    validArtifacts.delete(artifact);
  }
  for (const artifact of transition.produces ?? []) {
    validArtifacts.add(artifact);
  }
  return { node: transition.to, validArtifacts };
}

function reconstructCounterexample(
  key: string,
  discovered: ReadonlyMap<string, DiscoveredState>,
): CounterexampleStep[] {
  const reversed: CounterexampleStep[] = [];
  let currentKey = key;

  while (true) {
    const current = discovered.get(currentKey);
    if (!current) {
      throw new Error("Counterexample predecessor is missing.");
    }
    if (!current.previousKey || !current.via) {
      break;
    }
    const previous = discovered.get(current.previousKey);
    if (!previous) {
      throw new Error("Counterexample predecessor state is missing.");
    }
    reversed.push({
      transition: current.via.id,
      from: previous.state.node,
      to: current.state.node,
      produces: sortedUnique(current.via.produces),
      invalidates: sortedUnique(current.via.invalidates),
      ...(current.via.guard ? { guard: current.via.guard } : {}),
      validArtifactsAfter: sortedUnique([...current.state.validArtifacts]),
    });
    currentKey = current.previousKey;
  }

  return reversed.reverse();
}

function violationAt(
  policy: SafetyPolicy,
  key: string,
  discovered: ReadonlyMap<string, DiscoveredState>,
): PolicyViolation | null {
  const state = discovered.get(key)?.state;
  if (!state || state.node !== policy.at) {
    return null;
  }

  const artifactPresent = state.validArtifacts.has(policy.artifact);
  const violates =
    policy.kind === "requires-valid-artifact"
      ? !artifactPresent
      : artifactPresent;
  if (!violates) {
    return null;
  }

  const counterexample = reconstructCounterexample(key, discovered);
  const guardBlind = counterexample.some((step) => step.guard !== undefined);
  const code =
    policy.kind === "requires-valid-artifact"
      ? "MISSING_REQUIRED_ARTIFACT"
      : "FORBIDDEN_ARTIFACT_PRESENT";
  const message =
    policy.kind === "requires-valid-artifact"
      ? `Policy ${policy.id} requires valid ${policy.artifact} at ${policy.at}.`
      : `Policy ${policy.id} forbids valid ${policy.artifact} at ${policy.at}.`;

  return {
    code,
    policy: policy.id,
    node: state.node,
    artifact: policy.artifact,
    message,
    validArtifacts: sortedUnique([...state.validArtifacts]),
    counterexample,
    guardBlind,
    ...(guardBlind
      ? {
          limitation:
            "The counterexample includes guarded transitions. Guards are treated as potentially enabled, so mutually exclusive guards can cause a false positive.",
        }
      : {}),
  };
}

export function validatePolicySafety(
  workflow: FiniteWorkflow,
  policies: readonly SafetyPolicy[],
): PolicyValidationResult {
  validateModel(workflow, policies);

  const transitionsByNode = new Map<string, WorkflowTransition[]>();
  for (const node of workflow.nodes) {
    transitionsByNode.set(node, []);
  }
  for (const transition of workflow.transitions) {
    transitionsByNode.get(transition.from)?.push(transition);
  }
  for (const transitions of transitionsByNode.values()) {
    transitions.sort((left, right) => left.id.localeCompare(right.id));
  }

  const sortedPolicies = [...policies].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const initialState: AbstractState = {
    node: workflow.initialNode,
    validArtifacts: new Set(workflow.initialArtifacts ?? []),
  };
  const initialKey = stateKey(initialState);
  const discovered = new Map<string, DiscoveredState>([
    [initialKey, { state: initialState }],
  ]);
  const queue = [initialKey];
  const violations = new Map<string, PolicyViolation>();

  for (let index = 0; index < queue.length; index += 1) {
    const key = queue[index];
    const current = key ? discovered.get(key) : undefined;
    if (!key || !current) {
      throw new Error("Validator queue contains an unknown state.");
    }

    for (const policy of sortedPolicies) {
      if (violations.has(policy.id)) {
        continue;
      }
      const violation = violationAt(policy, key, discovered);
      if (violation) {
        violations.set(policy.id, violation);
      }
    }

    for (const transition of transitionsByNode.get(current.state.node) ?? []) {
      const nextState = applyTransition(current.state, transition);
      const nextKey = stateKey(nextState);
      if (discovered.has(nextKey)) {
        continue;
      }
      discovered.set(nextKey, {
        state: nextState,
        previousKey: key,
        via: transition,
      });
      queue.push(nextKey);
    }
  }

  const orderedViolations = [...violations.values()].sort((left, right) =>
    left.policy.localeCompare(right.policy),
  );
  return {
    safe: orderedViolations.length === 0,
    exploredStates: discovered.size,
    violations: orderedViolations,
  };
}
