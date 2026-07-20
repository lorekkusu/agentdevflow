import {
  createPrivateRenderPlanSnapshot,
  type PrivateRenderPlanSnapshot,
} from "../commands/private-render-plan-snapshot.js";
import {
  compilePrivateDomainProjectDocument,
  parsePrivateDomainProjectDocument,
  type PrivateDomainProjectDocument,
  type PrivateDomainProjectDocumentDiagnostic,
  type PrivateDomainProjectDocumentLimits,
} from "../interface/private-domain-project-document.js";
import {
  parsePrivateRenderLock,
  type PrivateRenderLock,
} from "../lock/private-render-lock.js";
import type {
  OwnershipClaim,
  RenderPlan,
  RenderReadWorkspace,
  RenderRequest,
} from "../renderer/contract.js";
import { renderRequestFromPrivateDomainProjectMaterialization } from "../renderer/from-compilation.js";
import {
  materializePrivateDomainProject,
  type PrivateResolvedDomainProject,
} from "../renderer/materialize-domain-project.js";
import type { PrivateRendererSourceMaterialization } from "../renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../renderer/staged-adapter.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../workflows/private-local-reviewed-change.js";

export interface PreparePrivateDomainProjectPlanOptions
  extends PrivateDomainProjectDocumentLimits {
  readonly content: string;
  readonly lockPath: string;
  readonly workspace: RenderReadWorkspace;
}

export interface PrivateDomainProjectPlanDiagnostic {
  readonly stage: "planning";
  readonly code: "BASE_LOCK_INVALID" | "LOCK_READ_FAILED";
  readonly path: string;
  readonly message: string;
}

export interface PrivateDomainProjectPlanPreparation {
  readonly document: PrivateDomainProjectDocument;
  readonly project: PrivateResolvedDomainProject;
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly request: RenderRequest;
  readonly plan: RenderPlan;
  readonly snapshot: PrivateRenderPlanSnapshot;
  readonly baseLock: PrivateRenderLock | null;
}

export type PrivateDomainProjectPlanResult =
  | ({ readonly ok: true } & PrivateDomainProjectPlanPreparation)
  | {
      readonly ok: false;
      readonly diagnostics: readonly (
        | PrivateDomainProjectDocumentDiagnostic
        | PrivateDomainProjectPlanDiagnostic
      )[];
    };

function nativeCapabilityObservations(
  family: PrivateResolvedDomainProject["normalizedIntent"]["workflow"]["family"],
) {
  return family === "local-reviewed-change"
    ? privateLocalReviewedChangeCapabilityObservations
    : [];
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

function planningDiagnostic(
  code: PrivateDomainProjectPlanDiagnostic["code"],
  path: string,
  message: string,
): PrivateDomainProjectPlanDiagnostic {
  return {
    stage: "planning",
    code,
    path,
    message,
  };
}

export async function preparePrivateDomainProjectPlan(
  options: PreparePrivateDomainProjectPlanOptions,
): Promise<PrivateDomainProjectPlanResult> {
  const parsed = parsePrivateDomainProjectDocument(options.content, options);
  if (!parsed.ok) {
    return parsed;
  }

  const compiled = compilePrivateDomainProjectDocument(options.content, {
    ...(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes }),
    ...(options.maxNestingDepth === undefined
      ? {}
      : { maxNestingDepth: options.maxNestingDepth }),
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
    capabilityObservations: nativeCapabilityObservations(
      parsed.document.intent.workflow.family,
    ),
  });
  if (!compiled.ok) {
    return compiled;
  }

  let baseLock: PrivateRenderLock | null = null;
  let lockContent: string | null;
  try {
    lockContent = await options.workspace.read(options.lockPath);
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        planningDiagnostic(
          "LOCK_READ_FAILED",
          options.lockPath,
          `Private render lock could not be read: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
    };
  }
  if (lockContent !== null) {
    try {
      baseLock = parsePrivateRenderLock(lockContent);
    } catch (error) {
      return {
        ok: false,
        diagnostics: [
          planningDiagnostic(
            "BASE_LOCK_INVALID",
            options.lockPath,
            `Private render base lock is invalid: ${error instanceof Error ? error.message : String(error)}`,
          ),
        ],
      };
    }
  }

  const project = compiled.project;
  const materialization = materializePrivateDomainProject(project);
  const request = renderRequestFromPrivateDomainProjectMaterialization(
    project,
    materialization,
    { ownership: ownershipFromLock(baseLock) },
  );
  const backend = new StagedRendererAdapter(
    new NativeProjectInstructionsRenderer(materialization),
  );
  const plan = await backend.plan(request, options.workspace);

  return {
    ok: true,
    document: compiled.document,
    project,
    materialization,
    request,
    plan,
    snapshot: createPrivateRenderPlanSnapshot(plan),
    baseLock,
  };
}
