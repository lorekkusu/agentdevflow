# Private transaction parent lifecycle evidence

Snapshot date: 2026-07-17.

## Verdict

**Pass for private parent ownership and cleanup-receipt retention.** Transaction stores, tombstones, and cleanup receipts now live under a caller-supplied dedicated parent that must be claimed while empty by a canonical owner record. Cleanup revalidates that ownership record before mutation. Receipts are immutable and retained for the entire parent lifetime.

A read-only disposal snapshot succeeds only after no active store, tombstone, symbolic link, foreign entry, or invalid receipt remains. It binds the parent owner record and every canonical receipt digest. The implementation does not automatically delete the parent and does not select a public path, retention duration, or CLI command.

## Reproduction

Implementation:

- `src/transaction/private-transaction-store-lifecycle.ts`;
- `src/transaction/private-transaction-store.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/transaction/private-transaction-store-lifecycle.test.ts`;
- `test/transaction/private-transaction-subprocess.test.ts`;
- `test/fixtures/transaction/private-transaction-cleanup-subprocess-worker.ts`.

Run:

```bash
npm install
npm run check
```

The lifecycle suite contains twelve tests including three cooperative boundary subtests. The subprocess suite contains thirty tests including twenty-four boundary subtests. The complete suite contains 170 tests at this snapshot.

## Dedicated parent contract

Initialization requires an existing empty non-symlink directory. It publishes one canonical private owner record containing:

- private revision;
- fixed private lifecycle owner identity;
- `parent-lifetime` receipt-retention policy;
- record digest.

Initialization rechecks that the record is the only entry after publication. Later lifecycle opening requires the exact canonical record. Cleanup and disposal inspection re-read the record before acting and fail if it is absent, changed, extended, malformed, non-canonical, or digest-invalid.

The owner record proves only cooperative namespace ownership. It does not authenticate a user or prevent a hostile process with filesystem write access from replacing parent entries.

## Receipt retention

Each completed store cleanup leaves one immutable canonical receipt in the dedicated parent. The receipt remains the durable distinction between:

- a store that completed deletion;
- a tombstone whose recursive removal must resume;
- a store that never existed or whose history is unknown.

Individual receipt deletion and time-based pruning are intentionally unsupported. Deleting a receipt would remove the evidence required for idempotent cleanup. The retention unit is therefore the entire dedicated parent, not an individual transaction or an arbitrary number of days.

This is a conservative private policy rather than a public storage promise. A future public design may replace individual receipts with a compacted ledger only if it preserves the same identity, terminal-state, and retry evidence.

## Disposal snapshot

`prepareParentDisposal()` is read-only. It requires the parent to contain only:

- the current canonical owner record;
- zero or more canonical cleanup receipts whose filenames match their store and transaction identities.

It rejects active store directories, tombstones, symbolic links, foreign files, invalid receipts, and receipts stored under unexpected names. The deterministic snapshot binds the owner-record digest and sorted references containing store name, transaction digest, and receipt digest.

The snapshot means the observed parent has no known in-progress lifecycle work. It is not a deletion capability and does not lock the directory against a new store created afterward. A future caller that deletes the parent must separately ensure exclusive parent administration and explicitly accept that all retained retry evidence will be discarded together.

## Observations

Automated tests demonstrate:

- only an empty directory can be initialized;
- opening an unclaimed parent fails;
- canonical owner records round-trip exactly and declare parent-lifetime retention;
- repeated initialization, non-empty initialization, and corrupted owner records fail closed;
- an already opened lifecycle refuses cleanup after owner-record corruption;
- a parent containing an active store or tombstone is not disposable;
- foreign parent content is not disposable;
- completed cleanup produces a deterministic receipt reference in the disposal snapshot;
- disposal inspection still succeeds after recovery from cooperative and `SIGKILL` cleanup interruption;
- all existing retirement, partial-removal, symbolic-link, unknown-entry, and receipt-resumption behavior remains intact under the dedicated parent.

## Limitations

- Parent initialization and disposal inspection use path-based APIs and a cooperative recheck, not an operating-system directory lock.
- A disposal snapshot can become stale immediately if another process creates a store or changes the parent.
- There is no automatic parent deletion, per-receipt pruning, retention timer, size threshold, or compaction.
- Parent deletion would intentionally discard all cleanup retry evidence and requires future explicit caller authority and exclusion.
- `SIGKILL` cleanup recovery is tested on the recorded Darwin environment; sudden power loss and other release platforms remain unqualified.
- The owner filename, receipt filenames, revisions, parent path, and disposal API are private implementation details.

## Recommendation

Retain the dedicated-parent and parent-lifetime receipt policy for the private transactional workspace. It avoids silent evidence loss and makes eventual parent disposal an explicit administrative boundary. Next qualify the complete execution, recovery, reclamation, and cleanup protocol on intended release platforms; do not add receipt pruning until a compacted representation can preserve equivalent retry evidence.
