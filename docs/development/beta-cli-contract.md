# Current beta CLI contract

## Status

This document describes the current unreleased working-tree candidate. It does
not claim that the candidate has been published or qualified through external
dogfood. The published `0.1.0-beta.2` package is an earlier historical
snapshot.

Configuration, guidance filenames, lock bytes, diagnostics, and JSON fields
remain beta surfaces and may change through documented migration before 1.0.

## Commands

The current command set is:

- `init`: validate explicit non-interactive choices, create an absent
  configuration or accept byte-identical existing configuration, and never
  overwrite different bytes;
- `onboard`: require the valid selected configuration, then select bounded
  manual inventory or Codex-operated onboarding;
- `diff`: read the repository and show the complete recognized target;
- `render`: apply only the current plan whose exact digest was reviewed;
- `check`: report clean, changes-required, or blocked state without mutation;
- `rule list` and `rule show`: require the valid selected configuration, then
  inspect canonical project rules; and
- `rule add`, `rule update`, and `rule remove`: require the valid selected
  configuration, then mutate only one canonical project-rule file per
  invocation.

Only `onboard --agent codex` runs an external agent. No command embeds a
provider SDK, calls trackers or repository hosts, probes credentials, or
manages Git.

The fixed non-interactive first-use order is:

```text
init -> onboard -> rule as needed -> diff -> render -> check
```

`init` is the only first-use entry. There is no supported onboard-first
preflight path. Every rule operation accepts `--config` and blocks before
reading or mutating canonical rules when the selected configuration is absent,
unreadable, or invalid.

## Existing-project onboarding

`onboard` accepts `--agent manual|codex`, `--repository`, `--config`, and
`--lock`. Without `--agent`, an interactive terminal presents the Manual and
Codex choices; non-interactive use requires an explicit agent. Before opening
the picker, reading the lock or any provider target, or launching Codex, it
requires the selected configuration to be a readable, valid revision-1 project
document. Missing, unreadable, or invalid configuration returns status `2`,
reports no target content, and launches no provider process.

`--agent manual` observes exactly `AGENTS.md`, `CLAUDE.md`, and
`.cursor/rules/agentdevflow.mdc`. It accepts `--json` and retains the following
exact inventory contract. It does not search parent, nested, or alternate
provider instruction paths.

Each complete target file is one content unit. Human and JSON output report:

- provider and exact repository-relative path;
- `absent`, `unmanaged-existing`, `managed-exact`, `managed-drift`, or
  `managed-missing` disposition;
- `not-applicable`, `unclassified`, or `managed` classification;
- UTF-8 byte count and exact SHA-256 digest; and
- exact content.

Each target is limited to 262,144 UTF-8 bytes and the existing total CLI output
limit remains 1,048,576 bytes. Invalid UTF-8, symlinks, non-regular files,
unreadable or oversized targets, invalid locks, and ambiguous ownership fail
without a partial inventory.

The operator represents retained content in canonical rules. A reviewed
unmanaged complete file may then be supplied to both `diff` and `render`:

```text
--replace-existing <repository-relative-path>=<observed-sha256>
```

The repeatable option authorizes only a configured native target whose current
unmanaged bytes match the supplied digest. It states that retained content is
represented in current canonical rules and that any remainder omitted from the
generated target is intentional. Duplicate, unsupported, unused, unnecessary,
managed, or stale inputs block. The operator first runs `diff` without
replacement inputs. Exact-adopt and equivalent-content import need no input;
replacement is used only for configured targets that remain ownership
conflicts.

An `init` invocation whose only provider failures are unsupported existing
content and its ownership conflict may create the absent valid configuration,
return `review-required`, and leave all provider targets and the lock
unchanged. The next command remains `onboard`.

### Codex-operated onboarding

`--agent codex` starts the user's installed `codex` executable in one
foreground interactive session. A packaged English instruction supplies the
exact current Node executable and agentdevflow entrypoint, selected repository,
configuration, and lock paths, and the required
`onboard --agent manual -> rule -> diff -> render -> check` operation.

Codex explains a rule proposal and asks the user in that same session before
mutation. The user may accept or correct it in natural language without a
second provider process or proposal transfer. `--yes` uses one non-interactive
`codex exec` process and authorizes that operation without the question.
`--json` is not supported for Codex-operated onboarding because provider
terminal output is not an agentdevflow JSON contract.

The launcher does not override or inspect Codex authentication,
configuration, permissions, hooks, MCP servers, persistence, or provider
output. It maintains no Codex version allowlist and performs no authentication
or permission diagnosis. The fixed 15-minute foreground timeout, cancellation,
missing executable, launch failure, and non-zero exit produce bounded process
diagnostics.

After the Codex process ends, the parent command independently runs the
existing `check` path. Success requires that final check to be clean. Codex
prose and exit status alone are insufficient. `agentdevflow` does not retain a
proposal, transcript, provider event stream, raw response, credential, or
private reasoning.

## Repository and paths

Commands use the current working directory as the exact root unless
`--repository <path>` is supplied. They do not search parents.

| Purpose | Default | Override |
| --- | --- | --- |
| Project configuration | `agentdevflow.config.jsonc` | `--config <repository-relative-path>` |
| Ownership lock | `.agentdevflow/lock.json` | `--lock <repository-relative-path>` |

Configuration and lock paths must remain below the selected root. Absolute
paths, traversal, symlinks, and non-regular files fail closed. The
configuration path must not overlap the canonical rule root or a native
provider target; this invariant also applies before every rule operation.

Canonical user guidance is discovered from immediate Markdown files under:

- `.agentdevflow/rules/shared/`;
- `.agentdevflow/rules/steward/`;
- `.agentdevflow/rules/developer/`;
- `.agentdevflow/rules/reviewer/`.

Each filename is `<rule-id>.md`; ids are globally unique lowercase ASCII slugs
of at most 64 characters and may not use Windows reserved basenames. Rule files
are optional, user-owned, bounded UTF-8, and not configurable in the current
candidate.

The former aggregate paths ending directly in `shared.md`, `steward.md`,
`developer.md`, or `reviewer.md` were never published. Their presence blocks
planning and rule commands with exact manual-move guidance. No command
automatically migrates, ignores, or deletes them.

## Rule commands

`rule list` returns sorted id, scope, and path summaries. `rule show` also
returns exact content. `add` requires a new globally unique id and a fixed
scope. `update` preserves scope, and `remove` requires an existing id.

`add` and `update` require exactly one of:

- `--file <repository-relative-path>`; or
- `--stdin`.

Every rule operation accepts `--repository <path>`,
`--config <repository-relative-path>`, and `--json`. The selected configuration
must be present and valid before canonical rules are read or mutated. Input
and output are bounded. A mutation invocation authorizes only its one
canonical file; provider files and the ownership lock still change only
through `diff -> render -> check`.

## Init choices

Shared required choices are:

- `--workflow`;
- `--preset fast|balanced`;
- one or more `--provider <id,product>`;
- `--steward <provider-id>`;
- `--developer <provider-id>`;
- `--reviewer <provider-id>`;
- `--tracker`.

Products are `codex`, `claude-code`, and `cursor`.

Fast requires a current review-verdict artifact. Balanced additionally compiles
a requirement for a `ReviewerIsolationEvidence` artifact and forbids completion
while a `BlockingFinding` artifact remains valid. Generated procedures tell
participants when these artifacts must be produced or invalidated. The CLI
does not acquire or authenticate reviewer identity, execution context, or
findings.

`local-reviewed-change` accepts tracker `local` or `none` and rejects
pull-request options.

For this workflow, `local` is an advisory declaration that the team uses a
maintainer-selected local tracker outside `agentdevflow`; `none` declares no
tracker. The CLI does not read or write either one.

`issue-to-reviewed-pull-request` accepts tracker `linear` or `github-issues`
and requires:

- `--pull-request-state draft|ready`;
- `--pull-request-host <external-id>`;
- `--ci <external-id>`.

The issue workflow fixes auxiliary review to `disabled` and merge method to
`squash`. Its external capabilities are advisory compiled procedures.
`agentdevflow` does not connect to the named systems.

Each native provider product has one project-wide output path. One provider id
may hold multiple roles, but multiple ids of the same product fail because the
output cannot isolate them.

## Generated targets and guidance scope

| Product | Target |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/agentdevflow.mdc` |

Each target contains shared protocol and optional shared guidance plus only the
procedure and rule sections assigned to that provider id. Targets can be
byte-different when assignments differ. This is deterministic
responsibility-filtered content, not execution-context, identity, permission,
or authority isolation.

Every target declares its exact coding-agent product and provider id. It makes
the entire projection inapplicable when the current runtime product does not
match and forbids combining responsibility sections across products. This
contract is advisory instruction text; it neither detects the runtime nor
prevents another product from discovering or disregarding the file.

Generated targets are whole-file, single-owner projections. Existing targets
must be absent, exact generated bytes, supported lossless-import candidates, or
exact reviewed unmanaged bytes with the current onboarding replacement
authorization. Unsupported content aborts without silent overwrite.

## Approval and mutation

`init` writes only an absent configuration. Provider files and the lock are
written only by `render`. Existing onboarding conflicts produce
`review-required` rather than preventing safe configuration creation.

`diff` returns the exact plan and approval digest. `render` rereads
configuration, canonical guidance, lock, and provider targets, replans through
the mutable workspace, and requires the approved digest to match again.
An explicit whole-file replacement requires identical `--replace-existing`
inputs for both commands. The complete authorized before and after bytes are
shown by `diff`; ordinary unowned conflicts continue to suppress foreign bytes.

The mutation path publishes provider files before the ownership lock. Ordinary
managed create, update, delete, and exact-adoption operations converge when the
same approved operation is retried.

Lossless initialization import is narrower. If interruption leaves generated
provider bytes in place before lock publication, the next plan sees an exact
target rather than the original import disposition. The prior approval must
fail; the user must review a fresh `diff` and approve its new digest.

The mutation path does not promise cross-file atomicity, rollback, or
protection from a hostile local writer.

Git cleanliness never authorizes replacement. The CLI never resets, cleans,
stashes, commits, branches, or rolls back user work.

## Exit status and output

| Code | Meaning |
| --- | --- |
| `0` | Success and clean or acceptable state. |
| `1` | Reviewable changes are required. |
| `2` | Input or state is invalid, blocked, unsafe, unsupported, or failed unexpectedly. |

Human-readable output is the default. `--json` emits one bounded UTF-8 object
with numeric `schemaVersion`, command, outcome, exit code, sorted diagnostics,
and command-specific fields.

Human `diff` renders complete recognized before and after content as numbered
lines and marks final-newline state. JSON output retains exact string values.
Blocked, foreign, or unowned content is represented by path, digest, and
diagnostic, not by disclosing the foreign bytes.

## Non-contracts

The finite-state compiler representation and arbitrary workflow topology are
private. The CLI does not expose a plugin ABI, workflow language, orchestration
runtime, external evidence protocol, aggregate migration command, rule index,
public rule DSL, Strict or Custom preset, auxiliary-review setting, non-squash
merge option, general instruction scanner, semantic classifier, or onboarding
proposal store.

This list describes the current executable contract. The root
[product roadmap](../../ROADMAP.md) keeps the implemented Codex-first
onboarding adapter in qualification and retains a later wizard and Strict.
Only the latter two remain absent from the current CLI surface.

## Historical release boundary

[ADR 0004](../decisions/0004-initial-beta-public-surface.md) records the exact
first-beta decision and remains historical evidence. Its five-command,
local-only surface does not describe the current working tree. A later
publication requires separate version authorization and installed-package
qualification.
