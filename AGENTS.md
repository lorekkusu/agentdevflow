# Repository guidance

## Product, authority, and design gate

`agentdevflow` is a local-first Node.js and TypeScript development-flow
configurator and policy compiler distributed through npm and invoked with
`npx agentdevflow`.

Use these sources for their stated authority:

- `ROADMAP.md`: accepted sequence, durable outcomes, open decisions, exit
  criteria, and evidence;
- `docs/product-direction.md`: retained product intent;
- `docs/architecture.md`: current component and mutation boundaries;
- `docs/development/engineering-boundary.md`: complexity admission;
- `docs/development/project-health.md`: current verified disposition;
- `docs/development/beta-cli-contract.md`: current unreleased CLI surface; and
- accepted ADRs: durable decisions, with older ADRs treated as historical when
  a later accepted decision explicitly supersedes them.

Derive public interfaces from the authoritative user journey. Do not use an
interface sketch, candidate implementation, test, or repeated rewrite to
decide the product. Before proposing or changing a public command, flag,
configuration field, file format, workflow or preset behavior, provider
adapter, or durable architecture boundary:

1. name the owning roadmap outcome and its position in the current sequence;
2. describe the user journey and relevant starting states;
3. state prerequisites, observations, mutations, success, failure, and recovery;
4. distinguish current behavior, accepted decisions, recommendations, open
   decisions, and prohibited or deferred work; and
5. obtain explicit acceptance for every unresolved public-contract decision.

If authority is missing or the roadmap says `Decision required`, present only
bounded alternatives and acceptance criteria, then stop before production
implementation or compatibility commitments.

The fixed non-interactive first-use sequence is:

```text
init -> onboard -> rule as needed -> diff -> render -> check
```

`init` is the only first-use entry. `onboard` requires the valid selected
configuration and fails before inspecting provider targets when that
configuration is absent or invalid. Every `rule` operation also requires that
valid selected configuration, so rule management cannot become another
pre-init entry. Do not introduce alternate first-use orders, implicit
discovery branches, or a second onboarding state model without a new accepted
decision.

Keep this file limited to repository-wide stop rules, invariants, required
commands, review gates, and source routing. Do not append milestone narratives,
exhaustive CLI syntax, test counts, or evidence summaries. A referenced
document may provide detail, but it must not be the only location of a
must-follow stop or permission rule. Consolidate overlapping rules instead of
adding exceptions.

## Non-negotiable product boundaries

- Keep Steward, Developer, and Reviewer provider-neutral. Codex, Claude Code,
  and Cursor are renderer targets, not workflow roles.
- Keep `local-reviewed-change` and `issue-to-reviewed-pull-request` as bounded
  built-in choices. Do not expose arbitrary workflow topology.
- Treat tracker, pull-request, CI, review, and merge capabilities as advisory
  compiled procedures. Do not imply live clients, credentials, observations,
  or mutation authority.
- Do not add a public workflow DSL, scheduler, runtime, marketplace, broad
  provider matrix, GUI, SaaS service, automatic merge or release system, or
  general agent-assisted repository analyzer without an accepted product
  decision.
- Do not add or retain a second writer, approval store, transaction system, Git
  manager, lease, credential subsystem, or hostile-local-writer defense without
  a reproduced in-scope failure and an accepted decision. Git history is
  sufficient for discarded experiments.
- The accepted external-agent onboarding milestone permits one selected local
  coding-agent CLI to operate the same public rule, diff, render, and check
  path. It does not authorize a general command runner, workflow runtime,
  provider SDK, credential manager, background process, retry system, or
  unsupported launcher claim.

## Architecture and mutation invariants

- Put implementation under `src/` and tests under `test/`. Use ESM TypeScript
  with strict type checking. Name tests `*.test.ts`; `npm test` builds and runs
  emitted tests with `node:test`.
- Keep JSONC and Zod imports behind
  `src/interface/private-domain-project-document.ts` and
  `src/interface/private-zod.ts`.
- Keep provider, tracker, and integration bindings out of generic workflow
  topology and policy validation.
- Model finite nodes, transitions, artifact production, and invalidation
  explicitly. Cycles are allowed. Treat guards as potentially enabled and
  report guard-blind false positives.
- Keep native provider emitters under `src/renderer/native/`; keep the renderer
  adapter planning-only.
- Route every provider-output and ownership-lock mutation through `render` and
  the single forward-convergent file executor. Publish the ownership lock last.
- Treat generated provider files as whole-file, single-owner projections.
  Existing-file behavior is create, exact adopt, bounded equivalent import,
  explicit exact onboarding replacement, or abort.
- Onboarding replacement requires retained content to be represented in
  canonical rules, an exact current per-target digest, the complete normal
  diff, and the current exact-plan render approval. Digests bind bytes and
  staleness; they are not authentication. The lock records ownership state; it
  is not a mutex, lease, or security boundary.
- Store canonical guidance as one Markdown file per globally unique rule id
  under the fixed shared, Steward, Developer, and Reviewer scope directories.
  A rule command may mutate only one canonical rule file. It must not write
  provider outputs or the lock.
- Do not add a rule index, database, public rule DSL, provider-instance or
  nested scope, composite source/provider transaction, approval store, backup
  system, lease, or Git manager. Unsupported aggregate rule paths fail closed
  with exact manual-move guidance.
- Generate only the roles assigned to each provider id. One id may hold
  multiple roles with separate sections. Reject multiple ids for one provider
  product while its native project target cannot isolate them.
- Treat native instruction discovery as overlapping. Every generated
  projection must name its target product, be wholly inapplicable to
  nonmatching products, and avoid claims of session, identity, permission, or
  authority isolation.
- `agentdevflow` must not use repository-wide Git cleanliness as write
  authorization or execute Git reset, clean, stash, commit, branch, or rollback
  operations. This does not restrict separately authorized maintainer or coding
  agent Git work.

## Repository content and implementation

Write every repository artifact in English, including source, comments, tests,
fixtures, diagnostics, CLI output, documentation, configuration, evidence,
commit messages, and pull-request content.

Do not store conversation transcripts, private development prompts, expanded
runtime requests, raw reviewer or provider output, identities, private
chronology, credentials, or embargoed vulnerability detail. Retain only
accepted decisions, sanitized verified findings, and reproducible evidence.
Follow `docs/development/public-information-policy.md` and route
security-sensitive findings through `SECURITY.md`.

A reviewed English product-owned runtime instruction template required by an
accepted feature is source code. Keep it visible, bounded, intentionally
packaged, and tested. Never retain a project-expanded request, provider event
stream, transcript, raw response, credential, or private reasoning as evidence.

Keep package contents allowlisted in `package.json`. Tests, fixtures,
experiments, research material, and external-provider clients must not enter
the runtime tarball. Never invoke `npm publish` locally;
`.github/workflows/publish.yml` is the only reviewed publication path.

## Verification

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

`npm run check` is required for every repository change. It audits repository
and package hygiene, type-checks, builds, and runs the automated tests. Run the
qualification, installed package-entrypoint, recovery, and pack commands when
public behavior, packaging, qualification evidence, or release readiness is in
scope. Exercise the installed artifact for every public CLI or onboarding
change.

Add or update tests whenever behavior changes. Keep fixtures deterministic and
free of machine-specific paths, timestamps, credentials, network access, and
real provider authentication. There is no lint or format command; do not claim
that one ran.

## Roadmap governance and independent review

Record every accepted durable outcome, engineering boundary, deferral, scope
change, and open public-contract decision in the root `ROADMAP.md`. Do not use
conversation history, issue comments, private notes, tests, or an optional
instruction reference as the sole authority for a requirement.

Update the affected roadmap item in the same change that implements,
supersedes, defers, or completes it. Never silently remove or weaken an
accepted outcome. A completed item requires reviewable repository, test,
verification, commit, pull-request, CI, or published-artifact evidence. Pull
requests must update `ROADMAP.md` or explain why they have no roadmap impact.

Create an ADR only for a material, evidence-backed durable decision. Mark it
Accepted only after explicit approval. Amend or supersede an existing ADR when
that is clearer than creating a new mechanics-only record.

Before finalizing any repository change, obtain a separate read-only review of
the complete staged, unstaged, and relevant untracked change. The reviewer must
not have implemented the change or received earlier findings or conclusions.
Verify material findings directly. If no qualified reviewer is available,
report the review as incomplete.

For every public-surface or durable-architecture change, the independent
reviewer must name the authorizing roadmap outcome and decision, then verify
that the complete change follows the accepted journey, sequence, state
transitions, criteria, and non-goals. Missing or unresolved authority is a
blocking scope finding, not an implementation detail.

Run project-health reviews only at the triggers and with the isolation defined
in `docs/development/project-health-review.md`. Ordinary change review does not
replace a health review. Publish only verified sanitized conclusions.

Instructions here are advisory. Put mechanically checkable constraints in
code, tests, repository audits, CI, hooks, or platform controls, and describe
their limits honestly. Mechanical checks may ensure that authority and review
gates remain present; they cannot determine whether a product decision is
semantically correct.
