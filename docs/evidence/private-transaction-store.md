# Private transaction store evidence

Snapshot date: 2026-07-17.

## Verdict

**Pass for persistent recovery preparation and repository temporary-file ownership records.** A caller-supplied private store can persist every before-and-after output, base and target lock bytes, a canonical transaction, a recovery manifest, a `prepared` journal, deterministic repository mutation intents, and explicit stale-writer clearances under one exclusive writer lease.

The prepared journal is written only after the store re-reads and verifies every required content-addressed blob and both lock records. The separate private executor consumes this state to apply generated outputs and the target lock; the store remains responsible only for durable recovery material, writer authority, and private ownership records.

## Reproduction

Implementation:

- `src/transaction/private-transaction-store.ts`;
- `src/transaction/private-temporary-intent.ts`;
- `src/transaction/private-render-transaction.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/transaction/private-transaction-store.test.ts`;
- `test/transaction/private-render-transaction.test.ts`;
- `test/workspace/private-filesystem-workspace.test.ts`.

Run:

```bash
npm install
npm run check
```

The store-specific suite contains twelve tests. The complete suite contains 170 tests at this snapshot.

## Storage boundary

The caller supplies an existing store directory. This experiment does not select a project-relative directory, public discovery rule, retention path, or CLI default.

Private recovery manifest revision 1 binds:

- the transaction digest;
- the nullable base render-lock digest and its serialized blob digest;
- the target render-lock digest and its serialized blob digest;
- the sorted, unique set of every required content blob;
- a canonical manifest digest.

Output content is addressed directly by the same SHA-256 digest recorded in each transaction operation. Lock bytes use separate blob digests because the render-lock digest describes the lock model rather than its serialized bytes.

The Balanced-to-Fast fixture produces this deterministic manifest digest:

```text
8bc7fced54e1552ce29632f3c3d5a0c6ac05fafc80f9b75ddff97ab173de0d3b
```

Transaction, manifest, journal, and lock records use strict deterministic private JSON serialization with one trailing newline. Reordered, extended, malformed, or digest-invalid records fail validation.

Temporary intent and writer-clearance registries follow the same strict canonical storage rules. Each intent binds the prepared transaction, opaque writer fingerprint, repository target path, target content digest, deterministic same-directory temporary path, and its own digest. A clearance binds one exact writer fingerprint to the prepared transaction. These private records do not select a public store path or compatibility format.

## Preparation order

Preparation uses this order:

```text
acquire writer lease
-> re-read and verify each before state
-> persist before and after content blobs
-> persist base and target lock blobs
-> persist transaction
-> persist recovery manifest
-> re-read and verify all records and blobs
-> persist prepared journal
```

If a path changes after planning, preparation fails before transaction, manifest, or journal publication. Blobs written for earlier paths can remain orphaned, but they are not reachable from a prepared transaction.

Every later journal transition also revalidates the complete recovery record and blob set. Missing or corrupt recovery content prevents the journal from advancing.

## Writer lease

The store creates an exclusive writer record through a synchronized temporary file and atomic hard-link publication. The record contains only an opaque random token; it does not contain a hostname, process identifier, username, timestamp, credential, or render-lock field.

Every store mutation verifies the caller's token. The executor also verifies the lease immediately before every project mutation. A second store instance cannot acquire the lease concurrently, a released lease cannot mutate the store, and lease release removes the record only when its content still matches the owner token.

This is a cooperative lock-file protocol, not an operating-system advisory lock. There is intentionally no automatic stale-lease takeover. After independently confirming that the writer process terminated, an operator may inspect an opaque fingerprint and clear the record only if that exact record and the expected prepared transaction remain unchanged. The store first persists matching writer clearance, then removes the unchanged writer record. The store cannot determine process death itself.

## Observations

Automated tests demonstrate:

- all required blobs exist before the `prepared` journal is observable;
- persisted transaction, manifest, journal, base lock, and target lock round-trip exactly;
- a changed project path fails preparation without publishing recovery records;
- concurrent writer acquisition fails and a released lease loses mutation authority;
- repeated registration by one writer produces one deterministic mutation intent before any repository temporary file exists;
- another writer receives a different fingerprint and temporary path for the same target bytes;
- wrong stale-writer evidence persists no clearance, while exact evidence makes only matching intents reclaimable;
- corrupt intent and clearance registries fail closed;
- a canonical intent registry for another transaction is rejected before any reclamation;
- corrupt and missing blobs fail verification;
- a missing blob prevents journal advancement;
- skipped journal states are rejected while only explicit commit and rollback transitions persist;
- non-canonical stored records are rejected.

## Limitations

- The private executor consumes the prepared store and checks the caller-supplied repository lock path, but public discovery remains undefined.
- A process crash can leave a stale writer record. Recovery requires external process-death confirmation and exact evidence; the store provides no automatic takeover or liveness proof.
- The lock-file protocol does not exclude a hostile process that directly edits the store.
- Store file and directory synchronization succeeds in the Darwin subprocess fixture, but power-loss behavior, network filesystems, and other platform-specific hard-link behavior are untested.
- Orphaned pre-preparation blobs are not garbage-collected.
- A separate lifecycle removes retired single-use stores under a dedicated parent and retains immutable cleanup receipts for the parent lifetime.
- Internal filenames and private revision 1 are implementation details, not public compatibility promises.
- No public store path, lock filename, schema, configuration, or CLI behavior is selected.

## Next experiment

Retain the [transaction cleanup](private-transaction-cleanup.md), [parent lifecycle](private-transaction-parent-lifecycle.md), and [temporary-file ownership](private-temporary-file-ownership.md) protocols while qualifying additional platforms without making the internal store layout public.
