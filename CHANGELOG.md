# Changelog

All notable public changes will be recorded in this file. During beta, incompatible configuration or JSON-output changes must include migration notes.

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
