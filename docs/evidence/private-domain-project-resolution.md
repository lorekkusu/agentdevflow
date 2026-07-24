# Domain project resolution implementation evidence

## Scope

This document identifies current reproducible coverage for resolving a beta
project document into one workflow compilation, role binding set, tracker
selection, capability target set, and renderer materialization. It does not
claim live adapter availability or current external dogfood.

Implementation:

- `src/project/private-domain-project-resolution.ts`;
- `src/project/private-domain-preset.ts`;
- `src/application/private-domain-project-plan.ts`;
- `src/renderer/materialize-domain-project.ts`;
- `src/workflows/private-issue-to-reviewed-pull-request.ts`;
- `src/workflows/private-local-reviewed-change.ts`.

Primary tests:

- `test/project/private-domain-project-resolution.test.ts`;
- `test/application/private-domain-project-plan.test.ts`;
- `test/renderer/materialize-domain-project.test.ts`.

## Current resolution behavior

The resolver accepts:

- revision-1 project intent;
- Fast or Balanced;
- Codex, Claude Code, and Cursor instances;
- Steward, Developer, and Reviewer references;
- one compatible tracker mode;
- one built-in workflow;
- exact logical capability bindings.

The workflows are:

- `local-reviewed-change` with `local` or `none`;
- `issue-to-reviewed-pull-request` with `linear` or `github-issues`, draft or
  ready state, and squash merge.

The current issue workflow omits auxiliary review.

## Issue capability boundary

The application planner provides the issue workflow with the complete closed
set of advisory `compiled-procedure` observations. It therefore produces
responsibility-filtered instruction text instead of failing for absent live
adapters.

This does not claim that any adapter is installed. External ids remain opaque
configuration references. The planner performs no network access, credential
lookup, provider invocation, or external mutation.

Removing a required procedure observation still fails with a deterministic
capability diagnostic. This distinguishes an explicitly compiled advisory
step from an omitted step.

## Materialization behavior

The application planner combines:

- current configuration bytes;
- current canonical guidance bytes;
- current lock bytes;
- current provider target bytes.

It resolves one provider view per product containing only the procedure and
rule sections assigned to that provider id. It rejects multiple ids for one
product because one native target cannot represent them separately. This
content filtering does not isolate execution contexts or identities.

The same input bytes produce the same normalized intent, workflow compilation,
project resolution, provider materialization, and render plan. Changing a role
binding or canonical rule changes the relevant downstream identity without
putting provider brands into generic workflow topology.

## Covered failures

Automated coverage includes:

- unknown role provider;
- duplicate provider or logical binding;
- incompatible tracker and workflow;
- missing or unused capability binding;
- binding routed to the wrong target kind or responsibility;
- invalid external id;
- unavailable Strict preset;
- unsafe workflow compilation;
- unreadable canonical guidance;
- ambiguous same-product provider ids;
- invalid or drifted lock;
- unsupported existing provider content.

## Limits

- Provider instances do not select versions, credentials, principals, or
  execution contexts.
- Role binding does not prove reviewer independence.
- External ids are not checked against an adapter registry.
- Revision 1 is a beta configuration revision, not a permanent 1.0 promise.
- Arbitrary workflow topology is private.
- Passing source tests does not establish installed-package or external
  dogfood success.

Run the verification commands in `AGENTS.md` for the current working-tree
result.
