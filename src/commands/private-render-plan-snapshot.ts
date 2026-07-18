import { createHash } from "node:crypto";

import type { RenderPlan } from "../renderer/contract.js";
import { validateRenderPlanIntegrity } from "../renderer/staged-adapter.js";

export const privateRenderPlanSnapshotRevision = 1;

export interface PrivateRenderPlanSnapshot {
  readonly revision: number;
  readonly plan: RenderPlan;
  readonly digest: string;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function snapshotValue(plan: RenderPlan): unknown {
  return {
    revision: privateRenderPlanSnapshotRevision,
    plan: {
      backend: plan.backend,
      backendVersion: plan.backendVersion,
      ownershipKey: plan.ownershipKey,
      inputDigest: plan.inputDigest,
      sourceDigest: plan.sourceDigest,
      planDigest: plan.planDigest,
      files: plan.files.map((file) => ({
        path: file.path,
        action: file.action,
        observedDigest: file.observedDigest,
        expectedContent: file.expectedContent,
        expectedDigest: file.expectedDigest,
        sourceRefs: file.sourceRefs,
      })),
      diagnostics: plan.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        path: diagnostic.path ?? null,
        provider: diagnostic.provider ?? null,
        capability: diagnostic.capability ?? null,
      })),
      safeToApply: plan.safeToApply,
      previousOwnership: Object.entries(plan.previousOwnership)
        .sort(([left], [right]) => compareText(left, right))
        .map(([path, claim]) => ({
          path,
          owner: claim.owner,
          digest: claim.digest,
        })),
    },
  };
}

function snapshotDigest(plan: RenderPlan): string {
  return createHash("sha256")
    .update(JSON.stringify(snapshotValue(plan)))
    .digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  description: string,
): void {
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new Error(`${description} has unexpected or missing fields.`);
  }
}

function requireString(value: unknown, description: string): string {
  if (typeof value !== "string") {
    throw new Error(`${description} must be a string.`);
  }
  return value;
}

function validatePlanShape(plan: Record<string, unknown>): void {
  requireExactKeys(
    plan,
    [
      "backend",
      "backendVersion",
      "ownershipKey",
      "inputDigest",
      "sourceDigest",
      "planDigest",
      "files",
      "diagnostics",
      "safeToApply",
      "previousOwnership",
    ],
    "Private render plan snapshot plan",
  );
  if (!Array.isArray(plan.files)) {
    throw new Error("Private render plan snapshot files must be an array.");
  }
  const actions = new Set([
    "create",
    "update",
    "delete",
    "unchanged",
    "conflict",
  ]);
  for (const [index, value] of plan.files.entries()) {
    if (!isRecord(value)) {
      throw new Error(`Private render plan snapshot file ${index} must be an object.`);
    }
    requireExactKeys(
      value,
      [
        "path",
        "action",
        "observedDigest",
        "expectedContent",
        "expectedDigest",
        "sourceRefs",
      ],
      `Private render plan snapshot file ${index}`,
    );
    if (!actions.has(requireString(value.action, "Private render plan action"))) {
      throw new Error(`Private render plan action is unsupported: ${String(value.action)}`);
    }
    if (!Array.isArray(value.sourceRefs)) {
      throw new Error("Private render plan source references must be an array.");
    }
  }
  if (!Array.isArray(plan.diagnostics)) {
    throw new Error("Private render plan diagnostics must be an array.");
  }
  const diagnosticKeys = new Set([
    "code",
    "severity",
    "message",
    "path",
    "provider",
    "capability",
  ]);
  for (const [index, value] of plan.diagnostics.entries()) {
    if (!isRecord(value)) {
      throw new Error(
        `Private render plan diagnostic ${index} must be an object.`,
      );
    }
    const keys = Object.keys(value);
    if (
      !keys.includes("code") ||
      !keys.includes("severity") ||
      !keys.includes("message") ||
      keys.some((key) => !diagnosticKeys.has(key))
    ) {
      throw new Error(
        `Private render plan diagnostic ${index} has unexpected or missing fields.`,
      );
    }
  }
  if (!isRecord(plan.previousOwnership)) {
    throw new Error("Private render plan previous ownership must be an object.");
  }
  for (const [path, value] of Object.entries(plan.previousOwnership)) {
    if (!isRecord(value)) {
      throw new Error(`Private render ownership claim must be an object: ${path}`);
    }
    requireExactKeys(
      value,
      ["owner", "digest"],
      `Private render ownership claim for ${path}`,
    );
    requireString(value.owner, `Private render ownership owner for ${path}`);
    if (
      typeof value.digest !== "string" ||
      !/^[a-f0-9]{64}$/u.test(value.digest)
    ) {
      throw new Error(
        `Private render ownership digest must be a lowercase SHA-256 digest: ${path}`,
      );
    }
  }
}

export function validatePrivateRenderPlanSnapshot(
  value: unknown,
): asserts value is PrivateRenderPlanSnapshot {
  if (!isRecord(value)) {
    throw new Error("Private render plan snapshot must be an object.");
  }
  const keys = Object.keys(value).sort(compareText);
  if (
    keys.length !== 3 ||
    keys[0] !== "digest" ||
    keys[1] !== "plan" ||
    keys[2] !== "revision"
  ) {
    throw new Error(
      "Private render plan snapshot has unexpected or missing fields.",
    );
  }
  if (value.revision !== privateRenderPlanSnapshotRevision) {
    throw new Error(
      `Unsupported private render plan snapshot revision: ${String(value.revision)}.`,
    );
  }
  if (typeof value.digest !== "string" || !/^[a-f0-9]{64}$/u.test(value.digest)) {
    throw new Error(
      "Private render plan snapshot digest must be a lowercase SHA-256 digest.",
    );
  }
  if (!isRecord(value.plan)) {
    throw new Error("Private render plan snapshot plan must be an object.");
  }
  validatePlanShape(value.plan);
  const plan = value.plan as unknown as RenderPlan;
  validateRenderPlanIntegrity(plan);
  if (value.digest !== snapshotDigest(plan)) {
    throw new Error("Private render plan snapshot digest does not match.");
  }
}

export function createPrivateRenderPlanSnapshot(
  plan: RenderPlan,
): PrivateRenderPlanSnapshot {
  validateRenderPlanIntegrity(plan);
  const snapshot: PrivateRenderPlanSnapshot = {
    revision: privateRenderPlanSnapshotRevision,
    plan,
    digest: snapshotDigest(plan),
  };
  validatePrivateRenderPlanSnapshot(snapshot);
  return snapshot;
}
