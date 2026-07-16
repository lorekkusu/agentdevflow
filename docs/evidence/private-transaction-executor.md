# Private transaction executor evidence

Snapshot date: 2026-07-17.

## Verdict

**Pass for recoverable multi-file execution through tested process-termination boundaries on Darwin.** A caller-supplied repository lock path, verified recovery store, and real filesystem workspace can execute one render transaction under an exclusive writer lease, publish the target lock last, and deterministically recover every instrumented forward boundary after cooperative faults or `SIGKILL`.

Interruption before target-lock publication rolls back to the base state. Interruption after target-lock publication rolls forward to the target state. Foreign drift fails closed. This proves the tested Node.js subprocess behavior on the recorded Darwin environment, not kernel-failure, power-loss, or cross-platform durability.

## Reproduction

Implementation:

- `src/transaction/private-transaction-executor.ts`;
- `src/transaction/private-transaction-store.ts`;
- `src/transaction/private-render-transaction.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/transaction/private-transaction-executor.test.ts`;
- `test/transaction/private-transaction-subprocess.test.ts`;
- `test/fixtures/transaction/private-transaction-subprocess-worker.ts`;
- `test/transaction/private-transaction-store.test.ts`;
- `test/transaction/private-render-transaction.test.ts`.

Run:

```bash
npm install
npm run check
```

The cooperative executor suite contains 34 tests including twenty-one boundary subtests. The subprocess suite contains 30 tests including twenty-four boundary subtests. The complete suite contains 170 tests at this snapshot.

## Execution order

The caller supplies the project workspace, prepared store, and private repository lock path. The executor rejects a lock path that overlaps a generated output.

Execution uses this order:

```text
acquire writer lease
-> reclaim only cleared exact temporary intents and refuse every uncleared temporary
-> verify transaction, manifest, journal, locks, and every blob
-> verify actual base lock and all before digests
-> persist outputs-applying
-> compare each changed output, persist its mutation intent, and apply it
-> verify all target outputs while the base lock remains
-> compare, persist the lock mutation intent, and publish the target lock
-> persist lock-written
-> verify target lock and all target outputs
-> persist committed
-> release writer lease
```

Every mutation verifies the active writer lease and compares the immediately observed digest with the state captured before that mutation. `retain` operations do not rewrite equal content. Each write is re-read and verified before execution continues. Mutation intent is durable before the repository temporary file is created.

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

The executor emits deterministic events after temporary creation and synchronization, each persisted journal state, changed output, target-lock publication, temporary reclamation, and target verification.

Automated tests interrupt and then recover at the eight original forward boundaries in the Balanced-to-Fast fixture:

1. `outputs-applying` journal persistence;
2. Cursor output mutation;
3. Codex output mutation;
4. Claude Code output mutation;
5. target-lock publication;
6. `lock-written` journal persistence;
7. target-state verification;
8. `committed` journal persistence.

The first four boundaries end in the exact base state and `rolled-back`. The last four end in the exact target state and `committed`. A separate fixture injects foreign drift after interruption and confirms that recovery refuses to mutate further.

Cooperative tests also interrupt `AGENTS.md` immediately after owned temporary creation and synchronization. The workspace removes the partial file before the exception escapes, and recovery returns exact base state. A recorded partial file without writer clearance is a conflict; the same exact file becomes reclaimable only after evidence-bound clearance is persisted.

## Process termination and stale writers

The separate [subprocess recovery fixture](private-transaction-subprocess.md) blocks after the original eight events plus repository temporary creation and synchronization, is terminated by its parent with `SIGKILL`, and leaves its writer record behind. Normal recovery refuses that record. Only the parent that observed process exit then captures an opaque writer fingerprint, persists matching clearance, and removes the unchanged record while binding the action to the prepared transaction digest.

At the two temporary boundaries, the child leaves either an empty regular file or synchronized target bytes at the exact intent path. Resumed recovery removes only that path, emits `temporary-reclaimed`, and restores exact base state. A symbolic-link replacement fails closed without changing its target. See [temporary-file ownership evidence](private-temporary-file-ownership.md).

This is an explicit operator boundary, not automatic takeover or process-liveness detection. Clearing a writer while its owner is still active violates the protocol. The executor verifies its lease immediately before project mutation and stops if the record was removed, but the cooperative lock does not eliminate hostile races between verification and a filesystem call.

## Recovery-process termination

The recovery fixture has two explicit anchors:

- base lock with all changed outputs at their after bytes, which requires three rollback mutations;
- target lock with all changed outputs at their before bytes, which requires three roll-forward mutations.

The target-anchor mixture is a valid recovery input used to exercise the protocol. Normal execution writes all target outputs before publishing the target lock and does not intentionally produce this mixture.

Cooperative and subprocess tests interrupt eleven recovery boundaries:

1. three rollback output mutations;
2. base-state verification;
3. `rolled-back` journal persistence;
4. three roll-forward output mutations;
5. `lock-written` journal persistence;
6. target-state verification;
7. `committed` journal persistence.

Every killed child leaves a writer record. Normal recovery refuses it; after the parent observes child termination and clears exact stale-writer evidence, another recovery reaches the deterministic terminal state. Foreign drift inserted after termination remains a conflict and leaves the nonterminal journal unchanged.

## Limitations

- Path inspection remains vulnerable to hostile concurrent parent replacement between path-based checks.
- Terminal stores are retired and removed under a dedicated private parent whose immutable receipts are retained for the parent lifetime.
- Windows, Linux, network filesystems, case folding, and hard-link edge cases remain untested.
- Directory synchronization is exercised but power-loss behavior is not.
- A hostile regular file placed at an exact cleared intent path cannot be distinguished from owned partial bytes; symbolic links and non-regular files fail closed.
- The lock path, store path, internal revisions, and serialized records are private implementation details.
- No public schema, configuration filename, lock filename, or CLI behavior is selected.

## Next experiment

Repeat execution, recovery, temporary-file reclamation, cleanup, parent-disposal inspection, and directory-synchronization experiments on every supported release platform before calling roadmap step 4 complete.
