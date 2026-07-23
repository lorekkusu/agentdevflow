# Project health

Assessment date: 2026-07-23.

This is a dated health snapshot. The root `ROADMAP.md` alone controls current
status, sequence, decisions, and acceptance criteria.

## Outcome

**Continue with the product and start the adoption milestone in
`ROADMAP.md`.** The earlier role-specific candidate was completed and merged as
pull request 10. Its tests, installed-package qualification, hosted platform
matrix, private-repository dogfood, and focused independent review support a
bounded conclusion: deterministic responsibility-specific instructions add
value beyond copying one shared prompt.

The current repository is still not the intended adoption beta. It lacks
command-based rule management, practical onboarding for projects with existing
provider instructions, an interactive first-use path, the accepted Strict
preset, and qualified external-agent-operated onboarding. Those are product
gaps, not optional research ideas.

## Active implemented core

- revision-1 bounded JSONC project configuration;
- Fast and Balanced preset expansion;
- `local-reviewed-change`;
- `issue-to-reviewed-pull-request` with Linear or GitHub Issues, draft or
  ready state, auxiliary review disabled, and squash merge;
- provider-neutral Steward, Developer, and Reviewer responsibilities;
- aggregate canonical guidance from
  `.agentdevflow/rules/{shared,steward,developer,reviewer}.md`;
- responsibility-specific Codex, Claude Code, and Cursor views;
- whole-file create, exact adopt, bounded equivalent-content import, or abort;
- complete `diff`, exact-approved `render`, ownership lock, and read-only
  `check`;
- finite-state safety validation for typed artifacts, invalidation, cycles,
  review bypass, stale evidence, deterministic counterexamples, and guard-blind
  diagnostics.

The public working-tree CLI currently exposes only `init`, `diff`, `render`,
and `check`. The accepted next commands and storage changes are roadmap
commitments, not implemented claims.

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
implementation. The accepted replacement is one Markdown file per rule, a
closed scope set, and small rule commands that reuse the existing provider
diff, render, and check path. Its aggregate-file migration and mixed-layout
behavior remain a decision gate; existing guidance must not be silently
ignored.

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

The bounded maintainer observation in `maintainer-dogfood.md` demonstrates:

- its exact pre-closure candidate tarball completed
  `init -> diff -> render -> check`;
- canonical shared and role guidance produced materially different provider
  outputs;
- fresh Codex, Claude Code, and Cursor contexts understood their assigned
  responsibilities and handoff boundaries;
- one Codex assignment could represent Steward and fresh Reviewer contexts
  without granting both responsibilities to the active context;
- the representative Linear, GitHub ready-pull-request, GitHub Actions, and
  squash-merge procedure remained understandable through CI repair and fresh
  review;
- tracker-native Cursor delegation could start the Developer step while later
  gates remained Steward responsibilities; and
- a changed revision invalidated earlier review evidence.

This is maintainer evidence from a synthetic private repository. It is not
normal-user adoption evidence, a provider compatibility guarantee, or evidence
for the new onboarding milestone.

### Qualification

The completed candidate passed:

- local repository, type, build, and automated test checks;
- installed-package entrypoint and tarball qualification;
- the supported Ubuntu, macOS, and Windows matrix on Node.js 22 and 24;
- dependency-advisory review; and
- a focused independent closure review after whole-project findings were
  repaired.

Every new roadmap milestone must rerun the current required checks and add
focused installed-bin coverage for its new public behavior.

### Published package

`0.1.0-beta.2` remains an earlier local-only historical snapshot. It does not
contain the issue workflow, responsibility-specific composition, rule
management, practical existing-project onboarding, wizard, Strict, or external
agent launchers now described by the current repository and roadmap.

## Current product risks

### Rule management is absent

Users and agents must currently edit four aggregate Markdown files manually.
The generated outputs cannot direct an agent to a real rule-management command.
This prevents the canonical rule source from being a complete product
experience.

### Existing projects remain blocked

The current analyzer accepts only a narrow case where existing logical content
is already preserved by the proposed generated target. It does not organize
arbitrary existing `AGENTS.md`, `CLAUDE.md`, or Cursor guidance into managed
rules. This blocks the primary audience that already maintains project
instructions.

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
| Minimal rule commands and one-file-per-rule source | Migration decision required |
| Manual existing-project onboarding | Interface decision required |
| External-agent-operated onboarding | Waiting on rule and manual contracts |
| Interactive new/existing project wizard | Waiting on non-interactive contracts |
| Strict policy difference accepted and executable | Decision required |
| Exact final tarball dogfood and zero-context review | Waiting on implementation |
| Next beta qualification and separately authorized publication | Waiting on prior gates |

If the compiler, onboarding path, or external-agent operation adds no useful
value, recommend a pivot or stop. Do not respond by adding a runtime, security
subsystem, transaction framework, or general automation platform.

## Next review triggers

Run another independent project-health review when:

- minimal rule management reaches its installed-bin acceptance criteria;
- existing-project onboarding and one external-agent adapter complete their
  first end-to-end private-repository run;
- the Strict property set is proposed for acceptance;
- the adoption milestone reaches exact-candidate qualification;
- a new public command, schema revision, provider renderer, live external
  adapter, or runtime is proposed;
- a superseded mechanism is proposed for reintroduction; or
- ordinary change cost grows without a corresponding user outcome.
