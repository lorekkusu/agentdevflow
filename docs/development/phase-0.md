# Phase 0

## Objective

Determine whether `agentdevflow` has an independently useful and maintainable policy-compiler layer. Phase 0 produces executable evidence and explicit recommendations, not a production CLI.

The exit decision is:

- **Go** when the renderer strategy is maintainable and the validator proves useful safety properties.
- **Pivot** when only one core remains viable or the integration or product position must change.
- **No-Go** when existing tools absorb the value, renderer maintenance is prohibitive, or policy guarantees collapse into prompt-only claims.

Gate 1 must complete before Gate 6 begins.

## Gate status

- Gate 1: complete, conditional Pass with a staging-only Rulesync integration. See [renderer backend evidence](../evidence/renderer-backend.md).
- Gate 6: complete, Pass. See [policy safety evidence](../evidence/policy-safety.md).
- Phase 0 exit: Go. Keep policy compilation as the core and retain the staging-only renderer boundary.

## Gate 1: renderer backend

### Question

Can Rulesync serve as a replaceable renderer backend without depending on undocumented behavior or surrendering artifact ownership and determinism?

### Required evidence

- current released CLI and programmatic API;
- deterministic output from identical inputs;
- Codex, Claude Code, and Cursor coverage;
- generated-file ownership and conflict behavior;
- source traceability;
- existing-file import, adoption, and abort behavior;
- unsupported-capability diagnostics;
- license, release cadence, version pinning, upstream coupling, and replacement boundaries;
- local executable experiments against the pinned Rulesync release.

Fixtures include a minimal neutral input, a provider extension, an unsupported capability, a hand-written provider file, a modified generated file, and two identical renders.

### Pass criteria

- At least one strategy provides deterministic plan, render, and verify behavior for the three initial providers.
- Ownership conflicts and unsupported capabilities fail visibly.
- The selected backend remains replaceable behind a narrow adapter contract.
- Patch, fork, and replacement costs are documented without invented precision and are compatible with expected maintenance capacity.

### Fail or pivot criteria

- Every strategy requires immediate ownership of a broad provider path matrix.
- Existing files cannot be handled without silent overwrite or fragile heuristics.
- Backend behavior cannot be pinned or reproduced.
- A released tool already provides the intended policy, provenance, and ownership layer sufficiently for target users.

### Deliverables

- reproducible fixtures and captured observations;
- a narrow adapter-contract prototype where technically possible;
- a three-strategy maintenance and failure analysis;
- explicit pass or fail results and a use, patch, build, pivot, or stop recommendation.

## Gate 6: finite-state policy safety

### Question

Can a small guard-blind finite-state validator detect meaningful workflow-policy bypasses without requiring a runtime or general-purpose workflow language?

### Required representation

- static finite nodes and transitions;
- cycles allowed;
- guard-blind over-approximation;
- a closed set of safety-property patterns;
- typed artifact production and invalidation;
- deterministic counterexample traces;
- no scheduler, arbitrary predicates, dynamic topology, public workflow DSL, general liveness, or fairness reasoning.

### Required fixtures

1. Safe `plan -> implement -> review -> merge`.
2. Direct `implement -> merge` review bypass.
3. Stale `ReviewVerdict` after returning to implementation.
4. Safe review and rework cycle without a bounded retry count.
5. Guard-related false positive with an explicit diagnostic.

### Pass criteria

- Direct and stale-artifact bypasses are rejected.
- Safe cyclic workflows are accepted.
- Results and counterexamples are deterministic and useful.
- Guard-blind false positives are explicit.
- The validator is independent of runtimes and provider adapters.

### Fail or pivot criteria

- Useful policies require arbitrary predicates or semantic interpretation.
- Artifact invalidation causes unacceptable state growth in the minimal fixtures.
- Diagnostics cannot explain rejection.
- The only remaining result is natural-language advice.

### Deliverables

- executable TypeScript and automated tests;
- the private graph and policy representation;
- deterministic counterexample diagnostics;
- complexity and limitation notes;
- explicit pass or fail results and a recommendation on policy compilation as the project core.

## Phase 0 exclusions

Do not build a production CLI, complete wizard, stable arbitrary-workflow DSL, orchestration runtime, skills or MCP marketplace, tracker runtime, broad provider matrix, GUI, SaaS control plane, automatic merge or release system, package publication, or agent-assisted repository analyzer.
