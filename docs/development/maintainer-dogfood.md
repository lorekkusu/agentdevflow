# Maintainer dogfood observation

Snapshot date: 2026-07-21.

## Verdict

**Pass as a bounded maintainer observation of the published beta's local workflow.** A private,
non-sensitive repository used the public `agentdevflow@0.1.0-beta.2` package to
configure, render, and verify both a single-provider Fast flow and a
three-provider Balanced flow. Clean headless sessions for Codex, Cursor Agent,
and Claude Code discovered their native project instructions, identified their
configured responsibilities, and completed one advisory
`plan -> implement -> review -> accepted` handoff.

This observation supports the current local configurator and policy-rendering
boundary. The private repository prevents independent reproduction of the
project-specific handoff, so that result is not a compatibility qualification.
The public package path remains independently reproducible through
[public first-run qualification](../evidence/public-first-run.md). This observation does not
qualify runtime orchestration, authenticated artifact production, automatic
transition authorization, pull-request operation, or tracker integration.

## Environment

| Component | Observed version |
| --- | --- |
| Published package | `agentdevflow@0.1.0-beta.2` through unqualified `npx` |
| Node.js | `24.18.0` |
| npm | `11.16.0` |
| Codex CLI | `0.144.6` |
| Claude Code | `2.1.216` |
| Cursor Agent | `2026.07.17-3e2a980` |

## Configuration exercise

The first pass used the public non-interactive `init` command with:

- the `local-reviewed-change` workflow;
- the Fast preset;
- tracker mode `none`;
- one Codex CLI provider assigned to Steward, Developer, and Reviewer.

The observed sequence was:

```text
init -> changing diff -> exact approved render -> clean check
```

`init` created only `agentdevflow.config.jsonc`. The reviewed render created
`AGENTS.md` and `.agentdevflow/lock.json`. The project tests passed before and
after rendering.

The second pass changed the same configuration to:

| Responsibility | Provider id | Product | Surface |
| --- | --- | --- | --- |
| Steward | `codex-steward` | `codex` | `cli` |
| Developer | `cursor-developer` | `cursor` | `cli` |
| Reviewer | `claude-reviewer` | `claude-code` | `cli` |

The preset changed to Balanced while the workflow and tracker mode remained
local and `none`. `diff` reported exactly four reviewable changes: update the
lock, update `AGENTS.md`, create `CLAUDE.md`, and create
`.cursor/rules/agentdevflow.mdc`. Exact approved `render` applied those changes,
and `check` then reported clean state. The repository-owned verification suite
remained green.

## Clean role-comprehension exercise

Each provider CLI ran in a new non-persistent or fresh headless context with
read-only repository access. Each session was asked to identify its configured
provider id and responsibility, the selected preset and workflow, its required
handoff artifacts, the acceptance and rework rules, the advisory enforcement
boundary, and the repository's local verification command.

Observed results:

- Codex identified `codex-steward`, the Steward responsibility, and `Plan` as
  the handoff artifact before implementation.
- Cursor Agent identified `cursor-developer`, the Developer responsibility,
  `VerificationEvidence`, and invalidation of `BlockingFinding` before review.
- Claude Code identified `claude-reviewer`, the Reviewer responsibility, the
  acceptance artifacts, the rework invalidations, and the reviewer-isolation
  requirement.
- all three found the same repository-owned verification command when
  allowed read-only access to project documentation;
- all three distinguished advisory project instructions from separately
  validated policy, capability, and artifact state.

## Advisory handoff exercise

The dogfood change made one bounded deterministic behavior change with explicit
regression requirements. Its implementation details are not public evidence.

1. A fresh Codex Steward inspected the repository without mutation and produced
   a `Plan` containing the intended project-owned files, exact acceptance
   criteria, repository verification command, risks, and Developer handoff
   condition.
2. Cursor Agent implemented only the plan-declared files and reported
   `VerificationEvidence` from the documented repository command. The complete
   repository-owned suite passed.
3. The coordinating process independently confirmed that only plan-declared
   paths changed, `git diff --check` passed, the complete repository-owned suite
   passed, and `agentdevflow check` reported clean state.
4. A new Claude Code Reviewer with no prior handoff context inspected repository
   content and the bounded verification statement. It produced an accepting
   `review-verdict@1` result, `reviewer-isolation@1` evidence referencing the
   verification evidence, no `BlockingFinding`, and an
   `AcceptanceAuthorization` recommendation.

## Limits and next decision

- The exercised provider mapping had one provider id per product. It does not
  prove that a provider can self-select among multiple configured instances of
  the same product without additional invocation context.
- The sessions produced artifacts as bounded messages. The beta did not persist,
  authenticate, or mechanically validate those messages, and it did not move a
  runtime state machine.
- The repository started without unrelated provider instruction files. Existing
  content adoption, lossless import, and abort behavior remain covered by
  deterministic package tests rather than this private scenario.
- The exercise used a local no-tracker workflow. It did not create an issue,
  branch, pull request, CI run, review-service result, or merge.
- Provider results apply only to the observed versions and invocation modes.
- Generated workflow guidance did not replace repository-owned build and test
  documentation. A Codex context without any repository file-reading mechanism
  could load `AGENTS.md` but could not discover a command stored elsewhere.
- In the observed Claude Code version, combining read-only planning mode with a
  shell tool did not complete, while a file-read-only review mode completed.
  Neither mode mutated repository files.

The next recommended product decision is whether to expose the smallest bounded
local consumer of compiled transition and artifact policy using explicit
caller-supplied evidence. That decision should precede live tracker,
pull-request, CI, or merge adapters. It must not silently turn advisory messages
into authenticated evidence, add a scheduler, or freeze a public workflow DSL.

## Disclosure boundary

This document retains configuration shape, tool versions, bounded maintainer
observations, stable failure boundaries, and the next decision gate. It excludes
prompts, raw model output, reviewer identities, private repository name, URL,
source, runtime, test names, verification command, credentials, local absolute
paths, and discussion chronology.
