# Private render lock evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for deterministic private lock creation and bounded canonical parsing.** An applied and verified render produces a lock that binds compiler intent, source materialization, renderer identity, generated-file ownership, content digests, and source references. The private application planner can read those exact bytes without requiring a caller-supplied lock object.

This remains a private serialized implementation contract. The current beta
CLI selects `.agentdevflow/lock.json` by default, but lock bytes, migrations,
and the TypeScript API are not stable 1.0 promises.

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

The authoritative lock is created only after apply and verification. The private render command derives expected target bytes before mutation, applies outputs through the accepted forward-convergent path, verifies them, and publishes the canonical lock last. A derived target remains non-authoritative until those checks complete.

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

The byte parser additionally enforces a private 262,144-byte default limit, strict JSON syntax, the complete runtime validator, and exact canonical serialization including the terminal newline. Alternate whitespace and key ordering are rejected even if they decode to the same object.

## Ownership correction

The staged adapter now emits a deterministic delete action for an obsolete owned path even when the file is already absent. Applying that plan clears the stale ownership claim, so it cannot leak into the next private lock.

## Limitations

- The private planner reads canonical lock bytes from a caller-supplied path through a read-only workspace; the private executor writes the same canonical form.
- The runtime validator is private and is not a public schema or compatibility promise.
- There is no public filename or discovery algorithm.
- There is no migration support between private revisions.
- The private workspace checks root containment and existing symlinks, subject to documented path-based race limits.
- The private executor coordinates outputs and lock state under cooperative fault injection and Darwin subprocess termination, but power-loss and cross-platform durability remain unverified.
- The current private lock expects one renderer ownership domain and rejects unrelated ownership claims.

## Current use

The local application planner reads this canonical form when producing an
exact plan. The accepted beta defines the current path and format boundary.
Stronger transaction state was removed and is not the next lock direction.
