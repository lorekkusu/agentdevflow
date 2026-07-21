# agentdevflow

Configure, validate, and compile portable software-development flows for coding agents.

## Status

`agentdevflow` has completed Phase 0 technical validation with a Go recommendation. Phase 1 has private prototypes for project-intent parsing, policy compilation, native project-instructions rendering, ownership-aware application, domain workflows, and typed execution evidence.

The first beta CLI boundary is now accepted and executable for `init`, `diff`, exact approved `render`, `check`, and a caller-observation-based `doctor`. It uses project-local defaults, stable outcome classes, and bounded versioned JSON output. The release-preparation manifest and manually triggered publish workflow are qualified, and the protected `npm-publish` environment is configured without a publishing credential. No npm package has been published or reserved. Beta configuration and machine-output details may still change through documented migration before 1.0.

The intended product is a local-first Node.js and TypeScript CLI distributed through npm and invoked with `npx agentdevflow`.

## Product direction

The project aims to let developers describe a development flow once and materialize compatible, reviewable configuration for multiple coding-agent products. It combines provider-neutral roles, policy validation, deterministic rendering, provenance, generated-file ownership, lock state, and drift diagnostics.

The long-term product is a development-flow configurator and policy compiler. It is not a general workflow runtime, autonomous multi-agent orchestrator, skills marketplace, MCP registry, or hosted control plane.

See [Product direction](docs/product-direction.md) and [Architecture](docs/architecture.md) for the retained product and technical boundaries.

See the [initial beta CLI contract](docs/development/beta-cli-contract.md), [ADR 0004](docs/decisions/0004-initial-beta-public-surface.md), and [development roadmap](docs/development/roadmap.md) for the accepted boundary and remaining release work. The [project health assessment](docs/development/project-health.md) records the current sanitized scope and complexity findings.

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
- an experimental offline local entry for non-interactive revision-1 `init`, read-only `check`, exact `diff`, and exact approved `render` from explicit user paths;
- a bounded local `doctor` over explicit revisioned observations, with no live provider, credential, process, or network probes;
- an allowlisted private npm tarball and clean offline installation exercise for all five candidate command names;
- typed revision-bound execution evidence and one pure GitHub Check Runs mapping.

The accepted V1 apply path is the smaller staged forward-convergent implementation in [ADR 0002](docs/decisions/0002-v1-forward-convergent-render-apply.md). The stronger write-ahead transaction, strict execution transport, and GitHub mapper are frozen private research rather than the next product direction.

The selected V1 suite has candidate qualification across explicit Ubuntu, macOS, and Windows hosted runners on Node.js 22 and 24. This is test evidence, not a published support guarantee. See [V1 platform qualification](docs/evidence/v1-platform-qualification.md).

The npm candidate tarball has a local allowlist and one clean offline installed-bin exercise. This is qualification evidence, not a release. See [private package qualification](docs/evidence/private-package-qualification.md).

The initial beta defaults are `agentdevflow.config.jsonc` and `.agentdevflow/lock.json` in the selected repository root. The CLI does not search parent directories. Human-readable output is the default; `--json` emits schema version 1. Exit codes are `0` for success or clean state, `1` for reviewable changes or degraded observations, and `2` for blocked or invalid state.

## Development

Requirements:

- Node.js 22 or 24;
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
npm run phase1:local-cli -- --help
npm pack --dry-run --json
```

The project currently uses no CLI framework, linter, formatter, or bundler. It pins `jsonc-parser` and Zod behind bounded configuration boundaries. See [Tooling decisions](docs/development/tooling.md), [ADR 0003](docs/decisions/0003-private-jsonc-zod-boundary.md), and the [beta CLI contract](docs/development/beta-cli-contract.md).

See [Contributing](CONTRIBUTING.md) and the [public information policy](docs/development/public-information-policy.md) before opening a change or decision proposal. Repository records preserve useful technical context without storing prompts, conversation transcripts, or private deliberation.

Release preparation follows the [beta release checklist](docs/development/release-checklist.md). See the [changelog](CHANGELOG.md) for the candidate user-visible surface and limitations.

## Package naming

- Repository: `agentdevflow`
- Intended npm package: `agentdevflow`
- Intended CLI: `agentdevflow`

The candidate package version is `0.1.0-beta.1`, licensed under Apache-2.0 and intended for npm's `next` tag with provenance. Package publication remains separately gated and unauthorized.
