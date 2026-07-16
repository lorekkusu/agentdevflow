# Phase 1: renderer integration evidence

Snapshot date: 2026-07-16.

## Verdict

**Pass. Renderer integration hardening is complete for one project-wide instruction document and the initial three providers.** Private compiler output now materializes deterministic agent-facing instructions, binds them to machine provenance, and stages native Codex, Claude Code, and Cursor output behind the ownership-aware renderer contract.

The implementation introduces no Rulesync runtime dependency, public configuration contract, public workflow DSL, lock format, production CLI, global instructions, nested scope, or additional capability surface.

## Reproduction

Implementation:

- `src/renderer/materialize-compilation.ts`;
- `src/renderer/from-compilation.ts`;
- `src/renderer/native/`;
- `src/renderer/staged-adapter.ts`.

Automated coverage and expected output:

- `test/renderer/materialize-compilation.test.ts`;
- `test/renderer/native-project-instructions.test.ts`;
- `test/fixtures/renderer/native/`.

Run:

```bash
npm install
npm run check
```

## Private materialization

The private materialization revision contains:

- the compiler digest that owns the materialization;
- one logical `project-instructions/development-flow.md` document;
- its capability, content digest, and exact source references;
- an overall digest over revision, compiler ownership, file metadata, and source references.

Agent-facing content contains operational responsibilities, transitions, typed artifact production and invalidation, safety requirements, and an explicit advisory enforcement boundary. Compiler digests, configuration digests, definition revisions, and capability evidence remain machine metadata rather than being embedded wholesale in provider instructions.

Unsafe compilations, unsupported materialization revisions, duplicate logical paths, content-digest mismatches, overall-digest mismatches, and cross-compilation reuse are rejected.

For the Balanced specimen:

```text
source content digest: ba17b89e57423ced99d5dda357e83b48bc4f208ed68272508c401b73839e04ff
materialization digest: 25f907fa0e8c7b6ae5094aba4573c0c2fd5b61f7b42fef18924a36db0465990e
render input digest: 974fc2bef7d4dc80fc9c491df0fee4aada49d921d1570730f77cb733983dcca2
```

Reordered candidate intent produces a deeply equal materialization and render request.

## Native provider output

| Provider | Output | Scope |
| --- | --- | --- |
| Codex | `AGENTS.md` | Root, project-wide |
| Claude Code | `CLAUDE.md` | Root, project-wide |
| Cursor | `.cursor/rules/agentdevflow.mdc` | Project rule with `alwaysApply: true` |

The Claude output is self-contained and does not depend on Codex also being selected. Each staged file carries the logical source path plus the underlying candidate configuration and workflow-definition references.

Six golden files cover Fast and Balanced output for all three providers. Tests also cover deterministic target deduplication, LF normalization, trailing newline behavior, Cursor frontmatter, ownership planning, apply, verification, and modified-output drift.

## Failure results

| Condition | Result |
| --- | --- |
| Unsafe policy compilation | Reject before materialization |
| Corrupted materialized content or digest | Reject before renderer construction |
| Compilation and materialization mismatch | Reject before request construction |
| Request source digest or path-set mismatch | `SOURCE_MATERIALIZATION_MISMATCH` error and no files |
| Missing required `rules` render capability | `MISSING_RENDER_CAPABILITY` error and no files |
| Capability other than project instructions | Per-provider `UNSUPPORTED_CAPABILITY` errors and no files |
| More than one source document or another source capability | `UNSUPPORTED_SOURCE_LAYOUT` error and no files |
| Existing unowned output | Ownership conflict unless explicit byte-exact adoption is requested |
| Modified owned output | Ownership conflict; apply is refused |
| Post-apply content drift | Deterministic path-specific verification error |

## Provider evidence

The emitted root and project-rule formats are based on current primary documentation:

- [Codex `AGENTS.md` discovery and scope](https://learn.chatgpt.com/docs/agent-configuration/agents-md);
- [Claude Code `CLAUDE.md` discovery and project instructions](https://code.claude.com/docs/en/memory);
- [Cursor project rules and rule types](https://docs.cursor.com/context/rules).

Provider instructions remain advisory context. They do not authenticate a responsible role, authorize a transition, or establish semantic truth.

## Limitations

- The materialization, emitter revision, render request, and golden format are private implementation contracts.
- Only one project-wide instruction document is supported.
- Nested, path-scoped, global, manual, and agent-requested rules are unsupported.
- Commands, skills, hooks, MCP configuration, permissions, ignore files, import, and conversion are unsupported.
- Transactional filesystem behavior, symlink safety, lock persistence, and crash recovery remain roadmap step 4.
- Provider documentation and golden fixtures must be reviewed when discovery or file formats change.

## Decision

[ADR 0001](../decisions/0001-native-project-instructions-renderer.md) accepts the minimal native renderer. Rulesync remains a pinned external experimental oracle and is neither a production nor test runtime dependency.

Proceed to the internal lock, provenance, and transactional workspace slice. Do not expand renderer scope as part of that work.
