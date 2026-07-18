# Private render command contract

## Status

This contract defines the internal render command service that composes exact-plan retention, forward-convergent output apply, verification, and private lock publication. It does not define a public command, API, configuration format, snapshot format, lock format, or filesystem location.

## Required inputs

The caller supplies:

- a validated private source materialization;
- an exact private render-plan snapshot;
- the expected base private render lock, or explicit absence;
- a private lock path;
- a safe convergent filesystem workspace.

The service does not discover or persist these inputs. Snapshot and lock placement remain caller responsibilities until command discovery and storage are designed with migration evidence.

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

A foreign lock fails before output mutation. A target lock with incomplete outputs fails as contradictory state. The service does not silently repair or overwrite either condition.

This design adds no multi-state journal. The before-or-after states are the exact output digests and exact base-or-target lock bytes.

## Explicit non-claims

The private service does not claim:

- recovery without the exact snapshot, materialization, and base-lock expectation;
- durable snapshot or lock discovery;
- a stable serialized snapshot or lock format;
- a stable lock or configuration filename;
- cross-file atomic visibility;
- hostile concurrent-writer exclusion;
- power-loss or filesystem-corruption durability;
- network or distributed filesystem behavior;
- a production CLI or public exit-code contract.

The stronger write-ahead implementation remains non-default evidence. Extending it requires a separately accepted property that the V1 service cannot satisfy.
