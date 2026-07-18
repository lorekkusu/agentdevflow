import { createHash } from "node:crypto";

import {
  derivePrivateRenderLockIntent,
  serializePrivateRenderLock,
  validatePrivateRenderLock,
  type PrivateRenderLock,
} from "../lock/private-render-lock.js";
import {
  validatePrivateRendererSourceMaterialization,
  type PrivateRendererSourceMaterialization,
} from "../renderer/materialize-compilation.js";
import {
  executePrivateCheckCommand,
  type ExecutePrivateCheckCommandOptions,
  type PrivateCheckDiagnostic,
  type PrivateCheckDiagnosticLevel,
  type PrivateCheckOutcome,
} from "./private-check-command-service.js";
import {
  validatePrivateRenderPlanSnapshot,
  type PrivateRenderPlanSnapshot,
} from "./private-render-plan-snapshot.js";

export type PrivateDiffChangeKind = "managed-output" | "render-lock";

export type PrivateDiffChangeAction = "create" | "update" | "delete";

export interface PrivateDiffChange {
  readonly kind: PrivateDiffChangeKind;
  readonly path: string;
  readonly action: PrivateDiffChangeAction;
  readonly beforeDigest: string | null;
  readonly afterDigest: string | null;
  readonly beforeContent: string | null;
  readonly afterContent: string | null;
}

export interface PrivateDiffDiagnostic
  extends Omit<PrivateCheckDiagnostic, "source"> {
  readonly source: "diff" | PrivateCheckDiagnostic["source"];
}

export type ExecutePrivateDiffCommandOptions = ExecutePrivateCheckCommandOptions;

export interface PrivateDiffCommandResult {
  readonly outcome: PrivateCheckOutcome;
  readonly candidateExitCode: 0 | 1 | 2;
  readonly snapshotDigest: string | null;
  readonly planDigest: string | null;
  readonly diagnostics: readonly PrivateDiffDiagnostic[];
  readonly changes: readonly PrivateDiffChange[];
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareDiagnostics(
  left: PrivateDiffDiagnostic,
  right: PrivateDiffDiagnostic,
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

function diffDiagnostic(
  code: string,
  level: PrivateCheckDiagnosticLevel,
  message: string,
  path?: string,
): PrivateDiffDiagnostic {
  return {
    source: "diff",
    code,
    level,
    message,
    ...(path === undefined ? {} : { path }),
  };
}

function blocked(options: {
  readonly diagnostics: readonly PrivateDiffDiagnostic[];
  readonly snapshotDigest: string | null;
  readonly planDigest: string | null;
}): PrivateDiffCommandResult {
  return {
    outcome: "blocked",
    candidateExitCode: 2,
    snapshotDigest: options.snapshotDigest,
    planDigest: options.planDigest,
    diagnostics: [...options.diagnostics].sort(compareDiagnostics),
    changes: [],
  };
}

function result(options: {
  readonly diagnostics: readonly PrivateDiffDiagnostic[];
  readonly snapshotDigest: string;
  readonly planDigest: string;
  readonly changes: readonly PrivateDiffChange[];
}): PrivateDiffCommandResult {
  const changes = [...options.changes].sort(
    (left, right) =>
      compareText(left.path, right.path) || compareText(left.kind, right.kind),
  );
  const outcome: PrivateCheckOutcome =
    changes.length === 0 ? "clean" : "changes-required";
  return {
    outcome,
    candidateExitCode: outcome === "clean" ? 0 : 1,
    snapshotDigest: options.snapshotDigest,
    planDigest: options.planDigest,
    diagnostics: [...options.diagnostics].sort(compareDiagnostics),
    changes,
  };
}

function validateInputs(options: ExecutePrivateDiffCommandOptions): {
  readonly snapshot: PrivateRenderPlanSnapshot;
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly baseLock: PrivateRenderLock | null;
} {
  validatePrivateRenderPlanSnapshot(options.snapshot);
  const snapshot = options.snapshot;
  const materialization =
    options.materialization as PrivateRendererSourceMaterialization;
  validatePrivateRendererSourceMaterialization(materialization);
  let baseLock: PrivateRenderLock | null = null;
  if (options.baseLock !== null) {
    validatePrivateRenderLock(options.baseLock);
    baseLock = options.baseLock;
  }
  return { snapshot, materialization, baseLock };
}

function changeAction(
  beforeContent: string | null,
  afterContent: string | null,
): PrivateDiffChangeAction {
  return beforeContent === null
    ? "create"
    : afterContent === null
      ? "delete"
      : "update";
}

export async function executePrivateDiffCommand(
  options: ExecutePrivateDiffCommandOptions,
): Promise<PrivateDiffCommandResult> {
  const check = await executePrivateCheckCommand(options);
  if (check.outcome === "blocked") {
    return blocked({
      diagnostics: check.diagnostics,
      snapshotDigest: check.snapshotDigest,
      planDigest: check.planDigest,
    });
  }

  let inputs: ReturnType<typeof validateInputs>;
  try {
    inputs = validateInputs(options);
  } catch (error) {
    return blocked({
      diagnostics: [
        ...check.diagnostics,
        diffDiagnostic(
          "DIFF_INPUT_REVALIDATION_FAILED",
          "error",
          `Validated check input could not be revalidated: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
      snapshotDigest: check.snapshotDigest,
      planDigest: check.planDigest,
    });
  }

  const diagnostics: PrivateDiffDiagnostic[] = check.diagnostics.filter(
    (diagnostic) => diagnostic.level !== "change",
  );
  const changes: PrivateDiffChange[] = [];
  for (const file of inputs.snapshot.plan.files) {
    let beforeContent: string | null;
    try {
      beforeContent = await options.workspace.read(file.path);
    } catch (error) {
      return blocked({
        diagnostics: [
          ...diagnostics,
          diffDiagnostic(
            "DIFF_WORKSPACE_READ_FAILED",
            "error",
            `Managed path could not be read for diff: ${error instanceof Error ? error.message : String(error)}`,
            file.path,
          ),
        ],
        snapshotDigest: inputs.snapshot.digest,
        planDigest: inputs.snapshot.plan.planDigest,
      });
    }
    const beforeDigest =
      beforeContent === null ? null : digest(beforeContent);
    if (beforeDigest === file.expectedDigest) {
      continue;
    }
    if (
      beforeDigest !== file.observedDigest ||
      file.action === "conflict" ||
      file.action === "unchanged"
    ) {
      return blocked({
        diagnostics: [
          ...diagnostics,
          diffDiagnostic(
            "DIFF_OBSERVATION_CHANGED",
            "error",
            `Managed path changed after check and has no safe exact diff: ${file.path}`,
            file.path,
          ),
        ],
        snapshotDigest: inputs.snapshot.digest,
        planDigest: inputs.snapshot.plan.planDigest,
      });
    }
    changes.push({
      kind: "managed-output",
      path: file.path,
      action: changeAction(beforeContent, file.expectedContent),
      beforeDigest,
      afterDigest: file.expectedDigest,
      beforeContent,
      afterContent: file.expectedContent,
    });
  }

  let targetLockContent: string;
  try {
    targetLockContent = serializePrivateRenderLock(
      derivePrivateRenderLockIntent({
        materialization: inputs.materialization,
        plan: inputs.snapshot.plan,
      }),
    );
  } catch (error) {
    return blocked({
      diagnostics: [
        ...diagnostics,
        diffDiagnostic(
          "DIFF_TARGET_LOCK_INVALID",
          "error",
          `Target render lock could not be derived for diff: ${error instanceof Error ? error.message : String(error)}`,
          options.lockPath,
        ),
      ],
      snapshotDigest: inputs.snapshot.digest,
      planDigest: inputs.snapshot.plan.planDigest,
    });
  }
  const baseLockContent =
    inputs.baseLock === null
      ? null
      : serializePrivateRenderLock(inputs.baseLock);
  let currentLockContent: string | null;
  try {
    currentLockContent = await options.workspace.read(options.lockPath);
  } catch (error) {
    return blocked({
      diagnostics: [
        ...diagnostics,
        diffDiagnostic(
          "DIFF_WORKSPACE_READ_FAILED",
          "error",
          `Render lock could not be read for diff: ${error instanceof Error ? error.message : String(error)}`,
          options.lockPath,
        ),
      ],
      snapshotDigest: inputs.snapshot.digest,
      planDigest: inputs.snapshot.plan.planDigest,
    });
  }
  if (currentLockContent === targetLockContent) {
    if (changes.length > 0) {
      return blocked({
        diagnostics: [
          ...diagnostics,
          diffDiagnostic(
            "DIFF_LOCK_CONTRADICTORY",
            "error",
            "The target render lock exists while managed output changes remain.",
            options.lockPath,
          ),
        ],
        snapshotDigest: inputs.snapshot.digest,
        planDigest: inputs.snapshot.plan.planDigest,
      });
    }
  } else if (currentLockContent === baseLockContent) {
    changes.push({
      kind: "render-lock",
      path: options.lockPath,
      action: changeAction(currentLockContent, targetLockContent),
      beforeDigest:
        currentLockContent === null ? null : digest(currentLockContent),
      afterDigest: digest(targetLockContent),
      beforeContent: currentLockContent,
      afterContent: targetLockContent,
    });
  } else {
    return blocked({
      diagnostics: [
        ...diagnostics,
        diffDiagnostic(
          "DIFF_LOCK_OBSERVATION_CHANGED",
          "error",
          "The render lock changed after check and has no safe exact diff.",
          options.lockPath,
        ),
      ],
      snapshotDigest: inputs.snapshot.digest,
      planDigest: inputs.snapshot.plan.planDigest,
    });
  }

  return result({
    diagnostics,
    snapshotDigest: inputs.snapshot.digest,
    planDigest: inputs.snapshot.plan.planDigest,
    changes,
  });
}
