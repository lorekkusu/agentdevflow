# Tooling decisions

These choices keep Phase 0 reproducible while avoiding premature production architecture. They do not freeze the public API, configuration format, or final CLI stack.

| Decision | Phase 0 choice | Rationale | Revisit trigger |
| --- | --- | --- | --- |
| Minimum Node.js | Node.js 22 | Node.js 20 is end-of-life; 22 and 24 are supported LTS lines as of 2026-07-13. | Before the first public release, using the then-current support schedule and user evidence. |
| Repository package manager | npm | npm is already required by the intended distribution path and adds no second package-manager requirement. | A workspace or release requirement that npm cannot meet simply. |
| Module system | ESM | ESM matches modern Node.js and keeps the Phase 0 source direct. No dual-package surface is needed. | Evidence that a public programmatic API needs CommonJS compatibility. |
| TypeScript | `tsc`, pinned in the lockfile | The target ecosystem requires TypeScript; the official compiler is the minimum build dependency. | A measured build or packaging need. |
| Test runner | `node:test` | The built-in runner supports the spike without a framework dependency. | Missing test features that materially improve the production suite. |
| Build tooling | `tsc` only | Phase 0 needs executable JavaScript and type checking, not bundling or publication. | Production CLI packaging or distribution requirements. |
| Source layout | `src/` and `test/` | A single package with direct source-to-test mapping is sufficient. | Multiple publishable packages or independently released adapters. |
| CLI framework | None | A production CLI is outside Phase 0. | Before implementing a real command surface. |
| Schema library | None | No public configuration schema is authorized in Phase 0. | When a candidate `ProjectConfig` fixture requires runtime validation. |
| Public configuration | Deferred | Syntax, filenames, and lock format require ownership and migration evidence. | After Phase 0 and before freezing any user-facing format. |

The Node.js support status is based on the [official Node.js release table](https://nodejs.org/en/about/previous-releases). The native project-instructions renderer adds no runtime dependency.
