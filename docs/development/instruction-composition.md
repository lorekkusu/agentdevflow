# Instruction composition

## Status

This document defines the current unreleased canonical-guidance slice. The
filenames and limits remain beta surfaces until a qualified release, but the
implementation is part of the installed CLI path rather than a separate
experiment. The root [product roadmap](../../ROADMAP.md) accepts a bounded
replacement for this aggregate-file surface; this document remains accurate
for the current implementation until that milestone lands.

## Purpose

Projects need one editable source for their own rules while Codex, Claude Code,
and Cursor receive instructions focused on their configured
responsibilities.

```mermaid
flowchart LR
    A["User-owned Markdown under .agentdevflow/rules"] --> B["Bounded read"]
    B --> C["Shared and responsibility composition"]
    C --> D["Role-specific provider views"]
    D --> E["Existing diff"]
    E --> F["Exact approved render"]
    F --> G["Provider files and ownership lock"]
    G --> H["Existing check"]
```

Provider outputs are projections. They are not another source of truth.

## Canonical inputs

Exactly four optional Markdown paths are recognized:

| Path | Applies to |
| --- | --- |
| `.agentdevflow/rules/shared.md` | Every configured provider product |
| `.agentdevflow/rules/steward.md` | A provider assigned Steward |
| `.agentdevflow/rules/developer.md` | A provider assigned Developer |
| `.agentdevflow/rules/reviewer.md` | A provider assigned Reviewer |

There is no index file, rule id, ordering metadata, provider-instance source,
or nested discovery. Each file is bounded to 65,536 bytes and read through the
same repository-root and regular-file boundary used by the planner. Missing
files mean no user guidance for that scope.

The user owns these source files. A user may edit them directly or explicitly
direct a coding agent to edit them. `agentdevflow` reads but never writes them.

## Composition

Every generated provider view contains:

1. shared workflow facts and stop conditions;
2. optional shared user guidance;
3. only the responsibilities assigned to that provider id;
4. an operational procedure for each assigned responsibility;
5. operational procedures, capability targets, and stop conditions for the
   assigned responsibilities;
6. optional user guidance for each assigned responsibility.

This makes a Cursor Developer view materially different from a Claude Code
Reviewer view. When one provider id holds several responsibilities, its file
contains separately labeled role sections and requires the agent to identify
the active responsibility before acting.

Codex, Claude Code, and Cursor each have one project-wide native output path.
Two ids for the same product are rejected because one target cannot isolate
their identities. One id may still hold multiple roles.

## Ownership and update flow

| Artifact | Owner | Mutation path |
| --- | --- | --- |
| Canonical guidance | User | Normal project edit |
| `AGENTS.md` | agentdevflow | Exact-approved `render` |
| `CLAUDE.md` | agentdevflow | Exact-approved `render` |
| `.cursor/rules/agentdevflow.mdc` | agentdevflow | Exact-approved `render` |
| `.agentdevflow/lock.json` | agentdevflow | Published last by `render` |

Canonical bytes and their paths contribute to the planned provider content and
plan digest. Editing guidance after `diff` makes the approval stale. Editing a
generated target directly creates ownership drift. No generated content is
reverse-synchronized into the canonical source.

Existing provider files use the renderer's ordinary create, exact-adopt,
supported lossless-import, or abort behavior. Instruction composition adds no
replacement authorization, second writer, or second approval mechanism.

## Failure behavior

Planning stops with a bounded diagnostic when:

- a recognized guidance path cannot be read safely;
- a configured provider product has more than one id;
- an existing provider target cannot be adopted or imported without
  information loss;
- a managed output or lock has drifted;
- the reviewed plan no longer matches current source and target bytes.

The planner does not disclose or overwrite unsupported foreign content.

## Current absences

The current implementation does not yet provide:

- `rule list`, `rule show`, `rule add`, `rule update`, or `rule remove`;
- a rule index, rule-level provenance format, or public rule DSL;
- provider-instance-specific or nested guidance;
- canonical-source mutation planning;
- a composite source/provider transaction;
- a second digest, approval store, authorization ledger, backup, journal,
  lease, or Git manager;
- natural-language merge, semantic deduplication, or agent-assisted
  classification;
- automatic import of arbitrary legacy provider instructions.

These absences describe the current candidate, not an indefinite product
decision.

## Accepted outcome and decision gates

The roadmap accepts:

- one Markdown file per stable rule id;
- fixed shared, Steward, Developer, and Reviewer scope directories;
- bounded human and JSON `rule list/show/add/update/remove` commands;
- generated instructions that route agents back to those commands;
- manual existing-project onboarding; and
- optional operation by one user-selected external coding-agent CLI.

Rule commands will mutate only canonical rule files. The external agent may
propose rule organization and operate the exact current `agentdevflow`
executable, including rule, diff, render, and check commands. Provider outputs
and the ownership lock remain under the existing render command.

The current aggregate inputs remain authoritative until the roadmap's migration
and mixed-layout decision is accepted and implemented. No implementation may
silently ignore or delete them. The external-agent proposal mode stops before
mutation; apply mode requires explicit one-operation delegation by the user.

The accepted outcome does not revive the removed index, per-rule authorization
ledger, source/provider composite transaction, second approval model, managed
regions, backup system, semantic merge authority, or Git manager. See
`ROADMAP.md` for sequence and acceptance criteria.

## Qualification requirements

The slice is ready for a release candidate only when installed-package tests
prove:

- absent guidance still produces responsibility-specific provider views;
- shared and role files reach only their declared outputs;
- source edits produce a deterministic new diff and stale the old approval;
- exact-approved render converges to clean `check` and clean repeated `diff`;
- direct generated-file edits remain blocked drift;
- unreadable or oversized sources fail without mutation;
- ambiguous same-product ids fail clearly;
- the package includes the guidance reader and no obsolete experiment tree.
