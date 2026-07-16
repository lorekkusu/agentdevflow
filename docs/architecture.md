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

## Transaction boundary

Multi-file rendering must provide recoverability rather than claim cross-file atomicity. A private transaction binds every affected path to an observed before digest and intended after digest, plus base and target lock digests. The base lock is the rollback anchor until the target lock is present; the target lock is the roll-forward anchor after that point.

A write-ahead journal records strict protocol progress, but recovery also inspects the observable lock and path digests. Any foreign lock or path state outside the recorded before-and-after set fails closed. A committed transaction does not silently repair subsequent drift.

The private filesystem workspace canonicalizes the repository root, rejects non-canonical relative paths and existing symbolic-link traversal, and restricts leaves to regular files. Its checks use path-based Node.js APIs and do not prevent another process from replacing a parent between inspection and mutation.

The caller-supplied private transaction store persists content-addressed before-and-after bytes, canonical transaction records, and journal state. It publishes `prepared` only after every required blob revalidates and uses an exclusive opaque writer lease for cooperative process exclusion. It does not automatically reclaim a stale lease. An operator may clear one unchanged writer record only after independently confirming that the owner process terminated and matching both captured writer evidence and the prepared transaction digest.

The private executor re-checks its writer lease and content preconditions before project mutation, persists the target lock last, verifies the resulting target state, and produces terminal `committed` or `rolled-back` journals. The target lock is the point after which recovery must roll forward; before that point, recovery rolls back. Cooperative faults and Darwin subprocess termination exercise the forward mutation boundaries.

Before a transaction-owned repository write creates a same-directory temporary file, the private store persists a canonical mutation intent bound to the transaction digest, writer fingerprint, target path, target digest, and deterministic temporary path. Stale-writer clearance is persisted before the unchanged writer record is removed. A new writer may reclaim only exact intent paths with matching clearance and otherwise fails closed. This protocol uses no directory scan, age threshold, PID, or automatic liveness inference. It rejects symbolic links and non-regular leaves, but it cannot distinguish hostile regular-file replacement at the exact authorized path from partial owned bytes.

The private filesystem synchronizes file content and affected directory entries, and refuses to open on a filesystem where its directory synchronization probe fails. This is exercised on Darwin but does not prove power-loss behavior or another platform.

A terminal transaction may be retired only after the executor verifies exact repository and lock state. Retirement is an immutable barrier: the prepared store cannot acquire another writer or return to active use. A dedicated caller-supplied parent must be claimed while empty by a canonical private owner record. The lifecycle revalidates that record, atomically renames the single-use store to a deterministic tombstone, writes a digest-bound cleanup receipt containing the authorized file inventory, audits known records, regular blobs, and recognized temporary files, then removes and synchronizes the tombstone. A partially removed tombstone can resume only while every remaining path and byte digest matches that inventory. Marker, tombstone, and receipt states make process-terminated cleanup idempotent.

Cleanup receipts remain immutable for the parent lifetime because deleting one would erase the distinction between completed cleanup and unknown history. A read-only disposal snapshot succeeds only when the dedicated parent contains the owner record and canonical receipts, with no active store, tombstone, symbolic link, or foreign entry. It binds every receipt digest but does not delete or lock the parent. Whole-parent disposal remains an explicit future administrative action requiring external exclusion.

Recovery is also process-termination tolerant on the tested Darwin environment. A base-lock anchor repeatedly restores before bytes and terminates as `rolled-back`; a target-lock anchor repeatedly restores after bytes and terminates as `committed`. All eleven recovery mutation boundaries have cooperative and `SIGKILL` coverage. Repository temporary-file creation and synchronization also have cooperative and `SIGKILL` coverage. The target-anchor partial fixture is an accepted recovery input, not a state produced by the normal executor order. The supported-platform guarantee remains an explicit prerequisite for completing the transactional workspace step.

A blocking candidate matrix is prepared for explicit Ubuntu, macOS, and Windows GitHub-hosted images on Node.js 22 and 24. It probes required filesystem primitives and runs the entire suite with zero skips. These are qualification candidates rather than support claims; only the local Darwin arm64 Node.js 24 cell has observed evidence in the working tree. See [candidate platform qualification](evidence/candidate-platform-qualification.md).

The durable [interruption contract](development/interruption-contract.md) separates tested recoverability from cross-file atomicity and power-loss durability. Platform qualification cannot widen that claim without new evidence.
