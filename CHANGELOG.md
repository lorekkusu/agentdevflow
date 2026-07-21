# Changelog

All notable public changes will be recorded in this file. During beta, incompatible configuration or JSON-output changes must include migration notes.

## Unreleased

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
- The first registry version is available through `next`. npm also requires `latest` to identify the only published version, so an unqualified install currently resolves this beta; this does not make it stable.
