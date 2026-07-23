# Getting started

This guide describes the current unreleased repository candidate. The
published `0.1.0-beta.2` package is an earlier local-only snapshot and must not
be used to evaluate the issue workflow or canonical custom guidance described
here.

## Requirements and invocation

Use Node.js 22 or 24 with a compatible npm release. `agentdevflow` is intended
to be installed from the qualified package and invoked with
`npx agentdevflow`.

The published package does not yet contain this guide's candidate behavior. To
evaluate a clean repository clone instead:

```bash
npm install
npm run build
node dist/src/cli/private-local-cli.js --help
```

Use `node dist/src/cli/private-local-cli.js` in place of the
`npx agentdevflow` prefix in the examples below. This runs the exact checked-out
source and does not install or publish another package version.

Commands use the current directory as the exact repository root unless
`--repository <path>` is supplied. They do not search parent directories.

| Purpose | Default | Override |
| --- | --- | --- |
| Project configuration | `agentdevflow.config.jsonc` | `--config <repository-relative-path>` |
| Ownership lock | `.agentdevflow/lock.json` | `--lock <repository-relative-path>` |

Absolute, escaping, symbolic-link, and non-regular-file configuration and lock
paths fail closed.

## Choose a workflow

The current CLI provides two built-in workflow families. They are closed
product choices, not a public arbitrary-workflow language.

### Local reviewed change

`local-reviewed-change` has no issue, pull-request, CI, or merge procedure. It
accepts `--tracker local` or `--tracker none`.

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

The generated responsibilities are:

- Steward prepares and hands off an explicit plan.
- Developer implements the accepted plan, verifies it, and never approves its
  own work.
- Reviewer evaluates the current implementation and verification evidence,
  returns actionable findings, or records acceptance.

### Issue to reviewed pull request

`issue-to-reviewed-pull-request` accepts `--tracker linear` or
`--tracker github-issues`. It also requires:

- `--pull-request-state draft|ready`;
- `--pull-request-host <id>`;
- `--ci <id>`.

The host and CI values are project-local opaque integration identifiers. They
do not configure a network client or credentials.

This example assigns both Steward and Reviewer to one Codex provider id and
Developer to Cursor:

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

For a draft pull request tracked through GitHub Issues:

```bash
npx agentdevflow init \
  --workflow issue-to-reviewed-pull-request \
  --preset balanced \
  --tracker github-issues \
  --pull-request-state draft \
  --pull-request-host github \
  --ci github-actions \
  --provider codex-steward,codex \
  --provider cursor-developer,cursor \
  --provider claude-reviewer,claude-code \
  --steward codex-steward \
  --developer cursor-developer \
  --reviewer claude-reviewer
```

The current issue-workflow CLI fixes auxiliary review to `disabled` and merge
method to `squash`.

The compiled Steward procedure plans, creates a tracker work item, delegates
implementation, observes the pull request and current CI result, routes failed
CI back to the Developer, marks a draft ready after CI succeeds, starts an
independent review, and allows squash merge only after current evidence
satisfies the policy. Balanced requires clean-context reviewer-isolation
evidence; Fast does not. A ready pull request skips only the draft-to-ready
step.

These are advisory instructions. `agentdevflow` does not call Linear, GitHub,
CI, or a coding-agent process. Each active agent uses tools already available
in its execution environment. If a required tool, integration, permission, or
configured capability is unavailable, the generated instruction requires the
agent to stop at that step and report the exact missing capability. It must not
silently switch trackers, skip a gate, or claim success.

## Configure providers and responsibilities

Declare each provider as `id,product`:

- `id` is a project-local identifier;
- `product` is `codex`, `claude-code`, or `cursor`.

`--steward`, `--developer`, and `--reviewer` must reference declared ids.
Roles describe workflow responsibility; they do not authenticate a user,
provider account, or clean execution context.

One provider id may hold several responsibilities. Its generated file contains
separate sections for each assigned role and instructs the agent to select the
active responsibility for the current task.

Each provider product has one project-wide native target. The current
candidate therefore rejects two configured ids for the same product because it
cannot isolate them in one file. For example, use one `codex-main` id for both
Steward and Reviewer instead of separate `codex-steward` and
`codex-reviewer` ids.

## Choose a preset

| Preset | Current behavior |
| --- | --- |
| `fast` | Requires the workflow's current review verdict before completion without a clean-context evidence gate. |
| `balanced` | Adds explicit clean-context reviewer-isolation evidence and forbids completion while a blocking finding remains. |

The issue workflow retains its current-revision CI, Reviewer handoff, and
merge-authorization requirements under either preset. A preset does not choose
the workflow, tracker, draft or ready state, provider, auxiliary review, or
merge method.

`strict` and `custom` are not available.

## Add canonical project guidance

Create any of these optional user-owned Markdown files:

| Source | Scope |
| --- | --- |
| `.agentdevflow/rules/shared.md` | Every configured provider output |
| `.agentdevflow/rules/steward.md` | Outputs assigned the Steward responsibility |
| `.agentdevflow/rules/developer.md` | Outputs assigned the Developer responsibility |
| `.agentdevflow/rules/reviewer.md` | Outputs assigned the Reviewer responsibility |

Each file is read as bounded UTF-8 text with a current maximum of 65,536 bytes.
There is no index, rule identifier format, provider-instance rule file, nested
discovery, rule CRUD command, or semantic merge.

Example:

```bash
mkdir -p .agentdevflow/rules

cat > .agentdevflow/rules/shared.md <<'EOF'
Run the repository's documented verification before every handoff.
Never place credentials in source, generated instructions, or diagnostics.
EOF

cat > .agentdevflow/rules/steward.md <<'EOF'
Keep the tracker work item synchronized with accepted scope changes.
EOF

cat > .agentdevflow/rules/developer.md <<'EOF'
Report the exact commands and results used to verify the implementation.
EOF

cat > .agentdevflow/rules/reviewer.md <<'EOF'
Review the current revision from a clean context and report only reproducible findings.
EOF
```

Canonical guidance is normal project content owned by the user. Edit it
directly or explicitly ask a coding agent to edit it. Then run `diff`, review
the resulting provider changes, and render them. `render` never writes these
source files.

Provider files are generated views, not a second rule store. Direct edits to
`AGENTS.md`, `CLAUDE.md`, or `.cursor/rules/agentdevflow.mdc` are drift and are
not reverse-synchronized.

## Complete the init, diff, render, check cycle

Successful `init` creates only `agentdevflow.config.jsonc`. It does not write
provider outputs or `.agentdevflow/lock.json`.

Review the plan:

```bash
npx agentdevflow diff
```

`diff` exits with status `1` when reviewable changes are required. Human output
shows the complete before and after content as numbered lines and reports
whether each file has a final newline. Read the complete recognized target and
copy its `exact-plan-digest`:

```bash
npx agentdevflow render --approve-plan <exact-plan-digest>
npx agentdevflow check
```

After a successful render, `check` should report clean and exit with status
`0`. A repeated `diff` should also be clean. Editing a canonical rule later
produces a new plan and digest.

## Reconfigure an initialized project

`init` is deliberately creation-only. It never overwrites an existing
configuration and refuses to initialize over an ownership lock. To change a
preset, provider assignment, tracker, or workflow, edit
`agentdevflow.config.jsonc` as user-owned project configuration, then use the
normal review path:

```bash
npx agentdevflow diff
npx agentdevflow render --approve-plan <new-exact-plan-digest>
npx agentdevflow check
```

Provider entries and `roles` use the same ids accepted by `init`. When changing
workflow family, update the tracker, workflow object, and capability bindings
together.

The local workflow uses:

```jsonc
{
  "tracker": { "mode": "none" },
  "workflow": { "family": "local-reviewed-change" },
  "capabilityBindings": [
    {
      "binding": "developer",
      "target": {
        "kind": "responsibility",
        "responsibility": "developer"
      }
    },
    {
      "binding": "reviewer",
      "target": {
        "kind": "responsibility",
        "responsibility": "reviewer"
      }
    }
  ]
}
```

An issue workflow using Linear, a ready GitHub pull request, and GitHub Actions
uses:

```jsonc
{
  "tracker": { "mode": "linear" },
  "workflow": {
    "family": "issue-to-reviewed-pull-request",
    "initialState": "ready",
    "auxiliaryReview": "disabled",
    "mergeMethod": "squash"
  },
  "capabilityBindings": [
    {
      "binding": "tracker",
      "target": { "kind": "tracker" }
    },
    {
      "binding": "developer",
      "target": {
        "kind": "responsibility",
        "responsibility": "developer"
      }
    },
    {
      "binding": "pull-request-host",
      "target": { "kind": "external", "id": "github" }
    },
    {
      "binding": "ci",
      "target": { "kind": "external", "id": "github-actions" }
    },
    {
      "binding": "reviewer",
      "target": {
        "kind": "responsibility",
        "responsibility": "reviewer"
      }
    }
  ]
}
```

`diff` validates the complete edited document before showing any mutation.
Changing configured products may create or remove generated targets; deletion
is allowed only when current bytes still match the ownership lock.

## Generated targets and existing files

| Product | Generated target |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/agentdevflow.mdc` |

Before mutation, the planner chooses one disposition:

- **Create** an absent target.
- **Exact adopt** when existing bytes already equal generated bytes.
- **Lossless import** only when the supported analyzer can preserve the
  complete logical instructions.
- **Abort** when different content cannot be preserved exactly.

Adoption and import make the complete path agentdevflow-owned. The tool does
not manage a section inside a foreign file. Resolve unsupported content
manually, then rerun `diff`; a clean Git repository is not replacement
authorization.

The lock records exact managed bytes. A later direct edit blocks mutation.
Removing a configured provider can plan deletion only when current bytes still
match the lock and the complete deletion plan is explicitly approved.

## Exact approval and output

`render --approve-plan <digest>` rereads the configuration, canonical guidance,
lock, and generated targets. It replans and requires the approved digest to
still match. A stale source, stale target, or foreign before-state fails before
mutation.

Add `--json` to emit one bounded UTF-8 JSON object with `schemaVersion: 1`,
command, outcome, exit code, sorted diagnostics, and command-specific fields.

| Exit status | Meaning |
| --- | --- |
| `0` | Success and clean or acceptable state. |
| `1` | Reviewable changes are required. |
| `2` | Input or state is blocked, invalid, unsafe, unsupported, or failed unexpectedly. |

When scripting `diff`, handle status `1` as a documented result rather than
losing the report under shell fail-fast behavior.

## Current non-features

The candidate does not:

- launch, delegate to, monitor, or retry coding-agent processes;
- connect to or mutate Linear, GitHub Issues, pull requests, CI, reviews, or
  merges;
- verify credentials, provider installations, tool availability, or external
  evidence;
- configure auxiliary automated review or a non-squash merge method;
- expose a public arbitrary-workflow language;
- provide Strict or Custom preset behavior;
- provide rule list, add, update, or remove commands;
- merge arbitrary existing provider instructions;
- claim that advisory instructions mechanically enforce agent behavior.
