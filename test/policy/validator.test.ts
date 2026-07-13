import assert from "node:assert/strict";
import test from "node:test";

import type { FiniteWorkflow, SafetyPolicy } from "../../src/policy/model.js";
import { validatePolicySafety } from "../../src/policy/validator.js";
import {
  directReviewBypass,
  guardedFalsePositive,
  reviewPolicy,
  safeBaseline,
  safeReviewReworkCycle,
  staleReviewVerdict,
} from "../fixtures/policy/workflows.js";

function transitionIds(workflow: FiniteWorkflow): string[] {
  const result = validatePolicySafety(workflow, [reviewPolicy]);
  return result.violations[0]?.counterexample.map((step) => step.transition) ?? [];
}

test("accepts the safe plan, implement, review, and merge path", () => {
  const result = validatePolicySafety(safeBaseline, [reviewPolicy]);

  assert.equal(result.safe, true);
  assert.deepEqual(result.violations, []);
});

test("rejects a direct review bypass with a deterministic counterexample", () => {
  const first = validatePolicySafety(directReviewBypass, [reviewPolicy]);
  const second = validatePolicySafety(directReviewBypass, [reviewPolicy]);

  assert.deepEqual(first, second);
  assert.equal(first.safe, false);
  assert.equal(first.violations[0]?.code, "MISSING_REQUIRED_ARTIFACT");
  assert.deepEqual(transitionIds(directReviewBypass), [
    "01-plan-implement",
    "02-implement-merge",
  ]);
});

test("rejects stale ReviewVerdict reuse after implementation resumes", () => {
  const result = validatePolicySafety(staleReviewVerdict, [reviewPolicy]);
  const violation = result.violations[0];

  assert.equal(result.safe, false);
  assert.deepEqual(violation?.counterexample.map((step) => step.transition), [
    "01-plan-implement",
    "02-implement-review",
    "03-review-reimplement",
    "04-reimplement-merge",
  ]);
  assert.deepEqual(violation?.counterexample[2]?.invalidates, [
    "ReviewVerdict",
  ]);
  assert.deepEqual(violation?.validArtifacts, []);
});

test("accepts an unbounded review and rework cycle that refreshes the verdict", () => {
  const result = validatePolicySafety(safeReviewReworkCycle, [reviewPolicy]);

  assert.equal(result.safe, true);
  assert.equal(result.violations.length, 0);
  assert.ok(result.exploredStates < 10);
});

test("reports a guard-blind false positive explicitly", () => {
  const result = validatePolicySafety(guardedFalsePositive, [reviewPolicy]);
  const violation = result.violations[0];

  assert.equal(result.safe, false);
  assert.equal(violation?.guardBlind, true);
  assert.match(violation?.limitation ?? "", /false positive/);
  assert.equal(
    violation?.counterexample[0]?.guard,
    "risk != low",
  );
  assert.equal(
    violation?.counterexample[1]?.guard,
    "risk == low",
  );
});

test("supports the closed absence pattern", () => {
  const workflow: FiniteWorkflow = {
    nodes: ["implement", "merge"],
    initialNode: "implement",
    transitions: [
      {
        id: "01-merge-with-finding",
        from: "implement",
        to: "merge",
        produces: ["BlockingFinding"],
      },
    ],
  };
  const policy: SafetyPolicy = {
    id: "merge-forbids-blocking-finding",
    kind: "forbids-valid-artifact",
    at: "merge",
    artifact: "BlockingFinding",
  };
  const result = validatePolicySafety(workflow, [policy]);

  assert.equal(result.safe, false);
  assert.equal(result.violations[0]?.code, "FORBIDDEN_ARTIFACT_PRESENT");
});

test("applies invalidation before production for a fresh artifact of one type", () => {
  const workflow: FiniteWorkflow = {
    nodes: ["implement", "review", "merge"],
    initialNode: "implement",
    initialArtifacts: ["ReviewVerdict"],
    transitions: [
      {
        id: "01-refresh-review",
        from: "implement",
        to: "review",
        invalidates: ["ReviewVerdict"],
        produces: ["ReviewVerdict"],
      },
      { id: "02-merge", from: "review", to: "merge" },
    ],
  };

  assert.equal(validatePolicySafety(workflow, [reviewPolicy]).safe, true);
});

test("rejects invalid finite models before exploration", () => {
  assert.throws(
    () =>
      validatePolicySafety(
        {
          nodes: ["plan"],
          initialNode: "plan",
          transitions: [
            { id: "missing-node", from: "plan", to: "implement" },
          ],
        },
        [],
      ),
    /undeclared node/,
  );
});
