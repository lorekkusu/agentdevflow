# V1 platform qualification

Snapshot date: 2026-07-17.

## Verdict

**Prepared, not hosted-qualified.** The repository contains a dedicated six-cell qualification workflow for the accepted V1 forward-convergent apply path. The local candidate suite passes, but no hosted result exists for the current working tree. No operating-system and Node.js combination should be described as V1-qualified until an authorized pushed commit completes the hosted matrix and the resolved environments are recorded here.

This qualification is intentionally separate from the stronger experimental write-ahead transaction. It tests the primitives and behavior required by [ADR 0002](../decisions/0002-v1-forward-convergent-render-apply.md) without requiring directory synchronization or hard links.

## Candidate matrix

| Operating-system image | Architecture | Node.js lines | Current status |
| --- | --- | --- | --- |
| `ubuntu-24.04` | x64 | 22, 24 | Prepared; hosted result required |
| `macos-15` | arm64 | 22, 24 | Prepared; hosted result required |
| `windows-2025` | x64 | 22, 24 | Prepared; hosted result required |

The matrix is a release-candidate experiment, not a public support table. Linux arm64, macOS Intel, Windows arm64, older operating-system images, network filesystems, and self-hosted runners remain outside its scope.

## Implementation and reproduction

Implementation:

- `.github/workflows/v1-platform-qualification.yml`;
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

The selected V1 suite discovered 14 compiled test files and passed 103 tests with zero failures and zero skips. The complete local repository suite also passed 202 tests with zero failures and zero skips. These observations are developer evidence only; they do not substitute for hosted cells with recorded runner images and Node.js versions.

## Hosted evidence required

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

Run the matrix from one explicitly authorized pushed commit and record the six hosted outcomes before selecting the initial V1 support candidates. If Windows fails a required V1 primitive, diagnose or defer Windows explicitly. Do not reintroduce the stronger directory-durability contract merely to preserve a predetermined provider or platform claim.
