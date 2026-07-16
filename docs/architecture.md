# Architecture

## Boundary

`agentdevflow` owns provider-neutral development-flow intent, policy validation, compilation, provenance, ownership, lock state, and diagnostics. Replaceable adapters may materialize provider files. External systems may execute exported workflows.

It must not absorb renderer implementation details into the public configuration model or become a scheduler, instruction-file generator without independent policy value, skills installer, registry, or runtime.

## Interface stability

`ProjectConfig` is the candidate stable user interface, but it is not frozen. `WorkflowDefinition` is experimental and `WorkflowIR` is private. Phase 0 introduces no public workflow DSL or configuration filename.

The compiler boundary should resemble:

```text
ProjectConfig
-> resolution and lock state
-> private WorkflowIR
-> policy validation
-> deterministic render plan
-> replaceable provider adapter
-> owned artifacts and provenance
```

Policy validation must not depend on a renderer, provider SDK, tracker, or runtime scheduler.

## Renderer boundary

The renderer backend is replaceable behind a narrow contract that separates planning, rendering, and verification. The contract must make writes, conflicts, unsupported capabilities, and ownership decisions explicit.

Gate 1 compared:

1. adopting Rulesync as released;
2. patching or forking Rulesync;
3. building the smallest renderer for Codex, Claude Code, and Cursor.

[ADR 0001](decisions/0001-native-project-instructions-renderer.md) selects the third strategy for one project-wide instruction document. Rulesync remains an external experimental oracle rather than a production or test runtime dependency. The native emitters remain behind the same staging contract and must not expand into a broad configuration synchronizer without a new decision.

Roadmaps and open issues are risk indicators, not automatic rejection criteria. A pivot is warranted if released tools already absorb the policy, provenance, and ownership layer, or if adapter maintenance is uneconomic.

## Policy safety model

The initial validator uses a static finite transition system:

- finite, explicit nodes and transitions;
- cycles allowed;
- guards treated as potentially enabled without satisfiability reasoning;
- a closed set of safety-property patterns;
- typed artifact production and invalidation as finite labels;
- no runtime termination proof, arbitrary executable predicates, dynamic topology, general liveness, or fairness.

Guard-blind over-approximation intentionally permits false positives in exchange for sound safety checking within this model. Diagnostics must identify this limitation when a counterexample traverses guarded transitions.

## Artifact validity

A transition may produce or invalidate artifact types. A merge requirement for `ReviewVerdict` means a currently valid verdict, not merely a verdict produced somewhere earlier in the trace.

Artifact validity has three distinct levels:

1. **Structural**: the artifact conforms to its versioned schema.
2. **Consistency**: its revision, digests, and recorded outputs match observable repository state.
3. **Semantic**: the evidence and judgment are truthful and sufficient.

The initial product may claim structural validity and parts of consistency. It must not claim semantic truth or authenticated producer identity without a controlled producer or attestation mechanism.

Repository files are the candidate canonical V1 artifact transport so local and tracker-free workflows can use the same checks. The exact path remains unselected. CI and pull-request views are derived representations.

## Enforcement model

Policies describe primitives rather than a rigid display enum:

- mechanism;
- scope;
- bypass authority;
- observed and configured availability;
- required strength.

User-facing strength labels are derived. Materialization may degrade only toward a weaker mechanism, must diagnose the degradation, and cannot satisfy a stronger policy requirement.

## Security and ownership

- Generated paths have one owner.
- Existing files follow explicit adopt, import, or abort behavior.
- Planned writes are deterministic, atomic, hash-bound, and conflict-aware.
- Community capabilities are opt-in and require immutable provenance and digests.
- Hash mismatch fails closed.
- Installation must disclose scripts, network and environment access, tools, write paths, and licensing.
- Registry presence is not a security endorsement.
- Prompt instructions do not constitute mechanical enforcement.
