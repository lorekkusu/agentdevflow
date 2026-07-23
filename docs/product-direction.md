# Product direction

## Product definition

`agentdevflow` is a local-first Node.js and TypeScript CLI for configuring and
compiling repeatable software-development flows for coding agents. It is
distributed through npm and intended to be invoked with `npx agentdevflow`.

Its core value is not generic prompt synchronization. A project expresses who
plans, implements, and reviews; which workflow and policy apply; and which
handoffs and stop conditions matter. `agentdevflow` turns that intent and
project-owned rules into deterministic provider-native instruction files whose
procedure and rule sections are filtered by configured responsibility.

The product configures and explains the flow. It does not need to become the
runtime that executes every step.

## Target users

The primary users are individual developers and small teams that use more than
one coding-agent product or assign different responsibilities to different
agent contexts. They need:

- one project-owned policy source;
- clear Steward, Developer, and Reviewer responsibilities;
- repeatable local or tracker-backed procedures;
- provider-native instructions;
- reviewable changes and ownership drift detection.

The product is not aimed at users seeking a one-time prompt template, a
general automation platform, or a hosted autonomous-agent control plane.

## Current product slice

The current unreleased candidate supports:

- non-interactive `init`, `diff`, `render`, and `check`;
- built-in `local-reviewed-change` and
  `issue-to-reviewed-pull-request` workflows;
- Linear, GitHub Issues, local, and no-tracker intent where compatible with
  the selected workflow;
- draft or ready pull-request creation;
- auxiliary review fixed to disabled and squash as the current issue-workflow
  merge method;
- Fast and Balanced policy presets;
- provider-neutral Steward, Developer, and Reviewer assignments;
- Codex, Claude Code, and Cursor native outputs;
- bounded `rule list`, `show`, `add`, `update`, and `remove` commands over
  optional per-rule Markdown sources under `.agentdevflow/rules/`;
- complete deterministic planning, exact digest approval, whole-file
  ownership, safe existing-file adoption, and drift checking.

This is the current unreleased implementation, not the complete accepted
adoption experience. The authoritative [product roadmap](../ROADMAP.md) adds
existing-project onboarding, user-selected external-agent operation, an
interactive wizard, and Strict before the next beta release.

The issue workflow produces advisory procedures. It does not call Linear,
GitHub, CI, agent processes, or merge APIs. Agents use the tools available in
their own environments and must stop when a configured capability is missing.

## Responsibilities

- **Steward** plans, establishes accepted scope, coordinates handoffs, routes
  failures, and decides when current evidence is ready for the next gate.
- **Developer** implements accepted work, verifies it, repairs findings, and
  never approves or merges its own change.
- **Reviewer** reviews the current revision as a separate responsibility,
  reports actionable findings or approval, and treats earlier verdicts as
  stale after rework.

These are provider-neutral responsibilities. Codex, Claude Code, and Cursor
are renderer targets and execution bindings, not role names.

Fast does not require a `ReviewerIsolationEvidence` artifact. Balanced does. A
different provider brand does not prove reviewer identity, independence, or
isolation. Session, execution context, principal, inherited state, and revision
identity remain external facts that the current CLI does not acquire or
authenticate.

## Built-in workflows

### Local reviewed change

This workflow provides planning, implementation, verification, review, and
rework without requiring issue, pull-request, CI, or merge concepts.

### Issue to reviewed pull request

This workflow:

1. plans and creates a Linear or GitHub Issues work item;
2. delegates accepted scope to the Developer;
3. creates a draft or ready pull request;
4. observes current-revision CI and routes failures to repair;
5. for a draft-configured flow, ensures the pull request is ready after CI
   passes and marks it ready only when it is still a draft;
6. starts the Reviewer responsibility, with clean-context evidence required by
   the Balanced preset but not the Fast preset;
7. invalidates stale evidence after repair;
8. permits external squash merge only after current evidence satisfies policy.

The flow is not tied to Issue-to-PR as the only topology. The local workflow is
a first-class contrast, and arbitrary workflow definitions remain private
until multiple real product cases require a stable extension boundary.

## Canonical project guidance

Projects may add:

```text
.agentdevflow/rules/shared/<rule-id>.md
.agentdevflow/rules/steward/<rule-id>.md
.agentdevflow/rules/developer/<rule-id>.md
.agentdevflow/rules/reviewer/<rule-id>.md
```

These Markdown files are user-owned inputs. Provider files are generated
projections with procedure and rule sections filtered by configured
responsibility. Direct edits to generated files are drift; they are not a
second rule store. Content filtering does not create a runtime role or
authorization boundary.

The current rule surface uses one Markdown file per globally unique, stable
rule id under fixed shared and responsibility scope directories. People,
agents, and scripts manage those files through `rule list`, `show`, `add`,
`update`, and `remove`; generated outputs still change only through the normal
diff, render, and check path.

This accepted outcome does not justify a rule index, database, public rule DSL,
source/provider composite transaction, provider-instance scope, semantic merge,
or second approval model. Four aggregate paths existed only in an unreleased
working-tree candidate and were never part of the published beta. The accepted
implementation detects and blocks those paths with exact manual-move guidance;
it does not add a public migration command, dual reader, or automatic mutation.

## Presets

- **Fast**: basic review with low ceremony.
- **Balanced**: explicit planning and implementation procedures, a
  `ReviewerIsolationEvidence` requirement, findings reconciliation, and
  selected-workflow gates.
- **Strict**: committed near-term work. Its exact closed safety-property set
  remains a decision, but it must be mechanically distinguishable from
  Balanced in the compiler and tests rather than merely add stronger prose.
- **Custom**: future composition of validated building blocks.

A preset is a policy profile, not a workflow selector. It must not silently
choose tracker mode, draft or ready state, provider assignments, auxiliary
review, or merge method.

## Compiler and API boundaries

- `ProjectConfig` is the beta user-facing concept and candidate stable 1.0
  API.
- `WorkflowDefinition` remains experimental.
- Compiler intermediate representation remains private.
- Policies remain separate from topology so a new transition cannot silently
  bypass a gate.
- Typed artifacts represent production and invalidation, but their shape and
  digest do not prove semantic truth or producer identity.
- Provider, tracker, and external-system bindings remain outside generic
  workflow topology.
- Generated instructions describe advisory behavior honestly and never claim
  mechanical enforcement.

The initial configuration is versioned JSONC at
`agentdevflow.config.jsonc`. Tool-owned state is
`.agentdevflow/lock.json`. Beta fields and lock bytes retain migration
authority before 1.0.

## Ownership

Every generated path has one owner. Existing files require an explicit result:

- create an absent file;
- exactly adopt matching generated bytes;
- perform the current bounded equivalent-content import;
- after accepted onboarding is implemented, explicitly replace a complete
  existing target whose selected guidance has been represented in canonical
  rules and whose complete replacement plan is current; or
- abort when ownership cannot be established without information loss.

Writes are deterministic, tied to current input and target bytes, and
published one file at a time with the lock last. The product does not claim
cross-file atomicity, use Git cleanliness as authorization, or manage Git
state.

## Longer-term direction

An interactive wizard is part of the accepted near-term adoption experience.
It will cover new projects and existing-project onboarding while preserving an
equivalent reproducible configuration or flag representation for every
selection. It may not create a second configuration model or hidden state.

Existing-project onboarding may launch one user-selected, already installed
and authenticated coding-agent CLI. That external agent acts as the user's
operator: it proposes canonical rules and may invoke the exact current
`agentdevflow` rule, diff, render, and check commands. The launcher does not
manage credentials, provide a provider SDK, trust the agent's prose as
evidence, or become an orchestration runtime.

Proposal mode stops before mutation. Apply mode is a one-operation delegation
in which the user authorizes the selected agent to make canonical-rule
decisions and approve the exact current render plan on the user's behalf.
Digest freshness does not itself provide that semantic authorization.

Reusable procedures and skills may later expose `plan-task`,
`implement-task`, `review-change`, and `record-progress`. They should remain
explicit and portable rather than rely on heuristic discovery.

Live adapters, if justified, begin one bounded capability at a time. They do
not automatically imply a scheduler, credential vault, long-running monitor,
or general orchestration platform.

## Deferred work

- a stable arbitrary-workflow DSL;
- an orchestration runtime or scheduler;
- live tracker, pull-request, CI, review, or merge clients;
- broad provider support;
- provider-instance, nested, conditional, or inherited rule scopes;
- a general agent-assisted repository analyzer beyond bounded onboarding;
- a complete migration command before a real schema transition;
- skills or MCP marketplaces;
- a GUI or SaaS control plane;
- automatic merge or release;
- automatic installation of unverified community code.

## Product proof

The product is worth continuing only if real repository use shows that:

1. provider responses consistently distinguish their supplied responsibility
   procedures and handoff boundaries in representative repository use;
2. a user can express a useful local or tracker-backed flow without manually
   maintaining three divergent instruction files;
3. edits to project policy produce understandable, reviewable provider changes;
4. the policy-compiler layer clarifies handoffs and stale evidence beyond what
   a shared prompt template provides.

Files, tests, and internal abstractions are supporting evidence, not substitutes
for these outcomes.
