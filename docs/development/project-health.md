# Project health

## Assessment basis

Assessment date: 2026-07-21.

The assessment reviewed base commit `4a62574` plus the declared cumulative unstaged working tree before closure edits. The branch matched `origin/main`, no change was staged, nine tracked files were modified, and 49 files were untracked. The untracked files contained approximately 12,235 lines across implementation, tests, fixtures, and documentation.

Three context-separated read-only reviews independently covered product and roadmap alignment, implementation complexity, and the smallest usable delivery path. The coordinating review checked their material claims against the repository and reconciled them into this assessment. This document records sanitized technical conclusions, not reviewer output or discussion chronology.

This is a product, architecture, maintainability, documentation, and delivery review. It is not a security audit and makes no claim that the repository is free of vulnerabilities.

## Current product outcome

Phase 0 established independent value for a provider-neutral policy compiler and a replaceable native project-instructions renderer. The working tree also contains private project-intent parsing, workflow resolution, typed execution evidence, deterministic transport, and one GitHub Check Runs mapping.

The npm product is published as `agentdevflow@0.1.0-beta.2`; both `latest` and `next` resolve to it. It is the qualified repair for non-interactive `init`, read-only `check` and `diff`, exact approved `render`, and explicit-observation `doctor`; the deprecated immutable `0.1.0-beta.1` tarball retains a `0644` bin even though npm 11.16 was later observed normalizing its installed target to `0755`. Publication remains protected by a manual exact-commit workflow, the `npm-publish` Environment, and an npm OIDC trusted publisher without a stored GitHub publishing secret.

The smallest current outcome is one reproducible init-to-check/diff/render vertical path through a directly invoked packed bin, bounded local doctor composition, exact-root project defaults, and bounded JSON schema version 1. Local, selected-platform, protected-publication, and public-registry first-run qualification pass. One bounded maintainer-dogfood observation also passes, confirming native instruction discovery and one advisory three-role handoff while preserving the explicit non-claim that messages are authenticated or mechanically transition workflow state. A later private spike validates caller-supplied canonical traces against workflows compiled from exact project bytes and explicit caller-supplied capability observations. It remains unpublished, does not authenticate those observations, and has no normal-user trace-creation path.

## Progress since assessment

The assessed closure was published as nine dependency-ordered commits ending at `2a1a4ae`. Each commit passed the repository check from an isolated archive snapshot, and `main` then matched `origin/main` with no staged or unstaged changes.

The first convergence slice after that checkpoint removes project resolution's dependency on execution-manifest export. The revision-1 project result now owns the authoritative private workflow compilation and can reach native Codex, Claude Code, and Cursor renderer staging directly. Execution manifests remain optional downstream exports for replay experiments. Schema-version-0 compilation remains compatibility and regression evidence rather than the active project path.

The next convergence slice adds a read-only private application planner. Local revision-1 configuration bytes now combine with repository observations and canonical lock bytes to produce an exact plan and snapshot consumable by existing check, diff, and render services. The planner never requests mutation access. Issue-to-reviewed-pull-request planning remains blocked because the repository does not contain live tracker, pull-request, CI, review-service, or merge adapters.

The following slice adds one experimental development entry for read-only `check` and `diff`. It accepts explicit repository, configuration, and lock paths, emits plan-bound human-readable diagnostics and exact recognized diff content, and preserves repository bytes across subprocess tests. Later slices extend the same entry without accepting its interface as public.

The next slice adds exact approved render to the same entry. Approval binds the complete plan snapshot, mutable authority is acquired only after a read-only match, and configuration plus repository state are replanned before mutation. Interrupted exact target bytes can reconstruct the original all-before plan under the still-authoritative base lock and original approval, avoiding both Git reset and a second journal.

The following slice adds minimal non-interactive initialization for the active revision-1 local workflow. Init creates only an absent exact configuration file. With no lock, the planner reuses the narrow project-instructions analyzer to classify provider targets as create, exact adopt, lossless import, or abort; provider mutation remains behind diff and exact approved render. No approval file, interactive wizard, discovery convention, or managed-region merge was introduced.

The package slice moves the shared temporary-intent primitive out of the frozen transaction subsystem, adds bounded explicit-observation doctor composition, allowlists the runtime tarball, and exercises all five installed command names offline. The first Node-compatible installed-command run exposed and fixed symbolic-link entry detection; automated coverage retains that regression case, while the later beta.2 check separately proves shell-visible execution.

The pre-beta-surface convergence candidate passed the repository audit over 211 text files, strict type checking, the build, and 388 automated tests with zero failures, skips, or todos.

The accepted beta-surface slice adds Apache-2.0 licensing, the `0.1.0-beta.1` candidate version, a Node.js 22/24 engine range, exact-root `agentdevflow.config.jsonc` and `.agentdevflow/lock.json` defaults, explicit repository-relative overrides, stable exit classes, and bounded JSON schema version 1. Tests prove default discovery does not walk to a parent and that oversized machine output fails closed. The release-preparation commit omits the manifest `private` field and adds a narrow manual publish workflow; no external publication state is configured or authorized by that repository change alone.

The published candidate passed strict type checking, build, 394 tests, repository audit, the selected V1 suite, dependency review, and five-command behavior through an installed module path. The later direct package-entrypoint audit found that this did not prove shell execution: the exact 118-entry tarball has a non-executable JavaScript bin. Registry advisory observations, dependency lifecycle-script queries, signatures, and provenance remain valid within their recorded point-in-time limits. See [beta release-candidate evidence](../evidence/beta-release-candidate.md), [initial beta publication evidence](../evidence/initial-beta-publication.md), and [public first-run qualification](../evidence/public-first-run.md).

The first public npm publication made exact version `0.1.0-beta.1` available with the qualified source commit, integrity, contents, registry signature, and provenance; current registry status is summarized above and in the public first-run evidence. At release-preparation commit `96c253c`, a bounded full-history disclosure audit covered 43 reachable commits, 223 historical paths, and 488 distinct blobs without finding a publication blocker through its documented pattern, path, blob, metadata, or external-state checks. It does not replace human review or a dedicated secret scanner. Public-repository hardening enables private vulnerability reporting, Dependabot security updates, secret scanning, push protection, full-SHA Actions pinning, an active no-bypass `main` ruleset requiring the six selected checks and squash-only pull requests, and a second ruleset rejecting identity-based remote branch prefixes. The `npm-publish` environment is restricted to `main`, requires an explicit approval from `lorekkusu`, and contains no secret; self-approval and administrator bypass remain possible and must not be represented as independent review.

## Roadmap alignment

- **Completed:** Phase 0 renderer and policy gates, the native initial-provider renderer, deterministic ownership and lock semantics, and staged forward-convergent apply have executable evidence.
- **Completed for the initial beta boundary:** the local application path reaches revision-1 init, exact planning, executable `check` and `diff`, and approved `render`, including fresh, exact-adopt, lossless-import, abort, exact-root discovery, bounded JSON, and stable outcome fixtures.
- **Completed:** the repaired package entrypoint and onboarding contract pass locally, across the selected hosted matrix, and from the public registry as `0.1.0-beta.2`. A bounded maintainer observation also covers the initial three provider products.
- **Current decision gate:** the bounded compiled-policy spike proves composability but does not provide an independently useful product outcome. Define a concrete normal-user workflow-status experience, trace-creation path, and evidence ownership model before exposing any command, path, or format.
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

At the assessment baseline, the newer model represented workflow family, hosted tracker intent, pull-request initial state, auxiliary review, and logical capability bindings that the older model could not express, but it did not feed renderer materialization. Project resolution also compiled and returned an execution manifest directly, coupling required project resolution to an optional export boundary.

The first convergence slice resolves those two defects: revision-1 project resolution now returns the authoritative workflow compilation, direct renderer materialization preserves its domain intent, and execution-manifest creation is an explicit optional downstream operation. The next slice adds a private read-only application planner that prepares exact values for the existing command services from configuration, lock, and repository bytes.

Disposition: **Invest.** Continue the accepted revision-1 path through package and local-doctor qualification. Retain the older model only as an explicit compatibility input or regression fixture, and fail rather than translating unsupported revision-1 intent back into it.

### High: a non-default transaction experiment is disproportionately large

Confidence: **High.** Categories: architecture and maintainability. Evidence: `src/transaction/`, `src/workspace/private-filesystem-workspace.ts`, ADR 0002, and the V1 recovery contract.

ADR 0002 selects staged digest-aware forward convergence as the V1 apply path and pauses stronger durability work. The retained write-ahead store, executor, cleanup lifecycle, receipts, and platform qualification are useful research evidence but are not the product default.

The temporary-intent primitive now lives under the workspace boundary. The normal filesystem workspace has no transaction import, and the package allowlist excludes `dist/src/transaction/`.

Disposition: **Freeze.** Do not extend or expose the strong transaction subsystem without a new accepted requirement. Keep it outside the runtime tarball. A later bounded removal review may move or delete transaction-only code while preserving the ADR, compact evidence, and Git history.

### High: roadmap execution advanced beyond an incomplete CLI dependency

Confidence: **High.** Categories: product and delivery. Evidence: `package.json`, `src/commands/`, and `src/interface/`.

Private `check`, `diff`, `render`, `doctor`, and `init` semantics exist, and the local application planner reaches the file-oriented commands from revision-1 bytes. The experimental installed entry provides explicit-path revision-1 init, read-only `check` and `diff`, exact approved `render`, and bounded doctor evaluation over explicit observations. It deliberately does not define public discovery, compatibility, live probes, or publication.

Disposition: **Resolved for the private offline package path.** Present public-surface, licensing, support, and prerelease decisions before accepting them. Do not add an interactive wizard, another provider, or another integration first.

### Medium: execution transport and GitHub evidence mapping answered their current questions

Confidence: **High.** Categories: architecture and delivery. Evidence: `src/execution/private-execution-transport.ts`, `src/adapters/github/private-github-check-runs-evidence.ts`, and their focused evidence documents.

Typed revision-bound evidence and pure replay demonstrate policy-compiler value beyond instruction rendering. The strict transport proves deterministic private byte boundaries, and the GitHub adapter proves one source observation can map into provider-neutral `CiResult` evidence.

No product command currently consumes a live GitHub observation. A live probe would add authentication, API-version, pagination, rate-limit, revision-selection, and operational failure concerns before the local initialization and package path is complete.

Disposition: **Freeze.** The compiled-policy spike is the one retained transport consumer, not a completed product gate. Limit changes to defects required by that composition. Defer live acquisition, more source adapters, and further transport generalization until a separately accepted user outcome requires them.

### Medium: documentation volume did not guarantee current accuracy at the assessment baseline

Confidence: **High.** Category: documentation. Evidence: the base-commit versions of `README.md` and this roadmap compared with the current package and qualification evidence.

At the assessment baseline, the roadmap accumulated chronological implementation slices that obscured current, next, later, and frozen work, and the README described an earlier dependency and platform-qualification state. Closure edits have reconciled those current-facing claims. Detailed evidence remains useful, but repository entry points must continue to reflect the current product truth.

Disposition: **Invest in consolidation.** Keep reproducible evidence, replace chronological roadmap accumulation with milestone state, and update current-facing documents when behavior changes.

### High: the assessed cumulative working tree was not one reviewable change

Confidence: **High.** Categories: maintainability and delivery. Evidence: the declared Git working-tree inventory and the subsystem paths listed in the disposition summary.

At the assessment baseline, the unstaged working tree combined project representation, parser and schema dependencies, workflow definitions, project resolution, presets, execution contracts, transport, a provider-specific evidence mapper, tests, and documentation.

Disposition: **Resolved for the assessed closure.** The cumulative change was divided into nine dependency-ordered commits and each snapshot passed complete verification before publication. Future slices should remain small and milestone-bound. Do not stage, commit, or push without separate authorization.

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

## Completed package and public-surface milestones

The private offline vertical path and package/local-doctor qualification are complete without publication:

```text
verified private local entry
-> isolate the runtime package graph from frozen research
-> compose bounded local doctor input
-> inspect npm package contents
-> install into a clean temporary project
-> execute all five candidate command names offline
-> report public-surface decisions for explicit approval
```

Exact-root defaults and explicit repository-relative path overrides are accepted. A user must not supply compiler output, materialization, manifest, evidence envelope, or render snapshot.

Exit criteria:

- the future package graph contains no import from the frozen transaction subsystem;
- `npm pack` contains only intended runtime and public documentation files;
- a clean temporary installation can invoke `init`, `render`, `diff`, `check`, and `doctor` without network access;
- doctor reports unknown external capability truth rather than adding live probes;
- Node.js and platform claims match selected qualification evidence;
- public filename, discovery, schema-versioning, output, and exit-code boundaries match ADR 0004 and executable tests;
- the public exact-version artifact matches the qualified package bytes, source commit, and provenance evidence.

Beta release hardening, publication, registry identity, and credential closure are complete. Version `0.1.0-beta.1` was published from commit `e4b3014`, but its packed JavaScript bin has mode `0644`; a recorded direct-entrypoint audit failed, while a later npm 11.16 clean-cache recheck normalized the installed target and succeeded. Version `0.1.0-beta.2` removes that ambiguity, repairs public onboarding, passed the six-cell protected path, and was published from exact commit `13bb07c0aea48df8dfd4bb8fbed7201ef30d4962` with OIDC provenance. Unqualified, exact-version, `next`, `npm exec`, and README first-run registry paths pass. An explicitly authorized registry correction moved `latest` to beta.2 and deprecated beta.1. One bounded local-workflow [maintainer observation](maintainer-dogfood.md) also passes without becoming compatibility qualification. The private compiled-policy spike has a technical composition pass but leaves the independently useful product-consumer gate open. A public command, representation, later package version, Git tag, GitHub Release, package-setting change, or scope expansion remains separately gated.

## Stop conditions

During beta release hardening:

- do not add a live GitHub probe;
- do not extend the strong transaction subsystem;
- do not add a provider, tracker, workflow family, preset, or evidence schema;
- do not generalize the private execution transport;
- do not count additional fixture, test, or evidence volume as product completion;
- do not require callers to construct private compiler, materialization, manifest, evidence, lock, or snapshot values;
- do not extend the accepted public filename, discovery rule, schema revision, output contract, or exit-code classes without a new explicit decision;
- reconsider the product if the vertical path cannot demonstrate policy-compiler value beyond file rendering.

## Decision requests

ADR 0004 accepts the initial beta public surface, and the exact initial version has been published. Any later version, Git tag, GitHub Release, package-setting change, product-direction change, provider-scope expansion, arbitrary workflow extensibility, live integration, release-authority change, or change to the Node.js/TypeScript/npm ecosystem remains separately gated.

## Limitations

- This assessment is not a security audit, threat model, dedicated secret scan, licensing review, or publication review. Package installation now has separate private qualification evidence.
- The initial measurements describe the declared pre-closure target. They are preserved as assessment evidence rather than presented as current repository counts.
- The published artifact identity and indirect installed-command behavior remain valid evidence, but the prior package qualification did not execute the shell-visible packed bin and therefore missed its non-executable mode.
- The accepted claims are limited to the published initial beta contract. No 1.0 compatibility, lock-byte stability, authenticated external observation, automatic orchestration, or later-release claim is made.

## Closure verification

The coordinating review completed the repository audit, strict type check, build, and complete automated test suite with Node.js 24.14.0. The audit passed over 201 text files, and 356 tests passed with zero failures, skips, or todos. Focused deterministic fixtures for both workflow families, execution manifest and transport, project resolution, project-document parsing, presets, schema-version-0 representation, and GitHub Check Runs mapping also passed.

The earlier closure environment did not expose npm directly. The later package milestone used the repository's NVM-managed Node.js 24.18.0 and npm, an isolated writable npm cache, locally packed exact runtime dependencies, and an offline temporary installation. See the package evidence for the separate result and limitations.

## Published checkpoint groups

The assessed cumulative working tree was published as nine dependency-ordered commits covering domain workflows, execution evidence, project resolution and presets, project-document parsing, transport, GitHub evidence mapping, compatibility experiments, architecture contracts, and closure governance. Git history is the authoritative record of those review units; this document intentionally does not duplicate commit chronology.

## Current closure checkpoint

Status: **Complete and published at `2a1a4ae`.**

The closure criteria are:

- the domain workflow, project-intent, preset, execution-evidence, transport, and GitHub mapping questions have explicit retained or frozen verdicts;
- current-facing documentation matches the package, platform, and roadmap state;
- no public file treats live trusted acquisition as the immediate next objective;
- the cumulative working tree was divided into coherent, independently verified commits;
- the complete repository verification passes;
- no later change is staged, committed, or pushed without explicit authorization.
