import { createHash } from "node:crypto";

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
  composePrivateProviderInstructionViews,
  readPrivateProjectGuidance,
} from "../guidance/private-project-guidance.js";
import {
  analyzePrivateProjectInstructionsImport,
} from "../import/private-project-instructions-analyzer.js";
import {
  parsePrivateRenderLock,
  privateRenderLockDefaultMaxBytes,
  type PrivateRenderLock,
} from "../lock/private-render-lock.js";
import type {
  InitializationImportAuthorization,
  ExistingTargetReplacementAuthorization,
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
import {
  nativeProjectInstructionExistingTargetMaxBytes,
  nativeProjectInstructionPaths,
} from "../renderer/native/common.js";
import type { PrivateFilesystemReadWorkspace } from "../workspace/private-filesystem-workspace.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../workflows/private-local-reviewed-change.js";
import { privateIssueToPullRequestCapabilityObservations } from "../workflows/private-issue-to-reviewed-pull-request.js";

export interface PreparePrivateDomainProjectPlanOptions
  extends PrivateDomainProjectDocumentLimits {
  readonly content: string;
  readonly lockPath: string;
  readonly workspace: RenderReadWorkspace &
    Pick<
      PrivateFilesystemReadWorkspace,
      "listDirectoryBounded" | "readBounded"
    >;
  readonly existingTargetReplacements?: readonly {
    readonly path: string;
    readonly observedDigest: string;
  }[];
}

export interface PrivateDomainProjectPlanDiagnostic {
  readonly stage: "planning";
  readonly code:
    | "BASE_LOCK_INVALID"
    | "LOCK_READ_FAILED"
    | "PROJECT_GUIDANCE_READ_FAILED"
    | "PROVIDER_PRODUCT_TARGET_AMBIGUOUS"
    | "RULE_AGGREGATE_LAYOUT_UNSUPPORTED"
    | "RULE_ID_DUPLICATE"
    | "RULE_ID_INVALID";
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
  const existingTargetReplacements = new Map(
    (preparation.request.existingTargetReplacements ?? []).map(
      (authorization) => [authorization.path, authorization] as const,
    ),
  );
  const recoveredPaths = new Set<string>();
  const files = preparation.plan.files.map((file) => {
    const claim = baseOwnership[file.path];
    const replacement = existingTargetReplacements.get(file.path);
    if (
      claim === undefined &&
      replacement !== undefined &&
      file.action === "conflict" &&
      file.observedDigest === file.expectedDigest &&
      replacement.targetDigest === file.expectedDigest
    ) {
      recoveredPaths.add(file.path);
      return {
        ...file,
        action: "update" as const,
        observedDigest: replacement.observedDigest,
      };
    }
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
        (diagnostic.code === "OWNERSHIP_CONFLICT" ||
          diagnostic.code === "EXISTING_TARGET_REPLACEMENT_STALE") &&
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
    : privateIssueToPullRequestCapabilityObservations;
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

async function renderRequestWithExistingTargets(options: {
  readonly project: PrivateResolvedDomainProject;
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly workspace: RenderReadWorkspace &
    Pick<PrivateFilesystemReadWorkspace, "readBounded">;
  readonly ownership: Readonly<Record<string, OwnershipClaim>>;
  readonly existingTargetReplacements: readonly {
    readonly path: string;
    readonly observedDigest: string;
  }[];
}): Promise<{
  readonly request: RenderRequest;
  readonly diagnostics: readonly RendererDiagnostic[];
}> {
  const baseRequest = renderRequestFromPrivateDomainProjectMaterialization(
    options.project,
    options.materialization,
    { ownership: options.ownership },
  );
  const stagingRenderer = new NativeProjectInstructionsRenderer(
    options.materialization,
  );
  const staged = await stagingRenderer.stage(baseRequest);
  if (staged.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { request: baseRequest, diagnostics: [] };
  }

  const providerByPath = new Map<string, RendererProvider>(
    Object.entries(nativeProjectInstructionPaths).map(([provider, path]) => [
      path,
      provider as keyof typeof nativeProjectInstructionPaths,
    ]),
  );
  const adoptPaths: string[] = [];
  const initializationImports: InitializationImportAuthorization[] = [];
  const existingTargetReplacements: ExistingTargetReplacementAuthorization[] = [];
  const diagnostics: RendererDiagnostic[] = [];
  const supportedPaths = new Set(Object.values(nativeProjectInstructionPaths));
  const replacementByPath = new Map<string, string>();
  for (const replacement of options.existingTargetReplacements) {
    if (
      !supportedPaths.has(
        replacement.path as (typeof nativeProjectInstructionPaths)[keyof typeof nativeProjectInstructionPaths],
      ) ||
      !/^[a-f0-9]{64}$/u.test(replacement.observedDigest) ||
      replacementByPath.has(replacement.path)
    ) {
      diagnostics.push({
        code: "EXISTING_TARGET_REPLACEMENT_INVALID",
        severity: "error",
        message: `Existing target replacement input is invalid or duplicated at ${replacement.path}.`,
        path: replacement.path,
      });
      continue;
    }
    if (options.ownership[replacement.path] !== undefined) {
      diagnostics.push({
        code: "EXISTING_TARGET_REPLACEMENT_MANAGED_STATE",
        severity: "error",
        message:
          "Existing target replacement authorization is accepted only for a currently unmanaged target.",
        path: replacement.path,
      });
      continue;
    }
    replacementByPath.set(replacement.path, replacement.observedDigest);
  }
  const usedReplacementPaths = new Set<string>();
  for (const file of staged.files) {
    const provider = providerByPath.get(file.path);
    if (provider === undefined) {
      continue;
    }
    if (options.ownership[file.path] !== undefined) {
      continue;
    }
    const existing = await options.workspace.readBounded(
      file.path,
      nativeProjectInstructionExistingTargetMaxBytes,
    );
    if (existing === null) {
      continue;
    }
    const configuredReplacementDigest = replacementByPath.get(file.path);
    if (existing === file.content) {
      if (
        configuredReplacementDigest !== undefined &&
        configuredReplacementDigest !== createHash("sha256").update(existing).digest("hex")
      ) {
        existingTargetReplacements.push({
          path: file.path,
          observedDigest: configuredReplacementDigest,
          targetDigest: createHash("sha256").update(file.content).digest("hex"),
        });
        usedReplacementPaths.add(file.path);
        continue;
      }
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
    const replacementDigest = configuredReplacementDigest;
    if (
      replacementDigest !== undefined &&
      replacementDigest === assessment.observedDigest
    ) {
      existingTargetReplacements.push({
        path: file.path,
        observedDigest: replacementDigest,
        targetDigest: createHash("sha256").update(file.content).digest("hex"),
      });
      usedReplacementPaths.add(file.path);
      continue;
    }
    if (replacementDigest !== undefined) {
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
  for (const [path] of replacementByPath) {
    if (usedReplacementPaths.has(path)) {
      continue;
    }
    diagnostics.push({
      code: "EXISTING_TARGET_REPLACEMENT_STALE",
      severity: "error",
      message:
        "Existing target replacement input is unnecessary or does not match the current unmanaged target bytes.",
      path,
    });
  }

  return {
    request: renderRequestFromPrivateDomainProjectMaterialization(
      options.project,
      options.materialization,
      {
        ownership: options.ownership,
        adoptPaths,
        initializationImports,
        existingTargetReplacements,
      },
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
    lockContent = await options.workspace.readBounded(
      options.lockPath,
      privateRenderLockDefaultMaxBytes,
    );
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
  const guidanceResult = await readPrivateProjectGuidance(options.workspace);
  if (!guidanceResult.ok) {
    return { ok: false, diagnostics: guidanceResult.diagnostics };
  }
  const composed = composePrivateProviderInstructionViews(
    project,
    guidanceResult.guidance,
  );
  if (!composed.ok) {
    return { ok: false, diagnostics: composed.diagnostics };
  }
  const materialization = materializePrivateDomainProject(
    project,
    guidanceResult.guidance,
  );
  const initialization = await renderRequestWithExistingTargets({
    project,
    materialization,
    workspace: options.workspace,
    ownership: ownershipFromLock(baseLock),
    existingTargetReplacements: options.existingTargetReplacements ?? [],
  });
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
