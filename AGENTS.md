# Repository guidance

## Project boundary

`agentdevflow` is a local-first Node.js and TypeScript development-flow configurator and policy compiler intended for npm distribution and `npx agentdevflow` invocation.

Keep the implementation provider-neutral. Codex, Claude Code, and Cursor are the initial adapter validation set; Steward, Developer, and Reviewer are responsibilities, not provider brands.

Phase 0 validated a replaceable renderer boundary and a finite-state policy core. Follow `docs/development/roadmap.md` for the current sequence. Do not expand the project into a public workflow DSL, scheduler, marketplace, tracker runtime, broad provider matrix, GUI, SaaS service, automatic merge or release system, or repository analyzer without an explicit project decision.

Do not freeze a public API, configuration syntax, configuration filename, lockfile format, or production framework during Phase 0.

## Repository language

Write every repository artifact in English, including documentation, code, comments, identifiers, configuration, tests, fixtures, diagnostics, CLI output, and generated evidence.

Do not store conversation transcripts or temporary deliberation records in the repository. Preserve durable technical conclusions and reproducible evidence only.

## Source of truth

- `docs/product-direction.md` defines retained product intent and deferred work.
- `docs/architecture.md` defines compiler, policy, ownership, and enforcement boundaries.
- `docs/development/phase-0.md` defines gate order and pass/fail criteria.
- `docs/development/roadmap.md` defines the current development sequence, scope, exit criteria, candidates, and stop conditions.
- `docs/development/tooling.md` records current reversible tooling choices.
- `docs/development/v1-recovery-contract.md` defines the accepted forward-convergence behavior and non-claims.
- `docs/development/private-render-command-contract.md` defines exact-plan and private lock publication behavior.
- `docs/development/private-check-command-contract.md` defines the candidate read-only check outcomes and diagnostics.
- `docs/development/private-diff-command-contract.md` defines exact-byte read-only diff behavior and disclosure boundaries.
- `docs/development/private-doctor-command-contract.md` defines provider-neutral observation validation and compiler evidence.
- `docs/development/private-approved-init-render-contract.md` defines exact approval, reread, plan preparation, and routing into the existing render command.
- `docs/development/interruption-contract.md` defines the stronger experimental write-ahead behavior.
- `docs/development/public-information-policy.md` defines what public technical context to retain and what private or transient material to exclude.
- `docs/decisions/` contains accepted or proposed material architecture decisions and the reusable ADR template.
- `docs/evidence/` contains public, reproducible technical evidence and gate conclusions.
- `CONTRIBUTING.md` defines the public contribution, issue, pull-request, and AI-assisted-work expectations.

Keep critical constraints in this file. Link to detailed documents for context instead of duplicating them here.

## Development commands

Run commands from the repository root.

```bash
npm install
npm run build
npm test
npm run check:repository
npm run check
npm run check:v1-qualification
npm run check:qualification
npm run experiment:recovery
npm run phase1:config
npm run phase1:compiler
npm run test:v1-recovery
```

`npm run check` is the required local verification. It audits repository publication hygiene, type-checks, builds, and runs the automated tests. `npm run check:v1-qualification` runs the explicitly selected V1 platform suite and fails if any selected test is skipped. `npm run check:qualification` runs the complete stronger write-ahead suite, requires directory synchronization, and also fails on skips. The repository audit is intentionally limited and does not replace human disclosure review or a dedicated secret scanner. There is currently no lint or format command; do not claim one has run.

## Code and tests

- Use ESM TypeScript with strict type checking.
- Put implementation code under `src/` and automated tests under `test/`.
- Name test files `*.test.ts`; `npm test` compiles them and runs the emitted JavaScript with `node:test`.
- Keep the renderer adapter narrow and replaceable. Do not leak backend-specific types into candidate public configuration.
- Route renderer filesystem experiments through `src/workspace/private-filesystem-workspace.ts`; do not bypass its root, path, symlink, and regular-file checks. Use its process-termination mode only with `applyPrivateConvergentRenderPlan`; it does not prove directory or power-loss durability.
- Use staged before-or-after digest convergence as the V1 apply path. Keep the exact plan caller-supplied until discovery and storage are decided. Never authorize mutation from repository-wide Git cleanliness or run reset, clean, stash, commit, or branch operations automatically.
- Keep the private transaction store and executor as a stronger non-default experiment. Do not extend or expose it without a material requirement and accepted decision.
- Route future mutating render behavior through the private render command service. Keep its snapshot and lock paths caller-supplied until public discovery and migration contracts are accepted.
- Route future check behavior through the private check command service. Preserve its read-only workspace boundary and keep its exit codes private candidates until CLI qualification.
- Route future diff behavior through the private diff command service. Do not return partial entries for blocked or foreign state, and defer public formatting and disclosure policy.
- Keep the doctor semantic core free of provider command execution, network access, credentials, and environment inspection. Add probe adapters only with narrow permission and evidence contracts.
- Keep the policy validator independent of provider adapters, trackers, and runtime schedulers.
- Keep private initialization read-only and non-interactive. Exact adoption, import assessment, and abort decisions must bind observed bytes to the candidate configuration; never infer ownership from Git cleanliness.
- Keep project-instructions import limited to deterministic logical equivalence with exact observed, configuration, and target digests. Do not invent merges or infer provider semantics from natural language.
- Route initialization mutation through the private approved-init render service. Retain its exact prepared snapshot before mutation; do not bypass it with a generic overwrite authorization.
- Model finite nodes, transitions, artifact production, and artifact invalidation explicitly. Cycles are allowed.
- Treat guards as potentially enabled and diagnose guard-blind false positives. Do not add executable predicates, dynamic topology, general liveness, or fairness reasoning.
- Make diagnostics and counterexample traces deterministic.

Add or update tests whenever behavior changes. Keep fixtures deterministic and free of machine-specific absolute paths, timestamps, credentials, or network assumptions.

## Evidence and decisions

Separate observed output from assumptions and recommendations. Pin external tools used by experiments, capture their versions and integrity metadata, and prefer current primary sources.

Label open questions and candidate decisions explicitly. Create an ADR only for a material, evidence-backed decision, and mark it Accepted only after explicit approval. Follow `docs/development/public-information-policy.md` and `docs/decisions/README.md`.

Gate 1 must reach an explicit renderer recommendation before Gate 6 begins. If evidence removes the independent value of the policy-compiler layer, recommend a pivot or stop instead of expanding scope.

Generated paths must have one owner. Existing files require an explicit adopt, import, or abort outcome; silent overwrite and silent capability downgrade are failures.

Instructions in this file are advisory context. Put mechanically checkable requirements in code, tests, scripts, CI, hooks, or platform controls, and describe the actual mechanism and bypass authority honestly.
