# Private render command service evidence

Snapshot date: 2026-07-18.

## Verdict

**Pass on the tested local Darwin environment.** The private service composes an exact render-plan snapshot, base-lock ownership, forward-convergent output apply, output verification, and forward-convergent lock publication without introducing a multi-state journal or public storage decision.

This result preserves the independent V1 policy and renderer core while closing the remaining private workspace integration gap. It is sufficient to begin read-only command services. It is not release or cross-platform qualification for the new command-service composition.

## Reproduction

Implementation:

- `src/commands/private-render-plan-snapshot.ts`;
- `src/commands/private-render-command-service.ts`;
- `src/lock/private-render-lock.ts`;
- `src/renderer/private-convergent-apply.ts`;
- `src/renderer/staged-adapter.ts`.

Automated coverage:

- `test/commands/private-render-command-service.test.ts`;
- `test/commands/private-render-command-subprocess.test.ts`;
- `test/fixtures/commands/private-render-command-subprocess-worker.ts`.

Run:

```bash
npm run build
node --test \
  dist/test/commands/private-render-command-service.test.js \
  dist/test/commands/private-render-command-subprocess.test.js
npm run check
```

## Observed behavior

Focused automated tests demonstrate:

- initial output and lock publication;
- an exact repeated command with no output write and no lock rewrite;
- an update from Fast to Balanced using exact base-lock ownership;
- cooperative interruption after output apply and after lock rename replacement;
- real forced process termination at both command-level interruption boundaries;
- exact-snapshot rerun to verified target outputs and target lock;
- foreign lock refusal before output mutation;
- contradictory target-lock and incomplete-output refusal;
- base ownership mismatch refusal;
- lock path overlap refusal;
- snapshot ownership tamper and unknown-field refusal.

The focused suite passes 10 tests with zero failures and zero skips. The selected V1 qualification suite passes 113 tests across 16 selected test files with zero failures and zero skips. The complete stronger suite passes 212 tests with zero failures and zero skips.

## Complexity and failure modes

The service adds one closed snapshot envelope and one linear orchestration sequence. It does not add transaction states, cleanup lifecycle, writer leases, recovery manifests, or a scheduler.

Expected recoverable states are:

- base lock with output paths independently at their before or after digests;
- target lock with every output at its target digest.

The following states fail closed:

- corrupt or extended snapshots;
- base ownership that differs from the retained plan;
- lock bytes outside exact base or target content;
- target lock with incomplete outputs;
- lock or lock-temporary overlap with managed output state;
- failed output or lock verification.

Hostile concurrent regular-file replacement at an authorized deterministic temporary path remains outside the V1 threat model. Directory and power-loss durability remain outside the accepted V1 contract.

## Recommendation

Use this private service as the only future mutating render-service path. Begin command-service development with read-only `check`, followed by `diff`, before exposing `render`. Keep snapshot and lock paths caller-supplied until discovery, migration, and public schema work provide enough evidence for an accepted format decision.
