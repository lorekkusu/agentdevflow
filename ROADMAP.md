# Product roadmap

## Purpose and authority

This is the single authoritative development roadmap for `agentdevflow`.
It records accepted product outcomes, current sequence, open decisions,
explicitly deferred work, and compact completion evidence. It does not preserve
conversation history, private review chronology, private development prompts,
expanded runtime requests, or temporary implementation plans.

Durable requirements must be added or updated here when they are accepted.
Implementation changes must update the affected roadmap item in the same
change. An item may not be silently removed, downgraded, marked complete, or
moved to a later phase. Superseding an accepted outcome requires an explicit
product decision and a recorded replacement or cancellation.

Evidence should prefer stable repository paths, symbols, tests, commands,
commits, pull requests, CI runs, or published artifacts. Add `file:line`
references when they materially improve review, but do not rely on line numbers
alone because they drift.

## Product objective

`agentdevflow` is a local-first Node.js and TypeScript configurator and policy
compiler for repeatable coding-agent development flows. A project owns its
configuration and rules. The product compiles them into deterministic
provider-target views whose procedure and rule sections are filtered by
configured responsibility, while preserving a reviewable path from source
changes to generated outputs.

The core user outcome is:

```text
choose a workflow and responsibilities
  -> init the project configuration
  -> onboard the configured project
  -> manage project-owned rules as needed
  -> generate provider-target views filtered by configured responsibilities
  -> review the complete diff
  -> render through one owned write path
  -> verify a clean managed state
```

External coding agents may act as user-selected operators of the
`agentdevflow` CLI. They do not replace the CLI's rule validation, planning,
render ownership, or final check.

The accepted non-interactive first-use order is fixed:

```text
init -> onboard -> rule as needed -> diff -> render -> check
```

`init` is the only first-use entry. `onboard` requires the valid selected
configuration and fails before inspecting provider targets when it is absent
or invalid. Every `rule` operation also requires the valid selected
configuration, preventing rule management from becoming another pre-init
entry. New projects and projects with existing instructions do not expose
different entry orders.

## Status meanings

- **In progress:** implementation or validation is active.
- **Accepted next:** the outcome and sequence are accepted; implementation has
  not started or is waiting on an earlier dependency.
- **Decision required:** the outcome is retained, but a bounded public behavior
  must be chosen before implementation.
- **Blocked:** implementation cannot proceed until a named decision or external
  dependency is resolved.
- **Later:** retained direction that must not interrupt the accepted near-term
  sequence.
- **Superseded:** an earlier mechanism or outcome has been explicitly replaced
  and must not be revived without a new accepted decision.
- **Complete:** acceptance criteria passed and evidence is recorded in the
  completion summary.

## Current sequence

Items 1 and 2 are complete and compressed in the completion summary. The
remaining numbers preserve the accepted dependency order.

### 3. External-agent-operated onboarding

Status: **In progress**

This item depends on the completed rule, manual onboarding, and repository-wide
health-review outcomes. The public Codex-first interaction contract is accepted
and implemented. The exact prompt and documentation follow-up tree remains in
qualification.

External-agent operation begins only after the same required `init -> onboard`
entry. It does not introduce a pre-init inventory path or a second first-use
state model.

#### User outcome

The user may select an already installed and authenticated coding-agent CLI to
act as their operator during onboarding. The initial public surface is:

```text
agentdevflow onboard
agentdevflow onboard --agent manual
agentdevflow onboard --agent codex
agentdevflow onboard --agent codex --yes
```

Bare `onboard` presents the currently implemented Manual and Codex choices in
an interactive terminal. Non-interactive use requires `--agent`. Manual keeps
the exact read-only inventory and supports `--json`.

Codex onboarding launches one foreground Codex session with a reviewed
product-owned instruction. The interactive path analyzes the current exact
inventory and every existing canonical rule, explains a proposed rule
organization, accepts natural-language correction, and asks before mutation.
After acceptance, the same session operates `rule`, `diff`, exact-approved
`render`, and `check`; the user then exits that session so the parent can run
an independent final `check`. `--yes` authorizes the same one operation through
one non-interactive Codex process without the confirmation or exit handoff.

Codex CLI is the only initial launcher. Other launchers remain unsupported and
absent from the picker until separately implemented and qualified. The
launcher invokes the user's installed `codex` executable without a proactive
version allowlist or authentication detector.

#### Acceptance criteria

- The valid selected configuration is required before the picker, provider
  inventory, canonical rules, or Codex process is opened.
- Manual remains the accepted exact read-only inventory.
- Interactive Codex keeps proposal, correction, confirmation, and execution in
  one session; `--yes` authorizes one non-interactive operation.
- The external agent lists and shows existing canonical rules, follows the
  closed rule-id and rule-command contract, and stops on unresolved content.
- One fixed executable, argv, stdin when non-interactive, and working directory
  are used without shell interpolation or an arbitrary executable option.
- The user's existing Codex authentication, configuration, permission
  behavior, hooks, MCP servers, and session behavior are inherited without
  inspection, copying, storage, override, provisioning, or diagnosis.
- Public documentation discloses project-content processing and possible
  provider cost without adding a separate runtime warning workflow.
- The exact current Node executable and agentdevflow entrypoint are passed to
  Codex; `npx`, package installation, PATH lookup, and another agentdevflow
  version are forbidden for the operation.
- Canonical rules, the exact current plan, renderer-owned outputs and lock, and
  a parent-run final `check` determine success rather than provider prose or
  exit status.
- The visible English runtime instruction is intentionally packaged and
  deterministically tested, including a pre-existing canonical-rule scenario.
- One internal 15-minute timeout and bounded cancellation, missing-executable,
  launch, non-zero-exit, and non-clean final-check diagnostics are retained.
- There is no public timeout, version catalog, authentication or permission
  classifier, provider-output or proposal schema, transcript store, second
  writer, retry system, background process, or general runner.

#### Evidence

PR [#17](https://github.com/lorekkusu/agentdevflow/pull/17) merged the bounded
adapter after isolated complete-change and triggered project-health reviews.
Its exact tree passed the hosted Node.js 22/24 matrix on Ubuntu, macOS, and
Windows, recorded in `docs/evidence/v1-platform-qualification.md`.

Authenticated installed-artifact macOS dogfood with Codex CLI 0.145.0 covered
both non-interactive and interactive paths. The interactive path preserved
source bytes through proposal and natural-language correction, then represented
two unmanaged provider instructions as Shared, Developer, and Reviewer rules
before exact replacement, render, ownership-lock publication, and a clean
parent check. Raw provider material was discarded.

The dogfood exposed missing rule syntax and interactive exit guidance. This
follow-up adds those instructions, pre-existing-rule installed-package
coverage, and aligned public documentation. Local `npm run check`,
`npm run check:v1-qualification`, `npm run check:package-entrypoint`,
`npm run test:v1-recovery`, and `npm pack --dry-run --json` pass. The exact
follow-up tree still requires final complete-change review and hosted
qualification before item 3 is complete.

### 4. Interactive first-use wizard

Status: **Accepted next**

This item depends on the accepted non-interactive rule and onboarding
contracts.

#### User outcome

A zero-context user can configure a new project or begin existing-project
onboarding without first learning every CLI flag, provider binding, workflow
constraint, or ownership disposition.

The wizard is a user interface over the same public configuration, rule,
onboarding, diff, render, and check operations. It does not create a second
configuration model, hidden state, or alternate first-use order.

#### Acceptance criteria

- It covers new-project initialization and existing-project onboarding.
- Every selection has an equivalent non-interactive flag or durable config
  representation.
- The final summary shows workflow, preset, tracker, pull-request state,
  provider assignments, target files, existing-file dispositions, and the next
  command.
- Equivalent interactive and non-interactive selections produce equivalent
  project configuration and plans.
- Cancellation or invalid input before confirmation leaves no partial
  configuration, canonical rule, provider output, or lock.
- The wizard does not log in to providers, discover credentials, infer product
  policy from repository contents, or bypass the normal render approval.
- Installed-package and zero-context tests exercise both a new project and a
  project with existing instructions.

#### Evidence

Pending implementation. The current non-interactive surface is documented in
`docs/development/beta-cli-contract.md`.

### 5. Strict preset

Status: **Decision required**

This item depends on the current finite policy compiler, not on a new evidence
transport or runtime. It follows the adoption interfaces so Strict does not
delay rule and onboarding usability.

#### Committed outcome

Strict is a committed near-term preset, not an indefinite evidence-gated idea.
It must compile a materially stronger, closed policy than Balanced and expose
that difference in provider instructions and automated policy tests.

Strict must not be implemented as longer wording or marketed as external
mechanical enforcement. The project must select its exact additional safety
properties before implementation.

#### Required decision criteria

- At least one built-in workflow case accepted by Balanced is rejected or
  blocked by Strict for a clear policy reason.
- The difference is represented in the finite policy model and executable
  tests, not only provider text.
- Plan acceptance, implementation verification, CI when applicable,
  independent current-revision review, finding disposition, and invalidation
  after rework have explicit Strict treatment.
- Missing tools or evidence cannot silently downgrade Strict to Balanced.
- Strict does not silently choose tracker, provider, pull-request state,
  auxiliary review, or merge method.
- Generated instructions describe which requirements are advisory and which
  configuration or compilation checks are mechanical.

#### Non-goals

- No general evidence transport, authenticated observation system, scheduler,
  or workflow-status database solely to support the preset.
- No automatic merge authority.
- No claim that launching a fresh process proves reviewer identity or
  independence.

#### Evidence

The finite-state safety foundation is covered by
`test/policy/validator.test.ts` and `docs/evidence/policy-safety.md`.
The exact Strict property set remains an open product decision.

### 6. Exact-candidate dogfood and zero-context review

Status: **Accepted next**

This begins only after items 1 through 5 have executable candidate behavior.

#### Required scenarios

1. A clean private repository completes interactive initialization,
   responsibility-scoped rule management, diff, render, check, and bounded
   Codex, Claude Code, and Cursor role-response checks. These checks evaluate
   expected and prohibited actions without treating a provider response as
   proof of identity, authority, clean context, or role isolation.
2. An existing private repository with overlapping `AGENTS.md`, `CLAUDE.md`,
   and Cursor guidance completes manual onboarding without undisclosed content
   loss.
3. The same existing-project fixture completes external-agent-operated
   onboarding for every launcher proposed for public support.
4. A representative Linear-to-reviewed-pull-request flow uses an authorized
   external Steward and Developer, current CI repair, fresh review after
   rework, squash merge, issue closure, and branch cleanup.
5. Strict demonstrates its accepted difference from Balanced in a reproducible
   case.

#### Acceptance criteria

- Dogfood installs the exact final candidate tarball rather than importing
  source files.
- Failures in external CLIs, permissions, missing tools, or malformed proposals
  stop with actionable diagnostics and preserve the manual path.
- Public evidence contains only sanitized scope, versions, outcomes,
  limitations, and reproducible non-sensitive fixtures.
- Independent zero-context reviewers can explain the product, choose a
  workflow, onboard an existing project, manage a rule, distinguish the
  generated responsibility sections, and state what the product does not
  automate or isolate.
- Maintainer dogfood is described as maintainer evidence, not normal-user
  adoption.

#### Evidence

The earlier bounded observation is
`docs/development/maintainer-dogfood.md`. It proves the advisory role flow, not
the new rule, onboarding, wizard, Strict, or launcher milestones.

### 7. Next npm beta

Status: **Accepted next**

Release preparation begins only after items 1 through 6 pass.

#### Acceptance criteria

- Select the version only after the public scope is final.
- Update the README, getting-started guide, CLI contract, changelog, and
  migration notes from the exact release tree.
- Run repository, type, build, test, installed-bin, tarball, supported-platform,
  and dependency-advisory qualification.
- Confirm the packed artifact contains the rule, onboarding, wizard, Strict,
  qualified launcher runtime, and reviewed product-owned runtime instruction
  templates but excludes tests, fixtures, private experiments, expanded
  requests, transcripts, and external credentials.
- Publish only through the protected workflow with separate release authority.
- Align the exact commit, Git tag, GitHub prerelease, npm version, provenance,
  and public installed-artifact verification.

The historical beta tags and release metadata will not be reconstructed solely
for cosmetic completeness. The next release establishes the complete release
record.

#### Evidence

The published `0.1.0-beta.2` package is an earlier local-only snapshot. Current
evidence is recorded in `docs/evidence/initial-beta-publication.md` and
`docs/evidence/public-first-run.md`.

## Accepted later direction

These outcomes remain intentionally after the current sequence:

- reusable, provider-portable procedures and skills for planning,
  implementation, review, and progress recording;
- Custom policy composition from a closed set of validated building blocks;
- provider-instance, nested, path-specific, conditional, or inherited rule
  scopes after the simple rule model proves insufficient;
- a complete `migrate` command when a real public configuration transition
  requires it;
- an additional provider renderer after a real repository requires one;
- a bounded live external adapter only when advisory procedures cannot satisfy
  a specific accepted user outcome;
- a stable arbitrary-workflow extension boundary after multiple built-in
  workflows prove insufficient;
- broader normal-user onboarding research after the adoption beta is usable.

`ProjectConfig` remains the beta user-facing configuration concept and
candidate stable 1.0 API. `WorkflowDefinition` and compiler intermediate
representation remain private and experimental.

## Explicitly out of scope

The current roadmap does not authorize:

- a scheduler, orchestration runtime, background agent queue, or automatic
  agent chain;
- a credential vault, provider login manager, or copied authentication state;
- a general repository analyzer;
- automatic merge or release authority;
- a GUI, SaaS control plane, skills marketplace, or MCP marketplace;
- broad provider support without per-provider qualification;
- arbitrary executable predicates, dynamic workflow topology, or a public
  general workflow DSL;
- a second writer, approval store, transaction system, rollback engine, lease,
  backup service, Git manager, or hostile-local-writer defense.

## Superseded mechanisms that must not return by default

- Rulesync as a runtime dependency or maintained fork;
- write-ahead journals, rollback or roll-forward transactions, leases, cleanup
  receipts, and durable recovery blobs;
- a second renderer writer or composite canonical-source/provider transaction;
- the schema-version-0 parser, compiler, and init/render bridge;
- managed regions and reverse synchronization from generated provider files;
- the former indexed and digest-heavy canonical-rule CRUD experiment;
- private execution trace transport, replay, compiled-policy consumer, and
  GitHub Check Runs mapper without a real product consumer;
- the caller-supplied observation `doctor` command;
- Git cleanliness, stash, reset, branch, or commit as render authorization;
- paid auxiliary review as a required workflow component.

Reopening one of these mechanisms requires a reproduced in-scope failure, a
smaller-alternative comparison, and an explicit accepted decision. The removed
mechanism does not cancel a retained user outcome; for example, the old rule
CRUD architecture remains superseded while minimal rule management is now an
accepted milestone.

## Open decisions

Only the following current decisions remain open:

1. the exact additional finite safety properties that distinguish Strict from
   Balanced;
2. the final interactive wizard questions and whether no-argument invocation or
   an explicit command is the primary entry point;
3. the next beta version after the implemented public scope is fixed.

These decisions must be resolved before their corresponding public contracts
are finalized. They do not reopen the accepted outcomes or reorder the current
sequence.

## Stop and pivot conditions

Recommend a pivot or stop rather than adding infrastructure if exact-candidate
dogfood shows that:

- responsibility-filtered instructions do not produce useful and repeatable
  responsibility or handoff differences compared with a shared-instruction
  baseline;
- existing projects cannot be onboarded without unacceptable content loss or
  manual reconstruction;
- external-agent operation adds more maintenance and failure modes than the
  onboarding work it removes;
- Strict cannot offer a mechanically testable difference from Balanced within
  the current compiler boundary; or
- the policy-compiler layer adds no independent value beyond copying a shared
  prompt.

## Completed summary

Completed outcomes are compressed here so the active roadmap remains
decision-ready. Detailed evidence stays in architecture, decision, development,
test, and evidence documents.

| Outcome | Evidence |
| --- | --- |
| English public product, architecture, development, contribution, and repository guidance established | `README.md`; `docs/product-direction.md`; `docs/architecture.md`; `AGENTS.md`; `CONTRIBUTING.md` |
| Root repository guidance aligned with real commands and advisory-versus-mechanical enforcement | `AGENTS.md`; `docs/development/public-information-policy.md` |
| Phase 0 Gate 1 selected a minimal native renderer instead of a Rulesync runtime dependency or fork | `docs/decisions/0001-native-project-instructions-renderer.md`; `docs/evidence/renderer-backend.md` |
| Phase 0 Gate 6 proved bounded finite-state policy safety with cycles, typed artifacts, invalidation, deterministic counterexamples, and guard-blind diagnostics | `src/policy/validator.ts`; `test/policy/validator.test.ts`; `docs/evidence/policy-safety.md` |
| Node.js 22/24, npm, ESM TypeScript, strict checking, `node:test`, Zod/JSONC boundaries, and the current source layout were selected | `package.json`; `tsconfig.json`; `docs/development/tooling.md`; `docs/decisions/0003-private-jsonc-zod-boundary.md` |
| Non-interactive `init`, `diff`, `render`, and `check` operate through the installed npm bin | `src/cli/private-local-cli.ts`; `test/cli/cli-bin-mode.test.ts`; `scripts/verify-package-entrypoint.mjs` |
| Provider-neutral Steward, Developer, and Reviewer procedures and canonical rules are deterministically filtered into provider target files; each target declares product applicability, and automated tests prove assigned sections are included while unassigned sections are omitted. This is text composition, not runtime role isolation. | `src/guidance/private-project-guidance.ts`; `src/renderer/native/`; `test/guidance/private-project-guidance.test.ts`; `test/renderer/native-project-instructions.test.ts`; `docs/development/maintainer-dogfood.md` |
| Built-in local-reviewed-change and issue-to-reviewed-pull-request workflows support Linear or GitHub Issues intent, draft or ready pull requests, Fast or Balanced policy, current CI repair, fresh review, and squash merge procedures | `src/workflows/`; `test/workflows/private-domain-workflows.test.ts`; `docs/development/issue-to-reviewed-pull-request.md` |
| Complete diff, exact plan approval, whole-file ownership, stale-plan rejection, forward-convergent apply, lock-last publication, and clean-state checking are implemented | `src/commands/`; `src/renderer/private-convergent-apply.ts`; `src/lock/private-render-lock.ts`; `docs/decisions/0002-v1-forward-convergent-render-apply.md` |
| The public repository, Apache-2.0 license, contribution and security policies, protected publication workflow, provenance, repository hardening, and dependency review are established | `LICENSE`; `CONTRIBUTING.md`; `SECURITY.md`; `.github/workflows/`; `docs/evidence/initial-beta-publication.md` |
| A bounded maintainer-operated sequence exercised role-labelled procedures, Linear, Cursor delegation, CI failure repair, fresh review after rework, squash merge, issue closure, and branch cleanup. The observation did not prove provider identity, authority, clean-context authenticity, or role isolation. | `docs/development/maintainer-dogfood.md` |
| Overbuilt transaction, recovery, execution-transport, old-schema, second-writer, and indexed-rule mechanisms were removed while their useful conclusions were retained | `docs/development/engineering-boundary.md`; `docs/development/project-health.md`; Git history |
| Root roadmap authority, update rules, completion evidence, and the known former duplicate-path check established | `ROADMAP.md`; `AGENTS.md`; `scripts/check-repository.mjs`; `test/repository/check-repository.test.ts` |
| Minimal per-rule management supports bounded human and JSON `list/show/add/update/remove`, portable globally unique ids, fixed shared and responsibility scopes, responsibility-filtered composition, stale-plan rejection, and fail-closed manual remediation for unpublished aggregate paths without adding a migration subsystem | `src/commands/private-rule-command-service.ts`; `src/guidance/private-project-guidance.ts`; `test/cli/private-local-cli.test.ts`; `test/guidance/private-project-guidance.test.ts`; `scripts/verify-package-entrypoint.mjs`; `docs/development/instruction-composition.md` |
| Fixed init-first manual existing-project onboarding requires a valid selected configuration before exact native-target inventory, keeps classification with the user, permits only exact digest-bound whole-file replacement through the normal diff, render, forward-convergence, and ownership-lock path, and finishes with a clean managed state without adding an alternate entry order, repository analyzer, second writer, or approval store | `docs/decisions/0006-manual-existing-project-onboarding.md`; `src/cli/private-local-cli.ts`; `src/onboarding/private-existing-project-inventory.ts`; `src/application/private-domain-project-plan.ts`; `test/cli/private-local-cli.test.ts`; `scripts/verify-package-entrypoint.mjs`; `npm run check:v1-qualification`; `npm run check:package-entrypoint`; `npm run test:v1-recovery` |
| Repository-wide health review mapped every accepted ADR, completed outcome, command, production module, public journey, package entry, and retained dependency; repaired stale ADR and package evidence; removed unsupported compiler artifacts and a no-value test; and completed independent product, implementation-cost, and zero-context installed-package perspectives | `docs/development/project-health.md`; `docs/decisions/0001-native-project-instructions-renderer.md`; `docs/decisions/0006-manual-existing-project-onboarding.md`; `docs/evidence/private-package-qualification.md`; `docs/evidence/v1-platform-qualification.md`; `npm run check`; `npm run check:v1-qualification`; `npm run check:package-entrypoint`; `npm run test:v1-recovery` |
