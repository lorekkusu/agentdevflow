# Initial beta CLI contract

## Status

This document defines the accepted boundary published in the first public beta. It does not authorize a later version, tag, release, or package-setting change and does not make beta configuration fields, lock bytes, or JSON report fields permanent 1.0 contracts.

## Repository and path selection

Commands use the current working directory as the repository root unless `--repository <path>` is supplied. The selected path is opened as the exact root; the CLI does not walk into parent directories to find configuration.

Defaults are:

| Purpose | Default | Override |
| --- | --- | --- |
| Project configuration | `agentdevflow.config.jsonc` | `--config <repository-relative-path>` |
| Tool-owned lock | `.agentdevflow/lock.json` | `--lock <repository-relative-path>` |

Configuration and lock paths must remain below the selected root. Absolute paths, path traversal, symbolic-link traversal, and non-regular files fail closed. Observation inputs for `doctor` are caller-supplied evidence and receive their own bounded read contract.

## Commands

- `init` validates explicit non-interactive project choices and creates only an absent configuration. It does not write provider files or a lock until a separately reviewed render.
- `diff` is read-only and shows the complete recognized exact target needed for approval.
- `render` mutates only after `--approve-plan <sha256>` matches the current exact plan before and after reopening the workspace.
- `check` is read-only and reports clean, changes-required, or blocked state.
- `doctor` is read-only and validates explicit observations. The initial beta does not run provider commands, inspect credentials, or perform network probes.

## Exit status

| Code | Meaning |
| --- | --- |
| `0` | The command succeeded and the inspected state is clean or acceptable. |
| `1` | Reviewable changes are required, or observations are degraded but structurally valid. |
| `2` | Input or state is invalid, blocked, unsafe, unsupported, or failed unexpectedly. |

An exact diagnostic code provides the machine-level reason within one of these stable outcome classes. Human wording may improve during beta.

## Output

Human-readable output is the default. `--json` emits one UTF-8 JSON object with a numeric `schemaVersion`, command, outcome, exit code, sorted diagnostics, and command-specific report data.

The initial JSON schema version is `1`. Incompatible beta changes require a schema-version change and migration notes. Output is bounded; a command fails with exit code `2` instead of emitting an unbounded report.

`diff` may emit exact bytes only for recognized managed paths participating in the approved plan. Blocked state and foreign or unowned content expose paths, digests, and diagnostics as allowed by the command contract, never the foreign bytes themselves. No command intentionally emits credentials or tokens.

## Configuration and workflows

`ProjectConfig` is the user-facing configuration concept. The initial beta accepts versioned JSONC and exposes `local-reviewed-change` as its only executable workflow. Comments and trailing commas are syntax conveniences; parsing still rejects duplicate keys, unsafe keys, excessive size or nesting, and values outside the closed schema. Hosted tracker and issue-to-pull-request values remain unavailable through the public init path because their external capabilities do not exist.

The finite-state compiler representation, arbitrary workflow topology, and `WorkflowDefinition` are private implementation details. They are not a plugin API or general scheduler contract.

## Release boundary

Version `0.1.0-beta.1` was published with provenance but its tarball records the POSIX bin as `0644`; some npm clients may normalize that mode during installation. Version `0.1.0-beta.2` is the installer-independent repaired public beta and is available through npm's `next` tag with OIDC provenance. Before every later publication, the release review must confirm:

- package ownership and repository URL;
- Apache-2.0 metadata and inclusion of `LICENSE`;
- Node.js 22 and 24 qualification;
- exact tarball contents and installed-bin behavior;
- production dependency advisories and lifecycle scripts;
- trusted publishing or an equivalently short-lived release credential;
- exact packed installed-bin behavior through the shell-visible package entrypoint;
- explicit authorization for that version and publication.

Beta release work must not add provider integrations, a workflow runtime, a wizard, a framework, or a public arbitrary-workflow language merely to complete publication.

## Decision

See [ADR 0004](../decisions/0004-initial-beta-public-surface.md).
