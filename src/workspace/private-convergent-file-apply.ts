import { createHash } from "node:crypto";

import { createPrivateConvergentMutationIntent } from "./private-convergent-intent.js";
import type {
  PrivateConvergentWorkspace,
  PrivateConvergentWriteEvent,
} from "./private-filesystem-workspace.js";

export interface PrivateConvergentFile {
  readonly path: string;
  readonly beforeDigest: string | null;
  readonly afterContent: string | null;
  readonly afterDigest: string | null;
}

export interface PrivateConvergentFilePlan {
  readonly approvalDigest: string;
  readonly files: readonly PrivateConvergentFile[];
}

export interface PrivateConvergentFileApplyResult {
  readonly written: readonly string[];
  readonly removed: readonly string[];
}

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

const digestPattern = /^[a-f0-9]{64}$/u;

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function unsafe(message: string, path?: string): never {
  throw new PrivateConvergentApplyError(
    "CONVERGENT_PLAN_UNSAFE",
    message,
    path,
  );
}

function validatePlan(plan: PrivateConvergentFilePlan): void {
  if (!digestPattern.test(plan.approvalDigest)) {
    unsafe("Convergent file plan approval digest is invalid.");
  }
  const paths = new Set<string>();
  for (const file of plan.files) {
    if (file.path.length === 0 || paths.has(file.path)) {
      unsafe("Convergent file plan path is empty or duplicated.", file.path);
    }
    paths.add(file.path);
    if (
      (file.beforeDigest !== null && !digestPattern.test(file.beforeDigest)) ||
      (file.afterDigest !== null && !digestPattern.test(file.afterDigest)) ||
      (file.afterContent === null) !== (file.afterDigest === null) ||
      (file.afterContent !== null &&
        digest(file.afterContent) !== file.afterDigest) ||
      (file.beforeDigest === null && file.afterDigest === null)
    ) {
      unsafe(`Convergent file plan state is invalid: ${file.path}`, file.path);
    }
  }
}

async function observedDigest(
  workspace: PrivateConvergentWorkspace,
  path: string,
): Promise<string | null> {
  const content = await workspace.read(path);
  return content === null ? null : digest(content);
}

function isExpectedState(
  file: PrivateConvergentFile,
  observed: string | null,
): boolean {
  return observed === file.beforeDigest || observed === file.afterDigest;
}

function drift(file: PrivateConvergentFile): never {
  throw new PrivateConvergentApplyError(
    "CONVERGENT_PATH_DRIFT",
    `Managed path is neither at its planned before nor after digest: ${file.path}`,
    file.path,
  );
}

export async function applyPrivateConvergentFilePlan(
  plan: PrivateConvergentFilePlan,
  workspace: PrivateConvergentWorkspace,
  faultInjector?: PrivateConvergentApplyFaultInjector,
): Promise<PrivateConvergentFileApplyResult> {
  await preflightPrivateConvergentFilePlan(plan, workspace);

  const written: string[] = [];
  const removed: string[] = [];
  for (const file of plan.files) {
    const current = await observedDigest(workspace, file.path);
    if (!isExpectedState(file, current)) {
      drift(file);
    }

    if (file.afterDigest !== null) {
      const intent = createPrivateConvergentMutationIntent({
        planDigest: plan.approvalDigest,
        targetPath: file.path,
        targetDigest: file.afterDigest,
      });
      if (current === file.afterDigest) {
        await workspace.discardConvergentTemporary(intent);
      } else {
        const outcome = await workspace.writeConvergently(
          intent,
          file.afterContent ?? "",
          {
            beforeDigest: file.beforeDigest,
            afterDigest: file.afterDigest,
          },
          async (event) => {
            await faultInjector?.({ kind: event.kind, path: file.path });
          },
        );
        if (outcome === "drift") {
          drift(file);
        }
        if (outcome === "applied") {
          written.push(file.path);
        }
      }
    } else if (current !== null) {
      await faultInjector?.({ kind: "path-removing", path: file.path });
      const outcome = await workspace.removeAtomically(file.path, {
        beforeDigest: file.beforeDigest,
        afterDigest: file.afterDigest,
      });
      if (outcome === "drift") {
        drift(file);
      }
      if (outcome === "applied") {
        removed.push(file.path);
      }
    }

    if ((await observedDigest(workspace, file.path)) !== file.afterDigest) {
      throw new PrivateConvergentApplyError(
        "CONVERGENT_PATH_VERIFY_FAILED",
        `Managed path did not reach its target digest: ${file.path}`,
        file.path,
      );
    }
    await faultInjector?.({ kind: "path-applied", path: file.path });
  }

  return { written, removed };
}

export async function preflightPrivateConvergentFilePlan(
  plan: PrivateConvergentFilePlan,
  workspace: PrivateConvergentWorkspace,
): Promise<void> {
  validatePlan(plan);
  for (const file of plan.files) {
    if (!isExpectedState(file, await observedDigest(workspace, file.path))) {
      drift(file);
    }
  }
}
