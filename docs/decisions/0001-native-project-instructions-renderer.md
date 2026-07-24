# 0001: Native project-instructions renderer

Status: Accepted

Date: 2026-07-16

## Context

`agentdevflow` must render validated compiler intent for Codex, Claude Code, and Cursor without surrendering ownership, provenance, capability diagnostics, or deterministic planning to a provider-specific backend.

Gate 1 initially proved that pinned Rulesync output could be isolated behind a staging-only process adapter. Follow-up experiments with Rulesync 9.6.3 and 11.0.0 produced byte-identical output for the minimal three-provider rules fixture. The experiment also observed a substantially broader feature and dependency surface than the single project-instructions capability required by the current product slice.

The project already owns private materialization, source references, content digests, generated-file ownership, conflict planning, apply, and verification. The remaining initial provider transformation is limited to three project-wide instruction formats.

## Decision

Build and maintain a minimal native project-instructions renderer for the initial provider validation set:

- Codex emits a self-contained root `AGENTS.md`;
- Claude Code emits a self-contained root `CLAUDE.md`;
- Cursor emits `.cursor/rules/agentdevflow.mdc` as an always-applied project rule.

The native renderer accepts only a verified private source materialization with a matching digest and source-path set. It produces staged files and diagnostics but has no direct filesystem write authority. Planning, ownership, adoption, application, drift detection, and verification remain in the backend-neutral adapter.

The renderer accepts one composed project-wide `project-instructions` source
document for each configured provider target. Canonical project rules and
responsibility procedures are composed upstream into that provider-specific
document; the renderer does not expose another source model. Unsupported
capabilities and target layouts fail closed. It does not support global or
nested targets, path-scoped outputs, commands, skills, hooks, MCP
configuration, permissions, ignore files, conversion, or additional
providers.

Rulesync remains a pinned external experimental oracle. It is not a production or test runtime dependency, and the project will not fork it.

## Consequences

The production path has no Rulesync runtime, package graph, CLI protocol, or release-cadence coupling. Provider output, source mapping, ownership, and capability failure behavior are tested together and can evolve behind the private renderer boundary.

The project becomes directly responsible for tracking relevant instruction discovery, file format, frontmatter, and precedence changes in the three supported providers. Golden fixtures and current primary provider documentation are required for changes to emitted paths or content.

The native scope must remain narrow. Reimplementing Rulesync's broad provider matrix or its commands, skills, hooks, MCP, import, conversion, and global-mode surfaces would undermine this decision's maintenance advantage.

## Alternatives considered

- **Adopt Rulesync behind the staging adapter.** Technically viable and deterministic for the tested fixture, but it retains a broad dependency and release surface for a narrow transformation requirement.
- **Patch or fork Rulesync.** Provides control over upstream behavior but makes this project responsible for merging and releasing a broad provider matrix. The current requirement does not justify that coupling.
- **Reimplement Rulesync broadly.** Rejected because broad configuration synchronization is not the product core and would duplicate mature upstream functionality.

## Evidence

- [Renderer backend evidence](../evidence/renderer-backend.md)
- Automated coverage in `test/renderer/native-project-instructions.test.ts`
- Responsibility-filtered materialization coverage in
  `test/renderer/materialize-domain-project.test.ts`
- [Official Codex `AGENTS.md` documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Official Claude Code instruction documentation](https://code.claude.com/docs/en/memory)
- [Official Cursor rules documentation](https://docs.cursor.com/context/rules)
- [Rulesync source and feature matrix](https://github.com/dyoshikawa/rulesync/tree/v11.0.0)

## Security and disclosure considerations

Provider instruction files are advisory context, not a mechanical authorization
or enforcement boundary. Machine provenance remains in render metadata and the
ownership lock rather than being embedded wholesale in agent-facing
instructions.

The renderer refuses mismatched materialization digests and paths and
unsupported capabilities. Unowned overwrite refusal, owned-file drift,
symlink refusal, and forward-convergent filesystem application belong to the
workspace and render path selected in ADR 0002; they are not duplicate renderer
responsibilities.

No Rulesync source code is copied into the native renderer. If future work incorporates substantial third-party code, the applicable license and notices must be retained.

## Revisit triggers

- Near-term requirements expand beyond three providers or project-wide instructions.
- Commands, skills, hooks, MCP, permissions, import, conversion, global scope, or nested scope become required together rather than as isolated capabilities.
- Provider maintenance begins to dominate policy-compiler development.
- A renderer backend offers the required policy, provenance, ownership, typed artifact, and honest capability semantics directly.
- The native adapter boundary begins to reproduce most of Rulesync.

## Supersedes

None. It replaces the candidate Rulesync production dependency recommendation recorded in the initial Gate 1 evidence.
