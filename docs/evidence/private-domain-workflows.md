# Domain workflow implementation evidence

## Scope

This document records reproducible source-level evidence for the two built-in
workflow definitions. It does not claim live tracker, pull-request, CI,
coding-agent, review-service, or merge integration.

Authoritative implementation:

- `src/compiler/private-domain-workflow.ts`;
- `src/workflows/private-local-reviewed-change.ts`;
- `src/workflows/private-issue-to-reviewed-pull-request.ts`.

Primary automated coverage:

- `test/workflows/private-domain-workflows.test.ts`;
- `test/application/private-domain-project-plan.test.ts`;
- `test/renderer/materialize-domain-project.test.ts`;
- `test/cli/private-local-cli.test.ts`.

## Current workflow families

### Local reviewed change

The local definition contains planning, implementation, verification, review,
rework, and acceptance without issue, pull-request, CI, or merge artifacts.

### Issue to reviewed pull request

The issue definition accepts draft or ready initial state. Draft mode includes
an explicit `07-mark-pull-request-ready` transition after CI passes. Ready mode
enters independent review after CI without that transition.

The workflow proceeds from current CI to the Reviewer responsibility.
Auxiliary review is not part of the current definition. Squash is the only
current merge method. Balanced requires clean-context reviewer-isolation
evidence and no blocking finding at authorization; Fast retains the current CI
and review-verdict gates without those additional requirements.

## Capability observations

Every current issue-workflow capability observation records
`mechanism: compiled-procedure`.

Covered capabilities are:

- `tracker.work-item.create`;
- `development.task.delegate`;
- `pull-request.create`;
- `pull-request.mark-ready`;
- `ci.result.observe`;
- `review.independent.run`;
- `pull-request.merge`.

Compilation requires each procedure observation used by the selected
definition. Removing the advisory merge procedure, for example, produces
`CAPABILITY_UNAVAILABLE`. This proves closed capability accounting; it does not
prove an external adapter exists or that an action occurred.

There is no approved external-adapter claim in this evidence. The installed
CLI compiles instructions and performs no network or provider operation.

## Safety coverage

The automated fixtures cover:

- a draft path with explicit mark-ready after CI;
- an immediately ready path without draft promotion;
- unbounded CI repair and review rework cycles;
- stale CI after a revision-changing repair;
- stale independent-review evidence after rework;
- direct merge before authorization;
- deterministic normalization;
- explicit state-space budgeting;
- a local workflow with no issue-to-PR assumptions.

Counterexamples are deterministic transition traces. Cycles are explored as
finite abstract artifact-validity states rather than by bounding operational
retry count.

## Limits

- Guards are treated as potentially enabled; reported guard-related failures
  may be intentional over-approximation.
- Artifact validity is an internal safety abstraction, not a versioned payload
  or proof of semantic truth or producer identity.
- The compiler does not acquire evidence, schedule work, authenticate an
  agent, or execute a transition.
- Balanced generated procedures require a clean Reviewer context, but the
  compiler does not authenticate reviewer identity or execution context.
- The public CLI does not expose arbitrary workflow definitions.

Run the repository verification commands in `AGENTS.md` to establish the
current pass or fail result for a specific working tree.
