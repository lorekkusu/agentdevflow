# agentdevflow

Configure, validate, and compile portable software-development flows for coding agents.

## Status

`agentdevflow` has completed Phase 0 technical validation with a Go recommendation. Phase 1 has private prototypes for project-intent parsing, policy compilation, native project-instructions rendering, ownership-aware application, command semantics, domain workflows, and typed execution evidence.

These components do not yet form a production CLI. The package is private, has no executable `bin`, and has no stable public API, configuration format, filename, lock format, or migration contract. Revision-1 configuration bytes now reach authoritative workflow compilation, native provider-instructions staging, canonical lock observation, and an exact read-only render plan without an execution manifest. The current work exposes that private local path through experimental `check`, `diff`, and explicit `render` commands.

The intended product is a local-first Node.js and TypeScript CLI distributed through npm and invoked with `npx agentdevflow`.

## Product direction

The project aims to let developers describe a development flow once and materialize compatible, reviewable configuration for multiple coding-agent products. It combines provider-neutral roles, policy validation, deterministic rendering, provenance, generated-file ownership, lock state, and drift diagnostics.

The long-term product is a development-flow configurator and policy compiler. It is not a general workflow runtime, autonomous multi-agent orchestrator, skills marketplace, MCP registry, or hosted control plane.

See [Product direction](docs/product-direction.md) and [Architecture](docs/architecture.md) for the retained product and technical boundaries.

See the [development roadmap](docs/development/roadmap.md) for the current, next, later, and frozen work. The [project health assessment](docs/development/project-health.md) records the current sanitized scope and complexity findings. Candidate decisions are not stable public contracts.

## Phase 0 result

Phase 0 evaluated two questions in order:

1. A narrow staging boundary can safely isolate renderer output; the accepted implementation is a minimal native project-instructions renderer for Codex, Claude Code, and Cursor, with Rulesync retained only as an external experimental oracle.
2. A small finite-state validator detects direct and stale-evidence bypasses while accepting safe unbounded review cycles.

See [renderer evidence](docs/evidence/renderer-backend.md), [policy evidence](docs/evidence/policy-safety.md), and the [Phase 0 plan](docs/development/phase-0.md).

Phase 1 has validated:

- deterministic private Fast and Balanced configuration and compiler specimens;
- native project-wide instructions for Codex, Claude Code, and Cursor;
- ownership, drift, lock, and staged forward-convergent apply behavior;
- isolated private `check`, `diff`, `render`, `doctor`, and `init` semantics;
- an issue-to-reviewed-pull-request workflow and a local no-pull-request contrast;
- bounded revision-1 project intent, JSONC parsing, preset expansion, and runtime schema validation;
- direct revision-1 project-instructions materialization with optional downstream execution-manifest export;
- deterministic local configuration-to-plan preparation from repository and canonical lock bytes;
- typed revision-bound execution evidence and one pure GitHub Check Runs mapping.

The accepted V1 apply path is the smaller staged forward-convergent implementation in [ADR 0002](docs/decisions/0002-v1-forward-convergent-render-apply.md). The stronger write-ahead transaction, strict execution transport, and GitHub mapper are frozen private research rather than the next product direction.

The selected V1 suite has candidate qualification across explicit Ubuntu, macOS, and Windows hosted runners on Node.js 22 and 24. This is test evidence, not a published support guarantee. See [V1 platform qualification](docs/evidence/v1-platform-qualification.md).

## Development

Requirements:

- Node.js 22 or newer;
- npm 11 or a compatible npm release.

Commands:

```bash
npm install
npm run build
npm test
npm run check:repository
npm run check
npm run check:v1-qualification
npm run phase1:config
npm run phase1:compiler
npm run phase1:project-document
npm run phase1:project-resolution
```

The project currently uses no CLI framework, linter, formatter, or bundler. It pins `jsonc-parser` and Zod behind private configuration boundaries; these dependencies do not make the current private schema a public contract. See [Tooling decisions](docs/development/tooling.md) and [ADR 0003](docs/decisions/0003-private-jsonc-zod-boundary.md).

See [Contributing](CONTRIBUTING.md) and the [public information policy](docs/development/public-information-policy.md) before opening a change or decision proposal. Repository records preserve useful technical context without storing prompts, conversation transcripts, or private deliberation.

## Package naming

- Repository: `agentdevflow`
- Intended npm package: `agentdevflow`
- Intended CLI: `agentdevflow`

Package publication is outside Phase 0.
