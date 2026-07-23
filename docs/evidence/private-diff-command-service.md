# Private diff command service evidence

Snapshot date: 2026-07-18.

## Verdict

**Pass on the tested local Darwin environment.** The private service reports exact managed before and target bytes for recognized creates, updates, deletes, and lock publication without obtaining a mutation-capable workspace interface.

Blocked or concurrently changed observations return diagnostics and no partial
entries. This historical service evidence supports the internal core used by
the current `diff` command; the current CLI contract and installed-entrypoint
tests define public behavior.

## Reproduction

Implementation:

- `src/commands/private-diff-command-service.ts`;
- `src/commands/private-check-command-service.ts`;
- `src/commands/private-render-plan-snapshot.ts`.

Automated coverage:

- `test/commands/private-diff-command-service.test.ts`.

Run:

```bash
npm run build
node --test dist/test/commands/private-diff-command-service.test.js
npm run check
```

## Observed behavior

Focused automated tests demonstrate:

- deterministic exact create entries for three managed outputs and the target lock;
- exact repeated results and unchanged repository bytes;
- a rendered target producing a clean empty diff;
- exact update entries from retained base ownership;
- exact delete entries when the desired provider set contracts;
- omission of an output already at target during partial forward convergence;
- blocked drift and malformed input producing no partial diff;
- a post-check foreign observation discarding every accumulated entry.

The focused suite passes 7 tests with zero failures and zero skips. The selected V1 qualification suite passes 126 tests across 18 selected test files with zero failures and zero skips. The complete stronger suite passes 225 tests with zero failures and zero skips.

## Complexity and limitations

The service performs the check pass followed by one additional linear reread of planned files and the lock. Sorting is bounded by the number of exact changes and diagnostics. This intentionally favors clear validation boundaries over minimizing local file reads.

The result contains exact recognized text content rather than a line-oriented
presentation. It does not read unrelated paths or return foreign content. The
current beta formatter and JSON report apply the bounded disclosure behavior
defined in the beta CLI contract; this older service result did not define
that public behavior.

The reread detects a changed observation during service execution but does not lock the workspace or claim an atomic snapshot. The render service must still revalidate every digest before mutation.

## Recommendation

This historical slice established the read-only `diff` semantic core before
the public CLI existed. Current behavior belongs in the beta CLI contract and
current CLI tests; later command sequencing from this snapshot is superseded.
