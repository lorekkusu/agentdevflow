# Product direction

## Definition

`agentdevflow` is a local-first Node.js and TypeScript CLI that configures, validates, and compiles portable software-development flows for coding agents. The intended npm package and executable name are both `agentdevflow`, with `npx agentdevflow` as the primary invocation.

The product is a development-flow configurator and policy compiler. It must retain independent value beyond generating instruction files.

## Target users

The primary users are individual developers and small teams that use at least two coding-agent products and maintain project-level instructions, skills, or workflow conventions. A secondary audience is teams that permit different coding-agent products but need shared policy, approved capabilities, reproducible setup, safe upgrades, and audit evidence.

The initial product is not intended for users who only want a one-time instruction template, general no-code automation, a fully autonomous multi-agent platform, or a hosted enterprise control plane.

## Desired experience

The long-term CLI should provide both an interactive wizard and reproducible non-interactive operation. Every wizard selection must have a file or flag representation.

A representative flow is:

```text
choose preset, roles, providers, tracker, and review policy
-> create a versioned ProjectConfig
-> resolve workflows and capabilities
-> validate policy and compatibility
-> resolve immutable lock state
-> show a complete plan and diff
-> apply only after approval
-> render provider artifacts deterministically
-> check drift, ownership, provenance, and environment health
```

A representative development workflow family begins with planning and optional tracker-backed work-item creation, delegates implementation, observes an exact pull-request revision, requires CI and independent-review evidence, allows repair cycles, and authorizes an external merge only when current evidence satisfies policy. A project may create either a draft pull request or a pull request that is ready for review immediately. Pull-request readiness is not merge authorization. Optional auxiliary automated review is a bounded stage rather than a provider-specific workflow.

The [issue-to-reviewed-pull-request candidate](development/issue-to-reviewed-pull-request.md) defines the current domain-validation direction. It remains an experimental workflow definition, not a frozen public configuration surface.

The private project-resolution experiment also retains a local no-pull-request workflow as a mandatory contrast. Project intent selects a workflow family, while provider, tracker, and external integration choices remain bindings outside generic workflow topology. This prevents the product from treating issue-to-pull-request as its only valid development flow.

## Roles and initial adapters

Roles describe workflow responsibilities rather than product brands:

- **Steward** manages planning, work-state governance, risk, findings reconciliation, and merge readiness.
- **Developer** implements an approved plan and supplies verification evidence.
- **Reviewer** performs independent review and produces findings and verdicts.

Reviewer independence may depend on session, execution context, principal, credentials, and shared state; a different vendor name alone is not proof of independence.

Codex, Claude Code, and Cursor form the initial adapter validation set. The architecture must not permanently bind any role to one provider.

## Trackers, presets, and procedures

Initial tracker choices are GitHub Issues, Linear, and local or no-tracker operation.

The intended presets are:

- **Fast**: one implementer, basic review, and low ceremony.
- **Balanced**: planning, implementation, independent review, and findings reconciliation.
- **Strict**: additional evidence for high-risk changes and stronger merge gates.
- **Custom**: future composition of validated workflow building blocks.

Presets should expand into versioned workflow definitions rather than become special cases throughout the compiler.

A preset is a policy profile, not a workflow-family selector. It must not silently choose Issue-to-PR, local operation, Draft or Ready PR creation, auxiliary review, a tracker, or a provider. A selected workflow may retain safety invariants stronger than the preset minimum. Strict must remain unavailable until its high-risk evidence and stronger gates are mechanically represented; Custom remains future composition.

Candidate first-party procedures are `plan-task`, `implement-task`, `review-change`, and `record-progress`. Later procedures may include `reconcile-change`, `audit-alignment`, `close-milestone`, and `release-version`. Critical transitions should invoke procedures explicitly; heuristic skill discovery is useful but not a reliable enforcement boundary.

## Candidate V1 commands

- `init`: create project configuration and deterministically detect existing agent files.
- `render`: produce provider artifacts from configuration and lock state.
- `diff`: show intended file, capability, ownership, and provenance changes.
- `check`: validate schema, policy, compatibility, drift, ownership, and locked provenance.
- `doctor`: diagnose provider versions, capability availability, environment access, and enforcement strength.

A complete `migrate` command is deferred until a real schema transition exists. A migration contract and synthetic migration fixture are prerequisites for stabilizing `ProjectConfig v1`.

## Compiler model

- `ProjectConfig` is the candidate stable user-facing API.
- `WorkflowDefinition` remains experimental until multiple distinct workflows and runtime exports validate it.
- `WorkflowIR` remains private so compiler internals can change without breaking users.
- Policies remain separate from workflow topology so adding a transition cannot silently bypass a gate represented only as a node.
- Typed artifacts connect states and carry evidence, but schema validity does not prove semantic truth or producer identity.
- Capabilities need versioned contracts that describe side effects, authorization, dry-run behavior, failure semantics, and provenance.
- Provider bindings need product, surface, version, execution context, principal, and supported capabilities rather than a single provider string.
- External execution should consume deterministic procedures or manifests and return typed, revision-bound evidence. Long-running monitoring, credentials, retries, scheduling, and external mutation remain outside the compiler core.
- Narrow source adapters may translate authenticated provider observations into provider-neutral evidence, but acquisition trust, credentials, and provider API behavior remain explicit integration boundaries.
- Lock state should capture immutable workflow, skill, adapter, and generated-artifact resolution.

The exact public configuration syntax, directory names, configuration filenames, and lockfile format remain open.

## Ownership and enforcement

Every generated path must have exactly one owner. Existing files require an explicit outcome:

- **Adopt** a safely delimited managed region while retaining a merge base.
- **Import** supported intent into source configuration while disclosing information loss.
- **Abort** when safe ownership cannot be established.

Writes must be planned, deterministic, tied to input hashes, conflict-aware, and published with atomic single-file replacement. Cross-file atomic visibility is not a V1 claim. Silent overwrite, silent capability downgrade, and digest mismatch are failures.

Prompt instructions are advisory. Policy data should record the actual mechanism, scope, bypass authority, availability, and required strength. Display labels such as advisory, guarded, and enforced are derived views. A weaker fallback must produce a diagnostic and never satisfy a stronger requirement.

## Deferred work

The following work is deliberately deferred:

- a stable arbitrary-workflow DSL;
- an orchestration runtime or scheduler;
- broad provider support;
- skills or MCP marketplaces;
- tracker runtimes;
- arbitrary third-party plugin ABIs;
- a complete migration command before a real transition exists;
- a GUI or SaaS control plane;
- automatic merge or release;
- automatic installation of unverified community code;
- agent-assisted repository analysis.

Agent-assisted analysis may be reconsidered only after a containment gate proves read-only, path-limited, secret-aware proposal generation with deterministic validation, a complete diff, and explicit approval.

## Product outcomes

The project must eventually demonstrate that:

1. A second coding agent can reproduce a development flow with materially less manual work.
2. Provider, skill, and workflow upgrades produce safe, reviewable diffs and migrations.
3. Users can see what an agent may do, what evidence exists, and why a transition is or is not authorized.

Repeated use of `check`, `doctor`, and `diff` matters more than one-time initialization.
