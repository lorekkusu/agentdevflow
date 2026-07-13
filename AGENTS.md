# Repository guidance

## Project boundary

`agentdevflow` is a local-first Node.js and TypeScript development-flow configurator and policy compiler intended for npm distribution and `npx agentdevflow` invocation.

Keep the implementation provider-neutral. Codex, Claude Code, and Cursor are the initial adapter validation set; Steward, Developer, and Reviewer are responsibilities, not provider brands.

Phase 0 validates a replaceable renderer boundary and a finite-state policy core. Do not expand it into a production CLI, wizard, public workflow DSL, scheduler, marketplace, tracker runtime, broad provider matrix, GUI, SaaS service, automatic merge or release system, or repository analyzer.

Do not freeze a public API, configuration syntax, configuration filename, lockfile format, or production framework during Phase 0.

## Repository language

Write every repository artifact in English, including documentation, code, comments, identifiers, configuration, tests, fixtures, diagnostics, CLI output, and generated evidence.

Do not store conversation transcripts or temporary deliberation records in the repository. Preserve durable technical conclusions and reproducible evidence only.

## Source of truth

- `docs/product-direction.md` defines retained product intent and deferred work.
- `docs/architecture.md` defines compiler, policy, ownership, and enforcement boundaries.
- `docs/development/phase-0.md` defines gate order and pass/fail criteria.
- `docs/development/tooling.md` records current reversible tooling choices.
- `docs/evidence/` contains public, reproducible technical evidence and gate conclusions.

Keep critical constraints in this file. Link to detailed documents for context instead of duplicating them here.

## Development commands

Run commands from the repository root.

```bash
npm install
npm run build
npm test
npm run check
```

`npm run check` is the required local verification. It type-checks, builds, and runs the automated tests. There is currently no lint or format command; do not claim one has run.

## Code and tests

- Use ESM TypeScript with strict type checking.
- Put implementation code under `src/` and automated tests under `test/`.
- Name test files `*.test.ts`; `npm test` compiles them and runs the emitted JavaScript with `node:test`.
- Keep the renderer adapter narrow and replaceable. Do not leak backend-specific types into candidate public configuration.
- Keep the policy validator independent of provider adapters, trackers, and runtime schedulers.
- Model finite nodes, transitions, artifact production, and artifact invalidation explicitly. Cycles are allowed.
- Treat guards as potentially enabled and diagnose guard-blind false positives. Do not add executable predicates, dynamic topology, general liveness, or fairness reasoning.
- Make diagnostics and counterexample traces deterministic.

Add or update tests whenever behavior changes. Keep fixtures deterministic and free of machine-specific absolute paths, timestamps, credentials, or network assumptions.

## Evidence and decisions

Separate observed output from assumptions and recommendations. Pin external tools used by experiments, capture their versions and integrity metadata, and prefer current primary sources.

Gate 1 must reach an explicit renderer recommendation before Gate 6 begins. If evidence removes the independent value of the policy-compiler layer, recommend a pivot or stop instead of expanding scope.

Generated paths must have one owner. Existing files require an explicit adopt, import, or abort outcome; silent overwrite and silent capability downgrade are failures.

Instructions in this file are advisory context. Put mechanically checkable requirements in code, tests, scripts, CI, hooks, or platform controls, and describe the actual mechanism and bypass authority honestly.
