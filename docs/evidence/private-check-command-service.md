# Private check command service evidence

Snapshot date: 2026-07-18.

## Verdict

**Pass on the tested local Darwin environment.** The private service classifies exact managed output and lock observations as clean, recognized changes, or blocked state without obtaining a mutation-capable workspace interface.

This result is sufficient to begin a private read-only `diff` service. It does not qualify a public CLI, discovery behavior, serialized output, or stable exit-code contract.

## Reproduction

Implementation:

- `src/commands/private-check-command-service.ts`;
- `src/commands/private-render-plan-snapshot.ts`;
- `src/lock/private-render-lock.ts`.

Automated coverage:

- `test/commands/private-check-command-service.test.ts`.

Run:

```bash
npm run build
node --test dist/test/commands/private-check-command-service.test.js
npm run check
```

## Observed behavior

Focused automated tests demonstrate:

- planned creates and lock publication reported as changes without mutation;
- a rendered target reported clean with candidate exit code zero;
- exact repeated checks returning identical results and repository bytes;
- foreign managed-path drift distinguished from recognized before state;
- ownership conflicts and unsupported capabilities reported as blocked;
- malformed snapshot and base-lock inputs reported as blocked diagnostics;
- foreign lock bytes reported as drift;
- a target lock paired with incomplete outputs reported as contradictory.

The focused suite passes 6 tests with zero failures and zero skips. The selected V1 qualification suite passes 119 tests across 17 selected test files with zero failures and zero skips. The complete stronger suite passes 218 tests with zero failures and zero skips.

## Complexity and limitations

The service adds one linear read-only classification pass over planned files plus one lock read. Its time complexity is linear in the number of planned files, excluding filesystem read cost. Diagnostic sorting is bounded by the number of renderer and check diagnostics.

The caller remains responsible for obtaining the exact materialization, plan snapshot, expected base lock, and lock path. The service detects a concurrent change only when the observed bytes fall outside retained before and target digests; it does not lock the workspace or authenticate another process.

Candidate exit codes are evidence for future CLI design, not accepted compatibility promises. Parser errors, discovery ambiguity, machine-readable formatting, and terminal presentation remain outside this slice.

## Recommendation

Use this service as the private semantic core for future `check` handling. Build `diff` next by reporting exact planned byte changes without mutation. Defer public command handlers and exit-code acceptance until discovery, parser, formatter, and end-to-end command fixtures exist.
