# Workspace recovery strategy comparison

Snapshot date: 2026-07-17.

## Verdict

**A clean Git worktree followed by `git reset --hard` fails as the general recovery contract.** It can be an optional preflight guard or an operator-managed recovery technique in a disposable checkout, but it is not safe as an automatic project recovery mechanism.

**Deterministic staged output with digest-aware, path-scoped forward convergence passes and is the accepted V1 contract at complete-file mutation boundaries.** It preserves unrelated work, handles tracked, untracked, and ignored managed targets uniformly, and fails closed when a managed target contains neither its planned before nor after content.

**The existing write-ahead journal remains the strongest tested process-termination design, but it imposes substantially more private state, cleanup, lifecycle, and platform qualification work.** Retain it as experimental evidence while the candidate V1 contract is evaluated. Do not continue expanding its Windows or power-loss contract unless a product requirement justifies that cost.

ADR 0002 accepts the recommendation without accepting a public API, file format, storage path, or power-loss durability promise.

## Reproduction

Implementation and fixture:

- `src/experiments/recovery-strategy-comparison.ts`;
- `test/experiments/recovery-strategy-comparison.test.ts`.

Run:

```bash
npm install
npm run experiment:recovery
npm run check
```

The experiment creates and deletes temporary Git repositories. It never resets, cleans, stages, or commits the project repository. Commit signing is disabled only inside each temporary fixture repository so results do not depend on user-level signing configuration.

## Common fixture

All three strategies receive four ordered managed operations and the same injected failure after three complete file writes:

| Path | Initial classification | Failure-boundary state |
| --- | --- | --- |
| `AGENTS.md` | Tracked file | Target content |
| `.agentdevflow/local.txt` | Ignored file | Target content |
| `.cursor/rules/agentdevflow.mdc` | Absent and untracked when created | Target content |
| `CLAUDE.md` | Tracked file | Original content |

After the third managed write, the fixture also changes tracked, unrelated `src/app.ts` content. This represents user or concurrent-tool work created after the clean-worktree preflight.

The fault is injected between complete file writes. It does not simulate termination during one `writeFile` call, kernel failure, sudden power loss, storage-cache loss, or filesystem corruption.

## Observations

### Strategy A: clean Git, direct writes, reset, and rerun

The temporary repository was clean according to `git status --porcelain` before generation. After interruption, `git reset --hard HEAD` produced all of the following:

- tracked managed `AGENTS.md` returned to its committed base;
- the ignored managed file retained target content instead of returning to its base;
- the generated untracked Cursor directory remained present;
- the unrelated tracked change was discarded;
- the managed output set therefore remained mixed rather than returning to an exact base state.

A subsequent deterministic direct-write rerun reached target content, but only after the unrelated change had already been lost. Direct rerun also has no digest precondition that distinguishes expected partial output from foreign edits.

These observations match Git's documented boundary: [`git reset --hard`](https://git-scm.com/docs/git-reset) overwrites the tracked working tree and index. Removing untracked directories requires [`git clean -d`](https://git-scm.com/docs/git-clean), and ignored files require the more destructive `-x` option. Combining reset and clean therefore broadens deletion rather than establishing ownership.

Result: **Fail as the default recovery strategy. Conditional only for an isolated, disposable checkout with no valuable uncommitted, untracked, or ignored content and an explicitly operator-owned reset policy.**

### Strategy B: staged, digest-aware forward convergence

The fixture materialized all target bytes outside the repository before applying them. On rerun it accepted only exact before or exact after content for every managed path, then wrote only paths that had not reached target content.

Observed results:

- no clean-Git precondition was required;
- the interrupted mixed state converged to the complete target;
- the unrelated tracked change remained intact;
- tracked, ignored, and newly created managed paths used the same content-state rule;
- a separate foreign-drift fixture failed before mutating any target in that attempt.

Result: **Pass as a candidate V1 forward-convergence contract at complete-file boundaries.**

The candidate still requires a production design for safe single-file replacement and temporary-file ownership. If termination can expose partial target bytes, those bytes produce an unknown digest and the simple rerun fails closed rather than recovering automatically. It also provides no automatic rollback, persistent commit anchor, durable cleanup history, power-loss guarantee, or general concurrent-writer exclusion. Regeneration must reproduce the same target bytes; changed inputs require a new plan rather than reuse of the interrupted plan.

### Strategy C: write-ahead journal

The comparison constructs the same four digest-bound operations with actual `PrivateRenderTransaction` and recovery-decision code.

Observed results:

- with the base lock as anchor, three target outputs produce a rollback decision with three restoring operations;
- with the target lock as anchor, the same mixture produces a roll-forward decision with one remaining operation;
- a managed path containing a foreign digest produces a conflict.

The broader executor and subprocess fixtures additionally test persistent blobs, writer leases, recovery after `SIGKILL`, temporary-file intent, cleanup, and lifecycle behavior. See [private transaction subprocess evidence](private-transaction-subprocess.md). Hosted Ubuntu and macOS qualification passes, while Windows currently fails the directory-synchronization prerequisite. See [candidate platform qualification](candidate-platform-qualification.md).

Result: **Pass for the stronger tested private contract, with unresolved cross-platform scope and materially higher implementation surface.**

## Current Rulesync behavior

Rulesync was re-inspected at immutable upstream commit [`9dc503808f552f2e602a08b02cba71cea983086e`](https://github.com/dyoshikawa/rulesync/tree/9dc503808f552f2e602a08b02cba71cea983086e), committed on 2026-07-16. This is a source snapshot, not a claim that the package version declared on that branch is the latest published npm release.

At that snapshot:

- [`FeatureProcessor.writeAiFiles()`](https://github.com/dyoshikawa/rulesync/blob/9dc503808f552f2e602a08b02cba71cea983086e/src/types/feature-processor.ts#L59-L92) reads, compares, optionally merges, and then writes changed files sequentially;
- [`writeFileContent()`](https://github.com/dyoshikawa/rulesync/blob/9dc503808f552f2e602a08b02cba71cea983086e/src/utils/file.ts#L161-L164) ensures the parent directory and calls `writeFile` directly;
- [`generate()`](https://github.com/dyoshikawa/rulesync/blob/9dc503808f552f2e602a08b02cba71cea983086e/src/lib/generate.ts#L427-L462) resolves generation order and awaits each feature step sequentially;
- the documented [`dryRun` and `check` options](https://github.com/dyoshikawa/rulesync/blob/9dc503808f552f2e602a08b02cba71cea983086e/docs/api/programmatic-api.md#L37-L56) preview or report drift before normal writes;
- the inspected generation path has no project-level Git clean/reset/stash protocol, multi-file journal, rollback anchor, or recovery loop.

The inspected Rulesync implementation provides deterministic regeneration, preview/check modes, ordered writes, and content comparison. Git remains an external, operator-managed safety mechanism; the inspected code does not show automatic `git reset --hard` as its generation recovery mechanism. Rulesync's larger provider and feature surface remains valuable as an external oracle, but its current writer behavior is not a transaction primitive for `agentdevflow`.

## Maintenance comparison

| Strategy | State owned by `agentdevflow` | Principal benefit | Principal loss or risk |
| --- | --- | --- | --- |
| Git reset and rerun | Almost none | Minimal implementation | Destructive tracked rollback, incomplete ignored/untracked recovery, no managed-path ownership |
| Staged digest convergence | Plan, target bytes, and before/after digests | Small independent recovery layer that preserves unrelated work | Forward-only; limited termination boundary; target regeneration and single-file safety are required |
| Write-ahead journal | Transaction, journal, blobs, lock anchors, writer evidence, cleanup and lifecycle records | Deterministic rollback or roll-forward across tested process-termination boundaries | Largest implementation, qualification, operator, storage, and migration surface |

No calendar or staffing estimate is asserted. The maintenance difference follows from the number of durable states, transitions, records, recovery authorities, cleanup paths, and platform contracts already present in each implementation.

## Accepted recommendation

1. Make staged, digest-aware forward convergence the V1 default.
2. Keep a clean-worktree check as an optional guard and diagnostic, never as authority to discard work automatically.
3. Require an explicit operator action for any destructive Git reset or clean command.
4. Define a narrow process-termination claim around complete single-file replacement before implementing a public render command.
5. Keep the current journal implementation private and tested, but pause new Windows and power-loss work.
6. Promote the journal only if a concrete use case requires automatic rollback, recovery without reproducible inputs, or a durable commit anchor across multiple files.
7. Reconsider the product core if even the smaller digest-aware layer adds no value beyond provider rendering and ordinary Git review.

## Decision outcome

[ADR 0002](../decisions/0002-v1-forward-convergent-render-apply.md) accepts forward convergence at complete-file boundaries, optional Git cleanliness diagnostics without automatic destructive recovery, and retention of the write-ahead journal as non-default experimental evidence. Windows remains a required candidate release platform under the smaller contract but needs a separate passing qualification matrix before support can be claimed.
