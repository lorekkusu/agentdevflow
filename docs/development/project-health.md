# Project health

## Assessment basis

Assessment date: 2026-07-21.

The assessment reviewed base commit `4a62574` plus the declared cumulative unstaged working tree before closure edits. The branch matched `origin/main`, no change was staged, nine tracked files were modified, and 49 files were untracked. The untracked files contained approximately 12,235 lines across implementation, tests, fixtures, and documentation.

Three context-separated read-only reviews independently covered product and roadmap alignment, implementation complexity, and the smallest usable delivery path. The coordinating review checked their material claims against the repository and reconciled them into this assessment. This document records sanitized technical conclusions, not reviewer output or discussion chronology.

This is a product, architecture, maintainability, documentation, and delivery review. It is not a security audit and makes no claim that the repository is free of vulnerabilities.

## Current product outcome

Phase 0 established independent value for a provider-neutral policy compiler and a replaceable native project-instructions renderer. The working tree also contains private project-intent parsing, workflow resolution, typed execution evidence, deterministic transport, and one GitHub Check Runs mapping.

The intended npm product is not yet usable through `npx agentdevflow`. The package remains private, has no `bin` entry, and has no executable application handler connecting repository configuration to the private command services.

The smallest current outcome is therefore a collection of executable private fixtures and semantic services, not a user-operable CLI.

## Roadmap alignment

- **Completed:** Phase 0 renderer and policy gates, the native initial-provider renderer, deterministic ownership and lock semantics, and staged forward-convergent apply have executable evidence.
- **Partial:** private project intent, workflow selection, presets, command semantics, initialization, and execution evidence exist but do not form one executable application path.
- **Blocked:** packaging and a user-operable CLI are blocked by parallel project and compiler models, project-resolution coupling to optional manifest export, and a normal workspace import from frozen transaction code.
- **Prematurely advanced:** strict execution transport and one GitHub observation mapper answered bounded research questions before the local CLI dependency was complete. Both are now frozen.

## Measured observations

The initial assessment counted:

- 52 source files and approximately 18,208 source lines;
- 66 test and fixture files and approximately 13,500 TypeScript test lines;
- 61 documentation files and approximately 6,236 Markdown lines;
- 355 passing automated tests with zero failures or skips;
- 34 evidence documents containing approximately 3,499 lines;
- 3,807 implementation lines and 3,146 test lines under the non-default transaction subsystem;
- 3,314 implementation lines and 2,219 test lines under command services without an executable source-side CLI caller.

Counts use repository file lists and physical lines, including blank lines, comments, tests, and fixtures. The declared initial baseline excludes the two health-review documents created during closure. Line counts are review indicators, not quality targets. The important mismatch is the amount of private infrastructure relative to the absence of a complete user path.

## Findings

### High: the active project and compiler models do not form one product pipeline

Confidence: **High.** Categories: product, architecture, and delivery. Evidence: `src/config/candidate.ts`, `src/compiler/private-model.ts`, `src/compiler/private-domain-workflow.ts`, `src/project/private-domain-project-resolution.ts`, and `src/renderer/materialize-compilation.ts`.

The older schema-version-0 candidate configuration feeds `CandidateCompilation`, renderer materialization, initialization, and command-service experiments. The newer revision-1 domain project intent feeds a separate domain-workflow compilation, workflow selection, preset expansion, project resolution, execution-manifest export, and replay.

The newer model represents workflow family, hosted tracker intent, pull-request initial state, auxiliary review, and logical capability bindings that the older model cannot express. It does not yet feed renderer materialization or the command services, and the renderer still consumes only the older compiled representation. Project resolution also compiles and returns an execution manifest directly, coupling project and workflow resolution to an optional export boundary. Continuing provider or evidence work before these boundaries converge would deepen parallel policy, rendering, and execution semantics.

Disposition: **Invest.** Select one active internal project intent and one authoritative compiled representation, or define one explicit one-way bridge with tested semantic parity. Separate required project and workflow compilation from optional execution-manifest export. Retain the older model only as an explicit compatibility input, bridge source, or regression fixture.

### High: a non-default transaction experiment is disproportionately large

Confidence: **High.** Categories: architecture and maintainability. Evidence: `src/transaction/`, `src/workspace/private-filesystem-workspace.ts`, ADR 0002, and the V1 recovery contract.

ADR 0002 selects staged digest-aware forward convergence as the V1 apply path and pauses stronger durability work. The retained write-ahead store, executor, cleanup lifecycle, receipts, and platform qualification are useful research evidence but are not the product default.

The normal filesystem workspace still imports one temporary-intent validator from the transaction area, so runtime-package exclusion is an intended packaging gate rather than a mechanically complete separation today.

Disposition: **Freeze.** Do not extend or expose the strong transaction subsystem without a new accepted requirement. Before packaging, move the shared temporary primitive out of the transaction area or isolate transaction-only workspace extensions so the runtime path has no frozen transaction import. Then review whether transaction-only APIs should move under experiments or be removed while preserving the ADR, compact evidence, and Git history.

### High: roadmap execution advanced beyond an incomplete CLI dependency

Confidence: **High.** Categories: product and delivery. Evidence: `package.json`, `src/commands/`, and `src/interface/`.

Private `check`, `diff`, `render`, `doctor`, and `init` semantics exist, but the package has no executable handler, discovery behavior, output contract, or end-to-end application service. Recent work advanced execution transport and GitHub evidence mapping instead of completing the earlier thin-CLI and initialization dependencies.

Disposition: **Invest in vertical integration; freeze horizontal expansion.** The next milestone must connect one configuration input to policy compilation, materialization, plan creation, read-only check and diff, explicit render, and clean recheck.

### Medium: execution transport and GitHub evidence mapping answered their current questions

Confidence: **High.** Categories: architecture and delivery. Evidence: `src/execution/private-execution-transport.ts`, `src/adapters/github/private-github-check-runs-evidence.ts`, and their focused evidence documents.

Typed revision-bound evidence and pure replay demonstrate policy-compiler value beyond instruction rendering. The strict transport proves deterministic private byte boundaries, and the GitHub adapter proves one source observation can map into provider-neutral `CiResult` evidence.

No product command currently consumes a live GitHub observation. A live probe would add authentication, API-version, pagination, rate-limit, revision-selection, and operational failure concerns before the local CLI path exists.

Disposition: **Freeze.** Retain the current private prototypes and non-claims. Defer live acquisition, more source adapters, and further transport generalization until a real external consumer requires them.

### Medium: documentation volume did not guarantee current accuracy at the assessment baseline

Confidence: **High.** Category: documentation. Evidence: the base-commit versions of `README.md` and this roadmap compared with the current package and qualification evidence.

At the assessment baseline, the roadmap accumulated chronological implementation slices that obscured current, next, later, and frozen work, and the README described an earlier dependency and platform-qualification state. Closure edits have reconciled those current-facing claims. Detailed evidence remains useful, but repository entry points must continue to reflect the current product truth.

Disposition: **Invest in consolidation.** Keep reproducible evidence, replace chronological roadmap accumulation with milestone state, and update current-facing documents when behavior changes.

### High: the cumulative working tree is not one reviewable change

Confidence: **High.** Categories: maintainability and delivery. Evidence: the declared Git working-tree inventory and the subsystem paths listed in the disposition summary.

The unstaged working tree combines project representation, parser and schema dependencies, workflow definitions, project resolution, presets, execution contracts, transport, a provider-specific evidence mapper, tests, and documentation.

Disposition: **Close before expanding.** Audit dependencies and incomplete boundaries, retain or freeze each subsystem explicitly, run the complete verification suite, and propose small coherent commit groups. Do not stage, commit, or push without separate authorization.

## Disposition summary

### Invest

- one active revision-1 project-intent and application pipeline;
- the finite-state policy validator and provider-neutral compiler boundary;
- the minimal native Codex, Claude Code, and Cursor renderer;
- ownership, drift, conflict, lock, and V1 forward-convergent apply behavior;
- executable `check`, `diff`, and explicit `render` entry points;
- temporary-repository acceptance tests driven through the real entry point;
- the local no-pull-request workflow as an anti-coupling regression fixture.

### Keep

- bounded JSONC parsing and the exact private runtime-schema dependencies;
- create, exact-adopt, lossless-import, and abort semantics;
- both bounded workflow families as private validation and anti-coupling fixtures;
- the typed execution manifest and pure replay boundary as proof of revision-bound policy value;
- deterministic diagnostics and critical interruption and foreign-drift coverage;
- Fast and Balanced as private executable profiles;
- explicit failure for unavailable Strict behavior.

### Freeze

- the non-default write-ahead transaction store, executor, cleanup, and disposal lifecycle;
- the private execution transport beyond defects required by retained code;
- the current GitHub Check Runs evidence mapper;
- live-observation-independent doctor semantics;
- stronger transaction platform qualification.
- schema-version-0 CLI parsing and project-document generation, except as explicit compatibility or regression evidence while the active model converges.

### Defer

- live GitHub acquisition and credentials;
- additional provider, tracker, CI, or review-source adapters;
- additional workflow families, evidence schemas, Strict implementation, and Custom composition;
- interactive initialization, managed-region merging, broad import semantics, and automatic repository analysis;
- polling, retries, scheduling, automatic repair, merge, release, GUI, and SaaS behavior.

### Removal candidates for a later bounded review

- transaction-only runtime code after the V1 package boundary exists;
- recovery comparison executables after their accepted ADR evidence is sufficient;
- transport fixtures with no retained consumer;
- duplicate chronological evidence that no longer supports a distinct claim;
- schema-version-0 document generation after the active vertical path has an explicit migration or compatibility disposition.

Do not remove these items during the current closure merely to reduce line counts. Git history and compact durable evidence should preserve technically useful conclusions before any later deletion.

## Next milestone

The next milestone is one experimental but executable local vertical path:

```text
explicit configuration bytes
-> parse and validate
-> resolve project, preset, workflow, providers, and capabilities
-> compile policy
-> materialize provider instructions
-> inspect repository and lock
-> check and diff
-> explicit approved render
-> repeated check reports clean
```

Use explicit caller paths before selecting public discovery precedence. A user must not supply compiler output, materialization, manifest, evidence envelope, or render snapshot.

Exit criteria:

- one revision-1 configuration produces one deterministic exact plan;
- one authoritative compiled representation reaches renderer materialization, or one explicit bridge proves semantic parity and reports unsupported intent without inference;
- required project and workflow compilation no longer depends on optional execution-manifest export;
- `check` and `diff` execute through a real entry point and never mutate project files;
- explicit render uses the accepted forward-convergent apply path;
- repeated render is a no-op and repeated check is clean;
- stale approval, foreign drift, ownership conflict, and unsupported capability fail closed with user-level diagnostics;
- a temporary fresh repository completes the path without network access;
- the older candidate configuration is either an explicit one-way compatibility input or no longer part of the active pipeline;
- the future package graph contains no import from the frozen transaction subsystem.

## Stop conditions

Until the next milestone is complete:

- do not add a live GitHub probe;
- do not extend the strong transaction subsystem;
- do not add a provider, tracker, workflow family, preset, or evidence schema;
- do not generalize the private execution transport;
- do not count additional fixture, test, or evidence volume as product completion;
- do not require callers to construct private compiler, materialization, manifest, evidence, lock, or snapshot values;
- stop for an explicit product-model decision if the two configuration paths cannot converge without silent intent loss;
- reconsider the product if the vertical path cannot demonstrate policy-compiler value beyond file rendering.

## Decision requests

None for this closure. The active internal model, bridge or replacement mechanics, public filenames, public schema, lock discovery, CLI output, and package publication remain candidate decisions gated by the next vertical milestone and explicit approval.

## Limitations

- This assessment is not a security audit, threat model, dedicated secret scan, package-installation test, or publication review.
- The initial measurements describe the declared pre-closure target; final verification results are recorded only after closure edits stop changing.
- The current working tree is intentionally dirty and cumulative. Proposed groups have not yet been proven as independently passing commits.
- No public compatibility, Node.js support, configuration-discovery, lockfile, exit-code, or release promise is accepted by this assessment.

## Closure verification

The coordinating review completed the repository audit, strict type check, build, and complete automated test suite with Node.js 24.14.0. The audit passed over 201 text files, and 356 tests passed with zero failures, skips, or todos. Focused deterministic fixtures for both workflow families, execution manifest and transport, project resolution, project-document parsing, presets, schema-version-0 representation, and GitHub Check Runs mapping also passed.

The local tool environment did not expose the `npm` executable, so the coordinator invoked the exact `check` constituent commands directly with the available Node.js runtime. This is equivalent source verification but is not an npm installation, package-content, or clean-install qualification result.

## Proposed checkpoint groups

The cumulative working tree should be reviewed and, only after separate authorization, committed in dependency order:

1. domain workflow definitions, generic compilation, deterministic fixtures, and focused evidence;
2. typed execution manifest, typed evidence, pure replay, deterministic fixtures, and focused evidence;
3. revision-1 project intent, preset expansion, resolution, and project fixtures;
4. bounded JSONC and Zod document parsing, exact dependency pins, repository-boundary enforcement, and its regression test;
5. frozen strict execution transport and its focused fixtures;
6. frozen GitHub Check Runs mapper and its focused fixtures;
7. schema-version-0 compatibility and representation experiments plus their existing fixture commands;
8. mutually dependent contracts, ADRs, architecture, and compact evidence;
9. closure governance, current-facing documentation, and roadmap reconciliation.

Each proposed commit must pass type checking, automated tests, repository audit, and link validation from its own snapshot. Some `package.json` and documentation changes will require hunk-level assignment so an earlier commit never references a later untracked file. Project resolution currently depends on execution-manifest compilation, so group 2 precedes group 3 unless that coupling is removed first.

## Current closure checkpoint

Status: **Complete in the current working tree; pending separate commit authorization.**

The closure criteria are:

- the domain workflow, project-intent, preset, execution-evidence, transport, and GitHub mapping questions have explicit retained or frozen verdicts;
- current-facing documentation matches the package, platform, and roadmap state;
- no public file treats live trusted acquisition as the immediate next objective;
- the cumulative working tree has a reviewed disposition and coherent proposed commit groups;
- the complete repository verification passes;
- no change is staged, committed, or pushed without explicit authorization.
