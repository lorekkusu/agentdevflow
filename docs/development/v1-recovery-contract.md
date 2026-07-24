# V1 render recovery contract

## Status

This document defines the accepted private V1 render-apply behavior from [ADR 0002](../decisions/0002-v1-forward-convergent-render-apply.md). It does not freeze a public command, plan path, lock path, configuration format, or serialized recovery format.

## Forward-convergence contract

An exact render plan binds every managed path to before and after content digests. Apply proceeds only when all paths initially contain one of those two states. Each path is checked again immediately before mutation.

- A path at its after digest is retained.
- A path at its before digest advances to its after state.
- Any other digest fails closed.
- A repeated apply is a no-op.
- No operation outside the plan is authorized.

The caller must retain or reproduce the exact plan after interruption. Changed inputs require a new plan and do not authorize resuming an older target.

The exact-plan rule applies to ordinary managed create, update, delete, and
exact-adoption operations. A lossless initialization import also binds its
import disposition. If interruption leaves generated provider bytes in place
without the ownership lock, a new plan observes an exact target rather than
the original import. Recovery therefore requires a fresh diff and approval;
the earlier import approval must fail instead of being reinterpreted.

An explicit onboarding replacement differs because the repeated planner input
retains the original observed target digest. When the target is already at the
exact generated digest and the lock is still absent, the CLI may reconstruct
the original approved update. The reconstructed exact snapshot must match the
original approval before lock publication continues.

## Single-file replacement

Writes use a same-directory temporary file whose name is derived from the plan digest, target path, and target digest. The temporary file is synchronized before rename replacement. A regular file at that exact reserved path is treated as resumable staging owned by the exact plan, removed, and recreated exclusively; a symbolic link or non-file entry fails closed, as does a competing creation.

Deletes converge from the before digest to absence. Other processes may observe mixed before and after files during apply. This is recoverability by rerun, not cross-file atomic visibility.

The process-termination workspace deliberately does not synchronize parent
directories. Parent-directory synchronization, write-ahead state, rollback,
and power-loss durability are outside the accepted contract.

## Git boundary

Repository-wide cleanliness does not authorize or prohibit a managed-path mutation. Git status may support diagnostics or an operator policy, but the apply implementation does not automatically reset, clean, stash, commit, or switch branches.

Destructive Git recovery remains an explicit operator action outside render authority.

## Verified behavior

Local automated fixtures cover:

- create and update convergence at every temporary creation, content synchronization, rename, and path-completion boundary;
- delete convergence immediately before and after unlink;
- real child-process termination with `SIGKILL` at every write boundary;
- exact-plan rerun from mixed before and after files;
- fresh diff and approval after an interrupted lossless initialization import
  changes the observed disposition;
- exact approved rerun after an explicit onboarding replacement reaches target
  bytes before lock publication;
- deterministic cleanup of reserved regular temporary files;
- refusal of symbolic-link temporary paths and foreign managed-path digests;
- no-op repeated apply.

See [forward-convergent apply evidence](../evidence/private-convergent-apply.md) and the separate [V1 platform qualification](../evidence/v1-platform-qualification.md).

## Explicit non-claims

V1 does not claim:

- automatic rollback;
- recovery without the exact plan or reproducible target bytes;
- cross-file atomic visibility;
- power-loss, kernel-failure, storage-cache, or filesystem-corruption durability;
- hostile concurrent-writer exclusion;
- network or distributed filesystem behavior;
- support on a platform that has not passed the V1 qualification matrix.

The stronger write-ahead prototype was removed from the executable tree. Its
journal, writer-clearance, cleanup, and directory-synchronization properties
are not part of V1. ADR 0002 defines the evidence required to revisit stronger
durability.
