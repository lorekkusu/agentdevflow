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
configuration and rules. The product compiles them into deterministic,
responsibility-specific instructions for coding-agent products and preserves a
reviewable path from source changes to generated outputs.

The core user outcome is:

```text
choose a workflow and responsibilities
  -> manage project-owned rules
  -> onboard new or existing projects
  -> generate distinct Steward, Developer, and Reviewer instructions
  -> review the complete diff
  -> render through one owned write path
  -> verify a clean managed state
```

External coding agents may act as user-selected operators of the
`agentdevflow` CLI. They do not replace the CLI's rule validation, planning,
render ownership, or final check.

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

### 1. Minimal project-rule management

Status: **Decision required**

The user outcome and command family are accepted. The aggregate-rule migration
decision below must be accepted before implementation.

#### User outcome

People, coding agents, and scripts can list, inspect, add, update, and remove
project-owned rules without editing generated provider files or reverse
engineering an internal storage format.

The accepted command family is:

```text
agentdevflow rule list [--json]
agentdevflow rule show <id> [--json]
agentdevflow rule add <id> --scope <scope> (--file <path> | --stdin)
agentdevflow rule update <id> (--file <path> | --stdin)
agentdevflow rule remove <id>
```

The initial closed scope set is:

```text
shared
steward
developer
reviewer
```

Each rule is one user-owned Markdown file. Its safe filename is its stable rule
id, and its parent scope directory determines where it applies:

```text
.agentdevflow/rules/shared/<rule-id>.md
.agentdevflow/rules/steward/<rule-id>.md
.agentdevflow/rules/developer/<rule-id>.md
.agentdevflow/rules/reviewer/<rule-id>.md
```

Rule ids use lowercase ASCII slugs matching
`[a-z0-9]+(?:-[a-z0-9]+)*` and are globally unique across every scope.
`update` changes content without changing scope. Moving a rule between scopes
requires an explicit remove and add. Composition is deterministic: shared rules
are ordered by rule id, and assigned responsibility rules are ordered by rule id
inside each fixed responsibility section.

Rule commands mutate only canonical rule sources. Provider outputs continue
through the existing `diff -> render -> check` path.

#### Aggregate-rule migration decision

The current beta reads four aggregate files at
`.agentdevflow/rules/{shared,steward,developer,reviewer}.md`. They must never
become silently ignored when per-rule directories are introduced.

Before implementation, accept one bounded transition contract. The current
recommendation is a one-shot, explicit migration that preserves the exact
aggregate Markdown as named rules, refuses target collisions, and fails closed
with exact paths when aggregate and per-rule layouts coexist. This avoids an
indefinite dual reader and avoids automatic mutation during ordinary planning.
The exact migration command and retry behavior remain a public-contract
decision.

#### Acceptance criteria

- Human and JSON output are bounded, deterministic, and documented.
- Rule ids reject traversal, ambiguous normalization, unsafe filenames, and
  duplicates.
- Directly created invalid rule entries fail with path-specific diagnostics;
  unrelated files outside the recognized immediate `*.md` entries are not
  discovered as rules.
- `add` fails when the id already exists; `update`, `show`, and `remove` fail
  when it does not.
- `--file` and `--stdin` have explicit size and regular-file boundaries.
- A shared rule reaches every configured provider output.
- A role rule reaches only providers assigned that role.
- A rule change creates a deterministic provider diff and invalidates an older
  render approval.
- Generated provider instructions explain that canonical rules are managed
  with the `rule` commands and outputs must not be edited directly.
- Installed-package tests cover the command family through the real npm bin.
- Aggregate-only, per-rule-only, mixed-layout, collision, interruption, and
  completed-migration cases have installed-bin regression coverage. No
  aggregate guidance is silently ignored or deleted.

#### Non-goals

- No database, manifest, index, provenance ledger, public rule DSL, or rule
  ordering language.
- No provider-instance, nested, path-specific, conditional, inherited, or
  dynamically evaluated scope in this milestone.
- No source/provider composite transaction, second approval model, backup
  system, lease, journal, or Git integration.
- No semantic merge, automatic conflict resolution, or direct generated-file
  editing.
- No indefinite dual storage model or implicit migration during `diff`,
  `render`, or `check`.

#### Evidence

Pending implementation. Current absence is evidenced by
`src/interface/private-cli-arguments.ts:16` and
`docs/development/instruction-composition.md`.

### 2. Existing-project onboarding

Status: **Decision required**

The user outcome and safety boundary are accepted. The manual interface and
replacement-authorization representation below must be accepted before
implementation. This item depends on item 1.

#### User outcome

A project that already contains `AGENTS.md`, `CLAUDE.md`, or supported Cursor
rules can move its useful instructions into canonical `agentdevflow` rules and
let the normal renderer take ownership without silent content loss.

This is a primary adoption path, not a legacy edge case. A manual deterministic
path must exist even when no external coding agent is installed.

#### Required flow

```text
discover supported existing instruction files
  -> show exact paths and ownership dispositions
  -> the operator classifies retained, duplicated, conflicting, and
     unclassified content
  -> write accepted rules through the rule command boundary
  -> show the complete provider replacement diff
  -> render the exact approved plan
  -> finish with a clean check
```

The original provider files remain unchanged until the normal render step.
Every replacement is represented in the complete render plan. A changed source
or target invalidates that plan.

#### Manual interface decision

The no-model path needs one reproducible public boundary for:

- read-only inventory of supported existing targets;
- the content unit and operator-supplied classification;
- bounded human and JSON output;
- the transition from accepted classifications to rule commands; and
- explicit per-target complete-file replacement authorization that both
  `diff` and `render` can reproduce and bind into the same plan digest.

The current recommendation is a read-only onboarding inventory plus explicit
per-target replacement arguments repeated for `diff` and `render`. It would
keep classifications in the operator's rule choices and complete diff instead
of adding a durable proposal store. The exact command and output shape require
acceptance before implementation.

#### Acceptance criteria

- Discovery is read-only, bounded to explicitly supported project paths, and
  fails clearly on unreadable, oversized, non-regular, or ambiguous files.
- The manual path can preserve selected existing content without an external
  model.
- The user can inspect content that was retained, combined, left unresolved,
  or intentionally omitted before provider replacement.
- The user, not a heuristic, owns every manual classification. Unresolved or
  unclassified content blocks replacement unless the user explicitly includes
  its omission in the reviewed whole-file disposition.
- Existing files are never silently overwritten or deleted.
- Replacement authorization is an explicit reproducible planner input bound to
  the target's observed bytes and the current canonical sources. It is not
  inferred from Git state, an earlier process, or an external agent's claim.
- The normal render plan, approval, forward convergence, and ownership lock are
  reused; onboarding adds no second provider writer or transaction.
- Tests cover duplicate guidance, provider-specific guidance, conflicting
  guidance, unclassified content, target drift, and interruption before lock
  publication.

#### Non-goals

- No repository-wide semantic analyzer.
- No claim that natural-language transformation is mechanically lossless.
- No managed regions, reverse synchronization, backup service, or Git rollback.
- No requirement that the manual onboarding path use an external agent or
  model.

#### Evidence

The current analyzer only accepts existing logical content already preserved by
the proposed generated target:
`src/import/private-project-instructions-analyzer.ts:121`.
The current adoption limitation is documented at
`docs/development/project-health.md`.

### 3. External-agent-operated onboarding

Status: **Accepted next**

This item depends on the accepted rule and manual onboarding contracts in items
1 and 2.

#### User outcome

The user may select an already installed and authenticated coding-agent CLI to
act as their operator during onboarding. The external agent supplies semantic
judgment, proposes a rule organization, and operates the same `agentdevflow`
commands that a user would operate manually.

The candidate invocation is:

```text
agentdevflow onboard --agent <agent>
```

It has two explicit operation modes:

```text
propose
  -> launch one selected local coding-agent process
  -> analyze supported existing instruction files
  -> emit a bounded rule proposal and unresolved-content report
  -> stop before any rule or provider mutation

apply
  -> the user explicitly delegates canonical-rule decisions and render
     approval for this one onboarding operation
  -> launch one selected local coding-agent process
  -> analyze and explain supported existing instruction files
  -> use agentdevflow rule commands
  -> run agentdevflow diff with the accepted replacement inputs
  -> approve and run agentdevflow render for that exact plan
  -> run agentdevflow check
  -> report applied rules, unresolved content, and failures
```

Selecting apply is the semantic authorization for the chosen external agent to
operate on the user's behalf; copying a plan digest is only the existing
staleness binding. Apply does not require a second approval system or an
unconditional intermediate human pause. Ambiguous or unresolved content must
stop rather than be silently omitted.

The launcher passes the exact current `agentdevflow` executable to the external
agent. It must not resolve a different package version during the same
onboarding operation.

#### Initial launcher candidates

- Codex CLI;
- Claude Code;
- Cursor CLI;
- OpenCode.

Each launcher is a thin, replaceable process adapter. Only adapters that pass
direct installed-version qualification and end-to-end dogfood may be described
as supported. Unsupported or incompatible installed versions fail with an
actionable diagnostic and retain the manual onboarding path.

OpenCode is an initial launcher candidate only. It is not an initial provider
renderer target.

#### Acceptance criteria

- The user explicitly selects the external agent and propose or apply mode.
  Apply permission cannot be inferred from project configuration or a previous
  run.
- The launcher uses a fixed executable plus argv and stdin without shell
  interpolation.
- It inherits the user's existing CLI authentication without reading, copying,
  storing, printing, or refreshing credentials.
- It discloses that selected project instruction content may be sent to the
  chosen external provider and may incur provider usage cost.
- The external agent is instructed to use the rule, diff, render, and check
  commands rather than edit generated provider files.
- Provider-specific permission controls are used when available, but the
  product does not claim hostile-process confinement.
- Product correctness is determined by the resulting canonical rules, exact
  render plan, ownership state, and final `check`, not by the agent's prose or
  exit code alone.
- A reviewed, visible, English product-owned runtime instruction template is
  versioned, packaged, and tested as source. Expanded requests containing
  project content and provider responses remain runtime data.
- Cancellation, timeout, missing executable, missing authentication, malformed
  output, permission rejection, and non-zero exit produce bounded diagnostics.
- No expanded request, raw transcript, credential, private reasoning, or raw
  provider session is written into the user's repository or retained as
  project evidence.

#### Engineering boundary

This is a foreground, one-shot operator convenience. It is not a provider SDK,
credential manager, background worker, scheduler, retry engine, agent chain, or
workflow runtime. It does not turn agent output into trusted verification,
review, CI, or merge evidence.

#### Evidence

Official CLI contracts support bounded non-interactive execution and require
provider-specific adapters:

- <https://learn.chatgpt.com/docs/non-interactive-mode>
- <https://code.claude.com/docs/en/cli-usage>
- <https://docs.cursor.com/en/cli/headless>
- <https://opencode.ai/docs/cli/#run>

Local compatibility fixtures and dogfood evidence are pending.

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
configuration model or hidden state.

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

1. A clean private repository completes interactive initialization, role-aware
   rule management, diff, render, check, and fresh Codex, Claude Code, and
   Cursor role-comprehension checks.
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
  workflow, onboard an existing project, manage a rule, identify each role, and
  state what the product does not automate.
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

1. the aggregate-rule migration command, mixed-layout behavior, and retry
   contract described in item 1;
2. the manual onboarding command, classification output, and reproducible
   per-target replacement authorization described in item 2;
3. the exact additional finite safety properties that distinguish Strict from
   Balanced;
4. the final interactive wizard questions and whether no-argument invocation or
   an explicit command is the primary entry point;
5. the final launcher command and mode flags, qualified version ranges, and
   public support tier for each external-agent launcher; and
6. the next beta version after the implemented public scope is fixed.

These decisions must be resolved before their corresponding public contracts
are finalized. They do not reopen the accepted outcomes or reorder the current
sequence.

## Stop and pivot conditions

Recommend a pivot or stop rather than adding infrastructure if exact-candidate
dogfood shows that:

- distinct role instructions do not improve responsibility or handoff
  understanding;
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
| Provider-neutral Steward, Developer, and Reviewer responsibilities render into materially distinct Codex, Claude Code, and Cursor instructions | `src/renderer/native/`; `test/renderer/native-project-instructions.test.ts`; `docs/development/maintainer-dogfood.md` |
| Built-in local-reviewed-change and issue-to-reviewed-pull-request workflows support Linear or GitHub Issues intent, draft or ready pull requests, Fast or Balanced policy, current CI repair, fresh review, and squash merge procedures | `src/workflows/`; `test/workflows/private-domain-workflows.test.ts`; `docs/development/issue-to-reviewed-pull-request.md` |
| Complete diff, exact plan approval, whole-file ownership, stale-plan rejection, forward-convergent apply, lock-last publication, and clean-state checking are implemented | `src/commands/`; `src/renderer/private-convergent-apply.ts`; `src/lock/private-render-lock.ts`; `docs/decisions/0002-v1-forward-convergent-render-apply.md` |
| The public repository, Apache-2.0 license, contribution and security policies, protected publication workflow, provenance, repository hardening, and dependency review are established | `LICENSE`; `CONTRIBUTING.md`; `SECURITY.md`; `.github/workflows/`; `docs/evidence/initial-beta-publication.md` |
| Bounded maintainer dogfood exercised distinct roles, Linear, Cursor delegation, CI failure repair, fresh review after rework, squash merge, issue closure, and branch cleanup | `docs/development/maintainer-dogfood.md` |
| Overbuilt transaction, recovery, execution-transport, old-schema, second-writer, and indexed-rule mechanisms were removed while their useful conclusions were retained | `docs/development/engineering-boundary.md`; `docs/development/project-health.md`; Git history |
| Root roadmap authority, update rules, completion evidence, and the known former duplicate-path check established | `ROADMAP.md`; `AGENTS.md`; `scripts/check-repository.mjs`; `test/repository/check-repository.test.ts` |
