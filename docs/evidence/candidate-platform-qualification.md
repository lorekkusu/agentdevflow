# Experimental write-ahead platform qualification

Snapshot date: 2026-07-17.

## Verdict

**Partially qualified for the stronger non-default contract.** Hosted run [29531413592](https://github.com/lorekkusu/agentdevflow/actions/runs/29531413592) passed all four Ubuntu and macOS cells and failed both Windows cells. Each passing cell completed the direct primitive probe, all 170 tests with zero skips, and the tracked-file check. Windows remains unqualified because directory-handle synchronization failed before the test suite started.

This evidence applies to the experimental write-ahead transaction and its directory-durability prerequisite. [ADR 0002](../decisions/0002-v1-forward-convergent-render-apply.md) selected a smaller forward-convergent V1 default with a separate [V1 platform qualification](v1-platform-qualification.md).

All matrix cells must pass before the corresponding operating-system and Node.js combination can become a support candidate. A failing cell is evidence to fix the implementation or defer that platform; it must not be converted into a passing result through `continue-on-error`, skipped interruption tests, or weaker synchronization behavior.

## Current primary-source basis

The official Node.js release table lists Node.js 22 and 24 as LTS and Node.js 26 as Current on the snapshot date. Production applications are advised to use Active or Maintenance LTS releases ([Node.js releases](https://nodejs.org/en/about/previous-releases)). The candidate matrix therefore exercises the current minimum line and the newer LTS line without adopting Current as a compatibility promise.

GitHub documents explicit standard runner labels for Ubuntu 24.04 x64, Windows 2025 x64, and macOS 15 arm64. It also notes that `-latest` identifies GitHub's latest stable image rather than necessarily the operating-system vendor's newest version ([GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)). The workflow uses explicit labels to make image changes reviewable.

GitHub recommends `setup-node` for consistent Node.js selection and matrix testing, and recommends `npm ci` for lockfile-based installation ([GitHub Node.js build guidance](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)). The official setup action supports explicit Node versions and recommends read-only contents permission ([actions/setup-node](https://github.com/actions/setup-node)).

## Candidate matrix

| Operating system image | Architecture | Node.js lines | Current status |
| --- | --- | --- | --- |
| `ubuntu-24.04` | x64 | 22, 24 | Qualified by run 29531413592 |
| `macos-15` | arm64 | 22, 24 | Qualified by run 29531413592 |
| `windows-2025` | x64 | 22, 24 | Failed directory synchronization in run 29531413592 |

This is a qualification matrix, not the final public support table. Linux arm64, macOS Intel, Windows arm64, older operating-system images, network filesystems, and self-hosted runners remain outside the candidate matrix.

## Workflow contract

Implementation:

- `.github/workflows/platform-qualification.yml`;
- `scripts/platform-probe.mjs`;
- `scripts/check-repository.mjs`;
- `test/transaction/private-transaction-subprocess.test.ts`;
- `test/workspace/private-filesystem-workspace.test.ts`;
- `test/transaction/private-transaction-store-lifecycle.test.ts`.

The workflow is retained as a manually dispatched experiment. Every matrix cell:

1. checks out one shallow revision without persisting credentials;
2. sets up the exact Node.js major line without package-manager caching;
3. runs `npm ci` with dependency lifecycle scripts, audit, and funding output disabled;
4. verifies the expected runtime platform, architecture, and Node.js major;
5. probes directory synchronization, synchronized temporary content, same-directory rename, hard links, symbolic links, case sensitivity, and forced child termination;
6. runs the complete repository audit, typecheck, build, and test suite through `npm run check:qualification`;
7. fails if tracked files changed.

The workflow has top-level `contents: read` permission. `actions/checkout` 6.0.2 and `actions/setup-node` 7.0.0 are pinned to full commit SHAs. The repository audit rejects non-SHA action references, `pull_request_target`, or missing top-level read-only contents permission.

## Portable termination contract

POSIX candidates request `SIGKILL`. Windows requests `SIGTERM`, which Node.js maps through its Windows child-process termination behavior. The test contract is forced owner-process termination followed by an observed exit, not identical operating-system signal implementation.

Transaction subprocess tests no longer skip Windows. A candidate platform must execute:

- all ten forward interruption boundaries;
- all eleven recovery mutation boundaries;
- stale-writer refusal and evidence-bound clearance;
- repository temporary-file reclamation;
- symlink-replacement refusal;
- retirement interruption;
- all three cleanup lifecycle boundaries.

## Local observation

The direct probe passed locally with:

```text
platform: darwin
architecture: arm64
Node.js: 24.14.0
directory sync: pass
same-directory rename: pass
hard link: pass
symbolic link: pass
case-sensitive lookup: false
forced termination: SIGKILL observed
```

The complete local suite passes 170 tests with zero skips. This remains useful developer evidence but does not substitute for a hosted cell because the image, Node.js line, and filesystem may differ.

## Hosted observation

Run [29531413592](https://github.com/lorekkusu/agentdevflow/actions/runs/29531413592) tested commit `483f3868e5d6399443e702eb9bf90ae267d19cb5` on 2026-07-16 UTC:

| Runner image | Image version | Node.js | Probe | Tests | Result |
| --- | --- | --- | --- | --- | --- |
| `ubuntu-24.04` x64 | `20260714.240.1` | `22.23.1` | Passed, including directory sync and `SIGKILL` observation | 170 passed, 0 failed, 0 skipped | Pass |
| `ubuntu-24.04` x64 | `20260714.240.1` | `24.18.0` | Passed, including directory sync and `SIGKILL` observation | 170 passed, 0 failed, 0 skipped | Pass |
| `macos-15-arm64` | `20260715.0234.1` | `22.23.1` | Passed, including directory sync and `SIGKILL` observation | 170 passed, 0 failed, 0 skipped | Pass |
| `macos-15-arm64` | `20260715.0234.1` | `24.18.0` | Passed, including directory sync and `SIGKILL` observation | 170 passed, 0 failed, 0 skipped | Pass |
| `windows-2025-vs2026` x64 | `20260714.173.1` | `22.23.1` | Directory `FileHandle.sync()` returned `EPERM` | Not run | Fail |
| `windows-2025-vs2026` x64 | `20260714.173.1` | `24.18.0` | Directory `FileHandle.sync()` returned `EPERM` | Not run | Fail |

The Windows result is a capability failure, not a test skip. The workflow remained blocking, and both affected jobs stopped at the primitive probe. File-content synchronization was not the failing operation; the failure occurred while synchronizing the opened workspace directory. The Node.js filesystem API documents `FileHandle.sync()` as an `fsync(2)` request, while Windows documents file-buffer flushing through `FlushFileBuffers` on an eligible file handle ([Node.js filesystem API](https://nodejs.org/api/fs.html), [Windows `FlushFileBuffers`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)). The observed hosted result is the basis for the project conclusion; the documentation links do not establish an equivalent directory-metadata primitive in Node.js on Windows.

## Pass and fail rules

A matrix cell passes only when the platform probe, `npm run check:qualification`, its mechanically enforced zero-skip expectation, and the tracked-file check all succeed in one run. Platform support remains unqualified until the hosted run URL, exact runner image, Node.js version, architecture, and test result are reviewed and recorded.

If a cell fails:

- preserve the failure log as observed evidence;
- identify whether the cause is the implementation, runner image, Node.js line, or test assumption;
- fix and rerun, or explicitly remove the platform from the release candidate;
- do not weaken directory synchronization, symlink refusal, ownership checks, or recovery assertions merely to obtain a green matrix.

## Limitations

- Windows process-termination behavior remains unqualified because its cells stopped before the zero-skip suite.
- GitHub-hosted images change over time even when their explicit labels remain stable; each qualification record must capture the resolved image metadata from the run.
- Default runner filesystems do not represent every local or network filesystem used by future users.
- Case-insensitive lookup is observed but case-folding and Unicode-equivalence collision policy remain unresolved.
- Forced process termination does not simulate sudden power loss, kernel panic, controller-cache loss, or filesystem corruption.
- The workflow does not test power-loss durability, network filesystems, installer behavior, package publication, or a production CLI.
- Passing this matrix alone must not freeze the public Node.js range or operating-system support policy.

## Recommendation

Retain this run as evidence for the stronger write-ahead option, including its Windows limitation. Do not use it as the release-candidate support decision for the smaller V1 path. Use the dedicated V1 matrix to qualify process-termination convergence without silently claiming directory or power-loss durability. A Windows-specific native durability dependency would materially increase maintenance and should not be introduced without a separate architecture decision.
