# agentdevflow

Configure, validate, and compile portable software-development flows for coding agents.

## Status

`agentdevflow` has completed Phase 0 technical validation with a Go recommendation. It does not yet provide a production CLI, and its public API and configuration format are not stable.

The intended product is a local-first Node.js and TypeScript CLI distributed through npm and invoked with `npx agentdevflow`.

## Product direction

The project aims to let developers describe a development flow once and materialize compatible, reviewable configuration for multiple coding-agent products. It combines provider-neutral roles, policy validation, deterministic rendering, provenance, generated-file ownership, lock state, and drift diagnostics.

The long-term product is a development-flow configurator and policy compiler. It is not a general workflow runtime, autonomous multi-agent orchestrator, skills marketplace, MCP registry, or hosted control plane.

See [Product direction](docs/product-direction.md) and [Architecture](docs/architecture.md) for the retained product and technical boundaries.

## Phase 0 result

Phase 0 evaluated two questions in order:

1. Rulesync 9.6.3 can serve only as a pinned staging renderer behind an `agentdevflow` ownership and verification adapter.
2. A small finite-state validator detects direct and stale-evidence bypasses while accepting safe unbounded review cycles.

See [renderer evidence](docs/evidence/renderer-backend.md), [policy evidence](docs/evidence/policy-safety.md), and the [Phase 0 plan](docs/development/phase-0.md).

## Development

Requirements:

- Node.js 22 or newer;
- npm 11 or a compatible npm release.

Commands:

```bash
npm install
npm run build
npm test
npm run check
```

The scaffold intentionally uses no CLI framework, schema library, linter, or production runtime dependency. See [Tooling decisions](docs/development/tooling.md).

## Package naming

- Repository: `agentdevflow`
- Intended npm package: `agentdevflow`
- Intended CLI: `agentdevflow`

Package publication is outside Phase 0.
