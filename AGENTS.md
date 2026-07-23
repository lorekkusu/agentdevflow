# Repository guidance

## Product boundary

`agentdevflow` is a local-first Node.js and TypeScript development-flow
configurator and policy compiler distributed through npm and invoked with
`npx agentdevflow`.

Keep Steward, Developer, and Reviewer provider-neutral. Codex, Claude Code, and
Cursor are the initial renderer targets, not workflow roles.

Follow:

- `docs/product-direction.md` for retained product intent;
- `docs/architecture.md` for current component boundaries;
- `docs/development/engineering-boundary.md` for complexity admission;
- `docs/development/roadmap.md` for sequence and acceptance criteria;
- `docs/development/project-health.md` for current disposition;
- `docs/development/beta-cli-contract.md` for the current working-tree surface;
- ADR 0004 only for the historical first-beta boundary.

Do not add a public workflow DSL, scheduler, runtime, marketplace, broad
provider matrix, GUI, SaaS service, automatic merge/release system, or
agent-assisted repository analyzer without an accepted product decision.

Apply the engineering boundary retroactively. Do not add or retain a second
writer, approval store, transaction system, Git manager, lease, credentials,
or hostile-local-writer defense without a reproduced in-scope failure and an
accepted decision. Git history is sufficient for discarded experiments.

## Repository language and disclosure

Write every repository artifact in English, including source, comments, tests,
fixtures, diagnostics, CLI output, documentation, configuration, and generated
evidence.

Do not store conversation transcripts, prompts, raw reviewer output,
identities, private chronology, credentials, or embargoed vulnerability detail.
Retain durable conclusions, accepted decisions, sanitized findings, and
reproducible evidence only. Follow
`docs/development/public-information-policy.md`.

## Current architecture

- Put implementation under `src/` and tests under `test/`.
- Use ESM TypeScript with strict type checking.
- Name tests `*.test.ts`; `npm test` builds and runs emitted tests with
  `node:test`.
- Keep JSONC and Zod imports behind
  `src/interface/private-domain-project-document.ts` and
  `src/interface/private-zod.ts`.
- Keep provider, tracker, and integration bindings out of generic workflow
  topology and policy validation.
- Keep `local-reviewed-change` and `issue-to-reviewed-pull-request` as bounded
  built-in choices. Do not expose arbitrary workflow topology.
- Treat issue-workflow tracker, pull-request, CI, review, and merge
  capabilities as advisory compiled procedures. Do not imply that the CLI has
  network clients, credentials, live observations, or mutation authority.
- Model finite nodes, transitions, artifact production, and invalidation
  explicitly. Cycles are allowed. Treat guards as potentially enabled and
  report guard-blind false positives.
- Keep native provider emitters under `src/renderer/native/` and the renderer
  adapter planning-only.
- Route all product mutation through the render command and the single
  forward-convergent file executor. Publish the ownership lock last.
- Never authorize mutation from repository-wide Git cleanliness. Never reset,
  clean, stash, commit, branch, or roll back user work automatically.
- Treat generated provider files as whole-file, single-owner projections.
  Existing files require explicit create, exact adopt, lossless import, or
  abort behavior.
- Treat digests as byte and staleness bindings, not authentication. Treat the
  render lock as ownership state, not a mutex, lease, or security boundary.
- Keep package contents allowlisted in `package.json`. Tests, fixtures,
  experiments, research evidence, and external-provider clients must not enter
  the runtime tarball.
- Never invoke `npm publish` locally. `.github/workflows/publish.yml` is the
  only reviewed publication path.

## Canonical guidance

Follow `docs/development/instruction-composition.md`.

Canonical guidance consists only of the optional user-owned Markdown files
`.agentdevflow/rules/shared.md`, `steward.md`, `developer.md`, and
`reviewer.md`. Read, compose, and project them through the existing
diff/render/check path. Do not add an index, rule CRUD, provider-instance
rules, source mutation planning, a composite transaction, a second approval
digest, or agent-assisted semantic classification without a separate accepted
decision.

Generate only the roles assigned to each provider id. One provider id may hold
multiple roles with separate sections. Reject multiple ids for one provider
product while its native project target cannot isolate them.

## Development commands

Run from the repository root:

```bash
npm install
npm run build
npm test
npm run check:repository
npm run check
npm run check:v1-qualification
npm run check:package-entrypoint
npm run test:v1-recovery
npm pack --dry-run --json
```

`npm run check` is the required local verification. It audits repository and
package hygiene, type-checks, builds, and runs the automated tests.
`check:v1-qualification` discovers the full current test set, requires the V1
recovery tests, and fails on skips. `check:package-entrypoint` packs and
exercises the installed npm bin. There is no lint or format command; do not
claim one has run.

Add or update tests whenever behavior changes. Keep fixtures deterministic and
free of machine-specific paths, timestamps, credentials, and network
assumptions.

## Decisions and reviews

Create an ADR only for a material, evidence-backed decision. Mark it Accepted
only after explicit approval. Label candidates and open questions honestly.

Run independent project-health reviews only at the triggers in
`docs/development/project-health-review.md`. Initial reviewers must be
read-only, context-isolated, and unaware of the current health conclusion.
Publish only verified sanitized findings.

Instructions in this file are advisory. Put mechanically checkable rules in
code, tests, scripts, CI, hooks, or platform controls, and describe their actual
enforcement and bypass authority honestly.
