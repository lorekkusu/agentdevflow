# Tooling decisions

These choices keep the beta reproducible while avoiding unnecessary production
architecture. They do not freeze a future 1.0 programmatic API or final CLI
stack.

| Decision | Phase 0 choice | Rationale | Revisit trigger |
| --- | --- | --- | --- |
| Minimum Node.js | Node.js 22 | Node.js 20 is end-of-life; 22 and 24 are supported LTS lines as of 2026-07-17. | Before the first public release, using the then-current support schedule and user evidence. |
| Repository package manager | npm | npm is already required by the intended distribution path and adds no second package-manager requirement. | A workspace or release requirement that npm cannot meet simply. |
| Module system | ESM | ESM matches modern Node.js and keeps the Phase 0 source direct. No dual-package surface is needed. | Evidence that a public programmatic API needs CommonJS compatibility. |
| TypeScript | `tsc`, pinned in the lockfile | The target ecosystem requires TypeScript; the official compiler is the minimum build dependency. | A measured build or packaging need. |
| Test runner | `node:test` | The built-in runner supports the spike without a framework dependency. | Missing test features that materially improve the production suite. |
| Build tooling | `tsc` only | The private npm package installs emitted ESM directly and does not require a bundler. | Measured startup, size, source-protection, or distribution requirements. |
| Source layout | `src/` and `test/` | A single package with direct source-to-test mapping is sufficient. | Multiple publishable packages or independently released adapters. |
| CLI framework | None; Node.js `util.parseArgs` backs the beta entry | The built-in parser covers the current command families, five rule operations, two built-in workflow forms, exact-root defaults, explicit overrides, and JSON selection without another production dependency. | Measured help, completion, nesting, or command-composition requirements that justify a framework. |
| Package boundary | npm `files` allowlist plus the `agentdevflow` bin | The tarball includes only the current runtime graph and excludes tests, fixtures, experiments, provider clients, and research evidence. | Accepted programmatic exports, adapter packages, or bundled distribution. |
| Schema library | Exact Zod 4.4.3 behind a private jitless wrapper | The integrated closed schema produces the bounded project intent and a deterministic Draft 2020-12 snapshot without using unrepresentable constructs. | Relevant advisory or upstream incident, an unrepresentable accepted field, unacceptable package cost, or evidence for a smaller maintained replacement. |
| Configuration parser | Exact `jsonc-parser` 3.3.1 behind one private boundary | Integrated tests cover comments, trailing commas, precise syntax errors, duplicate rejection, unsafe keys, resource limits, comment-preserving scalar edits, and array insertion. | Relevant advisory or upstream incident, required unsupported semantics, unacceptable package cost, or a materially safer maintained replacement. |
| Public configuration | Versioned JSONC `ProjectConfig`; default `agentdevflow.config.jsonc` at the exact selected root | Init emits deterministic revision-1 bytes accepted by the bounded parser. Parent discovery is disabled; explicit repository-relative overrides remain available. Beta field changes require documented migration. | A real workspace use case requires nested scope, or field evolution requires a new schema revision and migration. |

The Node.js support status is based on the [official Node.js release table](https://nodejs.org/en/about/previous-releases). The native project-instructions renderer adds no runtime dependency.

The initial beta supports Node.js 22 and 24. Current V1 qualification uses
explicit `ubuntu-24.04` x64, `macos-15` arm64, and `windows-2025` x64
GitHub-hosted runner labels; those exact cells are qualification evidence rather
than promises for every operating-system version or architecture. See
[V1 platform qualification](../evidence/v1-platform-qualification.md).

[ADR 0003](../decisions/0003-private-jsonc-zod-boundary.md) accepts the private exact parser and schema dependency boundary, not a public filename or format. Current supply-chain and residual-risk observations are in [parser and schema dependency security](../evidence/parser-schema-dependency-security.md).
