# 0002: V1 forward-convergent render apply

Status: Accepted

Date: 2026-07-17

## Context

`agentdevflow` must apply multiple generated files without discarding unrelated repository work and without presenting a partially updated file set as complete. The private write-ahead transaction prototype proves deterministic rollback and roll-forward after tested process termination, but it also requires persistent blobs, journals, writer evidence, cleanup receipts, lifecycle ownership, and platform-specific directory-durability qualification.

A comparative experiment evaluated three recovery strategies at the same complete-file failure boundary. A clean Git worktree plus `git reset --hard` discarded concurrent tracked work and did not restore ignored or untracked managed paths. Digest-aware rerun preserved unrelated work, completed the intended target, and rejected foreign managed-path content. The write-ahead journal provided the strongest recovery semantics at the highest implementation and platform cost.

The first product version needs deterministic rendering, ownership, drift refusal, and safe rerun. It does not require automatic rollback, recovery without reproducible inputs, storage durability after power loss, or a public transaction log.

## Decision

Use staged, digest-aware forward convergence as the default V1 render-apply contract.

An apply plan binds every managed path to exact before and after content digests. Before any target mutation, every path must contain either its planned before or after state. Each path is checked again before mutation. A path already at its after state is retained; a path at its before state advances to its after state; any other state fails closed.

Writes use a synchronized same-directory temporary file and rename replacement. The temporary path is derived deterministically from the plan digest, target path, and target digest inside a reserved private namespace. Rerun may reclaim a regular file at that exact derived path because the reproducible plan is the ownership intent. Symbolic links, directories, unsafe paths, and unexpected target digests are rejected.

Deletes converge from the planned before digest to absence. The operation provides forward convergence, not automatic rollback or cross-file atomic visibility. Other processes may observe a mixture of before and after files while apply is running.

A clean overall Git worktree is not required. Git status may be used as an optional diagnostic or operator policy, but `agentdevflow` must not automatically execute destructive reset or clean commands. Ownership and digest checks, not repository-wide cleanliness, authorize managed-path mutation.

The existing write-ahead transaction implementation remains private experimental evidence and is not the V1 default. New Windows directory-durability and power-loss work is paused until a concrete requirement justifies the stronger contract.

## Consequences

V1 retains an independent ownership and recovery layer without requiring a durable multi-state journal. Tracked, untracked, and ignored managed targets use the same digest rules, and unrelated repository changes remain outside the mutation set.

The caller must retain or reproduce the exact apply plan after interruption. Changed source input creates a new plan and cannot silently resume the old one. The initial implementation does not select a public plan path, lock path, configuration filename, or serialized recovery format.

The contract covers process termination around complete single-file replacement. File content is synchronized before rename, but parent directories are not synchronized. The project therefore does not claim survival after power loss, kernel failure, storage-cache loss, or filesystem corruption.

A hostile concurrent writer remains out of scope. Path rechecks narrow cooperative races but cannot make path-based filesystem APIs an authorization boundary.

## Alternatives considered

- **Require a clean Git worktree and reset on failure.** Rejected as the default because reset discards tracked work while untracked and ignored cleanup requires broader destructive commands that do not establish generated-file ownership.
- **Keep the write-ahead journal as the default.** Retains stronger rollback and roll-forward semantics, but the current product requirements do not justify its persistent state, cleanup, operator, migration, and platform surface.
- **Use direct writes and rely only on rerun.** Rejected because partial bytes, foreign edits, and newly created managed paths need explicit digest and temporary-file ownership rules.

## Evidence

- [Workspace recovery strategy comparison](../evidence/workspace-recovery-strategy-comparison.md)
- [Private transaction subprocess evidence](../evidence/private-transaction-subprocess.md)
- [Candidate platform qualification](../evidence/candidate-platform-qualification.md)
- Automated coverage in `test/renderer/private-convergent-apply.test.ts`
- Subprocess coverage in `test/renderer/private-convergent-subprocess.test.ts`

## Security and disclosure considerations

The deterministic temporary namespace is a cooperative ownership convention, not protection against another process with repository write access. A regular file at the exact derived path may be replaced during recovery; symbolic links and non-file entries fail closed.

Automatic Git reset, clean, stash, commit, or branch mutation is outside the apply authority. Diagnostics must describe tested process-termination behavior separately from untested power-loss durability.

No private prompt, transcript, machine path, or user identity is part of the plan or evidence.

## Revisit triggers

- V1 requires automatic rollback rather than forward convergence.
- Recovery must proceed when exact target inputs cannot be reproduced.
- A durable commit anchor is required across generated files and lock state.
- Power-loss durability becomes a supported product requirement.
- Hostile concurrent writers must be detected or excluded mechanically.
- The smaller implementation grows comparable to the retained write-ahead transaction system.

## Supersedes

None. This decision selects the V1 default while retaining the stronger private transaction prototype as non-default evidence.
