# V1 platform qualification

Snapshot date: 2026-07-20.

## Verdict

**All six candidate cells requalified with the private initialization path.** Hosted run [29741641490](https://github.com/lorekkusu/agentdevflow/actions/runs/29741641490) passed Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 on Node.js 22 and 24. Every cell passed its V1 primitive probe, 154 selected tests with zero skips, and the tracked-file check. The designated Ubuntu and Node.js 24 cell also passed the complete 254-test stronger regression suite.

This qualification is intentionally separate from the stronger experimental write-ahead transaction. It tests the primitives and behavior required by [ADR 0002](../decisions/0002-v1-forward-convergent-render-apply.md) without requiring directory synchronization or hard links.

## Candidate matrix

| Operating-system image | Architecture | Node.js lines | Current status |
| --- | --- | --- | --- |
| `ubuntu-24.04` | x64 | 22, 24 | Requalified by run 29741641490 |
| `macos-15` | arm64 | 22, 24 | Requalified by run 29741641490 |
| `windows-2025` | x64 | 22, 24 | Requalified by run 29741641490 |

The matrix is a release-candidate experiment, not a public support table. Linux arm64, macOS Intel, Windows arm64, older operating-system images, network filesystems, and self-hosted runners remain outside its scope.

## Implementation and reproduction

Implementation:

- `.github/workflows/v1-platform-qualification.yml`;
- `.gitattributes`;
- `scripts/v1-platform-probe.mjs`;
- `scripts/run-v1-platform-tests.mjs`;
- `test/renderer/private-convergent-apply.test.ts`;
- `test/renderer/private-convergent-subprocess.test.ts`.

Run the local candidate checks from the repository root:

```bash
npm run build
node scripts/v1-platform-probe.mjs
node scripts/run-v1-platform-tests.mjs
npm run check:v1-qualification
```

Every hosted matrix cell:

1. checks out one shallow revision without persisting credentials;
2. selects the exact Node.js major line without package-manager caching;
3. installs the lockfile with lifecycle scripts, audit, and funding output disabled;
4. verifies the expected platform, architecture, and Node.js major;
5. probes the V1 filesystem and process-termination primitives;
6. runs the explicitly selected V1 suite with a mechanically enforced zero-skip result;
7. fails if tracked files change.

One designated Ubuntu 24.04 and Node.js 24 cell also runs the complete stronger `npm run check:qualification` suite. This preserves regression coverage without making the stronger write-ahead filesystem prerequisites part of every V1 platform cell.

The workflow has top-level `contents: read` permission. Checkout and Node setup actions use full commit SHA references. The repository audit rejects non-SHA action references, privileged pull-request triggers, or missing top-level read-only contents permission.

## V1 primitive contract

The direct probe requires:

- synchronized regular-file content;
- same-directory rename replacement over an existing target;
- symbolic-link creation and inspection so unsafe traversal can be rejected;
- forced child-process termination and an observed exit.

POSIX candidates request `SIGKILL`. Windows requests `SIGTERM`, following Node.js child-process behavior on that platform. The portable contract is forced owner-process termination followed by an observed exit, not identical operating-system signal semantics.

The V1 path does not require:

- directory-handle synchronization;
- hard-link publication;
- power-loss durability;
- atomic multi-file publication.

Those are not silent omissions. They belong to the stronger experimental transaction or to future explicitly accepted durability work.

## Selected test contract

The selector discovers compiled test files, excludes only the five complete strong-transaction test files listed below, requires the V1 apply and subprocess files to be present, and fails on any skipped test.

Explicit source-test exclusions:

- `test/transaction/private-transaction-executor.test.ts`;
- `test/transaction/private-transaction-store-lifecycle.test.ts`;
- `test/transaction/private-transaction-store.test.ts`;
- `test/transaction/private-transaction-subprocess.test.ts`;
- `test/workspace/private-filesystem-workspace.test.ts`.

These exclusions isolate requirements that are not part of the accepted V1 contract, including directory synchronization, hard links, the write-ahead store, and its cleanup lifecycle. They must not be expanded silently. The selector mechanically requires the V1 recovery tests so a missing or renamed recovery suite cannot produce a false pass.

## Local observation

The direct probe passed locally on Darwin arm64 with Node.js 24.14.0:

```text
file sync: pass
rename replacement: pass
symbolic link: pass
case-sensitive lookup: false
forced termination: SIGKILL observed
directory sync required: false
hard link required: false
```

The current selected V1 suite discovers 22 compiled test files and passes 154 tests with zero failures and zero skips. The complete local repository suite passes 254 tests with zero failures and zero skips. These observations are developer evidence only; they do not substitute for hosted cells with recorded runner images and Node.js versions.

## First hosted observation

Run [29643493317](https://github.com/lorekkusu/agentdevflow/actions/runs/29643493317) tested commit `df150c7dd57955fb8b415aaaee14d50436030058` on 2026-07-18 UTC:

| Runner image | Image version | Node.js | Probe | Selected tests | Result |
| --- | --- | --- | --- | --- | --- |
| `ubuntu-24.04` x64 | `20260714.240.1` | `22.23.1` | Passed | 103 passed, 0 failed, 0 skipped | Pass |
| `ubuntu-24.04` x64 | `20260714.240.1` | `24.18.0` | Passed | 103 passed, 0 failed, 0 skipped; complete 202-test regression also passed | Pass |
| `macos-15-arm64` | `20260715.0234.1` | `22.23.1` | Passed | 103 passed, 0 failed, 0 skipped | Pass |
| `macos-15-arm64` | `20260715.0234.1` | `24.18.0` | Passed | 103 passed, 0 failed, 0 skipped | Pass |
| `windows-2025-vs2026` x64 | `20260714.173.1` | `22.23.1` | Passed, including rename replacement and `SIGTERM` observation | 86 passed, 17 failed, 0 skipped | Fail |
| `windows-2025-vs2026` x64 | `20260714.173.1` | `24.18.0` | Passed, including rename replacement and `SIGTERM` observation | 86 passed, 17 failed, 0 skipped | Fail |

The Windows failures had two observed causes:

- reopening a retained regular temporary file with `O_NOFOLLOW` returned `EINVAL`; the fresh exclusive-create path and the direct primitive probe succeeded;
- Git checkout converted golden Markdown fixtures to CRLF while the renderer correctly produced deterministic LF output.

The focused repair removes the unsupported reopen operation by unlinking an inspected regular temporary file and recreating it with exclusive creation. A symbolic link or non-file still fails during inspection, and a competing creation still fails closed through `O_EXCL`. Repository text checkout is fixed to LF through `.gitattributes`.

## Replacement hosted observation

Run [29643865692](https://github.com/lorekkusu/agentdevflow/actions/runs/29643865692) tested repair commit `43e89f185d82d6ac08d2931264ba0c359e3c4b4b` on 2026-07-18 UTC:

| Runner image | Image version | Node.js | Probe | Selected tests | Result |
| --- | --- | --- | --- | --- | --- |
| `ubuntu-24.04` x64 | `20260714.240.1` | `22.23.1` | Passed | 103 passed, 0 failed, 0 skipped | Pass |
| `ubuntu-24.04` x64 | `20260714.240.1` | `24.18.0` | Passed | 103 passed, 0 failed, 0 skipped; complete 202-test regression also passed with zero skips | Pass |
| `macos-15-arm64` | `20260715.0234.1` | `22.23.1` | Passed | 103 passed, 0 failed, 0 skipped | Pass |
| `macos-15-arm64` | `20260715.0234.1` | `24.18.0` | Passed | 103 passed, 0 failed, 0 skipped | Pass |
| `windows-2025-vs2026` x64 | `20260714.173.1` | `22.23.1` | Passed, including rename replacement and `SIGTERM` observation | 103 passed, 0 failed, 0 skipped | Pass |
| `windows-2025-vs2026` x64 | `20260714.173.1` | `24.18.0` | Passed, including rename replacement and `SIGTERM` observation | 103 passed, 0 failed, 0 skipped | Pass |

The replacement run confirms both focused portability repairs without skipping a V1 recovery test or weakening the primitive contract. The first failed run remains recorded because it explains the evidence-backed implementation change.

## Initialization-path regression and requalification

Run [29741256136](https://github.com/lorekkusu/agentdevflow/actions/runs/29741256136) tested private approved-initialization bridge commit `e2633e9868457dbc06cc8e43958e5c4062f5af5c` on 2026-07-20 UTC. Both Ubuntu cells and both macOS cells passed. Both Windows cells passed the primitive probe but failed the same read-only initialization integration test with 153 of 154 selected tests passing and zero skips. Opening the full filesystem workspace attempted directory synchronization before the service read any file, and Windows returned `EPERM`.

The repair introduced a narrow read-only workspace view. It retains root containment, canonical relative-path, symbolic-link, and regular-file checks, exposes no mutation methods, and does not request directory synchronization. The strict mutating workspace continues to require its existing durability primitives; the repair separates observation requirements from write durability rather than weakening mutation behavior.

Run [29741641490](https://github.com/lorekkusu/agentdevflow/actions/runs/29741641490) tested repair commit `13b0b3ecb29be8663b8ea33264bf777f0c69d657` on 2026-07-20 UTC:

| Runner image | Image version | Node.js | Probe | Selected tests | Result |
| --- | --- | --- | --- | --- | --- |
| `ubuntu-24.04` x64 | `20260714.240.1` | `22.23.1` | Passed | 154 passed, 0 failed, 0 skipped | Pass |
| `ubuntu-24.04` x64 | `20260714.240.1` | `24.18.0` | Passed | 154 passed, 0 failed, 0 skipped; complete 254-test regression also passed with zero skips | Pass |
| `macos-15-arm64` | `20260715.0234.1` | `22.23.1` | Passed | 154 passed, 0 failed, 0 skipped | Pass |
| `macos-15-arm64` | `20260715.0234.1` | `24.18.0` | Passed | 154 passed, 0 failed, 0 skipped | Pass |
| `windows-2025-vs2026` x64 | `20260714.173.1` | `22.23.1` | Passed, including rename replacement and `SIGTERM` observation | 154 passed, 0 failed, 0 skipped | Pass |
| `windows-2025-vs2026` x64 | `20260714.173.1` | `24.18.0` | Passed, including rename replacement and `SIGTERM` observation | 154 passed, 0 failed, 0 skipped | Pass |

The requalification covers the complete private initialization observation and approved render bridge without adding a Windows skip or making directory synchronization a V1 read requirement.

## Qualification record requirements

For each cell, record:

- the workflow run URL and tested commit digest;
- the resolved runner image and architecture;
- the exact Node.js version;
- the primitive-probe output;
- the selected test count, failures, and skips;
- the tracked-file check result;
- the complete-suite result for the designated Ubuntu and Node.js 24 cell.

A cell passes only when all required steps succeed in one run. A failure must remain visible evidence and be diagnosed as an implementation, runner, runtime, filesystem, or test-contract issue. Do not use `continue-on-error`, skip recovery tests, or weaken ownership and symlink checks to obtain a green matrix.

## Limitations

- Process termination does not simulate sudden power loss, kernel panic, controller-cache loss, or filesystem corruption.
- GitHub-hosted images change while their explicit labels remain stable; qualification must capture resolved image metadata.
- Default runner filesystems do not represent every local or network filesystem.
- Case sensitivity is observed, but cross-platform case-folding and Unicode-equivalence collision policy remain unresolved.
- The workflow does not test package publication, installer behavior, a production CLI, or public configuration compatibility.
- Passing this matrix must not freeze a public Node.js or operating-system support policy.

## Recommendation

Use the six qualified cells as the initial V1 support candidates for command-service development. Keep the public release support policy open until packaging and CLI evidence exists, and requalify after material filesystem, recovery, Node.js-range, or runner changes. Do not reintroduce the stronger directory-durability contract without a separately accepted requirement.
