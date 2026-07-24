# Working-tree package qualification

Snapshot date: 2026-07-24.

## Verdict

**Pass for the repository-wide health-gate package candidate on the tested
local environment.** The candidate is derived from merged base
`dc9ee9b19f7b860809d40458b9c25acadd582a7e`. The packed and installed CLI
exercises the bounded product surface, including the fixed init-first journey,
responsibility-filtered guidance, and both accepted workflow families.

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

Both commands passed. The complete automated test set contained 245 tests with
245 passes, zero failures, zero skips, and zero todos. The V1 qualification
selector discovered the full current test set, required the retained recovery
tests, and produced the same result.

## Installed entrypoint qualification

`npm run check:package-entrypoint` built and packed the working tree, installed
the tarball into isolated temporary projects, and invoked the installed
`agentdevflow` bin. The exercise covered:

- `init -> changing diff -> exact-approved render -> clean check`;
- the fixed `init -> onboard -> rule as needed -> diff -> render -> check`
  journey;
- fail-closed pre-init onboarding and rule operations;
- empty-project and exact existing-target onboarding;
- the local reviewed-change workflow;
- a Linear-backed ready-pull-request workflow;
- a GitHub Issues-backed draft-pull-request workflow;
- idempotent draft-to-ready procedure generation;
- optional canonical guidance under `.agentdevflow/rules/`;
- byte-different Codex, Claude Code, and Cursor outputs whose procedure and
  rule sections matched the configured responsibilities;
- exact target-product and provider-id declarations plus whole-projection
  nonmatching-product applicability instructions in every generated target;
- generated-file drift, deletion diagnostics, and ownership-only cleanup when
  an obsolete output is already absent;
- symbolic-link refusal; and
- an empty diff after successful convergence.

The qualification uses synthetic local fixtures. It does not connect to
trackers, GitHub, provider services, credentials, or a network.

## Tarball boundary

`npm pack --dry-run --json` passed and reported:

| Property | Observation |
| --- | --- |
| Compressed size | 75,598 bytes |
| Unpacked size | 371,069 bytes |
| Entry count | 45 |
| SHA-1 | `cee4e844ff581f7855049b0ad4de9860f2a7b441` |
| npm integrity | `sha512-aQtNm7nlvmAy1XpoHafml0odxx1TQeHVb/pg6Hh2eWVHY68akCQghBVvg4TB5zQYs/cXBpIQ5clOG5QsjdZR5g==` |
| CLI target mode | `0755` |

The package uses a manifest allowlist. It contains the runtime guidance,
compiler, renderer, command, workflow, and workspace modules required by the
CLI. It excludes tests, fixtures, research evidence, development scripts,
provider clients, experiments, transaction machinery, execution transport,
external-system adapters, TypeScript declarations, and source maps. The
package exposes no programmatic entrypoint.

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
- The repository-wide health review separately records current findings and
  dispositions; this document is package evidence rather than a review verdict.
- No npm publication, tag, release, registry round trip, provenance statement,
  or rollback exercise occurred.

## Recommendation

Use this snapshot as local package evidence for the health-gate candidate.
Hosted pull-request checks must still pass for the final exact tree before this
change is merged. A release or version decision remains separate.
