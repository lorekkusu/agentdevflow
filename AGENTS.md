# Repository guidance

## Project boundary

`agentdevflow` is a local-first Node.js and TypeScript development-flow configurator and policy compiler intended for npm distribution and `npx agentdevflow` invocation.

Keep the implementation provider-neutral. Codex, Claude Code, and Cursor are the initial adapter validation set; Steward, Developer, and Reviewer are responsibilities, not provider brands.

Phase 0 validated a replaceable renderer boundary and a finite-state policy core. Follow `docs/development/roadmap.md` for the current sequence and `docs/development/project-health.md` for the current scope and complexity disposition. The repaired five-command beta is published as `0.1.0-beta.2`, passes protected publication and registry first-run qualification, and has one bounded maintainer-dogfood observation. A private compiled-policy spike proves that existing boundaries compose, but the independently useful product-consumer gate remains open because trace creation, evidence ownership, and normal-user workflow status are unresolved. Later versions, tags, releases, package-setting changes, and public-surface extensions remain separately authorized. Do not expand the project into a public workflow DSL, scheduler, marketplace, tracker runtime, broad provider matrix, GUI, SaaS service, automatic merge or release system, or repository analyzer without an explicit project decision.

Do not extend the accepted beta API, configuration syntax, discovery rules, JSON schema, lock format, or production framework without its roadmap acceptance gate. Follow ADR 0004 and the beta CLI contract for the currently accepted surface.

## Repository language

Write every repository artifact in English, including documentation, code, comments, identifiers, configuration, tests, fixtures, diagnostics, CLI output, and generated evidence.

Do not store conversation transcripts or temporary deliberation records in the repository. Preserve durable technical conclusions and reproducible evidence only.

## Branch names

Name branches for the change purpose, never for an authoring tool or contributor identity. Use an allowed prefix from `CONTRIBUTING.md`; an active GitHub ruleset enforces the documented convention for branches created in this repository.

## Source of truth

- `docs/product-direction.md` defines retained product intent and deferred work.
- `docs/architecture.md` defines compiler, policy, ownership, and enforcement boundaries.
- `docs/development/phase-0.md` defines gate order and pass/fail criteria.
- `docs/development/roadmap.md` defines the current development sequence, scope, exit criteria, candidates, and stop conditions.
- `docs/development/project-health-review.md` defines trigger-based independent scope and complexity reviews, disclosure classes, and outcome routing.
- `docs/development/project-health.md` defines the current sanitized health assessment, disposition, next milestone, and expansion stop conditions.
- `docs/development/tooling.md` records current reversible tooling choices.
- `docs/development/beta-cli-contract.md` defines accepted initial beta discovery, commands, exits, output, and release boundaries.
- `docs/getting-started.md` defines the public executable beta choices, first-use path, ownership behavior, and current non-features.
- `docs/development/release-checklist.md` defines the review, authorization, publication, and post-publication gates for the beta candidate.
- `docs/evidence/beta-release-candidate.md` records the final pre-publication package snapshot and its historical release gates.
- `docs/evidence/initial-beta-publication.md` records the exact initial registry artifact, provenance, installation, and credential closure.
- `docs/evidence/public-first-run.md` records the public entrypoint and onboarding qualification boundary.
- `docs/development/maintainer-dogfood.md` records a bounded private-repository observation of native instruction discovery and an advisory three-role handoff; it is not reproducible qualification evidence.
- `docs/development/v1-recovery-contract.md` defines the accepted forward-convergence behavior and non-claims.
- `docs/development/private-render-command-contract.md` defines exact-plan and private lock publication behavior.
- `docs/development/private-check-command-contract.md` defines the candidate read-only check outcomes and diagnostics.
- `docs/development/private-diff-command-contract.md` defines exact-byte read-only diff behavior and disclosure boundaries.
- `docs/evidence/private-local-cli.md` records the private path-facing `init`, `check`, `diff`, and approved-render verification and non-claims.
- `docs/evidence/private-package-qualification.md` records the allowlisted tarball, installed npm-bin, offline five-command qualification, and release blockers.
- `docs/development/private-doctor-command-contract.md` defines provider-neutral observation validation and compiler evidence.
- `docs/development/private-approved-init-render-contract.md` defines exact approval, reread, plan preparation, and routing into the existing render command.
- `docs/development/interruption-contract.md` defines the stronger experimental write-ahead behavior.
- `docs/development/public-information-policy.md` defines what public technical context to retain and what private or transient material to exclude.
- `docs/development/issue-to-reviewed-pull-request.md` defines the current realistic workflow domain-validation target and its open representation decisions.
- `docs/development/private-execution-contract.md` defines deterministic private manifest export and evidence-trace verification without runtime orchestration.
- `docs/development/private-execution-transport.md` defines strict canonical byte codecs and resource limits for private execution values.
- `docs/development/private-compiled-policy-consumer.md` defines the pure project-to-trace validation composition and its public-surface non-claims.
- `docs/development/private-github-check-runs-evidence.md` defines the narrow GitHub Check Runs to provider-neutral CI evidence boundary and its trust non-claims.
- `docs/development/private-domain-project-resolution.md` defines bounded private project intent, workflow selection, and logical capability-target resolution.
- `docs/development/private-preset-expansion.md` defines orthogonal private preset profiles, explicit Strict failure, and legacy candidate convergence.
- `docs/development/private-project-document-contract.md` defines bounded JSONC parsing, runtime schema validation, and pure edit behavior.
- `docs/decisions/` contains accepted or proposed material architecture decisions and the reusable ADR template.
- `docs/evidence/` contains public, reproducible technical evidence and gate conclusions.
- `CONTRIBUTING.md` defines the public contribution, issue, pull-request, and AI-assisted-work expectations.
- `SECURITY.md` defines the public vulnerability-reporting and coordinated-disclosure route.
- `.github/workflows/publish.yml` is the only reviewed npm publication path and remains manually triggered.

Keep critical constraints in this file. Link to detailed documents for context instead of duplicating them here.

## Development commands

Run commands from the repository root.

```bash
npm install
npm run build
npm test
npm run check:repository
npm run check
npm run check:package-entrypoint
npm run check:v1-qualification
npm run check:qualification
npm run experiment:recovery
npm run phase1:config
npm run phase1:compiler
npm run phase1:domain-workflows
npm run phase1:execution-contract
npm run phase1:execution-transport
npm run phase1:github-ci-evidence
npm run phase1:local-cli -- --help
npm run phase1:project-resolution
npm run phase1:project-document
npm run phase1:preset
npm run phase1:representation
npm run test:v1-recovery
npm pack --dry-run --json
```

`npm run check` is the required local verification. It audits repository publication hygiene, type-checks, builds, and runs the automated tests. `npm run check:v1-qualification` runs the explicitly selected V1 platform suite and fails if any selected test is skipped. `npm run check:qualification` runs the complete stronger write-ahead suite, requires directory synchronization, and also fails on skips. The repository audit is intentionally limited and does not replace human disclosure review or a dedicated secret scanner. There is currently no lint or format command; do not claim one has run.

## Code and tests

- Use ESM TypeScript with strict type checking.
- Put implementation code under `src/` and automated tests under `test/`.
- Name test files `*.test.ts`; `npm test` compiles them and runs the emitted JavaScript with `node:test`.
- Keep the renderer adapter narrow and replaceable. Do not leak backend-specific types into candidate public configuration.
- Route renderer filesystem experiments through `src/workspace/private-filesystem-workspace.ts`; do not bypass its root, path, symlink, and regular-file checks. Use its process-termination mode only with `applyPrivateConvergentRenderPlan`; it does not prove directory or power-loss durability.
- Use staged before-or-after digest convergence as the V1 apply path. Generate active revision-1 exact plans through `src/application/private-domain-project-plan.ts`; keep the lock path caller-supplied until discovery and migration are decided. Never authorize mutation from repository-wide Git cleanliness or run reset, clean, stash, commit, or branch operations automatically.
- Keep the private transaction store and executor as frozen non-default research. Do not extend, expose, or include it in the runtime package without a material requirement that reopens ADR 0002. Keep the normal workspace graph free of `src/transaction/` imports; shared temporary-intent primitives live under `src/workspace/`.
- Route mutating render behavior through the internal render command service. Require the beta CLI's exact snapshot-digest approval, read-only planning, configuration reread, mutable-workspace replan, and second digest match before mutation.
- Reconstruct an interrupted all-before plan only when current managed bytes are at exact approved target digests and the base lock or explicit absence remains authoritative. Require the original exact snapshot approval and normal convergent preflight; never use reconstruction as silent adoption or foreign-drift repair.
- Route check behavior through the private check command service. Preserve its read-only workspace boundary and the accepted beta exit classes.
- Route diff behavior through the internal diff command service. Do not return partial entries for blocked or foreign state; preserve the accepted beta disclosure and output limits.
- Keep the doctor semantic core free of provider command execution, network access, credentials, and environment inspection. The private CLI may evaluate only explicit bounded observation envelopes for the local workflow. Add probe adapters only with narrow permission and evidence contracts.
- Keep npm package contents allowlisted through `package.json`. Do not include tests, experiments, frozen transaction code, Rulesync process integration, or private evidence in the runtime tarball. Build and package verification must preserve an executable POSIX bin and exercise the installed package entrypoint. Never invoke `npm publish` locally. Keep the only reviewed publish path manually triggered, exact-version and exact-commit bound, environment-gated, and limited to `contents: read` plus `id-token: write`.
- Keep the policy validator independent of provider adapters, trackers, and runtime schedulers.
- Keep domain-specific workflow artifacts and capabilities under `src/workflows/`; do not add issue, pull-request, CI, or merge assumptions to the generic compiler. Preserve the local no-pull-request workflow as an anti-coupling regression fixture.
- Keep the private execution contract pure and filesystem-free. It verifies caller-supplied traces but must not schedule steps, monitor systems, hold credentials, retry work, or mutate external state. Route manifest-required evidence through the closed payload-package validator; do not accept an opaque digest where a typed requirement exists. Treat envelope and payload digests as integrity bindings, not authentication.
- Keep the private compiled-policy consumer as a thin pure composition. Compile exact project bytes internally, derive the manifest from the authoritative workflow compilation, parse trace bytes through the strict transport, and delegate evaluation to existing replay. Do not accept caller-supplied compiler output or manifests, duplicate those boundaries, or expose the private trace as a public command or format without an accepted decision.
- Route caller-supplied execution bytes through the private strict transport codecs before replay. Require exact canonical UTF-8 JSON and preserve byte, nesting, and value-count limits. Parsing proves structure and digest consistency, not compiler provenance, evidence truth, or producer identity. The compiled-policy consumer does not authorize further transport generalization; keep the transport frozen beyond defects required by that retained composition.
- Keep GitHub Check Runs observation mapping under `src/adapters/github/`. Require complete exact-SHA snapshots, pinned App ids, and an observation digest. The current mapper accepts Check Runs only and contains no network client, token handling, branch-protection discovery, polling, retries, or mutation. Treat its verified-origin field as a caller assertion. Do not add a live probe before the local vertical CLI milestone and a material consumer justify reopening this boundary.
- Keep private project resolution independent from execution exports; the repository audit forbids `src/project/` imports from `src/execution/`. Provider products, tracker products, responsibility providers, and external integration identifiers are project bindings, not workflow-topology primitives. Preserve both built-in workflow families and fail closed on missing, unused, or misrouted logical capability bindings. Renderer materialization must consume the authoritative revision-1 project result directly rather than translating it back into schema-version-0.
- Keep private application planning read-only. It may derive the local workflow's native project-instructions observations, but it must not reuse fixture observations to claim unavailable tracker, pull-request, CI, review-service, or merge adapters. Read and validate canonical lock bytes inside the planner rather than accepting a caller-supplied private lock object.
- Keep presets orthogonal to workflow family, pull-request readiness, auxiliary review, providers, trackers, and capability targets. Fast and Balanced are private executable profiles. Keep Strict unavailable until its additional evidence and stronger completion gates are executable; do not silently downgrade it. Custom remains deferred.
- Import `jsonc-parser` only through `src/interface/private-domain-project-document.ts` and Zod only through `src/interface/private-zod.ts`; the repository audit enforces this boundary. Keep Zod jitless, reject all JSONC syntax errors, duplicate keys, and `__proto__`, and retain byte, depth, collection, and diagnostic limits. Schema success must still pass project resolution and policy compilation.
- Keep private initialization non-interactive. Begin through `PrivateFilesystemWorkspace.openReadOnly`; the only init mutation is exclusive creation of an absent exact revision-1 configuration after a read-only recheck. Never overwrite different configuration bytes or infer ownership from Git cleanliness.
- With no lock, derive provider create, exact-adopt, lossless-import, and abort outcomes from current native targets and exact observations. Provider mutation remains behind diff and the normal exact approved render path. Reread, reanalyze, and replan before mutation.
- Keep schema-version-0 representation experiments pure and filesystem-free. Do not treat their specimen paths, flags, or fields as public compatibility promises; ADR 0004 and the beta CLI contract define the accepted prerelease surface.
- Keep project-instructions import limited to deterministic logical equivalence with exact observed, configuration, and target digests. Do not invent merges or infer provider semantics from natural language.
- Keep the schema-version-0 approved-init bridge as compatibility evidence. The active revision-1 successor binds adoption and lossless-import authorization into the complete exact plan reviewed through diff and executed only by the private render command service; do not add a generic overwrite authorization.
- Model finite nodes, transitions, artifact production, and artifact invalidation explicitly. Cycles are allowed.
- Treat guards as potentially enabled and diagnose guard-blind false positives. Do not add executable predicates, dynamic topology, general liveness, or fairness reasoning.
- Make diagnostics and counterexample traces deterministic.

Add or update tests whenever behavior changes. Keep fixtures deterministic and free of machine-specific absolute paths, timestamps, credentials, or network assumptions.

## Evidence and decisions

Separate observed output from assumptions and recommendations. Pin external tools used by experiments, capture their versions and integrity metadata, and prefer current primary sources.

Treat runtime dependency updates as security-sensitive. Repeat known-advisory, audit, registry-signature, lifecycle-script, package-content, schema-snapshot, focused-test, and complete repository review before changing `jsonc-parser` or Zod.

Label open questions and candidate decisions explicitly. Create an ADR only for a material, evidence-backed decision, and mark it Accepted only after explicit approval. Follow `docs/development/public-information-policy.md` and `docs/decisions/README.md`.

Run project health reviews only at the triggers defined in `docs/development/project-health-review.md`. Initial independent reviewers must be read-only, context-isolated, and unaware of the current health conclusions. Publish only verified sanitized findings; never retain prompts, raw reviewer output, identities, review chronology, or embargoed security details.

Gate 1 must reach an explicit renderer recommendation before Gate 6 begins. If evidence removes the independent value of the policy-compiler layer, recommend a pivot or stop instead of expanding scope.

Generated paths must have one owner. Existing files require an explicit adopt, import, or abort outcome; silent overwrite and silent capability downgrade are failures.

Instructions in this file are advisory context. Put mechanically checkable requirements in code, tests, scripts, CI, hooks, or platform controls, and describe the actual mechanism and bypass authority honestly.
