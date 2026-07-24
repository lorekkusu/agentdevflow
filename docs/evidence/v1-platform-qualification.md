# V1 platform qualification

Snapshot updated: 2026-07-23.

## Historical hosted result

GitHub Actions run [29801066651](https://github.com/lorekkusu/agentdevflow/actions/runs/29801066651)
passed the original V1 matrix on Ubuntu 24.04 x64, macOS 15 arm64, and Windows
2025 x64 with Node.js 22 and 24. That run qualified the published beta.2
candidate and is historical evidence, not proof for later working-tree changes.

## Most recent merged-tree result

GitHub Actions run
[30067879491](https://github.com/lorekkusu/agentdevflow/actions/runs/30067879491)
passed pull request 15 on all six cells at head commit
`340f484bdf8ef69bfb022dd58bc08f1d4fe4bc01`. That commit and merged `main`
commit `dc9ee9b19f7b860809d40458b9c25acadd582a7e` have the same Git tree
`4278390982303bda5a0218fc681ed18b9c39eb65`.

Every cell passed the platform probe, zero-skip qualification, installed
package entrypoint exercise, and tracked-file cleanliness check. Later commits
remain subject to their own required checks.

## Current qualification contract

`.github/workflows/v1-platform-qualification.yml` retains the same six cells:

| Runner | Architecture | Node.js |
| --- | --- | --- |
| `ubuntu-24.04` | x64 | 22, 24 |
| `macos-15` | arm64 | 22, 24 |
| `windows-2025` | x64 | 22, 24 |

Each cell:

1. installs the exact lockfile without lifecycle scripts;
2. checks the expected platform, architecture, Node major, UTF-8 file I/O,
   rename replacement, same-directory hard-link publication for exclusive
   creation, and child-process termination;
3. runs `npm run check:v1-qualification` with zero skipped tests;
4. packs and exercises the installed npm entrypoint;
5. verifies that tracked files remain unchanged.

The test selector discovers the complete compiled test set, requires the two
forward-convergence recovery suites, and fails if any selected test is skipped.
There is no separate strong-transaction suite or platform workflow.

## Reproduction

From the repository root:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check:v1-qualification
npm run check:package-entrypoint
```

The platform probe is run by CI with explicit expected values:

```bash
node scripts/v1-platform-probe.mjs \
  --expected-platform <platform> \
  --expected-architecture <architecture> \
  --expected-node-major <major>
```

## Scope

This evidence covers the supported local beta primitives and current tests on
the named GitHub-hosted runner images. It does not promise every operating
system version, architecture, filesystem, container, network filesystem, or
self-hosted runner.

The apply path provides complete planning, exact approval, same-directory
single-file replacement, process-interruption rerun, before-or-after digest
convergence, hard-link-based exclusive state creation, and lock-last
publication. It does not claim cross-file atomicity, automatic rollback,
directory or power-loss durability, or hostile-writer exclusion.

Changes after the current candidate run require a new protected CI pass before
a later release can cite exact-commit hosted qualification.
