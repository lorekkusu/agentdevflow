# Architecture

`agentdevflow` is a local-first development-flow configurator and policy
compiler. The current product slice converts bounded project choices and
optional user-owned guidance into provider-native project instruction files
whose procedure and rule sections are filtered by configured responsibility.

The [engineering boundary](development/engineering-boundary.md) is normative.
The root [product roadmap](../ROADMAP.md) is the authoritative sequence. This
document distinguishes the active path from accepted next boundaries and does
not describe every experiment in Git history.

## Active product path

```text
revision-1 ProjectConfig bytes
  -> bounded JSONC parse and closed schema validation
  -> built-in workflow and preset resolution
  -> finite-state policy compilation
  -> bounded read of .agentdevflow/rules/*.md
  -> responsibility-filtered provider composition
  -> native Codex, Claude Code, and Cursor staging
  -> complete repository plan and exact approval digest
  -> forward-convergent provider-file apply
  -> ownership lock published last
```

The CLI exposes this path through `init`, `diff`, `render`, and `check`.

## Configuration and project resolution

`src/interface/private-domain-project-document.ts` is the JSONC and Zod schema
boundary. It rejects unknown or unsafe structure and enforces resource limits
before resolution.

`src/project/private-domain-project-resolution.ts` binds:

- one built-in workflow family;
- Fast or Balanced;
- provider instances;
- Steward, Developer, and Reviewer assignments;
- tracker mode;
- logical external capability targets.

The current workflows are:

- `local-reviewed-change`, with local or no-tracker intent;
- `issue-to-reviewed-pull-request`, with Linear or GitHub Issues, draft or
  ready pull requests, auxiliary review disabled, and squash merge.

Provider and tracker products remain bindings outside generic workflow
topology. Strict is recognized but unavailable; Custom and arbitrary workflow
topology are deferred. Strict is accepted near-term work, but its exact closed
property set remains a product decision and is not part of the current
implementation.

## Policy compiler

The compiler models finite nodes and transitions, cycles, typed artifact
production and invalidation, capability requirements, and a closed set of
safety policies. Guards are treated as potentially enabled, so guard-blind
false positives are diagnosed honestly.

It is not a scheduler. It does not run agents, acquire evidence, call trackers,
poll CI, hold credentials, retry work, or merge pull requests.

The issue workflow currently resolves external actions as advisory
`compiled-procedure` capabilities. This is sufficient to generate explicit
role instructions, including stop conditions when the active agent lacks a
required tool or permission. It is not evidence that an adapter exists or an
external action occurred.

## Canonical guidance and composition

The accepted rule boundary reads immediate user-owned Markdown rules from four
fixed scope directories:

```text
.agentdevflow/rules/shared/<rule-id>.md
.agentdevflow/rules/steward/<rule-id>.md
.agentdevflow/rules/developer/<rule-id>.md
.agentdevflow/rules/reviewer/<rule-id>.md
```

Composition creates one provider view per configured product. Each view
contains shared protocol and guidance plus the procedure and rule sections
assigned to that provider id. Multiple responsibilities assigned to one id
appear as separate sections in the same target. This content projection does
not select or isolate an execution context, identity, permission set, or
authority. Multiple ids for one product are rejected because the single native
target cannot represent them separately.

Native discovery surfaces are not assumed to be isolated. A generated view
therefore declares its target coding-agent product and makes the entire
projection inapplicable to a nonmatching runtime. This remains advisory
instruction text, not a runtime detector or enforcement boundary. The current
observed overlap and its limits are recorded in
[maintainer dogfood](development/maintainer-dogfood.md).

Rule commands are the only product commands that mutate those canonical
sources. They do not mutate provider outputs or the ownership lock; those remain
under the existing renderer writer. Composition has no index, database,
provider-instance scope, or semantic merge authority. See
[instruction composition](development/instruction-composition.md).

The former four aggregate paths existed only in an unreleased working-tree
candidate. Any remaining aggregate path blocks planning and rule commands with
exact manual-move guidance. The implementation never reads both layouts,
silently ignores old content, or performs automatic migration.

## Accepted onboarding path

Existing-project onboarding is a primary adoption path:

```text
supported existing provider instructions
  -> bounded discovery
  -> manual or external-agent-assisted rule proposal
  -> canonical changes through rule commands
  -> complete provider replacement plan
  -> normal exact-approved render
  -> normal check
```

A selected external coding agent may act as the user's operator and invoke the
exact current `agentdevflow` executable. Provider-specific process adapters map
the bounded task to one foreground executable, argv, stdin, working directory,
and exit result. They inherit an existing user login without inspecting or
managing credentials.

The external agent is not a second writer or source of trusted workflow
evidence. It may supply semantic judgment and operate the CLI, but successful
onboarding is determined by valid canonical rules, the complete current render
plan, the renderer-owned outputs and lock, and a clean final check. The manual
path remains available when no compatible external agent is installed.

Proposal mode stops before mutation. Explicitly selecting apply delegates
canonical-rule decisions and exact render approval to the selected agent for
one operation; the plan digest still binds freshness rather than semantic
approval. The manual command and reproducible per-target replacement input
remain a roadmap decision before implementation.

## Native rendering

Native emitters map composed views to:

| Product | Path |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/agentdevflow.mdc` |

`StagedRendererAdapter` is planning-only. Existing targets have one of four
outcomes:

- create an absent target;
- adopt exact generated bytes;
- replace through the current bounded equivalent-content authorization;
- abort on ambiguity, foreign ownership, or drift.

The accepted onboarding milestone may add a complete existing-target
replacement after selected content has been represented in canonical rules and
the replacement is visible in the normal current plan. It does not add managed
regions or a second approval path.

Generated files are whole-file, single-owner projections. Direct edits are
drift, not reverse-synchronization input.

The lock records managed paths, content digests, renderer identity, and source
references. It is ownership state, not a mutex, lease, credential, or security
boundary. A digest binds bytes and detects staleness; it does not authenticate
a producer or prove semantic truth.

## Mutation

The render command is the only product writer for provider files and the lock.
It requires:

1. a complete read-only plan;
2. approval of that exact plan digest;
3. a fresh reread and mutable-workspace replan;
4. a second exact digest match;
5. provider-file application followed by lock publication.

Each file uses a same-directory temporary file and rename. Retrying the same
approved managed create, update, delete, or exact-adoption operation converges
from exact before or after bytes.

Lossless initialization import has a narrower recovery rule. If interruption
occurs after imported provider bytes reach their generated target but before
the ownership lock is published, the next plan observes an exact target
instead of the original import disposition. The user must review a fresh
`diff` and approve its new digest. The old approval is not silently
reinterpreted.

The design does not claim cross-file atomicity, rollback, power-loss
durability, or hostile local-writer exclusion.

Git is outside this boundary. The tool never requires a clean worktree and
does not reset, clean, stash, commit, branch, or roll back user work.

## External systems

Linear, GitHub Issues, pull-request hosts, CI services, and coding-agent
products may already be usable by the agent that reads a generated procedure.
`agentdevflow` itself has no network client, credentials, provider process
manager, polling loop, queue, or external mutation authority.

The accepted onboarding launcher is a narrow exception to "no provider process
manager": it starts one selected local coding-agent CLI in the foreground so
that agent can operate `agentdevflow` on the user's behalf. It does not call a
provider API directly, log in, poll, retry, schedule, chain agents, or manage
remote workflow state.

If generated workflow procedures later prove insufficient, each proposed live
tracker, CI, review, or merge adapter still requires a concrete user outcome
and an accepted credential, failure, ownership, and retry boundary. A general
runtime is not implied.

## Distribution

The package is ESM TypeScript compiled by `tsc`, tested with `node:test`, and
distributed through npm with an explicit `files` allowlist. Tests, fixtures,
research evidence, and obsolete experiments are excluded from runtime package
content. Publication remains a separately authorized protected workflow.
