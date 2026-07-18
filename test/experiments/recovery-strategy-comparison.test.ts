import assert from "node:assert/strict";
import test from "node:test";

import { runRecoveryStrategyComparison } from "../../src/experiments/recovery-strategy-comparison.js";

test("compares Git reset, convergent apply, and journal recovery at one fault boundary", async () => {
  const result = await runRecoveryStrategyComparison();

  assert.equal(result.gitReset.preflightClean, true);
  assert.equal(result.gitReset.resetRestoredExactBase, false);
  assert.equal(result.gitReset.resetRemovedUntrackedOutput, false);
  assert.equal(result.gitReset.resetRestoredIgnoredOutput, false);
  assert.equal(result.gitReset.resetPreservedConcurrentWork, false);
  assert.equal(result.gitReset.rerunReachedTarget, true);
  assert.match(result.gitReset.statusAfterReset, /\.cursor\//u);

  assert.deepEqual(result.convergentApply, {
    requiresCleanGit: false,
    rerunReachedTarget: true,
    rerunPreservedConcurrentWork: true,
    acceptedOnlyBeforeOrAfterDigests: true,
    foreignTargetDriftFailedClosed: true,
    foreignDriftAttemptMutatedNoTargets: true,
  });

  assert.deepEqual(result.writeAheadJournal, {
    baseAnchorAction: "rollback",
    baseAnchorOperationCount: 3,
    targetAnchorAction: "roll-forward",
    targetAnchorOperationCount: 1,
    foreignTargetAction: "conflict",
  });
});
