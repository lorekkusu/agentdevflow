# Product direction

## Product definition

`agentdevflow` is a local-first Node.js and TypeScript CLI for configuring and
compiling repeatable software-development flows for coding agents. It is
distributed through npm and intended to be invoked with `npx agentdevflow`.

Its core value is not generic prompt synchronization. A project expresses who
plans, implements, and reviews; which workflow and policy apply; and which
handoffs and stop conditions matter. `agentdevflow` turns that intent and
project-owned rules into deterministic native instructions that different
coding-agent products can follow.

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
- four optional canonical Markdown rule files under
  `.agentdevflow/rules/`;
- complete deterministic planning, exact digest approval, whole-file
  ownership, safe existing-file adoption, and drift checking.

The issue workflow produces advisory procedures. It does not call Linear,
GitHub, CI, agent processes, or merge APIs. Agents use the tools available in
their own environments and must stop when a configured capability is missing.

## Responsibilities

- **Steward** plans, establishes accepted scope, coordinates handoffs, routes
  failures, and decides when current evidence is ready for the next gate.
- **Developer** implements accepted work, verifies it, repairs findings, and
  never approves or merges its own change.
- **Reviewer** reviews the current revision from an independent context,
  reports actionable findings or approval, and treats earlier verdicts as
  stale after rework.

These are provider-neutral responsibilities. Codex, Claude Code, and Cursor
are renderer targets and execution bindings, not role names.

A different provider brand does not prove reviewer independence. Session,
execution context, principal, inherited state, and revision identity remain
relevant facts.

## Built-in workflows

### Local reviewed change

This workflow provides planning, implementation, verification, independent
review, and rework without requiring issue, pull-request, CI, or merge
concepts.

### Issue to reviewed pull request

This workflow:

1. plans and creates a Linear or GitHub Issues work item;
2. delegates accepted scope to the Developer;
3. creates a draft or ready pull request;
4. observes current-revision CI and routes failures to repair;
5. marks a draft ready after CI passes;
6. starts an independent review, with clean-context evidence required by the
   Balanced preset but not the Fast preset;
7. invalidates stale evidence after repair;
8. permits external squash merge only after current evidence satisfies policy.

The flow is not tied to Issue-to-PR as the only topology. The local workflow is
a first-class contrast, and arbitrary workflow definitions remain private
until multiple real product cases require a stable extension boundary.

## Canonical project guidance

Projects may add:

```text
.agentdevflow/rules/shared.md
.agentdevflow/rules/steward.md
.agentdevflow/rules/developer.md
.agentdevflow/rules/reviewer.md
```

These Markdown files are user-owned inputs. Provider files are
responsibility-specific generated projections. Direct edits to generated files
are drift; they are not a second rule store.

The current design deliberately has no rule index, CRUD commands, semantic
merge, source transaction, provider-instance rules, or agent-assisted
classification. Those features require demonstrated user need rather than
being assumed infrastructure.

## Presets

- **Fast**: basic review with low ceremony.
- **Balanced**: explicit planning, implementation, reviewer isolation,
  findings reconciliation, and selected-workflow gates.
- **Strict**: deferred until additional high-risk evidence and stronger gates
  are executable.
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
- perform a supported lossless import;
- abort when ownership cannot be established without information loss.

Writes are deterministic, tied to current input and target bytes, and
published one file at a time with the lock last. The product does not claim
cross-file atomicity, use Git cleanliness as authorization, or manage Git
state.

## Longer-term direction

An interactive wizard may later complement the non-interactive CLI; every
selection must still have a reproducible configuration or flag
representation.

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
- rule CRUD and agent-assisted repository analysis;
- a complete migration command before a real schema transition;
- skills or MCP marketplaces;
- a GUI or SaaS control plane;
- automatic merge or release;
- automatic installation of unverified community code.

## Product proof

The product is worth continuing only if real repository use shows that:

1. different agents understand and follow their assigned responsibilities;
2. a user can express a useful local or tracker-backed flow without manually
   maintaining three divergent instruction files;
3. edits to project policy produce understandable, reviewable provider changes;
4. the policy-compiler layer clarifies handoffs and stale evidence beyond what
   a shared prompt template provides.

Files, tests, and internal abstractions are supporting evidence, not substitutes
for these outcomes.
