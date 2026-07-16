# Private transaction cleanup evidence

Snapshot date: 2026-07-17.

## Verdict

**Pass for a private single-use store lifecycle on the tested Darwin environment.** An exact terminal transaction can be retired, made permanently unavailable for writer acquisition, atomically tombstoned, audited, removed, and identified afterward by a canonical digest-bound receipt. Cleanup resumes deterministically after cooperative faults and real subprocess termination at every lifecycle boundary.

This lifecycle removes valid content-addressed orphan blobs and recognized store-local temporary files without resetting a prepared store in place. It fails closed on terminal repository drift, an active or stale writer, unknown entries, corrupt orphan blobs, symbolic links, mismatched records, unsafe store names, or a contradictory receipt.

## Reproduction

Implementation:

- `src/transaction/private-transaction-store-lifecycle.ts`;
- `src/transaction/private-transaction-store.ts`;
- `src/transaction/private-transaction-executor.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/transaction/private-transaction-store-lifecycle.test.ts`;
- `test/transaction/private-transaction-subprocess.test.ts`;
- `test/fixtures/transaction/private-transaction-cleanup-subprocess-worker.ts`;
- `test/fixtures/transaction/private-transaction-subprocess-worker.ts`.

Run:

```bash
npm install
npm run check
```

The lifecycle suite contains twelve tests including three cooperative boundary subtests. The subprocess suite contains thirty tests including twenty-four boundary subtests. The complete suite contains 170 tests at this snapshot.

Recorded environment:

```text
Node.js v24.14.0
darwin arm64
Darwin kernel 25.5.0
```

## Single-use store protocol

The caller supplies an existing parent directory and a canonical single-segment store name. These remain private inputs; the experiment does not select a project path, discovery rule, public transaction identifier, or cleanup command.

The protocol is:

```text
acquire writer
-> verify terminal journal and every recovery record
-> verify exact terminal repository outputs and lock
-> persist canonical retirement marker
-> release writer
-> verify retirement and absence of a writer
-> rename store to deterministic tombstone
-> synchronize parent directory
-> publish canonical cleanup receipt
-> audit tombstone tree and recovery records again
-> remove tombstone
-> synchronize parent directory
```

The retirement marker binds transaction digest, manifest digest, and `committed` or `rolled-back` state. Once present, it prevents new writer acquisition and every ordinary store mutation. The store cannot be reset or reused.

The receipt binds the private store name, transaction digest, retirement digest, terminal state, and a sorted inventory of every authorized store file and byte digest. It is written before tombstone removal so a later invocation can distinguish completed removal from a store that never existed. Receipt plus tombstone means cleanup must resume; receipt without source or tombstone means cleanup completed. Source plus receipt, source plus tombstone, and absence without a matching receipt are conflicts.

## Deletion audit

Before rename and immediately before removal, cleanup reopens and verifies the complete retired store. It requires canonical transaction, manifest, journal, retirement, lock, and required blob records. The tree audit accepts only:

- the known root records and `blobs` directory;
- canonical repository temporary-intent and writer-clearance registries when present;
- regular content-addressed blobs whose bytes match their filename digest;
- recognized same-directory private temporary-file names.

The audit rejects a writer record, symbolic link, unknown root or blob entry, non-regular file, missing required record, corrupt required blob, or corrupt content-addressed orphan blob. A subprocess can leave a partial recognized temporary file; because the entire verified single-use store is retired and caller-owned, that temporary file is included in the inventory and removed with its tombstone.

Recursive removal is not atomic. If interruption leaves only part of the tombstone, cleanup no longer requires the deleted recovery records to reappear. Instead, every remaining regular file must still be an inventory path with the same byte digest. Missing inventory members are accepted as already removed; a new path or changed content fails closed. The lifecycle fixture removes a journal and blob after receipt publication, resumes successfully, and separately confirms that replaced remaining bytes are rejected.

## Interruption evidence

Cooperative tests stop after tombstone publication, receipt publication, and tombstone removal. Re-entering from every state produces the same receipt and no remaining source store or tombstone.

Subprocess tests repeat all three boundaries with `SIGKILL`. A fourth test terminates after retirement marker publication but before writer release. The marker blocks reuse, the remaining writer blocks cleanup, and only explicit evidence-matched stale-writer removal after observed process death permits cleanup to continue.

## Limitations

- Only the recorded Darwin environment is tested; Windows and Linux behavior is unqualified.
- `SIGKILL` does not establish sudden-power-loss or kernel-failure durability.
- Path inspection, rename, audit, and recursive removal use path-based APIs and cannot defeat a hostile process replacing entries between checks.
- Node.js recursive removal is used only after the explicit tree audit; no operating-system directory capability prevents a hostile post-audit race.
- Repository-side temporary files are outside the retired store and are reclaimed only through the separate exact intent-and-clearance protocol before retirement.
- Cleanup receipts remain immutable for the dedicated parent lifetime. No per-receipt pruning or compaction protocol is selected.
- Parent path, store name, tombstone name, receipt name, marker format, and revisions are private implementation details.

## Recommendation

Retain the single-use store lifecycle. Do not add in-place reset. Keep the [repository temporary-file ownership](private-temporary-file-ownership.md) and [parent lifecycle](private-transaction-parent-lifecycle.md) protocols as prerequisites while qualifying another release platform. Do not freeze a public storage layout yet.
