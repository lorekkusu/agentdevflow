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

## Workflow and execution boundary

The compiler models responsibilities, finite workflow topology, typed evidence, closed safety policies, capability requirements, provider bindings, and enforcement strength. It may export deterministic procedures or an execution manifest. External agents, CI systems, trackers, and hosting platforms perform observations and mutations and return evidence for revalidation.

Provider products and tracker products are bindings, not workflow primitives. Replacing a Steward, Developer, Reviewer, tracker, or auxiliary review service should not normally change workflow topology. Provider-specific capability gaps remain visible diagnostics.

Pull-request hosting state is separate from policy state. A workflow may create a draft pull request or a pull request that is ready for review immediately, but neither state authorizes merge. Merge authorization binds an exact revision to the current required evidence. Revision-changing repair or autofix work invalidates revision-bound CI, review, and authorization artifacts.

The first realistic domain-validation target is the [issue-to-reviewed-pull-request workflow candidate](development/issue-to-reviewed-pull-request.md). It must remain a private definition until multiple workflows demonstrate a stable public representation.

Domain-specific artifact and capability types belong in built-in workflow definitions, not the compiler core. The [private domain workflow evidence](evidence/private-domain-workflows.md) compiles the issue-to-pull-request family and a local no-pull-request workflow through one generic seam. The local workflow remains a regression guard: it must not require empty pull-request fields, fictitious tracker evidence, or domain-specific compiler branches.

The [private execution contract](development/private-execution-contract.md) exports deterministic manifests and verifies externally supplied evidence traces for both workflow families. The [private execution transport](development/private-execution-transport.md) rejects ambiguous, malformed, or unbounded caller-supplied bytes before those values reach replay. The [private GitHub Check Runs adapter](development/private-github-check-runs-evidence.md) demonstrates one source-specific mapping into provider-neutral `CiResult` evidence while keeping network access, credentials, polling, and external mutation outside the core. These are verification boundaries, not executors: capability-to-step routing, artifact invalidation, and policy checks remain data, while scheduling, waiting, credentials, retries, and external mutation remain outside the core.

The [private domain project resolution](development/private-domain-project-resolution.md) selects a built-in workflow family and binds responsibilities, tracker choice, and logical capability targets around one authoritative workflow compilation. Provider replacement changes project resolution without changing provider-neutral topology unless the selected capability set or bounded workflow choice also changes. Revision-1 renderer materialization consumes the project resolution and workflow compilation directly. Execution-manifest export is an optional downstream consumer and cannot define project resolution.

The [private preset expansion](development/private-preset-expansion.md) overlays a minimum policy profile on an explicitly selected workflow family. It never selects Draft or Ready PR state, auxiliary review, a tracker, provider products, or capability targets. Fast and Balanced compile through the same generic seam; Strict fails closed until stronger evidence semantics exist. The older schema-version-0 candidate converges only with caller-supplied choices that it could not represent.

The [private project document boundary](development/private-project-document-contract.md) converts bounded JSONC bytes into that intent through size and depth preflight, complete syntax-tree validation, duplicate and unsafe-key rejection, a strict jitless runtime schema, and semantic project resolution. Syntax validity, schema validity, project consistency, policy safety, and external truth remain distinct checks.

The private application planning bridge composes that document boundary with revision-1 materialization, canonical lock observation, the native staging backend, and exact render-plan retention. Planning depends on a read-only workspace interface and performs no mutation. It currently derives only the local workflow's native project-instructions observations; workflows requiring tracker, pull-request, CI, review-service, or merge adapters fail closed until real adapter evidence is available.

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

The private execution boundary now validates closed CI, review, reviewer-isolation, and merge-authorization payload packages, exact subject agreement, envelope producer agreement, reviewer separation from active change-producer evidence, and exact canonical byte transport. `ci-result@2` also binds the complete normalized source observation so a passing summary cannot be detached from the captured provider state. This advances structural validity and internal consistency. It must not claim response origin, compiler provenance, semantic truth, or authenticated producer identity without a controlled acquisition or attestation mechanism.

Source adapters are pure translators after an explicit acquisition trust boundary. The first GitHub adapter requires a complete exact-SHA Check Runs snapshot and pinned App identities, but its response-origin field remains an external assertion. This adapter is frozen until a real consumer exists after the local vertical CLI milestone. Any later live probe requires a separately accepted narrow permission and acquisition contract and must not move tokens or provider clients into the compiler core.

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
- Planned writes are deterministic, hash-bound, conflict-aware, and published with atomic single-file replacement. The V1 path does not claim cross-file atomic visibility.
- Community capabilities are opt-in and require immutable provenance and digests.
- Hash mismatch fails closed.
- Installation must disclose scripts, network and environment access, tools, write paths, and licensing.
- Registry presence is not a security endorsement.
- Prompt instructions do not constitute mechanical enforcement.

## Render apply and recovery boundaries

V1 uses staged, digest-aware forward convergence as defined by [ADR 0002](decisions/0002-v1-forward-convergent-render-apply.md). Every managed path must match its exact plan-bound before or after digest before apply, and is checked again before mutation. Paths at the before state advance; paths already at the after state remain unchanged; foreign states fail closed. The exact plan must be retained or reproduced after interruption.

Single-file writes synchronize content in a deterministic same-directory temporary file and publish by rename. The temporary identity binds the plan, target path, and target digest. This supports rerun after tested process termination without requiring a clean Git worktree or authorizing automatic reset, clean, stash, commit, or branch mutation. It does not provide rollback, cross-file atomic visibility, hostile-writer exclusion, directory durability, or power-loss guarantees. See the [V1 recovery contract](development/v1-recovery-contract.md).

### Experimental write-ahead prototype

The private write-ahead prototype demonstrates deterministic rollback or roll-forward using content-addressed recovery blobs, explicit writer evidence, a target-lock commit anchor, and resumable cleanup. It is stronger and substantially more complex than the accepted V1 path.

This subsystem is frozen research. It is not the default apply implementation, must not enter a future runtime package, and must not receive new durability, cleanup, platform, or public-contract work without a material requirement that reopens ADR 0002. Its detailed behavior and limitations remain in the [interruption contract](development/interruption-contract.md) and the transaction evidence documents. Candidate qualification does not establish power-loss durability, hostile-writer exclusion, or a public platform guarantee.
