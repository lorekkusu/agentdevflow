# Private init command contract

## Status

This contract defines an internal, read-only, non-interactive initialization proposal service. It is not a stable CLI, API, configuration schema, configuration filename, import protocol, discovery extension point, or apply authorization.

## Boundary

The service accepts a candidate configuration, deterministic target bytes, optional caller-supplied import assessments, and a read-only workspace. It returns a complete proposal and never writes, removes, adopts, imports, stages, commits, resets, or otherwise mutates repository state.

Revision 1 recognizes only the project-level instruction paths already validated by the native renderer:

| Provider product | Observed path |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/agentdevflow.mdc` |

The target set must contain exactly one entry for each distinct provider product in the normalized candidate configuration. Nested instructions, global scope, arbitrary provider paths, commands, skills, hooks, MCP configuration, permissions, and ignore files remain outside this revision.

## Proposed configuration and target files

The service normalizes the existing revision-0 candidate configuration and returns:

- the normalized in-memory value;
- canonical JSON;
- its SHA-256 digest;
- a private proposal revision.

This makes the proposed configuration reviewable without selecting a public serialization format or filename. The candidate configuration remains an experimental specimen, not a stable `ProjectConfig` API.

Every target entry contains the complete proposed bytes, target digest, source references, observed state, observed digest when available, information-loss entries, and one explicit disposition. Existing foreign bytes are not returned. A caller that displays those bytes must read and disclose them under a separate reviewed policy.

## Dispositions

| Disposition | Condition | Meaning |
| --- | --- | --- |
| `create` | The provider path is absent. | The future apply may create the exact visible target bytes. |
| `adopt` | Existing bytes exactly equal target bytes. | A future apply may claim ownership only after explicit approval. No bytes need to change. |
| `import` | A current import assessment binds the observed digest to the same proposed configuration and target digests. | The proposal requires explicit review. Information loss is empty for `lossless` or fully listed for `lossy`. |
| `abort` | The path is unreadable or import evidence is absent, stale, unsupported, or bound to another configuration. | No future apply may proceed from this proposal. |

Exact byte equality is the only adoption rule. Repository-wide Git cleanliness is not ownership evidence and is never inspected.

## Import assessment boundary

An assessment records provider product, observed content digest, `lossless`, `lossy`, or `unsupported` classification, proposed configuration and target-content digests when supported, and a complete list of known information loss.

The semantic core verifies shape, digest binding, classification consistency, and agreement with the proposed configuration. It does not parse provider files or prove that an assessment is semantically correct or complete. Future provider-specific import analyzers must be narrow, deterministic, separately tested, and able to explain every unsupported or lossy construct. Until such an analyzer exists, differing existing content without an assessment aborts.

Lossy import remains a reviewable proposal with a warning; it is not apply authorization. Unsupported analysis always aborts.

## Outcomes

| Outcome | Candidate exit code | Meaning |
| --- | ---: | --- |
| `ready` | `0` | All paths are absent or byte-exact adoption candidates. |
| `review-required` | `1` | At least one supported import proposal exists and no path aborts. |
| `blocked` | `2` | At least one path has an `abort` disposition, or private input validation failed. |

Candidate exit codes remain private until end-to-end CLI behavior is qualified and explicitly accepted.

## Determinism and observation

Targets, assessments, entries, source references, information-loss lists, and diagnostics are normalized or sorted deterministically. The service reads only the three fixed paths selected by configured provider products.

The production filesystem adapter enforces repository-root containment, canonical relative paths, symbolic-link rejection, and regular-file checks. A read failure becomes an explicit unreadable `abort` entry. The proposal is still an observation rather than an atomic snapshot; a future apply must reread and revalidate all bound digests.

## Explicit non-claims

The private service does not define:

- a public configuration syntax, filename, or `ProjectConfig` compatibility promise;
- an interactive wizard or prompt sequence;
- provider-file parsing or semantic import correctness;
- a merge algorithm, managed-region syntax, or ownership format;
- arbitrary path discovery, nested scope, or global scope;
- terminal formatting, redaction, truncation, or public JSON output;
- mutation, lock creation, adoption authorization, or import application;
- Git status, reset, clean, stash, branch, commit, or push behavior.

Any future handler must preserve this read-only proposal boundary and route mutation through the existing exact-plan render path.
