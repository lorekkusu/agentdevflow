import { createHash } from "node:crypto";

import {
  createPrivateRenderLock,
  derivePrivateRenderLockIntent,
  serializePrivateRenderLock,
  validatePrivateRenderLock,
  type PrivateRenderLock,
} from "../lock/private-render-lock.js";
import type { PrivateRendererSourceMaterialization } from "../renderer/materialize-compilation.js";
import {
  applyPrivateConvergentRenderPlan,
  type PrivateConvergentApplyFaultInjector,
} from "../renderer/private-convergent-apply.js";
import type {
  OwnershipClaim,
  RenderPlan,
  RenderResult,
  VerifyResult,
} from "../renderer/contract.js";
import { verifyRenderPlan } from "../renderer/staged-adapter.js";
import { createPrivateConvergentMutationIntent } from "../workspace/private-convergent-intent.js";
import type {
  PrivateConvergentWorkspace,
  PrivateConvergentWriteEvent,
} from "../workspace/private-filesystem-workspace.js";
import {
  validatePrivateRenderPlanSnapshot,
  type PrivateRenderPlanSnapshot,
} from "./private-render-plan-snapshot.js";

export type PrivateRenderCommandErrorCode =
  | "PRIVATE_RENDER_PLAN_SNAPSHOT_INVALID"
  | "PRIVATE_RENDER_BASE_OWNERSHIP_MISMATCH"
  | "PRIVATE_RENDER_LOCK_PATH_OVERLAP"
  | "PRIVATE_RENDER_LOCK_STATE_DRIFT"
  | "PRIVATE_RENDER_LOCK_STATE_CONTRADICTORY"
  | "PRIVATE_RENDER_VERIFY_FAILED"
  | "PRIVATE_RENDER_LOCK_VERIFY_FAILED";

export class PrivateRenderCommandError extends Error {
  override readonly name = "PrivateRenderCommandError";

  constructor(
    readonly code: PrivateRenderCommandErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
  }
}

export type PrivateRenderCommandEvent =
  | { readonly kind: "render-applied" }
  | { readonly kind: "render-verified" }
  | {
      readonly kind: `lock-${PrivateConvergentWriteEvent["kind"]}`;
      readonly path: string;
    }
  | { readonly kind: "lock-published"; readonly path: string };

export type PrivateRenderCommandFaultInjector = (
  event: PrivateRenderCommandEvent,
) => void | Promise<void>;

export interface ExecutePrivateRenderCommandOptions {
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly snapshot: PrivateRenderPlanSnapshot;
  readonly baseLock: PrivateRenderLock | null;
  readonly lockPath: string;
  readonly workspace: PrivateConvergentWorkspace;
  readonly applyFaultInjector?: PrivateConvergentApplyFaultInjector;
  readonly faultInjector?: PrivateRenderCommandFaultInjector;
}

export interface PrivateRenderCommandResult {
  readonly snapshotDigest: string;
  readonly renderResult: RenderResult;
  readonly verification: VerifyResult;
  readonly lock: PrivateRenderLock;
  readonly lockPublished: boolean;
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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

function requireMatchingBaseOwnership(
  plan: RenderPlan,
  baseLock: PrivateRenderLock | null,
): void {
  const expected = JSON.stringify(ownershipEntries(ownershipFromLock(baseLock)));
  const actual = JSON.stringify(ownershipEntries(plan.previousOwnership));
  if (actual !== expected) {
    throw new PrivateRenderCommandError(
      "PRIVATE_RENDER_BASE_OWNERSHIP_MISMATCH",
      "The retained render plan previous ownership does not match the base lock.",
    );
  }
}

function pathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function requireSeparatedLockPath(
  plan: RenderPlan,
  lockPath: string,
  lockTemporaryPath: string,
): void {
  const reserved = plan.files.flatMap((file) => {
    if (file.expectedDigest === null) {
      return [file.path];
    }
    return [
      file.path,
      createPrivateConvergentMutationIntent({
        planDigest: plan.planDigest,
        targetPath: file.path,
        targetDigest: file.expectedDigest,
      }).temporaryPath,
    ];
  });
  for (const path of reserved) {
    if (
      pathsOverlap(path, lockPath) ||
      pathsOverlap(path, lockTemporaryPath)
    ) {
      throw new PrivateRenderCommandError(
        "PRIVATE_RENDER_LOCK_PATH_OVERLAP",
        `Private render lock path overlaps managed render state: ${path}`,
        path,
      );
    }
  }
}

async function outputsAreAtTarget(
  plan: RenderPlan,
  workspace: PrivateConvergentWorkspace,
): Promise<boolean> {
  for (const file of plan.files) {
    const content = await workspace.read(file.path);
    const observed = content === null ? null : digest(content);
    if (observed !== file.expectedDigest) {
      return false;
    }
  }
  return true;
}

async function lockState(
  workspace: PrivateConvergentWorkspace,
  lockPath: string,
  baseContent: string | null,
  targetContent: string,
): Promise<"base" | "target"> {
  const content = await workspace.read(lockPath);
  if (content === targetContent) {
    return "target";
  }
  if (content === baseContent) {
    return "base";
  }
  throw new PrivateRenderCommandError(
    "PRIVATE_RENDER_LOCK_STATE_DRIFT",
    "Private render lock is neither at its expected base nor target content.",
    lockPath,
  );
}

export async function executePrivateRenderCommand(
  options: ExecutePrivateRenderCommandOptions,
): Promise<PrivateRenderCommandResult> {
  const {
    materialization,
    snapshot,
    baseLock,
    lockPath,
    workspace,
    applyFaultInjector,
    faultInjector,
  } = options;
  try {
    validatePrivateRenderPlanSnapshot(snapshot);
  } catch (error) {
    throw new PrivateRenderCommandError(
      "PRIVATE_RENDER_PLAN_SNAPSHOT_INVALID",
      `Private render plan snapshot is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (baseLock !== null) {
    validatePrivateRenderLock(baseLock);
  }
  const plan = snapshot.plan;
  requireMatchingBaseOwnership(plan, baseLock);
  const targetLock = derivePrivateRenderLockIntent({ materialization, plan });
  const baseContent =
    baseLock === null ? null : serializePrivateRenderLock(baseLock);
  const targetContent = serializePrivateRenderLock(targetLock);
  const lockIntent = createPrivateConvergentMutationIntent({
    planDigest: snapshot.digest,
    targetPath: lockPath,
    targetDigest: digest(targetContent),
  });
  requireSeparatedLockPath(plan, lockPath, lockIntent.temporaryPath);

  const initialLockState = await lockState(
    workspace,
    lockPath,
    baseContent,
    targetContent,
  );
  if (
    initialLockState === "target" &&
    !(await outputsAreAtTarget(plan, workspace))
  ) {
    throw new PrivateRenderCommandError(
      "PRIVATE_RENDER_LOCK_STATE_CONTRADICTORY",
      "Target private render lock exists while managed outputs are incomplete.",
      lockPath,
    );
  }

  const renderResult = await applyPrivateConvergentRenderPlan(
    plan,
    workspace,
    applyFaultInjector,
  );
  await faultInjector?.({ kind: "render-applied" });
  const verification = await verifyRenderPlan(plan, workspace);
  if (!verification.ok || verification.diagnostics.length > 0) {
    throw new PrivateRenderCommandError(
      "PRIVATE_RENDER_VERIFY_FAILED",
      "Managed outputs did not verify after convergent apply.",
    );
  }
  await faultInjector?.({ kind: "render-verified" });
  const lock = createPrivateRenderLock({
    materialization,
    plan,
    result: renderResult,
    verification,
  });
  if (lock.digest !== targetLock.digest) {
    throw new PrivateRenderCommandError(
      "PRIVATE_RENDER_LOCK_VERIFY_FAILED",
      "Verified private render lock differs from its precomputed target.",
      lockPath,
    );
  }

  const currentLockState = await lockState(
    workspace,
    lockPath,
    baseContent,
    targetContent,
  );
  let lockPublished = false;
  if (currentLockState === "target") {
    await workspace.discardConvergentTemporary(lockIntent);
  } else {
    await workspace.writeConvergently(
      lockIntent,
      targetContent,
      async (event) => {
        await faultInjector?.({
          kind: `lock-${event.kind}`,
          path: lockPath,
        });
      },
    );
    lockPublished = true;
  }
  if ((await workspace.read(lockPath)) !== targetContent) {
    throw new PrivateRenderCommandError(
      "PRIVATE_RENDER_LOCK_VERIFY_FAILED",
      "Private render lock did not reach its exact target content.",
      lockPath,
    );
  }
  await faultInjector?.({ kind: "lock-published", path: lockPath });

  return {
    snapshotDigest: snapshot.digest,
    renderResult,
    verification,
    lock,
    lockPublished,
  };
}
