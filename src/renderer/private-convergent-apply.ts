import { createHash } from "node:crypto";

import { createPrivateConvergentMutationIntent } from "../workspace/private-convergent-intent.js";
import type {
  PrivateConvergentWorkspace,
  PrivateConvergentWriteEvent,
} from "../workspace/private-filesystem-workspace.js";
import type {
  OwnershipClaim,
  PlannedFile,
  RenderPlan,
  RenderResult,
} from "./contract.js";
import { validateRenderPlanIntegrity } from "./staged-adapter.js";

export type PrivateConvergentApplyEvent =
  | {
      readonly kind: PrivateConvergentWriteEvent["kind"];
      readonly path: string;
    }
  | { readonly kind: "path-removing"; readonly path: string }
  | { readonly kind: "path-applied"; readonly path: string };

export type PrivateConvergentApplyFaultInjector = (
  event: PrivateConvergentApplyEvent,
) => void | Promise<void>;

export type PrivateConvergentApplyErrorCode =
  | "CONVERGENT_PLAN_UNSAFE"
  | "CONVERGENT_PATH_DRIFT"
  | "CONVERGENT_PATH_VERIFY_FAILED";

export class PrivateConvergentApplyError extends Error {
  override readonly name = "PrivateConvergentApplyError";

  constructor(
    readonly code: PrivateConvergentApplyErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
  }
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function observedDigest(
  workspace: PrivateConvergentWorkspace,
  path: string,
): Promise<string | null> {
  const content = await workspace.read(path);
  return content === null ? null : digest(content);
}

function isExpectedState(
  file: PlannedFile,
  observed: string | null,
): boolean {
  return observed === file.observedDigest || observed === file.expectedDigest;
}

function drift(file: PlannedFile): never {
  throw new PrivateConvergentApplyError(
    "CONVERGENT_PATH_DRIFT",
    `Managed path is neither at its planned before nor after digest: ${file.path}`,
    file.path,
  );
}

function writeIntent(plan: RenderPlan, file: PlannedFile) {
  if (file.expectedDigest === null) {
    throw new Error(`Write path has no target digest: ${file.path}`);
  }
  return createPrivateConvergentMutationIntent({
    planDigest: plan.planDigest,
    targetPath: file.path,
    targetDigest: file.expectedDigest,
  });
}

export async function applyPrivateConvergentRenderPlan(
  plan: RenderPlan,
  workspace: PrivateConvergentWorkspace,
  faultInjector?: PrivateConvergentApplyFaultInjector,
): Promise<RenderResult> {
  validateRenderPlanIntegrity(plan);
  if (!plan.safeToApply) {
    throw new PrivateConvergentApplyError(
      "CONVERGENT_PLAN_UNSAFE",
      "Refusing to apply an unsafe render plan.",
    );
  }

  for (const file of plan.files) {
    if (!isExpectedState(file, await observedDigest(workspace, file.path))) {
      drift(file);
    }
  }

  const written: string[] = [];
  const removed: string[] = [];
  const ownership: Record<string, OwnershipClaim> = {
    ...plan.previousOwnership,
  };

  for (const file of plan.files) {
    const current = await observedDigest(workspace, file.path);
    if (!isExpectedState(file, current)) {
      drift(file);
    }

    if (file.expectedDigest !== null) {
      const intent = writeIntent(plan, file);
      if (current === file.expectedDigest) {
        await workspace.discardConvergentTemporary(intent);
      } else {
        await workspace.writeConvergently(
          intent,
          file.expectedContent ?? "",
          async (event) => {
            await faultInjector?.({ kind: event.kind, path: file.path });
          },
        );
        written.push(file.path);
      }
      ownership[file.path] = {
        owner: plan.ownershipKey,
        digest: file.expectedDigest,
      };
    } else if (current !== null) {
      await faultInjector?.({ kind: "path-removing", path: file.path });
      await workspace.removeAtomically(file.path);
      removed.push(file.path);
      delete ownership[file.path];
    } else {
      delete ownership[file.path];
    }

    const after = await observedDigest(workspace, file.path);
    if (after !== file.expectedDigest) {
      throw new PrivateConvergentApplyError(
        "CONVERGENT_PATH_VERIFY_FAILED",
        `Managed path did not reach its target digest: ${file.path}`,
        file.path,
      );
    }
    await faultInjector?.({ kind: "path-applied", path: file.path });
  }

  return {
    planDigest: plan.planDigest,
    written,
    removed,
    ownership,
  };
}
