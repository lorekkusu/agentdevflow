import { createHash } from "node:crypto";

import {
  parsePrivateRenderLock,
  privateRenderLockDefaultMaxBytes,
} from "../lock/private-render-lock.js";
import type { RendererProvider } from "../renderer/contract.js";
import {
  nativeProjectInstructionExistingTargetMaxBytes,
  nativeProjectInstructionPaths,
} from "../renderer/native/common.js";
import { nativeProjectInstructionsOwnershipKey } from "../renderer/native/staging-renderer.js";
import type { PrivateFilesystemReadWorkspace } from "../workspace/private-filesystem-workspace.js";

export const privateExistingProjectInstructionMaxBytes =
  nativeProjectInstructionExistingTargetMaxBytes;

export type PrivateExistingProjectTargetDisposition =
  | "absent"
  | "managed-drift"
  | "managed-exact"
  | "managed-missing"
  | "unmanaged-existing";

export type PrivateExistingProjectTargetClassification =
  | "managed"
  | "not-applicable"
  | "unclassified";

export interface PrivateExistingProjectTargetInventory {
  readonly provider: RendererProvider;
  readonly path: string;
  readonly disposition: PrivateExistingProjectTargetDisposition;
  readonly classification: PrivateExistingProjectTargetClassification;
  readonly byteCount: number | null;
  readonly observedDigest: string | null;
  readonly content: string | null;
}

export interface PrivateExistingProjectInventoryDiagnostic {
  readonly code: string;
  readonly level: "error";
  readonly message: string;
  readonly path?: string;
}

export type PrivateExistingProjectInventoryResult =
  | {
      readonly outcome: "inventory";
      readonly exitCode: 0;
      readonly diagnostics: readonly [];
      readonly targets: readonly PrivateExistingProjectTargetInventory[];
    }
  | {
      readonly outcome: "blocked";
      readonly exitCode: 2;
      readonly diagnostics: readonly PrivateExistingProjectInventoryDiagnostic[];
      readonly targets: null;
    };

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function blocked(
  diagnostic: PrivateExistingProjectInventoryDiagnostic,
): PrivateExistingProjectInventoryResult {
  return {
    outcome: "blocked",
    exitCode: 2,
    diagnostics: [diagnostic],
    targets: null,
  };
}

export async function executePrivateExistingProjectInventory(options: {
  readonly lockPath: string;
  readonly workspace: Pick<
    PrivateFilesystemReadWorkspace,
    "readBounded"
  >;
}): Promise<PrivateExistingProjectInventoryResult> {
  let lockContent: string | null;
  try {
    lockContent = await options.workspace.readBounded(
      options.lockPath,
      privateRenderLockDefaultMaxBytes,
    );
  } catch (error) {
    return blocked({
      code: "ONBOARD_LOCK_READ_FAILED",
      level: "error",
      message:
        error instanceof Error
          ? error.message
          : "The ownership lock could not be read.",
      path: options.lockPath,
    });
  }

  let lock: ReturnType<typeof parsePrivateRenderLock> | null = null;
  if (lockContent !== null) {
    try {
      lock = parsePrivateRenderLock(lockContent);
    } catch (error) {
      return blocked({
        code: "ONBOARD_LOCK_INVALID",
        level: "error",
        message:
          error instanceof Error
            ? error.message
            : "The ownership lock is invalid.",
        path: options.lockPath,
      });
    }
    const ownershipKey = lock.renderer.ownershipKey;
    if (
      ownershipKey !== nativeProjectInstructionsOwnershipKey ||
      lock.files.some(
        (file) =>
          Object.values(nativeProjectInstructionPaths).includes(
            file.path as (typeof nativeProjectInstructionPaths)[keyof typeof nativeProjectInstructionPaths],
          ) &&
          file.owner !== ownershipKey,
      )
    ) {
      return blocked({
        code: "ONBOARD_OWNERSHIP_AMBIGUOUS",
        level: "error",
        message:
          "The ownership lock does not describe unambiguous native project-instruction ownership.",
        path: options.lockPath,
      });
    }
  }

  const claims = new Map(
    (lock?.files ?? []).map((file) => [file.path, file] as const),
  );
  const targets: PrivateExistingProjectTargetInventory[] = [];
  for (const [provider, path] of Object.entries(
    nativeProjectInstructionPaths,
  ).sort(([, left], [, right]) => left.localeCompare(right))) {
    let content: string | null;
    try {
      content = await options.workspace.readBounded(
        path,
        privateExistingProjectInstructionMaxBytes,
      );
    } catch (error) {
      return blocked({
        code: "ONBOARD_TARGET_READ_FAILED",
        level: "error",
        message:
          error instanceof Error
            ? error.message
            : "A supported project-instruction target could not be read.",
        path,
      });
    }
    const claim = claims.get(path);
    const observedDigest = content === null ? null : digest(content);
    let disposition: PrivateExistingProjectTargetDisposition;
    let classification: PrivateExistingProjectTargetClassification;
    if (claim === undefined) {
      disposition = content === null ? "absent" : "unmanaged-existing";
      classification = content === null ? "not-applicable" : "unclassified";
    } else if (content === null) {
      disposition = "managed-missing";
      classification = "managed";
    } else if (claim.contentDigest === observedDigest) {
      disposition = "managed-exact";
      classification = "managed";
    } else {
      disposition = "managed-drift";
      classification = "managed";
    }
    targets.push({
      provider: provider as RendererProvider,
      path,
      disposition,
      classification,
      byteCount: content === null ? null : Buffer.byteLength(content, "utf8"),
      observedDigest,
      content,
    });
  }
  return {
    outcome: "inventory",
    exitCode: 0,
    diagnostics: [],
    targets,
  };
}
