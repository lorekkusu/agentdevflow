# Private doctor command service evidence

Snapshot date: 2026-07-18.

## Verdict

**Pass for the deterministic private semantic core.** The service validates revisioned provider and environment observations, distinguishes healthy, degraded, and blocked evidence, and produces compiler-compatible capability availability only when no blocking diagnostic exists.

The service performs no live provider or environment probing. This result is sufficient to preserve a provider-neutral `doctor` boundary while deferring side-effecting probe adapters, public output, version-support policy, and authentication claims.

## Reproduction

Implementation:

- `src/commands/private-doctor-command-service.ts`;
- `src/compiler/private-model.ts`;
- `src/compiler/compile-candidate.ts`.

Automated coverage:

- `test/commands/private-doctor-command-service.test.ts`.

Run:

```bash
npm run build
node --test dist/test/commands/private-doctor-command-service.test.js
npm run check
```

## Observed behavior

Focused automated tests demonstrate:

- current versioned probe evidence producing a healthy result;
- derived capability availability compiling the Balanced candidate successfully;
- reordered observations producing an identical result;
- input observations remaining unchanged;
- manual evidence, unknown version, and unknown principal producing degraded warnings;
- missing, stale, mismatched, or insufficient provider evidence blocking the result;
- unavailable required environment capability blocking the result;
- unavailable optional environment capability degrading the result;
- duplicate or extended observation envelopes failing closed;
- every blocked result returning no compiler capability availability.

The focused suite passes 6 tests with zero failures and zero skips. The selected V1 qualification suite passes 132 tests across 19 selected test files with zero failures and zero skips. The complete stronger suite passes 231 tests with zero failures and zero skips.

## Complexity and limitations

The service indexes provider and environment observations, then evaluates each configured provider against the closed workflow capability requirements. Runtime is linear in the configured observations and provider-requirement pairs, excluding deterministic result sorting.

The fixture evidence is asserted input. No test spawns a provider binary, accesses credentials, calls a network service, or proves that an evidence reference is authentic. Freshness is a closed observation value rather than a wall-clock calculation. Provider version strings are recorded but not interpreted as semantic versions or compared with a support table.

The current closed capability set contains only provider-neutral project instructions, honestly classified as advisory through instruction files. The service does not infer stronger enforcement from a provider brand or version.

## Recommendation

Use this service as the private semantic core for future `doctor` handling. Design probe adapters separately and one permission surface at a time. Do not persist raw local observations in the public repository. With private `check`, `diff`, `render`, and `doctor` semantic cores available, evaluate non-interactive `init` as an explicit adoption/import/abort proposal rather than a wizard.
