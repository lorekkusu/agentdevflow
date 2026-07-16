# Private transaction executor evidence

Snapshot date: 2026-07-16.

## Verdict

**Pass for cooperative multi-file execution and recovery.** A caller-supplied repository lock path, verified recovery store, and real filesystem workspace can now execute one render transaction under an exclusive writer lease, publish the target lock last, and deterministically recover every instrumented forward boundary.

Interruption before target-lock publication rolls back to the base state. Interruption after target-lock publication rolls forward to the target state. Foreign drift fails closed. This does not yet prove behavior after process termination, kernel failure, or power loss.

## Reproduction

Implementation:

- `src/transaction/private-transaction-executor.ts`;
- `src/transaction/private-transaction-store.ts`;
- `src/transaction/private-render-transaction.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/transaction/private-transaction-executor.test.ts`;
- `test/transaction/private-transaction-store.test.ts`;
- `test/transaction/private-render-transaction.test.ts`.

Run:

```bash
npm install
npm run check
```

The executor-specific suite contains 14 tests including eight boundary subtests. The complete suite contains 94 tests at this snapshot.

## Execution order

The caller supplies the project workspace, prepared store, and private repository lock path. The executor rejects a lock path that overlaps a generated output.

Execution uses this order:

```text
acquire writer lease
-> verify transaction, manifest, journal, locks, and every blob
-> verify actual base lock and all before digests
-> persist outputs-applying
-> compare and apply each changed output
-> verify all target outputs while the base lock remains
-> compare and publish the target lock
-> persist lock-written
-> verify target lock and all target outputs
-> persist committed
-> release writer lease
```

Every mutation compares the immediately observed digest with the state captured before that mutation. `retain` operations do not rewrite equal content. Each write is re-read and verified before execution continues.

## Recovery branch

Private journal revision 1 now has two terminal outcomes:

```text
prepared -> outputs-applying -> lock-written -> committed
                            \-> rolled-back
```

The additional `rolled-back` state closes a protocol gap: restoring base bytes without a terminal journal would otherwise leave a recovered transaction permanently marked in progress.

Recovery observes the actual lock and every transaction path:

- base lock plus before/after mixtures rolls changed paths back and persists `rolled-back`;
- target lock plus before/after mixtures completes target paths, persists `lock-written` when needed, and commits;
- exact `committed` and `rolled-back` states are idempotent;
- a `prepared` store with an exact base state remains `ready` for first execution;
- a foreign lock, malformed lock, unknown path digest, or terminal-state drift fails closed.

## Boundary injection

The executor emits deterministic events after each persisted journal state, changed output, target-lock publication, and target verification.

Automated tests interrupt and then recover at all eight forward boundaries in the Balanced-to-Fast fixture:

1. `outputs-applying` journal persistence;
2. Cursor output mutation;
3. Codex output mutation;
4. Claude Code output mutation;
5. target-lock publication;
6. `lock-written` journal persistence;
7. target-state verification;
8. `committed` journal persistence.

The first four boundaries end in the exact base state and `rolled-back`. The last four end in the exact target state and `committed`. A separate fixture injects foreign drift after interruption and confirms that recovery refuses to mutate further.

## Limitations

- Fault injection throws cooperatively inside one live Node.js process; it is not a process-kill or power-loss experiment.
- The `finally` path releases the writer lease after injected exceptions. A real process crash can leave a stale lease.
- No automatic stale-lease takeover or operator recovery procedure exists.
- Directory entries are not synchronized after rename, link, or unlink.
- Path inspection remains vulnerable to hostile concurrent parent replacement between path-based checks.
- Completed and rolled-back stores are not archived, reset, or garbage-collected.
- Windows, Linux, network filesystems, case folding, and hard-link edge cases remain untested.
- The lock path, store path, internal revisions, and serialized records are private implementation details.
- No public schema, configuration filename, lock filename, or CLI behavior is selected.

## Next experiment

Run subprocess termination tests at the same boundaries and define an explicit stale-writer recovery procedure that fails closed unless the persisted store and observable repository state agree. Then add directory synchronization experiments on the intended operating-system support set before calling roadmap step 4 durable.
