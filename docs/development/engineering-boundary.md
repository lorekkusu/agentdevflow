# Engineering boundary

## Purpose

This document defines the repository-wide complexity and responsibility
boundary for `agentdevflow`. Every production path, experiment, test, and
proposal must fit this boundary. Security and recovery mechanisms are justified
only when they protect a concrete product operation against an in-scope failure.

The governing rule is:

> Build the smallest deterministic local configurator and policy compiler that
> can configure, preview, render, and verify a project development flow. Do not
> turn local file generation into version-control management, distributed
> coordination, identity infrastructure, or a general transaction system.

See [product direction](../product-direction.md) for product scope and
[architecture](../architecture.md) for compiler and renderer boundaries.

## Product operation

The primary local operation is:

```text
init creates validated project configuration
-> onboard inventories supported provider targets
-> canonical custom guidance as needed
-> policy compilation and responsibility-specific instruction views
-> complete deterministic diff
-> explicit render approval
-> provider files and ownership lock
-> read-only check
```

The accepted onboarding path may place a selected local coding-agent CLI in the
operator role:

```text
existing project instructions
-> selected external agent proposes canonical rules
-> the agent operates agentdevflow rule, diff, render, and check
-> the same canonical and generated-state invariants decide success
```

Code is core only when it directly supports the primary operation, the current
commands, an accepted near-term command in `../../ROADMAP.md`, or the finite
policy compiler. A component that cannot identify such a caller is not
production infrastructure merely because it is technically reusable.

## Operating and threat model

The supported environment is one selected local project root operated by a
cooperative user on a normally functioning filesystem.

The implementation protects against:

- accidental overwrite of an unexplained existing target;
- stale plans after an ordinary concurrent or intervening edit;
- path traversal and writes outside the selected project root;
- symbolic-link substitution of a managed target or temporary file;
- malformed or unexpectedly large local input crossing a parser boundary;
- partial single-file writes and ordinary process interruption between
  complete-file replacements; and
- dishonest ownership or clean-state reporting.

The implementation does not protect against or claim support for:

- a malicious local user or process with repository write access;
- a compromised operating system, runtime, dependency, or filesystem;
- distributed writers, remote consensus, leases, or multi-host coordination;
- cryptographic identity, authentication, authorization, or non-repudiation;
- power-loss durability, storage corruption, or cross-file atomic visibility;
- automatic rollback when exact desired inputs cannot be reproduced; or
- semantic truth or lossless natural-language interpretation.

An in-scope digest binds exact bytes for determinism and stale-state detection.
It is not authentication. The render lock records generated-file ownership and
input state. It is not a mutex, lease, credential, or security boundary.

## Required local safety baseline

The normal write path may use only the following baseline unless a concrete
accepted requirement proves more is necessary:

- a complete deterministic plan and user-visible diff;
- explicit create, exact-adopt, bounded equivalent-content import, or abort
  behavior for existing files;
- one existing plan approval rather than an additional approval store;
- exact before-or-after digest checks immediately before mutation;
- repository-root path validation and symbolic-link refusal;
- same-directory temporary-file replacement for one complete file;
- forward-convergent retry from exact before or target bytes;
- publication of the ownership lock after provider files; and
- clear diagnostics when the current state no longer matches the plan.

Existing-file onboarding must stay inside that path. The current implementation
requires `init` to establish the valid selected configuration before
`onboard` reads any provider target. The current implementation supports exact
adopt, bounded equivalent import, explicit exact whole-file replacement, or
abort. Replacement is allowed only after the operator has represented retained
content in canonical rules. The normal diff shows the complete replacement,
and the normal render approval authorizes the complete current plan. A changed
source or target invalidates the plan. The exact per-target replacement input
must be repeated for both diff and render. Do not add an alternate onboard-first
path, durable approval record, per-section authorization ledger, backup
service, Git transaction, or second provider writer.

## Responsibility boundaries

### Version control

Git history, branches, commits, stashes, resets, backups, and working-tree
policy belong to the operator and repository hosting configuration.
`agentdevflow` must not require repository-wide cleanliness to authorize its
own managed paths and must not execute Git mutation commands as part of render
or recovery.

### Filesystem recovery

Idempotent forward convergence is sufficient for the accepted local product.
Journals, recovery blobs, writer records, cleanup receipts, durable commit
anchors, directory-durability qualification, and rollback engines are outside
the normal path. Retain research about them only when its compact conclusion
prevents a likely repeated mistake; executable subsystems without a current
caller are removal candidates.

### Agent assistance

A user-selected external coding agent may propose canonical-rule changes and
operate the same `agentdevflow` commands that the user could operate manually.
This is a foreground operator convenience. Public documentation explains
provider content and cost implications. The launcher uses the user's installed
CLI behavior without inspecting, copying, storing, overriding, refreshing, or
printing credentials, configuration, permissions, hooks, MCP state, or
sessions.

The external agent may use rule commands for canonical sources and may invoke
the normal diff, render, and check sequence. It is not a second provider writer,
trusted evidence producer, scheduler, or authority outside the selected
operation. Agent analysis must not require a second storage model, approval
protocol, transaction, or trust system. The accepted canonical state, complete
deterministic render plan, ownership lock, and final check remain
authoritative.

The initial Codex adapter uses one interactive session for analysis,
natural-language correction, confirmation, and execution. `--yes` explicitly
authorizes the same single operation without the confirmation question. There
is no separate propose/apply mode, proposal handoff, or provider-output schema.
The existing digest remains a staleness binding rather than a second approval.

### External services

Provider, tracker, CI, and hosting adapters translate explicit observations or
perform separately authorized external operations. The compiler does not own
credentials, polling, delegation, scheduling, retry loops, merge, release, or
remote workflow state.

A one-shot local coding-agent process adapter is not a live tracker or workflow
runtime. It may map a bounded onboarding task to one installed executable,
argv, stdin, working directory, and exit result. It must not become a
background process manager, provider SDK, login flow, retry queue, or general
agent chain.

Do not add a proactive provider-version allowlist, authentication detector,
permission classifier, runtime cost workflow, or arbitrary executable option
without a reproduced in-scope failure and an accepted decision.

## Complexity admission test

Before adding a subsystem, persistent record, abstraction layer, dependency, or
failure protocol, answer all of the following with repository evidence:

1. Which current product operation or accepted next milestone cannot complete
   without it?
2. Which reproduced in-scope failure does it prevent?
3. Why can the existing plan, diff, digest, lock, and convergent writer not
   handle that failure?
4. What normal user-visible capability is lost if the mechanism is omitted?
5. Does the proposal add another source of truth, writer, approval model,
   transaction model, discovery rule, or public format?
6. Is its ongoing maintenance smaller than the product value it unlocks?

If the first four answers are missing or theoretical, do not implement the
proposal. A reusable abstraction is not evidence of a requirement.

## Keep, freeze, defer, and remove

- **Keep:** directly serves a current operation, has a real caller, and uses the
  smallest mechanism consistent with the operating model.
- **Freeze:** preserves a compact technical conclusion or compatibility fixture
  but must receive no feature expansion. Frozen executable code still requires
  a named, credible revisit trigger.
- **Defer:** represents an accepted future outcome without production code or a
  compatibility promise.
- **Remove:** has no current caller, duplicates another boundary, implements an
  out-of-scope threat model, imposes ongoing test or change cost, or exists only
  to preserve prior effort. Git history is sufficient retention for removed
  experiments.

Deletion is preferred over freezing a large executable subsystem. Freeze only
the minimum documentation, fixture, or pure seam that would materially reduce
future reinvestigation cost.

## Repository-wide review rule

The engineering boundary applies to previously accepted and experimental work,
not only new changes. A project-health review must compare the entire current
repository with this document and identify code, tests, documents, commands,
and package entries whose maintenance cost no longer supports the product
operation.

Do not preserve an overbuilt mechanism merely because other code was adapted to
it. Instead, identify the smallest retained seam, remove dependent complexity in
dependency order, and verify the normal user path after every removal group.

## Revisit requirements

A stronger mechanism requires all of the following:

- a reproduced failure in a supported operation;
- an explicit statement that the failure is now in scope;
- comparison with the existing minimal mechanism;
- a bounded maintenance and migration consequence;
- an exit criterion and removal trigger; and
- explicit approval when it changes a public contract or long-term
  architecture boundary.

Examples that require this process include automatic rollback, durable
cross-file transactions, hostile-writer exclusion, cryptographic attestation,
managed regions, distributed execution, and Git-integrated recovery.
