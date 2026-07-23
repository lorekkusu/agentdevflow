# Changelog

All notable public changes will be recorded in this file. During beta, incompatible configuration or JSON-output changes must include migration notes.

## Unreleased

### Added

- Add `issue-to-reviewed-pull-request` to the non-interactive init surface with
  explicit Linear or GitHub Issues selection, draft or ready pull-request
  state, pull-request-host id, and CI id.
- Compile distinct Steward, Developer, and Reviewer procedures into the native
  Codex, Claude Code, and Cursor outputs.
- Read optional user-owned Markdown guidance from
  `.agentdevflow/rules/shared.md`, `steward.md`, `developer.md`, and
  `reviewer.md`.
- Add an explicit draft-to-ready step after required CI succeeds.

### Changed

- Treat every issue-workflow external capability as an advisory compiled
  procedure. The CLI does not connect to trackers, pull-request hosts, CI, or
  coding-agent processes.
- Fix auxiliary review to disabled and merge method to squash in the current
  issue-workflow CLI surface.
- Reject multiple configured ids for one provider product because its single
  project-wide instruction target cannot isolate them.

### Removed

- Remove the low-value caller-supplied observation command from the current
  CLI and runtime. The current command set is `init`, `diff`, `render`, and
  `check`.
- Remove obsolete research systems and detailed evidence whose conclusions are
  already represented by current architecture decisions or Git history.

### Migration

- Projects using the retired fifth beta command must stop invoking it; there
  is no replacement command in this candidate.
- Remove the retired `surface` property from every provider in existing
  configuration documents. Update scripted init calls from
  `--provider <id,product,surface>` to `--provider <id,product>`; the legacy
  property and three-component CLI form now fail validation.
- Existing generated files remain subject to the complete diff, exact approval,
  whole-file ownership, and drift rules.

The release sections below are historical snapshots. Their command and workflow
lists do not describe the unreleased candidate above.

## 0.1.0-beta.2 - 2026-07-21

### Fixed

- Preserve an executable POSIX mode on the built npm CLI and verify the packed, installed entrypoint directly.
- Support command-specific help for all five beta commands.
- Reject oversized doctor observation files with a bounded read instead of loading the complete file first.
- Preserve bounded schema-version-1 JSON when repository observation or planning fails unexpectedly.

### Documentation

- Add a public quick start, complete current option reference, generated-file ownership behavior, caller-supplied doctor example, and explicit non-features.
- Clarify advisory policy behavior, whole-file ownership and deletion, and the unauthenticated doctor-observation trust boundary.
- Synchronize the published beta, OIDC closure, and maintainer dogfood status across current project guidance.

### Publication

- Publish the repaired executable package through the protected OIDC workflow under npm's `next` tag.
- Verify exact-version, `next`, and `npm exec` entrypoints plus the complete documented first-run path from the public registry.

## 0.1.0-beta.1 - 2026-07-21

#### Added

- Local-first `init`, `diff`, `render`, `check`, and `doctor` commands.
- Provider-neutral project configuration with built-in local reviewed-change policy compilation.
- Native project-instructions rendering for Codex, Claude Code, and Cursor.
- Exact-root defaults for `agentdevflow.config.jsonc` and `.agentdevflow/lock.json`.
- Deterministic ownership, drift, conflict, exact-plan approval, and forward-convergent render behavior.
- Human-readable output and bounded JSON schema version 1.
- Apache License 2.0.

#### Limitations

- Only the local reviewed-change workflow is executable through `init`; workflows requiring external tracker, pull-request, CI, review-service, or merge adapters fail closed.
- `doctor` validates caller-supplied observations and does not run provider commands, inspect credentials, or use the network.
- Strict and Custom presets are unavailable.
- Beta configuration and JSON report fields may change through documented migration before 1.0.
- At first publication, npm established both `next` and the required `latest` tag at this version. Both tags now identify `0.1.0-beta.2`, and this first beta is deprecated; no distribution tag makes a prerelease stable.
