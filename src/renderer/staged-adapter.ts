import { createHash } from "node:crypto";
import { posix } from "node:path";

import type {
  PlannedFile,
  RenderPlan,
  RenderReadWorkspace,
  RenderRequest,
  RendererBackend,
  RendererDiagnostic,
  StagedFile,
  StagingRenderer,
  VerifyResult,
} from "./contract.js";

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeRelativePath(value: string): string {
  const normalized = posix.normalize(value.replaceAll("\\", "/"));
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    posix.isAbsolute(normalized)
  ) {
    throw new Error(`Renderer produced an unsafe path: ${value}`);
  }
  return normalized;
}

function compareDiagnostics(
  left: RendererDiagnostic,
  right: RendererDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    (left.path ?? "").localeCompare(right.path ?? "") ||
    (left.provider ?? "").localeCompare(right.provider ?? "") ||
    (left.capability ?? "").localeCompare(right.capability ?? "") ||
    left.message.localeCompare(right.message)
  );
}

interface PlanDigestInput {
  readonly backend: string;
  readonly backendVersion: string;
  readonly ownershipKey: string;
  readonly inputDigest: string;
  readonly sourceDigest: string;
  readonly files: readonly PlannedFile[];
}

export function createRenderPlanDigest(input: PlanDigestInput): string {
  return digest(
    JSON.stringify({
      backend: input.backend,
      backendVersion: input.backendVersion,
      inputDigest: input.inputDigest,
      ownershipKey: input.ownershipKey,
      sourceDigest: input.sourceDigest,
      files: input.files.map((file) => ({
        action: file.action,
        digest: file.expectedDigest,
        observedDigest: file.observedDigest,
        path: file.path,
        sourceRefs: file.sourceRefs,
      })),
    }),
  );
}

export function validateRenderPlanIntegrity(plan: RenderPlan): void {
  let previousPath = "";
  for (const [index, file] of plan.files.entries()) {
    const path = normalizeRelativePath(file.path);
    if (path !== file.path || file.path.includes("\\")) {
      throw new Error(`Render plan path is not canonical: ${file.path}`);
    }
    if (index > 0 && previousPath.localeCompare(file.path) >= 0) {
      throw new Error("Render plan paths are not unique and sorted.");
    }
    previousPath = file.path;

    const contentDigest =
      file.expectedContent === null ? null : digest(file.expectedContent);
    if (contentDigest !== file.expectedDigest) {
      throw new Error(`Render plan content digest does not match: ${file.path}`);
    }
    if (
      (file.action === "create" && file.observedDigest !== null) ||
      (file.action === "update" &&
        (file.observedDigest === null ||
          file.expectedDigest === null ||
          file.observedDigest === file.expectedDigest)) ||
      (file.action === "unchanged" &&
        (file.observedDigest === null ||
          file.observedDigest !== file.expectedDigest)) ||
      (file.action === "delete" &&
        (file.expectedContent !== null || file.expectedDigest !== null))
    ) {
      throw new Error(`Render plan action state is inconsistent: ${file.path}`);
    }
  }

  const expectedSafeToApply =
    plan.diagnostics.every((diagnostic) => diagnostic.severity !== "error") &&
    plan.files.every((file) => file.action !== "conflict");
  if (plan.safeToApply !== expectedSafeToApply) {
    throw new Error("Render plan safety flag does not match its contents.");
  }
  if (plan.planDigest !== createRenderPlanDigest(plan)) {
    throw new Error("Render plan digest does not match its contents.");
  }
}

export async function verifyRenderPlan(
  plan: RenderPlan,
  workspace: RenderReadWorkspace,
): Promise<VerifyResult> {
  validateRenderPlanIntegrity(plan);
  const diagnostics: RendererDiagnostic[] = [];

  for (const file of plan.files) {
    if (file.action === "conflict") {
      diagnostics.push({
        code: "PLAN_CONFLICT",
        severity: "error",
        message: `The plan contains an unresolved conflict at ${file.path}.`,
        path: file.path,
      });
      continue;
    }

    const existing = await workspace.read(file.path);
    const matches =
      file.action === "delete"
        ? existing === null
        : existing !== null && digest(existing) === file.expectedDigest;
    if (!matches) {
      diagnostics.push({
        code: "GENERATED_FILE_DRIFT",
        severity: "error",
        message: `Generated file drift detected at ${file.path}.`,
        path: file.path,
      });
    }
  }

  diagnostics.sort(compareDiagnostics);
  return {
    planDigest: plan.planDigest,
    ok: diagnostics.length === 0,
    diagnostics,
  };
}

export class StagedRendererAdapter implements RendererBackend {
  constructor(private readonly backend: StagingRenderer) {}

  async plan(
    request: RenderRequest,
    workspace: RenderReadWorkspace,
  ): Promise<RenderPlan> {
    const staged = await this.backend.stage(request);
    const diagnostics: RendererDiagnostic[] = [...staged.diagnostics];
    const files: PlannedFile[] = [];
    const stagedByPath = new Map<string, StagedFile>();
    const adoptPaths = new Set(
      (request.adoptPaths ?? []).map(normalizeRelativePath),
    );
    const initializationImports = new Map(
      (request.initializationImports ?? []).map((authorization) => [
        normalizeRelativePath(authorization.path),
        authorization,
      ]),
    );
    if (
      initializationImports.size !== (request.initializationImports ?? []).length
    ) {
      throw new Error("Initialization import paths are duplicated.");
    }
    for (const [path, authorization] of initializationImports) {
      if (
        !/^[a-f0-9]{64}$/u.test(authorization.observedDigest) ||
        !/^[a-f0-9]{64}$/u.test(authorization.targetDigest) ||
        authorization.observedDigest === authorization.targetDigest
      ) {
        throw new Error(
          `Initialization import authorization is invalid: ${path}`,
        );
      }
    }
    const usedInitializationImports = new Set<string>();

    for (const stagedFile of staged.files) {
      const path = normalizeRelativePath(stagedFile.path);
      if (stagedByPath.has(path)) {
        diagnostics.push({
          code: "DUPLICATE_OUTPUT_PATH",
          severity: "error",
          message: `The renderer produced ${path} more than once.`,
          path,
        });
        continue;
      }
      stagedByPath.set(path, { ...stagedFile, path });
    }

    for (const [path, stagedFile] of [...stagedByPath].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const existing = await workspace.read(path);
      const observedDigest = existing === null ? null : digest(existing);
      const claim = request.ownership[path];
      const expectedDigest = digest(stagedFile.content);
      const sourceRefs = [...(stagedFile.sourceRefs ?? [])].sort();

      if (sourceRefs.length === 0) {
        diagnostics.push({
          code: "TRACEABILITY_UNAVAILABLE",
          severity: "warning",
          message: `The renderer did not map ${path} to source files.`,
          path,
        });
      }

      let action: PlannedFile["action"] = "create";
      if (claim && claim.owner !== this.backend.ownershipKey) {
        action = "conflict";
      } else if (existing !== null && !claim) {
        const authorization = initializationImports.get(path);
        if (adoptPaths.has(path) && observedDigest === expectedDigest) {
          action = "unchanged";
        } else if (
          authorization &&
          authorization.observedDigest === observedDigest &&
          authorization.targetDigest === expectedDigest &&
          authorization.observedDigest !== authorization.targetDigest
        ) {
          action = "update";
          usedInitializationImports.add(path);
        } else {
          action = "conflict";
        }
      } else if (existing !== null && claim) {
        if (observedDigest !== claim.digest) {
          action = "conflict";
        } else if (observedDigest === expectedDigest) {
          action = "unchanged";
        } else {
          action = "update";
        }
      }

      if (action === "conflict") {
        diagnostics.push({
          code: "OWNERSHIP_CONFLICT",
          severity: "error",
          message: `Refusing to overwrite ${path} without a matching ownership digest.`,
          path,
        });
      }

      files.push({
        path,
        action,
        observedDigest,
        expectedContent: stagedFile.content,
        expectedDigest,
        sourceRefs,
      });
    }

    for (const path of initializationImports.keys()) {
      if (!stagedByPath.has(path)) {
        diagnostics.push({
          code: "INITIALIZATION_IMPORT_TARGET_MISSING",
          severity: "error",
          message: `Initialization import authorization has no renderer output at ${path}.`,
          path,
        });
      } else if (!usedInitializationImports.has(path)) {
        diagnostics.push({
          code: "INITIALIZATION_IMPORT_STALE",
          severity: "error",
          message: `Initialization import authorization does not match current bytes at ${path}.`,
          path,
        });
      }
    }

    for (const [rawPath, claim] of Object.entries(request.ownership).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      const path = normalizeRelativePath(rawPath);
      if (claim.owner !== this.backend.ownershipKey || stagedByPath.has(path)) {
        continue;
      }
      const existing = await workspace.read(path);
      const observedDigest = existing === null ? null : digest(existing);
      const action =
        observedDigest === null || observedDigest === claim.digest
          ? "delete"
          : "conflict";
      if (action === "conflict") {
        diagnostics.push({
          code: "OWNERSHIP_CONFLICT",
          severity: "error",
          message: `Refusing to delete modified generated file ${path}.`,
          path,
        });
      }
      files.push({
        path,
        action,
        observedDigest,
        expectedContent: null,
        expectedDigest: null,
        sourceRefs: [],
      });
    }

    files.sort((left, right) => left.path.localeCompare(right.path));
    diagnostics.sort(compareDiagnostics);
    const safeToApply =
      diagnostics.every((diagnostic) => diagnostic.severity !== "error") &&
      files.every((file) => file.action !== "conflict");

    return {
      backend: this.backend.name,
      backendVersion: this.backend.version,
      ownershipKey: this.backend.ownershipKey,
      inputDigest: request.inputDigest,
      sourceDigest: request.sourceDigest,
      planDigest: createRenderPlanDigest({
        backend: this.backend.name,
        backendVersion: this.backend.version,
        ownershipKey: this.backend.ownershipKey,
        inputDigest: request.inputDigest,
        sourceDigest: request.sourceDigest,
        files,
      }),
      files,
      diagnostics,
      safeToApply,
      previousOwnership: request.ownership,
    };
  }

}
