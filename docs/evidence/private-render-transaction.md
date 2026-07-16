# Private render transaction evidence

Snapshot date: 2026-07-16.

## Verdict

**Pass for the private transaction protocol slice.** A render plan can now be converted into deterministic before-and-after preconditions, a target lock intent, a write-ahead journal state machine, and fail-closed recovery decisions.

This document validates the in-memory protocol. The [private transaction store](private-transaction-store.md) persists recovery content and journal state, and the [private transaction executor](private-transaction-executor.md) coordinates generated outputs with the target lock under cooperative fault injection. Roadmap step 4 remains in progress.

## Reproduction

Implementation:

- `src/renderer/contract.ts`;
- `src/renderer/staged-adapter.ts`;
- `src/lock/private-render-lock.ts`;
- `src/transaction/private-render-transaction.ts`.

Automated coverage:

- `test/transaction/private-render-transaction.test.ts`;
- `test/lock/private-render-lock.test.ts`;
- `test/renderer/staged-adapter.test.ts`.

Run:

```bash
npm install
npm run check
```

The transaction-specific suite contains eight tests. The complete suite contains 94 tests at this snapshot.

## Transaction model

Private transaction revision 1 records:

- the render plan digest;
- the nullable base lock digest;
- the target lock digest;
- sorted per-path operations;
- each path's observed before digest and intended after digest;
- an overall canonical transaction digest.

Operations are closed to `write`, `remove`, and `retain`. They contain content digests rather than content, timestamps, random identifiers, host data, temporary directory names, or public storage paths.

The Balanced-to-Fast fixture produces this deterministic transaction digest:

```text
206f6a493332fcee3139e56e52144b9018a4db13ad88dee9f96054644af4f4eb
```

Repeated construction produces a deeply equal transaction.

## Preparation preconditions

Transaction preparation requires all of the following:

1. the base lock, when present, validates;
2. the target lock intent validates;
3. the render plan has canonical sorted paths and a matching canonical digest;
4. every planned content value matches its expected content digest;
5. each plan action is consistent with its observed and expected digest state;
6. the plan safety flag agrees with its diagnostics and conflict actions;
7. the plan is safe to apply;
8. previous ownership exactly matches the base lock;
9. the target lock intent is re-derived from the same source materialization and plan;
10. target renderer identity, input digest, paths, and content digests match the plan.

The staged adapter now captures `observedDigest` for every planned path and includes it in the plan digest. A future filesystem executor must re-check these preconditions immediately before each mutation; capturing them does not eliminate time-of-check/time-of-use races.

## Journal model

Private journal revision 1 has a forward commit path and a terminal rollback branch:

```text
prepared -> outputs-applying -> lock-written -> committed
                            \-> rolled-back
```

Each journal value binds its transaction digest, state, revision, and canonical journal digest. Skipped, repeated, reverse, and terminal-state transitions are rejected.

The journal state records protocol progress, but the observed lock is the recovery anchor. This permits deterministic recovery when a process stops after a filesystem mutation but before the next journal update.

## Recovery decisions

| Journal and observed state | Decision |
| --- | --- |
| Base lock; all paths at before state | Rollback with no path changes |
| Base lock; some paths at after state | Roll back those paths to their before state |
| Target lock; some paths at before state | Roll forward those paths to their after state |
| Target lock; all paths at after state | Complete |
| `lock-written` journal without the target lock | Conflict |
| `committed` journal without the exact target lock and outputs | Conflict |
| `rolled-back` journal with the exact base lock and outputs | Complete terminal rollback |
| `rolled-back` journal with later drift | Conflict |
| Foreign lock, missing observation, malformed digest, or path state outside before/after | Conflict |

Recovery operations are sorted by transaction path. A committed transaction does not silently repair later drift; it reports a conflict for a separate explicit render or recovery action.

## Fault injection observations

Automated tests cover:

- interruption before any output mutation;
- interruption after two of three output mutations while the base lock remains;
- interruption with the target lock present and one output still at its before state;
- target lock plus all target outputs;
- a foreign lock digest;
- a path digest that matches neither the before nor after state;
- a missing observed path;
- a `lock-written` journal contradicted by the base lock;
- output drift after a committed journal;
- corrupt, extended, unsafe, unsorted, and internally inconsistent protocol data.

## Limitations

- A private executor consumes the store, re-checks actual state, applies outputs, publishes the target lock last, and persists a terminal outcome.
- The protocol does not select public lock, journal, staging, backup, or transaction paths.
- The private store has an exclusive cooperative writer lease, but no operating-system advisory lock or stale-lease takeover policy exists.
- A private filesystem workspace now executes transaction mutations with root containment and existing-symlink checks. Hard links, case folding, and other platform-specific path behavior remain unevaluated.
- Single-file writes synchronize temporary-file content and use same-directory replacement, but directory synchronization and power-loss behavior remain untested.
- There is no garbage collection or retention policy for recovery blobs.
- There is no public schema, migration promise, CLI behavior, or configuration syntax.
- The current protocol coordinates one private renderer ownership domain.

## Next experiment

Run subprocess termination and directory-synchronization experiments for the [private transaction executor](private-transaction-executor.md), then define stale-lease recovery and store cleanup without weakening fail-closed behavior.
