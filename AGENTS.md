# Repository guidance

## Product boundary

`agentdevflow` is a local-first Node.js and TypeScript development-flow
configurator and policy compiler distributed through npm and invoked with
`npx agentdevflow`.

Keep Steward, Developer, and Reviewer provider-neutral. Codex, Claude Code, and
Cursor are the initial renderer targets, not workflow roles.

Follow:

- `ROADMAP.md` for the authoritative accepted sequence, open decisions,
  acceptance criteria, and completion evidence;
- `docs/product-direction.md` for retained product intent;
- `docs/architecture.md` for current component boundaries;
- `docs/development/engineering-boundary.md` for complexity admission;
- `docs/development/project-health.md` for current disposition;
- `docs/development/beta-cli-contract.md` for the current working-tree surface;
- ADR 0004 only for the historical first-beta boundary.

Do not add a public workflow DSL, scheduler, runtime, marketplace, broad
provider matrix, GUI, SaaS service, automatic merge/release system, or
general agent-assisted repository analyzer without an accepted product
decision. The bounded external-agent-operated onboarding milestone in
`ROADMAP.md` is accepted: a selected local coding-agent CLI may act as the
user's operator of the same rule, diff, render, and check commands.

Apply the engineering boundary retroactively. Do not add or retain a second
writer, approval store, transaction system, Git manager, lease, credentials,
or hostile-local-writer defense without a reproduced in-scope failure and an
accepted decision. Git history is sufficient for discarded experiments.

## Repository language and disclosure

Write every repository artifact in English, including source, comments, tests,
fixtures, diagnostics, CLI output, documentation, configuration, and generated
evidence.

Do not store conversation transcripts, private development prompts, expanded
runtime requests, raw reviewer output, identities, private chronology,
credentials, or embargoed vulnerability detail. Retain durable conclusions,
accepted decisions, sanitized findings, and reproducible evidence only.

A reviewed English product-owned runtime instruction template required by an
accepted feature is source code, not private development history. Keep it
visible, bounded, packaged intentionally, and tested. Never retain a
project-expanded request, provider transcript, or private reasoning as
repository evidence. Follow `docs/development/public-information-policy.md`.

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
- Route provider-output and ownership-lock mutation through the render command
  and the single forward-convergent file executor. Publish the ownership lock
  last. The accepted rule commands may mutate only canonical user-owned rule
  sources; they must not create a second provider writer.
- Never authorize mutation from repository-wide Git cleanliness. Never reset,
  clean, stash, commit, branch, or roll back user work automatically.
- Treat generated provider files as whole-file, single-owner projections.
  Current existing-file behavior is create, exact adopt, bounded equivalent
  import, or abort. The accepted onboarding milestone may add an explicitly
  reviewed complete-file replacement only after selected content is represented
  in canonical rules and the normal plan approval remains current.
- Treat digests as byte and staleness bindings, not authentication. Treat the
  render lock as ownership state, not a mutex, lease, or security boundary.
- Keep package contents allowlisted in `package.json`. Tests, fixtures,
  experiments, research evidence, and external-provider clients must not enter
  the runtime tarball.
- Never invoke `npm publish` locally. `.github/workflows/publish.yml` is the
  only reviewed publication path.

## Canonical guidance

Follow `docs/development/instruction-composition.md`.

The current candidate stores one Markdown file per globally unique rule id
under fixed shared, Steward, Developer, and Reviewer scope directories. The
bounded `rule list/show/add/update/remove` command family may mutate one
canonical rule file per invocation. Provider outputs and the ownership lock
still change only through `diff` and exact-approved `render`.

Keep rule management without an index, database, public rule DSL,
provider-instance or nested scope, source/provider composite transaction,
second approval model, backup system, lease, or Git manager. The four
unreleased aggregate paths must fail closed with exact manual-move guidance;
never silently ignore, delete, or automatically migrate them.

External-agent onboarding may supply semantic judgment and operate the public
CLI, but final managed state must still pass canonical rule validation, the
complete render plan, and `check`. Do not implement manual onboarding until its
reproducible replacement-authorization input and output boundary are accepted.

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

## Roadmap governance

Record every accepted durable product outcome, engineering boundary, deferral,
scope change, and open public-contract decision in the root `ROADMAP.md`.
Do not rely on conversation history, issue comments, private notes, or an
optional instruction reference as the only record of a requirement.

Update the affected roadmap item in the same change that implements,
supersedes, defers, or completes it. Never silently remove an accepted outcome
when deleting an overbuilt implementation. A completed item requires
reviewable evidence such as a repository path and symbol, focused test,
verification command, commit or pull request, CI run, or published artifact.
Use `file:line` when useful, but prefer stable symbols and tests when line
numbers would drift.

Keep the roadmap decision-ready:

- put active, next, blocked, and decision-required work before later work;
- keep completed outcomes compressed in the bottom completion summary;
- distinguish retained user outcomes from superseded implementation
  mechanisms;
- exclude private development prompts, expanded runtime requests, transcripts,
  private chronology, identities, credentials, routine retries, and ordinary
  Git bookkeeping; and
- keep exactly one authoritative roadmap.

Pull requests must update `ROADMAP.md` or explain why the change has no roadmap
impact. Repository checks enforce the presence of the root roadmap and reject
the known former `docs/development/roadmap.md` path. The broader one-authority
rule and prose accuracy require human review.
