import { validatePolicySafety } from "../../../src/policy/validator.js";
import {
  directReviewBypass,
  guardedFalsePositive,
  reviewPolicy,
  safeBaseline,
  safeReviewReworkCycle,
  staleReviewVerdict,
} from "./workflows.js";

const results = {
  safeBaseline: validatePolicySafety(safeBaseline, [reviewPolicy]),
  directReviewBypass: validatePolicySafety(directReviewBypass, [reviewPolicy]),
  staleReviewVerdict: validatePolicySafety(staleReviewVerdict, [reviewPolicy]),
  safeReviewReworkCycle: validatePolicySafety(safeReviewReworkCycle, [
    reviewPolicy,
  ]),
  guardedFalsePositive: validatePolicySafety(guardedFalsePositive, [
    reviewPolicy,
  ]),
};

console.log(JSON.stringify(results, null, 2));
