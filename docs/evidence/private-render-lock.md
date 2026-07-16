# Private render lock evidence

Snapshot date: 2026-07-17.

## Verdict

**Pass for the first roadmap step 4 slice.** An applied and verified render can now produce a deterministic private lock that binds compiler intent, source materialization, renderer identity, generated-file ownership, content digests, and source references.

This is an in-memory implementation contract. It does not select a public lock filename, serialized format, discovery rule, migration contract, transaction directory, or CLI behavior.

## Reproduction

Implementation:

- `src/lock/private-render-lock.ts`;
- `src/renderer/input-digest.ts`;
- `src/renderer/contract.ts`;
- `src/renderer/staged-adapter.ts`.

Automated coverage:

- `test/lock/private-render-lock.test.ts`;
- `test/renderer/staged-adapter.test.ts`.

Run:

```bash
npm install
npm run check
```

## Lock contents

Private lock revision 1 records only deterministic state:

- compiler digest;
- source materialization revision and digest;
- renderer name, version, ownership key, and render input digest;
- sorted generated paths;
- each path's owner, content digest, and sorted source references;
- an overall canonical lock digest.

It does not include timestamps, hostnames, absolute machine paths, process identifiers, credentials, environment variables, plan actions, or a transient plan digest. Excluding plan actions keeps the lock stable when an initial create plan becomes a repeated no-op plan with the same final output.

The Balanced fixture produces this deterministic lock digest:

```text
c677b6542ee1d1d0ddf61c979a136d16624f7ee72ea9c03fbe99854a0eb79779
```

Reordered candidate intent and a verified no-op render produce a deeply equal lock.

## Creation preconditions

Lock creation requires all of the following:

1. the private source materialization validates;
2. the render plan is safe to apply;
3. the render result carries the same plan digest;
4. verification carries the same plan digest and reports no diagnostics;
5. the plan source digest matches the materialization;
6. the plan input digest recomputes from compiler digest, source digest, and sorted logical source paths;
7. every retained output has exact renderer ownership, content digest, and source references;
8. the result contains no unexpected ownership claims.

The authoritative lock is created only after apply and verification. The transaction protocol may deterministically derive the expected target lock bytes before apply, but that value is a non-authoritative intent and does not claim successful materialization. Persisting and committing a future serialized lock still requires the recoverable filesystem executor.

## Runtime validation

The validator rejects:

- unsupported lock revisions;
- missing or additional fields;
- malformed SHA-256 digests;
- empty or whitespace-padded identifiers;
- absolute, parent-traversing, backslash, or non-normalized paths;
- duplicate or unsorted paths;
- empty, duplicate, unsorted, or control-character source references;
- per-file owners that differ from the renderer ownership key;
- empty output sets;
- canonical digest mismatches.

Nested object key order does not affect digest validation. Array order remains meaningful and is required to be canonical.

## Ownership correction

The staged adapter now emits a deterministic delete action for an obsolete owned path even when the file is already absent. Applying that plan clears the stale ownership claim, so it cannot leak into the next private lock.

## Limitations

- The private executor reads and writes canonical lock bytes at a caller-supplied path.
- The runtime validator is private and is not a public schema or compatibility promise.
- There is no public filename or discovery algorithm.
- There is no migration support between private revisions.
- The private workspace checks root containment and existing symlinks, subject to documented path-based race limits.
- The private executor coordinates outputs and lock state under cooperative fault injection and Darwin subprocess termination, but power-loss and cross-platform durability remain unverified.
- The current private lock expects one renderer ownership domain and rejects unrelated ownership claims.

## Next experiment

Validate the [temporary-file ownership](private-temporary-file-ownership.md), [transaction cleanup](private-transaction-cleanup.md), and [parent lifecycle](private-transaction-parent-lifecycle.md) protocols on the supported release platforms before selecting a public lock path or format.
