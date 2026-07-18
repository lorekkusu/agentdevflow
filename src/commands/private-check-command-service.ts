import { createHash } from "node:crypto";

import {
  derivePrivateRenderLockIntent,
  serializePrivateRenderLock,
  validatePrivateRenderLock,
  type PrivateRenderLock,
} from "../lock/private-render-lock.js";
import { createRenderInputDigest } from "../renderer/input-digest.js";
import {
  validatePrivateRendererSourceMaterialization,
  type PrivateRendererSourceMaterialization,
} from "../renderer/materialize-compilation.js";
import type {
  OwnershipClaim,
  RendererCapability,
  RendererDiagnostic,
  RendererProvider,
  RenderPlan,
} from "../renderer/contract.js";
import {
  validatePrivateRenderPlanSnapshot,
  type PrivateRenderPlanSnapshot,
} from "./private-render-plan-snapshot.js";

export type PrivateCheckOutcome = "clean" | "changes-required" | "blocked";

export type PrivateCheckDiagnosticLevel = "change" | "warning" | "error";

export type PrivateCheckObservedLockState =
  | "not-evaluated"
  | "base"
  | "target"
  | "foreign";

export interface PrivateCheckDiagnostic {
  readonly source: "check" | "renderer";
  readonly code: string;
  readonly level: PrivateCheckDiagnosticLevel;
  readonly message: string;
  readonly path?: string;
  readonly provider?: RendererProvider;
  readonly capability?: RendererCapability;
}

export interface PrivateCheckReadWorkspace {
  read(path: string): Promise<string | null>;
}

export interface ExecutePrivateCheckCommandOptions {
  readonly materialization: unknown;
  readonly snapshot: unknown;
  readonly baseLock: unknown | null;
  readonly lockPath: string;
  readonly workspace: PrivateCheckReadWorkspace;
}

export interface PrivateCheckCommandResult {
  readonly outcome: PrivateCheckOutcome;
  readonly candidateExitCode: 0 | 1 | 2;
  readonly snapshotDigest: string | null;
  readonly planDigest: string | null;
  readonly observedLockState: PrivateCheckObservedLockState;
  readonly diagnostics: readonly PrivateCheckDiagnostic[];
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareDiagnostics(
  left: PrivateCheckDiagnostic,
  right: PrivateCheckDiagnostic,
): number {
  return (
    compareText(left.code, right.code) ||
    compareText(left.path ?? "", right.path ?? "") ||
    compareText(left.provider ?? "", right.provider ?? "") ||
    compareText(left.capability ?? "", right.capability ?? "") ||
    compareText(left.message, right.message) ||
    compareText(left.source, right.source)
  );
}

function finish(options: {
  readonly diagnostics: readonly PrivateCheckDiagnostic[];
  readonly snapshotDigest: string | null;
  readonly planDigest: string | null;
  readonly observedLockState: PrivateCheckObservedLockState;
}): PrivateCheckCommandResult {
  const diagnostics = [...options.diagnostics].sort(compareDiagnostics);
  const blocked = diagnostics.some((diagnostic) => diagnostic.level === "error");
  const changesRequired = diagnostics.some(
    (diagnostic) => diagnostic.level === "change",
  );
  const outcome: PrivateCheckOutcome = blocked
    ? "blocked"
    : changesRequired
      ? "changes-required"
      : "clean";
  return {
    outcome,
    candidateExitCode: outcome === "clean" ? 0 : outcome === "changes-required" ? 1 : 2,
    snapshotDigest: options.snapshotDigest,
    planDigest: options.planDigest,
    observedLockState: options.observedLockState,
    diagnostics,
  };
}

function checkDiagnostic(
  code: string,
  level: PrivateCheckDiagnosticLevel,
  message: string,
  path?: string,
): PrivateCheckDiagnostic {
  return {
    source: "check",
    code,
    level,
    message,
    ...(path === undefined ? {} : { path }),
  };
}

function rendererDiagnostic(
  diagnostic: RendererDiagnostic,
): PrivateCheckDiagnostic {
  return {
    source: "renderer",
    code: diagnostic.code,
    level: diagnostic.severity,
    message: diagnostic.message,
    ...(diagnostic.path === undefined ? {} : { path: diagnostic.path }),
    ...(diagnostic.provider === undefined
      ? {}
      : { provider: diagnostic.provider }),
    ...(diagnostic.capability === undefined
      ? {}
      : { capability: diagnostic.capability }),
  };
}

function ownershipEntries(
  ownership: Readonly<Record<string, OwnershipClaim>>,
): readonly unknown[] {
  return Object.entries(ownership)
    .sort(([left], [right]) => compareText(left, right))
    .map(([path, claim]) => ({
      path,
      owner: claim.owner,
      digest: claim.digest,
    }));
}

function ownershipFromLock(
  lock: PrivateRenderLock | null,
): Readonly<Record<string, OwnershipClaim>> {
  return Object.fromEntries(
    (lock?.files ?? []).map((file) => [
      file.path,
      { owner: file.owner, digest: file.contentDigest },
    ]),
  );
}

function baseOwnershipMatches(
  plan: RenderPlan,
  baseLock: PrivateRenderLock | null,
): boolean {
  return (
    JSON.stringify(ownershipEntries(plan.previousOwnership)) ===
    JSON.stringify(ownershipEntries(ownershipFromLock(baseLock)))
  );
}

async function readDigest(
  workspace: PrivateCheckReadWorkspace,
  path: string,
): Promise<string | null> {
  const content = await workspace.read(path);
  return content === null ? null : digest(content);
}

function inputMatches(
  materialization: PrivateRendererSourceMaterialization,
  plan: RenderPlan,
): boolean {
  const sourceFiles = materialization.files
    .map((file) => file.path)
    .sort(compareText);
  const inputDigest = createRenderInputDigest({
    compilerDigest: materialization.compilerDigest,
    sourceDigest: materialization.digest,
    sourceFiles,
  });
  return (
    plan.sourceDigest === materialization.digest &&
    plan.inputDigest === inputDigest
  );
}

export async function executePrivateCheckCommand(
  options: ExecutePrivateCheckCommandOptions,
): Promise<PrivateCheckCommandResult> {
  const diagnostics: PrivateCheckDiagnostic[] = [];
  let observedLockState: PrivateCheckObservedLockState = "not-evaluated";
  let snapshot: PrivateRenderPlanSnapshot;
  try {
    validatePrivateRenderPlanSnapshot(options.snapshot);
    snapshot = options.snapshot;
  } catch (error) {
    diagnostics.push(
      checkDiagnostic(
        "CHECK_SNAPSHOT_INVALID",
        "error",
        `Private render plan snapshot is invalid: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return finish({
      diagnostics,
      snapshotDigest: null,
      planDigest: null,
      observedLockState,
    });
  }

  let materialization: PrivateRendererSourceMaterialization;
  try {
    const candidate =
      options.materialization as PrivateRendererSourceMaterialization;
    validatePrivateRendererSourceMaterialization(candidate);
    materialization = candidate;
  } catch (error) {
    diagnostics.push(
      checkDiagnostic(
        "CHECK_MATERIALIZATION_INVALID",
        "error",
        `Private source materialization is invalid: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return finish({
      diagnostics,
      snapshotDigest: snapshot.digest,
      planDigest: snapshot.plan.planDigest,
      observedLockState,
    });
  }

  let baseLock: PrivateRenderLock | null = null;
  if (options.baseLock !== null) {
    try {
      validatePrivateRenderLock(options.baseLock);
      baseLock = options.baseLock;
    } catch (error) {
      diagnostics.push(
        checkDiagnostic(
          "CHECK_BASE_LOCK_INVALID",
          "error",
          `Expected base render lock is invalid: ${error instanceof Error ? error.message : String(error)}`,
          options.lockPath,
        ),
      );
      return finish({
        diagnostics,
        snapshotDigest: snapshot.digest,
        planDigest: snapshot.plan.planDigest,
        observedLockState,
      });
    }
  }

  const plan = snapshot.plan;
  diagnostics.push(...plan.diagnostics.map(rendererDiagnostic));
  if (!baseOwnershipMatches(plan, baseLock)) {
    diagnostics.push(
      checkDiagnostic(
        "CHECK_BASE_OWNERSHIP_MISMATCH",
        "error",
        "The retained render plan previous ownership does not match the expected base lock.",
      ),
    );
  }
  if (!inputMatches(materialization, plan)) {
    diagnostics.push(
      checkDiagnostic(
        "CHECK_INPUT_MISMATCH",
        "error",
        "The retained render plan does not match the private source materialization.",
      ),
    );
  }
  if (!plan.safeToApply) {
    diagnostics.push(
      checkDiagnostic(
        "CHECK_PLAN_UNSAFE",
        "error",
        "The retained render plan is not safe to apply.",
      ),
    );
  }

  let allOutputsAtTarget = true;
  for (const file of plan.files) {
    let currentDigest: string | null;
    try {
      currentDigest = await readDigest(options.workspace, file.path);
    } catch (error) {
      allOutputsAtTarget = false;
      diagnostics.push(
        checkDiagnostic(
          "CHECK_WORKSPACE_READ_FAILED",
          "error",
          `Managed path could not be read: ${error instanceof Error ? error.message : String(error)}`,
          file.path,
        ),
      );
      continue;
    }
    if (currentDigest === file.expectedDigest && file.action !== "conflict") {
      continue;
    }
    allOutputsAtTarget = false;
    if (file.action === "conflict") {
      diagnostics.push(
        checkDiagnostic(
          "CHECK_PATH_CONFLICT",
          "error",
          `Managed path has an unresolved ownership conflict: ${file.path}`,
          file.path,
        ),
      );
    } else if (currentDigest === file.observedDigest) {
      diagnostics.push(
        checkDiagnostic(
          "CHECK_PATH_CHANGE_REQUIRED",
          "change",
          `Managed path requires the planned ${file.action} action: ${file.path}`,
          file.path,
        ),
      );
    } else {
      diagnostics.push(
        checkDiagnostic(
          "CHECK_PATH_DRIFT",
          "error",
          `Managed path is neither at its planned before nor target digest: ${file.path}`,
          file.path,
        ),
      );
    }
  }

  const baseContent =
    baseLock === null ? null : serializePrivateRenderLock(baseLock);
  let targetContent: string | null = null;
  if (plan.safeToApply && inputMatches(materialization, plan)) {
    try {
      targetContent = serializePrivateRenderLock(
        derivePrivateRenderLockIntent({ materialization, plan }),
      );
    } catch (error) {
      diagnostics.push(
        checkDiagnostic(
          "CHECK_TARGET_LOCK_INVALID",
          "error",
          `Target render lock could not be derived: ${error instanceof Error ? error.message : String(error)}`,
          options.lockPath,
        ),
      );
    }
  }

  let currentLockContent: string | null;
  try {
    currentLockContent = await options.workspace.read(options.lockPath);
  } catch (error) {
    diagnostics.push(
      checkDiagnostic(
        "CHECK_WORKSPACE_READ_FAILED",
        "error",
        `Render lock could not be read: ${error instanceof Error ? error.message : String(error)}`,
        options.lockPath,
      ),
    );
    return finish({
      diagnostics,
      snapshotDigest: snapshot.digest,
      planDigest: plan.planDigest,
      observedLockState,
    });
  }

  if (targetContent !== null && currentLockContent === targetContent) {
    observedLockState = "target";
    if (!allOutputsAtTarget) {
      diagnostics.push(
        checkDiagnostic(
          "CHECK_LOCK_CONTRADICTORY",
          "error",
          "The target render lock exists while managed outputs are incomplete.",
          options.lockPath,
        ),
      );
    }
  } else if (currentLockContent === baseContent) {
    observedLockState = "base";
    if (targetContent !== null && currentLockContent !== targetContent) {
      diagnostics.push(
        checkDiagnostic(
          "CHECK_LOCK_CHANGE_REQUIRED",
          "change",
          "The render lock requires publication of the planned target state.",
          options.lockPath,
        ),
      );
    }
  } else {
    observedLockState = "foreign";
    diagnostics.push(
      checkDiagnostic(
        "CHECK_LOCK_DRIFT",
        "error",
        "The render lock is neither at its expected base nor target content.",
        options.lockPath,
      ),
    );
  }

  return finish({
    diagnostics,
    snapshotDigest: snapshot.digest,
    planDigest: plan.planDigest,
    observedLockState,
  });
}
