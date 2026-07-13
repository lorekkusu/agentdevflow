# Ecosystem evidence

Snapshot date: 2026-07-13.

This document records public technical evidence that affects the product boundary.

## Portable instruction and capability formats

[AGENTS.md](https://agents.md/) provides a shared Markdown instruction format, while the [Agent Skills specification](https://agentskills.io/specification) defines portable skill packages. The [Model Context Protocol registry](https://modelcontextprotocol.io/registry/about) supplies MCP server metadata. These ecosystems support interoperability, but they also argue against creating another proprietary instruction format, skills marketplace, or MCP registry.

## Renderer tools

[Rulesync](https://github.com/dyoshikawa/rulesync) generates configuration for many coding-agent products and exposes rules, commands, MCP, subagent, skill, hook, and permission surfaces. Its released programmatic API includes generate, import, convert, dry-run, and check operations. It is therefore the primary renderer candidate and a material dependency risk rather than a component to reimplement by default.

[Ruler](https://github.com/intellectronica/ruler) also centralizes agent instructions and related configuration. Together these tools make a rules-only synchronizer an insufficient product distinction.

## Workflow methods and runtimes

[Spec Kit](https://github.com/github/spec-kit), [OpenSpec](https://github.com/Fission-AI/OpenSpec), and [BMAD](https://github.com/bmad-code-org/BMAD-METHOD) already provide specification-oriented development methods. `agentdevflow` should integrate methods as presets or workflow packages instead of inventing another comprehensive methodology.

[OpenAI Symphony](https://github.com/openai/symphony) and [GitHub Agentic Workflows](https://github.com/github/gh-aw) represent execution systems with scheduling, isolation, credentials, retries, logs, and external writes. Those responsibilities form a separate runtime boundary and remain outside V1.

## Durable conclusion

The viable product boundary is a provider-neutral configuration and policy compiler with deterministic rendering, provenance, ownership, drift detection, honest enforcement diagnostics, and typed artifact safety. If the implementation reduces to a wizard plus generated instructions, the project should pivot or stop.

Competitive review must continue to watch renderer tools moving into policy and provenance, and providers adding native enforcement that removes the need for an intermediary compiler.
