# 0004: Initial beta public surface

Status: Accepted

Date: 2026-07-21

## Context

The qualified local package connects bounded project configuration, policy compilation, native project-instructions rendering, ownership-aware planning, read-only inspection, exact approval, and forward-convergent application. Publication still requires a small explicit public boundary so that private prototype names and paths do not become compatibility promises by accident.

The first beta must remain local-first, provider-neutral, and replaceable. It must not imply a workflow scheduler, live integration runtime, arbitrary public workflow language, or automatic issue, pull-request, review, merge, or release authority.

## Decision

The initial beta adopts these public boundaries:

- The project is licensed under Apache License 2.0. The repository root contains the canonical `LICENSE` text. A separate `NOTICE` file is added only when the distributed work contains attribution notices that require one.
- Supported Node.js release lines are 22 and 24. The package engine range expresses those two majors rather than every later Node.js release.
- The default project configuration path is `agentdevflow.config.jsonc` at the selected repository root. Commands inspect only that exact root and do not search parent directories. `--repository` and `--config` provide explicit overrides.
- The default tool-owned lock path is `.agentdevflow/lock.json` below the selected repository root. `--lock` provides an explicit repository-relative override. Lock bytes remain an implementation-owned versioned format rather than a user-authored API.
- `ProjectConfig` is the intended user-facing configuration concept. The beta exposes only built-in workflow families. A general `WorkflowDefinition` and arbitrary workflow topology remain experimental and non-public.
- The command set is `init`, `render`, `diff`, `check`, and `doctor`. Exit code `0` means success or clean state, `1` means reviewable changes or degraded observations, and `2` means invalid, blocked, unsafe, or unexpected failure.
- Human-readable output is the default. `--json` uses an explicitly versioned bounded envelope. Beta fields may evolve through documented migration; secret, credential, and unrecognized foreign file bytes are never output.
- The first release candidate is `0.1.0-beta.1`, published under the npm `next` distribution tag with package provenance. Publication remains separately authorized, and the current manifest remains mechanically non-publishable until that authorization.
- Node.js built-ins remain sufficient for command parsing until measured usability requirements justify a CLI framework.

The detailed executable behavior belongs in the beta CLI contract and tests. This ADR accepts the boundary, not every private type name, diagnostic wording, JSON field, lock byte, or configuration field as a permanent 1.0 guarantee.

## Consequences

Users receive predictable project-local discovery without hidden parent-directory influence. Automation receives stable outcome classes and a versioned machine-output boundary. The package can be tested on the same Node.js majors used by qualification before publication.

The project must provide migration notes for incompatible beta configuration or machine-output changes. Supporting only built-in workflow families limits early extensibility but prevents the compiler's private finite-state representation from becoming an accidental public DSL.

The package remains blocked from publication until a separate release review confirms package ownership, public repository metadata, provenance configuration, tarball contents, supported-platform checks, security review, and explicit publish authority.

## Alternatives considered

- Parent-directory configuration search was rejected for the initial beta because it introduces hidden scope and precedence. It can be reconsidered with explicit workspace semantics.
- Supporting every Node.js release greater than or equal to 22 was rejected because odd and unqualified future majors would become accidental support claims.
- Publishing directly on npm's `latest` tag was rejected because prerelease users must opt into the beta.
- Exposing the private finite-state model as a public workflow language was rejected because its safety representation and migration requirements are not yet stable.
- Adding a CLI framework was deferred because the current five-command surface does not yet demonstrate a requirement that outweighs another production dependency.

## Evidence

- [Private package qualification](../evidence/private-package-qualification.md)
- [Private local CLI evidence](../evidence/private-local-cli.md)
- [V1 platform qualification](../evidence/v1-platform-qualification.md)
- [Apache guidance for applying Apache License 2.0](https://www.apache.org/legal/apply-license)
- [Apache License 2.0 canonical text](https://www.apache.org/licenses/LICENSE-2.0.txt)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [npm distribution-tag guidance](https://docs.npmjs.com/adding-dist-tags-to-packages/)
- [npm provenance guidance](https://docs.npmjs.com/generating-provenance-statements/)
- [npm trusted publishing guidance](https://docs.npmjs.com/trusted-publishers/)

## Security and disclosure considerations

Project-local discovery reduces unintended configuration inheritance. Explicit paths remain subject to repository-root, traversal, symlink, and regular-file checks before they can affect managed files. Render authority remains bound to an exact reviewed plan and a fresh reread.

Machine output must remain bounded. Recognized managed bytes may be shown by `diff`; blocked or foreign state must not disclose unrecognized file content. Provenance binds an npm artifact to a supported build environment but does not replace source review, dependency review, account protection, or release authorization.

## Revisit triggers

- A real monorepo use case requires deterministic nested scope or parent discovery.
- Node.js changes release status or qualification exposes a major-specific failure.
- Machine-output consumers require a field that cannot be added compatibly.
- A second lock location or migration consumer requires accepted discovery and migration rules.
- Built-in workflows cannot represent a validated use case without a public extension boundary.
- CLI usability evidence justifies a framework dependency.

## Supersedes

None.
