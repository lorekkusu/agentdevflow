# Project health

Assessment date: 2026-07-23.

## Outcome

**Continue with the usable candidate slice; complete exact-commit CI before a
release decision.** The current working tree has a coherent path from bounded
project choices and canonical guidance to responsibility-specific
instructions, reviewed diff, exact-approved render, and clean check.

A synthetic private-repository exercise also completed the representative
Linear-to-ready-pull-request workflow through CI failure and repair, fresh
review, squash merge, issue closure, and branch cleanup. This demonstrates
narrow product value beyond copying one shared prompt. It does not turn
advisory procedures into live adapters or mechanical workflow enforcement.

A separate tracker-native Cursor delegation also produced a scoped ready pull
request with green CI. The tracker did not perform review, merge, branch
cleanup, or final status transitions, so those responsibilities remain
explicit Steward steps.

The candidate remains unreleased. Local final-tree repository, package,
installed-entrypoint, and dependency-advisory checks passed. Initial
whole-project review findings were addressed and the focused independent
closure review passed. Exact-commit CI remains.

## Active product core

- revision-1 bounded JSONC project configuration;
- Fast and Balanced preset expansion;
- `local-reviewed-change`;
- `issue-to-reviewed-pull-request` with Linear or GitHub Issues, draft or
  ready state, auxiliary review disabled, and squash merge;
- provider-neutral Steward, Developer, and Reviewer responsibilities;
- bounded canonical guidance from
  `.agentdevflow/rules/{shared,steward,developer,reviewer}.md`;
- responsibility-specific Codex, Claude Code, and Cursor views;
- whole-file create, exact adopt, supported lossless import, or abort;
- complete `diff`, exact-approved `render`, ownership lock, and read-only
  `check`;
- finite-state safety validation for typed artifacts, invalidation, cycles,
  review bypass, and stale evidence.

## Corrective simplification

Executable systems without a normal-user producer or consumer were removed:

- write-ahead transaction, rollback, lease, and journal machinery;
- execution trace transport and replay;
- provider-specific external evidence mapping;
- superseded schema and init paths;
- Rulesync process-oracle tooling;
- canonical-rule CRUD and composite source/provider transactions;
- the caller-supplied environment-observation command.

The retained file executor provides exact before-or-after convergence and
lock-last publication. Stronger machinery may return only after a reproduced
in-scope failure and an accepted product decision.

Git history retains discarded implementation detail. Current public documents
retain only useful technical conclusions and reopen criteria.

## Current external-system boundary

The issue workflow's tracker, pull-request, CI, review, and merge capabilities
are advisory compiled procedures. The CLI does not connect to Linear or
GitHub, execute agents, poll CI, manage credentials, or merge.

The dogfood exercise used capabilities already available to the participating
agents and maintainers. Generated instructions required capability failures to
stop and report. This is evidence that the procedures are usable, not evidence
of an installed external-system adapter.

## Current evidence

### Usable slice

The earlier [maintainer dogfood observation](maintainer-dogfood.md)
demonstrates that:

- its exact pre-closure candidate tarball completed
  `init -> diff -> render -> check`;
- canonical shared and role guidance produces materially different provider
  outputs;
- fresh Codex, Claude Code, and Cursor contexts understand their assigned
  responsibilities and handoff boundaries;
- one Codex provider assignment can represent Steward and fresh Reviewer
  contexts without granting both responsibilities to the active context;
- the representative Linear, GitHub ready-pull-request, GitHub Actions, and
  squash-merge procedure remains understandable through CI repair and fresh
  review;
- a repository-group binding plus tracker-native Cursor delegation can start
  the Developer step, while later gates still require Steward coordination;
- a changed revision invalidates earlier review evidence and requires review
  of the replacement revision.

This is bounded maintainer evidence from a synthetic private repository. It is
not public adoption evidence or a provider support guarantee.

### Published package

`0.1.0-beta.2` remains an earlier local-only historical snapshot. Current
documentation must not imply that the issue workflow, canonical guidance, or
responsibility-specific composition is already published.

## Remaining risks

### Exact-commit CI is pending

The complete local repository check, V1 qualification, installed-package
entrypoint, tarball review, and dependency advisory query passed on the
converged working tree. The same code must be committed and pass protected
hosted checks before delivery is reproducible from Git.

### Independent closure review passed

The initial context-separated review found an intervening-edit overwrite
window, preset procedures disconnected from compiled policy, one no-op
provider field, and stale recovery wording. Those findings were addressed.
A focused context-separated re-review verified the fixes, package evidence,
documentation consistency, and current disclosure boundary without a
remaining actionable finding.

### Existing instruction files can block adoption

The current whole-file ownership model supports absent files, exact adoption,
and one bounded lossless-import path. Arbitrary existing instructions are not
merged. The controlled dogfood repository does not prove that every legacy
instruction set can be adopted without manual preparation.

### Advisory procedures depend on available tools

The tracker-backed flow is useful only when the selected agent environment
actually provides the required tools and permissions. The CLI cannot verify
that today. Missing capability diagnostics must continue to prevent silent
gate skipping.

### Maintainer evidence is not user adoption

One synthetic private-repository exercise proves a usable bounded slice, not
market demand, broad repository compatibility, or reliable behavior across
future provider versions. Expand the surface only from concrete observed
needs.

## Milestone closure criteria

| Criterion | Current status |
| --- | --- |
| Exact candidate tarball completes the core command path | Passed in bounded dogfood |
| Distinct provider outputs and fresh role comprehension | Passed in bounded dogfood |
| Representative tracker-backed flow completes through repair and fresh review | Passed in bounded dogfood |
| Full final-tree repository checks | Passed locally: 203/203 |
| Installed-package and tarball qualification on the converged tree | Passed locally |
| Independent whole-project review and finding disposition | Passed |
| Public release authorization and publication | Out of scope for this milestone |

If final verification or review shows that the compiler adds no useful value,
recommend a pivot or stop. Do not respond by adding a runtime, security
subsystem, or general framework.

## Next review triggers

Run another independent project-health review when:

- the active milestone reaches its verification closure;
- a new public command, schema revision, provider, live adapter, or runtime is
  proposed;
- a removed subsystem is proposed for reintroduction;
- dogfood contradicts the product boundary;
- ordinary change cost grows without a corresponding user outcome.
