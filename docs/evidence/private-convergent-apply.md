# Private forward-convergent apply evidence

Snapshot date: 2026-07-18.

## Verdict

**Pass on the tested local Darwin environment.** The accepted V1 executor applies exact staged render plans through before-or-after digest convergence, deterministic same-directory temporary files, synchronized file content, and rename replacement. It converges after cooperative faults and real `SIGKILL` termination at every instrumented write boundary, handles deletes before and after unlink, and fails closed on foreign managed-path content.

This evidence does not qualify Windows or Linux and does not claim directory durability or power-loss behavior.

## Reproduction

Implementation:

- `src/renderer/private-convergent-apply.ts`;
- `src/workspace/private-convergent-intent.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/renderer/private-convergent-apply.test.ts`;
- `test/renderer/private-convergent-subprocess.test.ts`;
- `test/fixtures/renderer/private-convergent-subprocess-worker.ts`.

Run:

```bash
npm install
npm run check
```

The complete local suite contains 202 tests at this snapshot.

## Observed boundaries

The fixture renders native Codex, Claude Code, and Cursor project instructions. For each target, cooperative and child-process fixtures interrupt:

1. after deterministic temporary-file exclusive creation or recreation;
2. after target content and file synchronization;
3. after same-directory rename replacement;
4. after target digest verification.

Every resumed apply reaches exact target bytes and leaves no convergent temporary file. A subsequent repeated apply writes and removes nothing.

Delete fixtures interrupt immediately before unlink and after absence verification. Both resume to exact target absence without changing retained output.

## Preconditions and drift

Before mutation, every managed path must equal either its plan-bound before digest or after digest. A separate fixture changes `CLAUDE.md` to foreign content before apply. The executor reports `CONVERGENT_PATH_DRIFT` and leaves the other two targets absent.

Each path is read again before its mutation. A cooperative concurrent change can therefore stop later work, but earlier completed paths remain visible and require the same exact plan for a future rerun.

## Temporary ownership

The temporary path is a deterministic function of private revision, plan digest, target path, and target digest. A regular partial file at that exact reserved path is removed and recreated exclusively from the plan. A symbolic link at the same path is rejected without following it, and a competing creation fails closed.

This is cooperative namespace ownership. It cannot distinguish a hostile regular-file replacement at the exact reserved path from interrupted staging. The threat is outside the accepted V1 contract.

## Filesystem boundary

The process-termination workspace retains root canonicalization, safe relative paths, existing symbolic-link refusal, regular-file leaves, exclusive initial temporary creation, content synchronization, and same-directory rename. It omits directory synchronization and therefore avoids silently inheriting the stronger prototype's unsupported Windows prerequisite.

The evidence establishes recovery after observed process termination on the local filesystem. It does not establish persistence across power loss or support on another platform.

## Recommendation

Use this executor for the future V1 render service. Keep the exact plan private and caller-supplied until plan discovery, lock publication, and storage placement are designed together. Add a separate V1 platform matrix before claiming Windows, Linux, or release support. Retain the write-ahead implementation as non-default evidence until command-service integration proves that no stronger requirement is missing.
