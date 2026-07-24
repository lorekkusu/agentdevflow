# Private render command contract

## Status

This contract defines the internal service behind the current beta `render`
command. It composes exact-plan retention, forward-convergent output apply,
verification, and lock publication. Its TypeScript API, snapshot bytes, and
lock bytes remain private; public paths and command behavior belong in the
[beta CLI contract](beta-cli-contract.md).

## Required inputs

The caller supplies:

- a validated private source materialization;
- an exact private render-plan snapshot;
- the expected base private render lock, or explicit absence;
- a private lock path;
- a safe convergent filesystem workspace.

The service does not discover or persist these inputs. Snapshot and lock placement remain caller responsibilities until command discovery and storage are designed with migration evidence.

## Private CLI composition

The CLI accepts explicit repository, revision-1 configuration, lock, and
approval values. The value passed to `--approve-plan` is the complete private
plan-snapshot digest, not the narrower renderer plan digest. Preparation also
reads canonical guidance. When the lock is absent, it stages native targets
and binds exact adoption, proven equivalent-content import, or explicit
whole-file replacement into that snapshot. Unsupported existing bytes keep the
plan blocked unless a matching replacement input is present.

The CLI sequence is:

1. read the explicit configuration and open a read-only repository workspace;
2. prepare the authoritative exact plan;
3. classify blocked state before approval can authorize mutation;
4. require the supplied approval to equal the complete snapshot digest;
5. reread the configuration and only then open the mutation-capable workspace;
6. reprepare the exact plan and require the same approved digest again;
7. invoke this render service with the fresh exact preparation;
8. report applied or clean state and the exact and renderer plan digests.

No user supplies materialization, lock objects, plans, or snapshots. A clean render still requires the current exact approval but obtains no mutation-capable workspace.

## Exact plan snapshot

The snapshot digest binds every execution-relevant plan field, including:

- backend identity and version;
- input, source, and plan digests;
- paths, actions, observed digests, target bytes, target digests, and source references;
- diagnostics and the safety flag;
- sorted previous ownership claims.

The runtime validator rejects unknown fields, missing fields, unsupported actions, malformed ownership claims, a corrupted plan digest, or a corrupted snapshot digest. This closes the gap where the renderer plan digest alone did not bind previous ownership or complete diagnostics.

## Execution sequence

The service performs the following sequence:

1. validate the exact snapshot and optional base lock;
2. require plan previous ownership to equal ownership derived from the base lock;
3. derive the target lock before project mutation;
4. reject overlap between the caller-supplied lock path, its deterministic temporary path, managed outputs, and output temporary paths;
5. require current lock bytes to equal exact base or target bytes;
6. reject a target lock paired with incomplete outputs;
7. apply the exact output plan through before-or-after digest convergence;
8. verify every managed output against the exact plan;
9. create the verified target lock and require it to equal the precomputed target;
10. publish the lock through synchronized single-file forward convergence;
11. verify exact target lock bytes before returning success.

The lock is published only after output verification. The service never authorizes a repository-wide Git reset, clean, stash, commit, or branch operation.

## Interruption behavior

If execution stops after some outputs change but before lock publication, the exact snapshot and base lock resume remaining output work and then publish the target lock. If execution stops after lock rename replacement, a rerun accepts the target lock only when all outputs already match their target digests.

The CLI does not persist a second snapshot or journal. While the base lock or explicit absence remains authoritative, it reconstructs the originally approved all-before actions when an interrupted path is already at its exact target. Only an exact target observation can replace a conflict or post-delete absence with its base observation; unrelated conflicts remain blocked. The reconstructed snapshot must equal the original approval, and this service then rechecks every actual before-or-target digest. A completed target-lock state is handled as a newly clean exact plan.

An interrupted initialization import has a narrower recovery claim. Once its different original before-bytes have been replaced, a digest-only CLI approval cannot reconstruct that lost observation. The stale import approval fails; a new diff may classify the exact target as adoption and requires a new explicit approval before completing lock publication. This is safe forward convergence with renewed review, not original-plan replay.

An explicit whole-file replacement retains its original observed digest in the
repeated planner input. If the target is already at the exact generated digest
and the lock remains absent, the CLI can reconstruct the approved update
action. The reconstructed snapshot must equal the supplied approval before the
normal convergent service may publish the lock.

A foreign lock fails before output mutation. A target lock with incomplete outputs fails as contradictory state. The service does not silently repair or overwrite either condition.

This design adds no multi-state journal. The before-or-after states are the exact output digests and exact base-or-target lock bytes.

## Explicit non-claims

The private service does not claim:

- recovery without the exact snapshot, materialization, and base-lock expectation;
- another snapshot or journal beyond the current configuration, outputs, and
  ownership lock;
- a stable serialized snapshot or lock format;
- 1.0 stability for the beta lock or configuration filename;
- cross-file atomic visibility;
- hostile concurrent-writer exclusion;
- power-loss or filesystem-corruption durability;
- network or distributed filesystem behavior;
- public stability for the internal TypeScript service.

The stronger write-ahead prototype was removed from the executable tree.
Reintroducing stronger durability requires a reproduced in-scope failure and a
separately accepted property that this service cannot satisfy.
