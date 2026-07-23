# Working-tree package qualification

Snapshot date: 2026-07-23.

## Verdict

**Pass for the current working-tree package candidate on the tested local
environment.** The packed and installed CLI exercises the bounded product
surface, including responsibility-specific guidance and both accepted workflow
families.

This is not publication authorization, registry-installation evidence, a new
release, or a claim about the already published package. The manifest still
contains version `0.1.0-beta.2`, but the working tree has different behavior
and bytes from that release. It must not be published under the same version.
A separate version and release decision is required.

## Environment

| Component | Observed version |
| --- | --- |
| Operating system | Darwin |
| Node.js | `24.18.0` |
| npm | `11.16.0` |

This local observation does not establish a platform support matrix.

## Repository qualification

The converged working tree completed:

```text
npm run check
npm run check:v1-qualification
```

Both commands passed. The complete automated test set contained 203 tests with
203 passes, zero failures, zero skips, and zero todos. The V1 qualification
selector discovered the full current test set, required the retained recovery
tests, and produced the same result.

## Installed entrypoint qualification

`npm run check:package-entrypoint` built and packed the working tree, installed
the tarball into isolated temporary projects, and invoked the installed
`agentdevflow` bin. The exercise covered:

- `init -> changing diff -> exact-approved render -> clean check`;
- the local reviewed-change workflow;
- a Linear-backed ready-pull-request workflow;
- a GitHub Issues-backed draft-pull-request workflow;
- draft-to-ready procedure generation;
- optional canonical guidance under `.agentdevflow/rules/`;
- materially different Codex, Claude Code, and Cursor outputs;
- generated-file drift and deletion diagnostics;
- symbolic-link refusal; and
- an empty diff after successful convergence.

The qualification uses synthetic local fixtures. It does not connect to
trackers, GitHub, provider services, credentials, or a network.

## Tarball boundary

`npm pack --dry-run --json` passed and reported:

| Property | Observation |
| --- | --- |
| Compressed size | 107,961 bytes |
| Unpacked size | 550,339 bytes |
| Entry count | 116 |
| SHA-1 | `530b79ff1f07f2c50d73402b28a85bc3d14f9546` |
| npm integrity | `sha512-XM8oVyWDUKwdIjB29n9YmdvbGEtNxSllxU6ANJscKaoHR91+GZh7gd9EGI6tvsyF+sWSfjelZ5PJHSy+D1785g==` |
| CLI target mode | `0755` |

The package uses a manifest allowlist. It contains the runtime guidance,
compiler, renderer, command, workflow, and workspace modules required by the
CLI. It excludes tests, fixtures, research evidence, development scripts,
provider clients, experiments, transaction machinery, execution transport, and
external-system adapters.

The digest binds only this exact working-tree specimen. Reproducible builds
across machines are not claimed.

## Dependency advisory observation

`npm audit --json` reported zero known vulnerabilities at every severity for
the installed dependency graph at the snapshot time. This is point-in-time
registry advisory matching, not proof that the package or its dependencies are
vulnerability-free.

## Reproduction

Run from the repository root with the supported toolchain installed:

```bash
npm install
npm run check
npm run check:v1-qualification
npm run check:package-entrypoint
npm pack --dry-run --json
npm audit --json
```

The package-entrypoint command creates and removes its own temporary
directories. It does not publish or mutate external project state.

## Limits and remaining gates

- The installed package was exercised locally on Darwin and Node.js 24.18.0.
- Tracker, pull-request, CI, review, and merge behavior is emitted as advisory
  procedure text; this qualification does not execute those systems.
- Provider comprehension is recorded separately as maintainer dogfood
  evidence and is not a deterministic package property.
- Arbitrary legacy instruction merging is not supported.
- Initial independent closure review findings were addressed and the focused
  closure review passed without a remaining actionable finding.
- No npm publication, tag, release, registry round trip, provenance statement,
  or rollback exercise occurred.

## Recommendation

Use this snapshot as the package evidence for the current milestone. Complete
exact-commit CI before making a release or version decision.
