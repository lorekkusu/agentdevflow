import {
  applyPrivateConvergentFilePlan,
  PrivateConvergentApplyError,
  type PrivateConvergentApplyFaultInjector,
} from "../workspace/private-convergent-file-apply.js";
import type { PrivateConvergentWorkspace } from "../workspace/private-filesystem-workspace.js";
import type {
  OwnershipClaim,
  RenderPlan,
  RenderResult,
} from "./contract.js";
import { validateRenderPlanIntegrity } from "./staged-adapter.js";

export {
  PrivateConvergentApplyError,
  type PrivateConvergentApplyErrorCode,
  type PrivateConvergentApplyEvent,
  type PrivateConvergentApplyFaultInjector,
} from "../workspace/private-convergent-file-apply.js";

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

  const fileMutations = plan.files.filter(
    (file) => file.action !== "delete" || file.observedDigest !== null,
  );
  const applied = await applyPrivateConvergentFilePlan(
    {
      approvalDigest: plan.planDigest,
      files: fileMutations.map((file) => ({
        path: file.path,
        beforeDigest: file.observedDigest,
        afterContent: file.expectedContent,
        afterDigest: file.expectedDigest,
      })),
    },
    workspace,
    faultInjector,
  );
  const ownership: Record<string, OwnershipClaim> = {
    ...plan.previousOwnership,
  };
  for (const file of plan.files) {
    if (file.expectedDigest !== null) {
      ownership[file.path] = {
        owner: plan.ownershipKey,
        digest: file.expectedDigest,
      };
    } else {
      delete ownership[file.path];
    }
  }

  return {
    planDigest: plan.planDigest,
    written: applied.written,
    removed: applied.removed,
    ownership,
  };
}
