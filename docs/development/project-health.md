# Project health

Assessment date: 2026-07-24.

This is a dated health snapshot. The root `ROADMAP.md` alone controls current
status, sequence, decisions, and acceptance criteria.

## Outcome

**Continue with the product and start the adoption milestone in
`ROADMAP.md`.** The earlier candidate was completed and merged as pull request
10. Its tests prove deterministic responsibility-filtered content routing, and
the maintainer dogfood records one bounded workflow observation. This evidence
supports continuing to test the hypothesis that responsibility-filtered
outputs add value beyond one shared prompt; it does not yet establish that
normal-user outcome.

The current repository is still not the intended adoption beta. Minimal
command-based rule management and bounded manual onboarding for existing
provider instructions are complete. An interactive first-use path, the
accepted Strict preset, and qualified external-agent-operated onboarding
remain product gaps rather than optional research ideas.

## Active implemented core

- revision-1 bounded JSONC project configuration;
- Fast and Balanced preset expansion;
- `local-reviewed-change`;
- `issue-to-reviewed-pull-request` with Linear or GitHub Issues, draft or
  ready state, auxiliary review disabled, and squash merge;
- provider-neutral Steward, Developer, and Reviewer responsibilities;
- globally unique, per-rule canonical guidance under fixed shared, Steward,
  Developer, and Reviewer scope directories;
- bounded human and JSON `rule list`, `show`, `add`, `update`, and `remove`
  commands that mutate one canonical rule file at a time;
- bounded read-only `onboard` inventory for the three native targets, with
  exact reviewed whole-file replacement through the normal plan and writer;
- responsibility-filtered Codex, Claude Code, and Cursor target views with
  explicit product applicability;
- whole-file create, exact adopt, bounded equivalent-content import, or abort;
- complete `diff`, exact-approved `render`, ownership lock, and read-only
  `check`;
- finite-state safety validation for typed artifacts, invalidation, cycles,
  review bypass, stale evidence, deterministic counterexamples, and guard-blind
  diagnostics.

The public working-tree CLI exposes `init`, `onboard`, `diff`, `render`,
`check`, and the bounded `rule` command family.

## Corrective simplification

Executable systems without a normal-user producer or consumer were removed:

- write-ahead transaction, rollback, lease, and journal machinery;
- execution trace transport and replay;
- provider-specific external evidence mapping;
- superseded schema and init paths;
- Rulesync process-oracle tooling;
- the indexed and transaction-heavy canonical-rule CRUD experiment;
- composite canonical-source/provider transactions; and
- the caller-supplied environment-observation command.

The rule-management user outcome was not canceled by deleting its overbuilt
implementation. Its smaller replacement is now implemented: one Markdown file
per globally unique rule id, a closed scope set, and small commands that reuse
the existing provider diff, render, and check path. Unreleased aggregate paths
fail closed with exact manual-move guidance; there is no migration subsystem or
dual reader.

The retained file executor provides exact before-or-after convergence and
lock-last publication. Stronger machinery may return only after a reproduced
in-scope failure and an accepted product decision.

## External-system boundary

The issue workflow's tracker, pull-request, CI, review, and merge capabilities
remain advisory compiled procedures. The CLI does not connect to Linear or
GitHub, poll CI, manage credentials, or merge.

The accepted onboarding launcher has a different and narrower purpose. It may
start one user-selected, already installed local coding-agent CLI in the
foreground. That external agent acts as the user's operator of the exact
current `agentdevflow` rule, diff, render, and check commands. The launcher
does not provide provider login, a provider SDK, background execution,
automatic retries, an agent chain, or trusted workflow evidence.

## Current evidence

### Role and workflow value

The bounded maintainer observation in `maintainer-dogfood.md` records:

- its exact pre-closure candidate tarball completed
  `init -> diff -> render -> check`;
- canonical shared and responsibility rules produced byte-different provider
  targets when configured assignments differed;
- one-shot Codex, Claude Code, and Cursor responses were consistent with the
  supplied responsibility sections and named expected handoffs;
- one Codex target exposed both Steward and Reviewer sections, while separate
  invocations followed the prompted section; this did not isolate identity,
  permissions, authority, or execution context;
- maintainers followed the representative Linear, GitHub
  ready-pull-request, GitHub Actions, and squash-merge procedure through CI
  repair and fresh review;
- tracker-native Cursor delegation started the Developer step while
  maintainers continued to follow the Steward procedure for later gates; and
- a changed revision caused the procedure to treat earlier review evidence as
  stale.

This is maintainer evidence from a synthetic private repository. It is not
normal-user adoption evidence, a provider compatibility guarantee, or proof of
role isolation.

### Provider discovery overlap

A 2026-07-24 bounded Cursor Agent observation showed that one runtime could
discover the generated root `AGENTS.md`, root `CLAUDE.md`, and Cursor rules
together. The pre-correction response selected the configured Cursor Developer
section but reported that the visible projections lacked an explicit
cross-product precedence rule. The current composition corrects that text by
declaring the target product and making every nonmatching projection wholly
inapplicable. Against the exact corrected output, the same Cursor Agent version
selected the Cursor Developer projection, rejected cross-product role
combination, and reported no unresolved ambiguity. Automated tests prove the
declaration and content routing; the headless response remains point-in-time
behavioral evidence rather than mechanical enforcement.

### Qualification

The earlier role-specific candidate passed:

- the supported Ubuntu, macOS, and Windows matrix on Node.js 22 and 24;
- dependency-advisory review; and
- a focused independent closure review after whole-project findings were
  repaired.

The current working tree passed repository audit, strict type checking, build,
242 automated tests, packed-installed entrypoint qualification, V1 recovery
tests, and tarball dry-run. The installed bin exercised all five rule
operations, responsibility-filtered render convergence, exact
product-applicability declarations, lock-free manual onboarding, and
incremental onboarding of an unmanaged provider target after another target
was already managed. Aggregate-layout evidence remains layered deliberately:
the shared reader has focused all-path tests, source CLI tests cover all five
rule operations without mutation, and the installed bin smoke test covers all
four aggregate paths in mixed and partially moved states through
representative `rule list` and `diff` commands. Hosted platform qualification
is supplied by pull-request checks rather than inferred from local checks.

Independent change and health reviews found no second writer, transaction,
approval store, backup system, Git manager, dependency, or other
engineering-boundary regression. Verified findings were repaired by applying
replacement authorization per unmanaged target rather than per lock, adding
incremental managed-project coverage, aligning current-state documentation,
clarifying local-versus-no-tracker intent, and distinguishing locally packed
development candidates from the historical published version.

A zero-context installed-package exercise completed
`onboard -> init -> rule -> diff -> render -> check`, reached a clean state,
and could explain the generated paths, approval sequence, and non-features.
This is bounded pre-release usability evidence, not normal-user adoption.

Every new roadmap milestone must rerun the current required checks and add
focused installed-bin coverage for its new public behavior.

### Published package

The published `0.1.0-beta.2` remains an earlier local-only historical snapshot.
It does not contain the issue workflow, responsibility-specific composition,
rule management, practical existing-project onboarding, wizard, Strict, or
external agent launchers now described by the current repository and roadmap.
The source manifest retains that historical version until the final next-beta
scope and version are selected. Locally packed tarballs from the working tree
are development candidates, not the published artifact.

## Current product risks

### Manual onboarding remains judgment-heavy and unreleased

The bounded manual path now inventories exact existing `AGENTS.md`,
`CLAUDE.md`, and the native Cursor target, lets the user represent retained
content in canonical rules, and permits exact reviewed replacement. It does not
classify or merge natural-language guidance. A user must still decide what is
shared, responsibility-specific, duplicated, conflicting, or intentionally
omitted. The zero-context package exercise proved the documented mechanism,
not broad usability or normal-user adoption.

### First-use configuration is too demanding

The non-interactive init path is reproducible but requires a zero-context user
to understand workflow, preset, tracker, pull-request, provider, and
responsibility choices before seeing a guided product flow. The accepted
wizard must wrap the same model rather than create a second configuration
surface.

### Strict is not yet a product capability

Strict is recognized but unavailable. The roadmap commits to implementing it,
but the exact closed property set still needs a bounded decision. It must be
mechanically distinguishable from Balanced and must not imply live external
enforcement.

### External-agent operation is unqualified

Codex, Claude Code, Cursor, and OpenCode expose different executable, auth,
permission, session, and output behavior. Thin adapters and real installed
CLI dogfood are required before any launcher is described as supported. The
manual onboarding path must remain available.

### Maintainer evidence is not user adoption

The project has no normal-user adoption evidence. Internal testing must make
the first useful beta coherent, but it cannot substitute for later observation
of unfamiliar users onboarding their own repositories.

## Active milestone closure

The active milestone is complete only when all current-sequence items in the
root roadmap pass:

| Criterion | Current status |
| --- | --- |
| Minimal rule commands and one-file-per-rule source | Complete in the working tree |
| Manual existing-project onboarding | Complete in the working tree |
| External-agent-operated onboarding | Accepted next; launcher contract and qualification pending |
| Interactive new/existing project wizard | Waiting on non-interactive contracts |
| Strict policy difference accepted and executable | Decision required |
| Exact final tarball dogfood and zero-context review | Waiting on implementation |
| Next beta qualification and separately authorized publication | Waiting on prior gates |

If the compiler, onboarding path, or external-agent operation adds no useful
value, recommend a pivot or stop. Do not respond by adding a runtime, security
subsystem, transaction framework, or general automation platform.

## Next review triggers

Run another independent project-health review when:

- existing-project onboarding and one external-agent adapter complete their
  first end-to-end private-repository run;
- the Strict property set is proposed for acceptance;
- the adoption milestone reaches exact-candidate qualification;
- a new public command, schema revision, provider renderer, live external
  adapter, or runtime is proposed;
- a superseded mechanism is proposed for reintroduction; or
- ordinary change cost grows without a corresponding user outcome.
