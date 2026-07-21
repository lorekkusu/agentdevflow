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
  analyzePrivateProjectInstructionsImport,
} from "../import/private-project-instructions-analyzer.js";
import {
  parsePrivateRenderLock,
  type PrivateRenderLock,
} from "../lock/private-render-lock.js";
import type {
  InitializationImportAuthorization,
  OwnershipClaim,
  RenderPlan,
  RenderReadWorkspace,
  RenderRequest,
  RendererDiagnostic,
  RendererProvider,
} from "../renderer/contract.js";
import { renderRequestFromPrivateDomainProjectMaterialization } from "../renderer/from-compilation.js";
import {
  materializePrivateDomainProject,
  type PrivateResolvedDomainProject,
} from "../renderer/materialize-domain-project.js";
import type { PrivateRendererSourceMaterialization } from "../renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../renderer/native/staging-renderer.js";
import {
  createRenderPlanDigest,
  StagedRendererAdapter,
} from "../renderer/staged-adapter.js";
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

/**
 * Reconstructs the approved all-before plan when an interrupted convergent apply
 * left managed paths at exact target bytes while the base lock remains current.
 */
export function reconstructPrivateDomainProjectConvergentPlan(
  preparation: PrivateDomainProjectPlanPreparation,
): PrivateDomainProjectPlanPreparation {
  const baseOwnership = ownershipFromLock(preparation.baseLock);
  const initiallyAdopted = new Set(preparation.request.adoptPaths ?? []);
  const recoveredPaths = new Set<string>();
  const files = preparation.plan.files.map((file) => {
    const claim = baseOwnership[file.path];
    if (file.expectedDigest === null && claim !== undefined) {
      if (file.observedDigest === null) {
        recoveredPaths.add(file.path);
        return {
          ...file,
          action: "delete" as const,
          observedDigest: claim.digest,
        };
      }
      return file;
    }
    if (
      claim === undefined &&
      initiallyAdopted.has(file.path) &&
      file.action === "unchanged" &&
      file.observedDigest === file.expectedDigest
    ) {
      recoveredPaths.add(file.path);
      return { ...file, action: "create" as const, observedDigest: null };
    }
    if (
      file.action !== "conflict" ||
      file.expectedDigest === null ||
      file.observedDigest !== file.expectedDigest
    ) {
      return file;
    }
    recoveredPaths.add(file.path);
    if (claim === undefined) {
      return { ...file, action: "create" as const, observedDigest: null };
    }
    return claim.digest === file.expectedDigest
      ? { ...file, action: "unchanged" as const, observedDigest: claim.digest }
      : { ...file, action: "update" as const, observedDigest: claim.digest };
  });
  const diagnostics = preparation.plan.diagnostics.filter(
    (diagnostic) =>
      !(
        diagnostic.code === "OWNERSHIP_CONFLICT" &&
        diagnostic.path !== undefined &&
        recoveredPaths.has(diagnostic.path)
      ),
  );
  const safeToApply =
    diagnostics.every((diagnostic) => diagnostic.severity !== "error") &&
    files.every((file) => file.action !== "conflict");
  const plan: RenderPlan = {
    ...preparation.plan,
    files,
    diagnostics,
    safeToApply,
    planDigest: createRenderPlanDigest({
      ...preparation.plan,
      files,
    }),
  };
  return {
    ...preparation,
    plan,
    snapshot: createPrivateRenderPlanSnapshot(plan),
  };
}

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

const nativeProviderPaths = {
  "claude-code": "CLAUDE.md",
  codex: "AGENTS.md",
  cursor: ".cursor/rules/agentdevflow.mdc",
} as const satisfies Readonly<Record<RendererProvider, string>>;

function compareDiagnostics(
  left: RendererDiagnostic,
  right: RendererDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.path ?? "").localeCompare(right.path ?? "") ||
    (left.provider ?? "").localeCompare(right.provider ?? "") ||
    left.message.localeCompare(right.message)
  );
}

async function initialRenderRequest(options: {
  readonly project: PrivateResolvedDomainProject;
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly workspace: RenderReadWorkspace;
}): Promise<{
  readonly request: RenderRequest;
  readonly diagnostics: readonly RendererDiagnostic[];
}> {
  const baseRequest = renderRequestFromPrivateDomainProjectMaterialization(
    options.project,
    options.materialization,
  );
  const stagingRenderer = new NativeProjectInstructionsRenderer(
    options.materialization,
  );
  const staged = await stagingRenderer.stage(baseRequest);
  if (staged.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { request: baseRequest, diagnostics: [] };
  }

  const providerByPath = new Map<string, RendererProvider>(
    Object.entries(nativeProviderPaths).map(([provider, path]) => [
      path,
      provider as RendererProvider,
    ]),
  );
  const adoptPaths: string[] = [];
  const initializationImports: InitializationImportAuthorization[] = [];
  const diagnostics: RendererDiagnostic[] = [];
  for (const file of staged.files) {
    const provider = providerByPath.get(file.path);
    if (provider === undefined) {
      continue;
    }
    const existing = await options.workspace.read(file.path);
    if (existing === null) {
      continue;
    }
    if (existing === file.content) {
      adoptPaths.push(file.path);
      continue;
    }
    const assessment = analyzePrivateProjectInstructionsImport({
      provider,
      existingContent: existing,
      targetContent: file.content,
      proposedConfigurationDigest: options.project.resolution.intentDigest,
    });
    if (
      assessment.classification === "lossless" &&
      assessment.proposedTargetDigest !== null
    ) {
      initializationImports.push({
        path: file.path,
        observedDigest: assessment.observedDigest,
        targetDigest: assessment.proposedTargetDigest,
      });
      continue;
    }
    diagnostics.push({
      code: "INITIALIZATION_IMPORT_UNSUPPORTED",
      severity: "error",
      message: `Existing provider content cannot be preserved exactly: ${assessment.informationLoss.join("; ")}`,
      path: file.path,
      provider,
    });
  }

  return {
    request: renderRequestFromPrivateDomainProjectMaterialization(
      options.project,
      options.materialization,
      { adoptPaths, initializationImports },
    ),
    diagnostics: diagnostics.sort(compareDiagnostics),
  };
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
  const initialization =
    baseLock === null
      ? await initialRenderRequest({ project, materialization, workspace: options.workspace })
      : {
          request: renderRequestFromPrivateDomainProjectMaterialization(
            project,
            materialization,
            { ownership: ownershipFromLock(baseLock) },
          ),
          diagnostics: [] as readonly RendererDiagnostic[],
        };
  const request = initialization.request;
  const backend = new StagedRendererAdapter(
    new NativeProjectInstructionsRenderer(materialization),
  );
  const planned = await backend.plan(request, options.workspace);
  const plan: RenderPlan =
    initialization.diagnostics.length === 0
      ? planned
      : {
          ...planned,
          diagnostics: [...planned.diagnostics, ...initialization.diagnostics].sort(
            compareDiagnostics,
          ),
          safeToApply: false,
        };

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
