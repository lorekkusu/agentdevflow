# agentdevflow

Configure how coding agents plan, implement, review, and hand work off—then
generate provider-native instruction files whose procedure and project-rule
sections are filtered by configured responsibility for Codex, Claude Code,
and Cursor.

`agentdevflow` is a local-first Node.js and TypeScript CLI. A project selects
Steward, Developer, and Reviewer responsibilities; chooses either a local
reviewed-change flow or an issue-to-reviewed-pull-request flow; adds optional
project rules under `.agentdevflow/rules/`; and reviews the exact generated
files before approving them.

It generates and checks project instructions. It does **not** run agents,
connect to Linear or GitHub, poll CI, manage credentials, or merge pull
requests. The generated procedure tells each configured agent what it owns,
where it must hand off, and when it must stop because a required tool or
permission is unavailable.

> **Repository status:** this README describes the current unreleased
> working-tree candidate. The published `0.1.0-beta.2` package is an earlier
> local-only snapshot and does not include the workflow and custom-guidance
> surface below. Do not use that published version to evaluate this candidate.
> The source manifest intentionally retains that historical version until the
> next beta scope and version are selected. A tarball packed from this working
> tree is therefore a development candidate, not the published artifact,
> despite carrying the same provisional manifest version.

To evaluate a clean clone of the current working tree:

```bash
npm install
npm run build
node dist/src/cli/private-local-cli.js --help
```

Replace the `npx agentdevflow` prefix in the examples below with
`node dist/src/cli/private-local-cli.js`. The repository version is not a
registry release and must not be published again as `0.1.0-beta.2`.

## Start here

Every unmanaged project follows one order:

```text
init -> onboard -> rule as needed -> diff -> render -> check
```

Choose one `init` command below. After `init` creates the configuration, run
`onboard` even when no provider instruction file is expected. `onboard` is
read-only, but it refuses to inspect provider targets until the selected
configuration exists and is valid. There is no alternate onboard-first path.

If existing provider instructions conflict with the generated targets, `init`
returns `review-required` with status `1` after creating only the
configuration. The provider files and ownership lock remain unchanged. Continue
with `onboard`; do not rerun or bypass `init`.

## What it can configure

### Local reviewed change

Use this when work does not require an issue, pull request, CI gate, or merge
procedure. The generated procedures assign planning to the Steward,
implementation and verification to the Developer, and the current verdict or
rework request to the Reviewer. Balanced additionally compiles an advisory
requirement for reviewer-isolation evidence from a declared clean context;
Fast keeps the Reviewer procedure without that evidence requirement. The CLI
does not create or authenticate either execution context.

Use `--tracker local` only to declare that the team follows a
maintainer-selected local tracker outside `agentdevflow`; use `--tracker none`
when the flow has no tracker. The CLI does not read or write either one.

```bash
npx agentdevflow init \
  --workflow local-reviewed-change \
  --preset balanced \
  --tracker none \
  --provider codex-main,codex \
  --provider cursor-main,cursor \
  --provider claude-main,claude-code \
  --steward codex-main \
  --developer cursor-main \
  --reviewer claude-main
```

### Issue to reviewed pull request

Use this when an agent should follow a tracker-backed procedure. This example
instructs Codex to plan and coordinate through Linear, Cursor to implement, and
a separately started Codex review invocation to review from a declared clean
context. The pull request starts ready, and the generated procedure permits
squash merge only after the required current CI and review artifacts are
present. `agentdevflow` does not acquire or authenticate those artifacts.

```bash
npx agentdevflow init \
  --workflow issue-to-reviewed-pull-request \
  --preset balanced \
  --tracker linear \
  --pull-request-state ready \
  --pull-request-host github \
  --ci github-actions \
  --provider codex-main,codex \
  --provider cursor-main,cursor \
  --steward codex-main \
  --developer cursor-main \
  --reviewer codex-main
```

Use `--tracker github-issues` instead of `linear` for GitHub Issues. Use
`--pull-request-state draft` when the Steward should mark the pull request
ready only after required CI succeeds. The current CLI fixes auxiliary review
to `disabled` and merge method to `squash`; neither is silently selected by a
preset.

The tracker, pull-request host, and CI values compile into advisory
instructions. `agentdevflow` does not verify that the selected agent can access
them. If a required integration, tool, or permission is unavailable, generated
instructions require the active agent to stop and report the missing
capability instead of simulating success or skipping the gate.

## Add project rules

Each project rule is one user-owned Markdown file under a fixed scope:

```text
.agentdevflow/rules/shared/<rule-id>.md
.agentdevflow/rules/steward/<rule-id>.md
.agentdevflow/rules/developer/<rule-id>.md
.agentdevflow/rules/reviewer/<rule-id>.md
```

Rule ids are globally unique lowercase ASCII slugs of at most 64 characters.
Windows reserved basenames such as `con`, `nul`, `com1`, and `lpt1` are
rejected. Manage rules directly or through bounded CLI commands:

```bash
npx agentdevflow rule add verification --scope shared --stdin <<'EOF'
Run the repository's documented verification before every handoff.
Do not include credentials or private issue content in generated artifacts.
EOF

npx agentdevflow rule add developer-handoff --scope developer --stdin <<'EOF'
Keep changes within the accepted issue scope.
Report the exact verification commands and results to the Steward.
EOF

npx agentdevflow rule list
npx agentdevflow rule show verification
```

Shared guidance appears in every configured provider output. A responsibility
rule appears only in outputs assigned that responsibility. Rules are ordered by
id inside their scope. Editing canonical guidance produces a new reviewable
diff; directly editing a generated provider file produces ownership drift.

The unreleased aggregate paths such as `.agentdevflow/rules/shared.md` are not
read as a second format. Their presence blocks with an exact suggested manual
move; no command silently migrates, ignores, or deletes them.

## Complete onboarding after init

After `init` creates the configuration, inventory the exact supported project
instruction targets before changing them:

```bash
npx agentdevflow onboard
```

The command requires the valid selected configuration and fails before reading
provider targets when the configuration is absent or invalid. It is otherwise
read-only. It reports bounded exact content, SHA-256 digest, and ownership
disposition for `AGENTS.md`, `CLAUDE.md`, and
`.cursor/rules/agentdevflow.mdc`. It does not scan nested instructions, other
Cursor rules, or the repository generally.

Represent every instruction that should remain through the canonical `rule`
commands, then run `diff` without replacement inputs. Exact-adopt and
equivalent-content import require no replacement. Only when `diff` still
reports an ownership conflict should you rerun it with the exact observed
digest for each configured conflicting target:

```bash
npx agentdevflow diff \
  --replace-existing AGENTS.md=<observed-sha256> \
  --replace-existing CLAUDE.md=<observed-sha256>
```

The complete diff shows the exact existing and generated bytes. Supplying the
flag states that retained content is represented in current canonical rules
and that any remainder absent from the generated target is intentionally
omitted. Repeat the same inputs for render:

```bash
npx agentdevflow render \
  --approve-plan <exact-plan-digest> \
  --replace-existing AGENTS.md=<observed-sha256> \
  --replace-existing CLAUDE.md=<observed-sha256>
npx agentdevflow check
```

Changed source or target bytes stale the approval. Managed drift cannot be
overridden through onboarding. The command adds no semantic merge, backup,
Git operation, second writer, or durable proposal store.

## Review and render

`init` creates an absent `agentdevflow.config.jsonc` or accepts byte-identical
existing configuration. It never overwrites different configuration bytes. It
reports provider-file dispositions but does not write provider files or the
ownership lock.

```bash
npx agentdevflow diff
```

When changes are required, `diff` intentionally exits with status `1`. Review
the complete numbered before and after content and copy the printed
`exact-plan-digest`:

```bash
npx agentdevflow render --approve-plan <exact-plan-digest>
npx agentdevflow check
```

A clean `check` exits with status `0`. The resulting targets are:

| Product | Generated target |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/agentdevflow.mdc` |

Each target contains shared protocol and shared user guidance plus the
procedure and rule sections assigned to that provider id. Different
assignments can therefore produce byte-different targets. This is advisory
content filtering, not session, identity, permission, or authority isolation.
Provider discovery can overlap, so every generated target declares its coding-
agent product and instructs a nonmatching runtime to ignore the entire
projection. That instruction is not mechanical enforcement. When one provider
id holds multiple responsibilities, every assigned section is visible in the
same target and the agent is instructed to select exactly one section for the
current task. Two ids for the same provider product remain unsupported because
the single project-wide target cannot represent them separately.

See [Getting started](docs/getting-started.md) for complete option behavior,
draft and ready examples, guidance scope, existing-file adoption, JSON output,
and exit statuses.

## Commands

| Command | Behavior |
| --- | --- |
| `init` | Validates explicit project choices, creates an absent configuration or accepts exact existing bytes, and never overwrites different bytes. |
| `onboard` | Requires a valid configuration, then reads the three supported targets and reports exact bounded inventory. |
| `diff` | Reads the project and prints the complete recognized plan without mutation. |
| `render` | Applies only a currently matching plan approved by exact digest. |
| `check` | Reports clean, changes-required, or blocked state without mutation. |
| `rule list/show/add/update/remove` | Requires the valid selected configuration, then reads or mutates only canonical project-rule files. |

Run global or command-specific help:

```bash
npx agentdevflow --help
npx agentdevflow init --help
```

## Ownership boundary

Generated paths are whole-file, single-owner projections. The planner can
create an absent target, adopt exact generated bytes, perform the current
bounded equivalent-content import (reported by the current CLI as
`lossless-import`), replace exact reviewed unmanaged bytes through the
onboarding authorization, or abort. It never merges arbitrary foreign
instructions or silently overwrites them.

The ownership lock is `.agentdevflow/lock.json`. A stale approval, unsupported
existing content, or later direct edit blocks mutation. `render` does not use
Git cleanliness as authorization and never resets, cleans, stashes, commits,
branches, or rolls back user work.

## Current limits

- Only `fast` and `balanced` presets are available.
- The issue workflow compiles procedures; it does not provide live Linear,
  GitHub, CI, delegation, review-service, or merge adapters.
- Auxiliary automated review is not configurable in the current CLI.
- Squash is the only current issue-workflow merge method.
- There is no arbitrary workflow language, scheduler, agent runtime, GUI,
  marketplace, or SaaS control plane.
- Manual onboarding covers only the three native project-wide targets; it does
  not discover nested instructions or other Cursor rules.
- Advisory instructions cannot prove that an external action occurred or that
  evidence is truthful.

Beta configuration, lock, diagnostic, and JSON report fields may change with
documented migration before 1.0.

## Accepted direction and next gate

The current limitations are not all indefinite deferrals. This is a
non-normative orientation summary; the [product roadmap](ROADMAP.md) alone owns
current status, order, decisions, and acceptance criteria. Its accepted product
outcomes include:

- a repository-wide health review of every current decision and implementation
  area before item 3 resumes;
- optional onboarding operated by a user-selected, already authenticated local
  Codex, Claude Code, Cursor, or OpenCode CLI;
- an interactive first-use wizard over the same reproducible configuration and
  command model; and
- a Strict preset with a mechanically tested policy difference from Balanced.

An external coding agent acts as the user's operator of the same
`agentdevflow` rule, diff, render, and check commands. Proposal mode stops
before mutation. In apply mode, the user explicitly delegates the rule
decisions and exact render approval for that one operation. `agentdevflow` will
not manage provider credentials or turn that bounded onboarding convenience
into a background orchestration runtime. OpenCode is a launcher candidate, not
an initial renderer target.

## Development

Contributors should read [Repository guidance](AGENTS.md),
[Contributing](CONTRIBUTING.md), the [product roadmap](ROADMAP.md), and the
[engineering boundary](docs/development/engineering-boundary.md).

```bash
npm install
npm run check
```

`npm run check` audits repository publication hygiene, type-checks, builds, and
runs the automated tests. The project currently uses no CLI framework, linter,
formatter, or bundler.

`agentdevflow` is licensed under Apache-2.0.
