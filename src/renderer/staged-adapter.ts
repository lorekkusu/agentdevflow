import { createHash } from "node:crypto";
import { posix } from "node:path";

import type {
  OwnershipClaim,
  PlannedFile,
  RenderPlan,
  RenderRequest,
  RendererBackend,
  RendererDiagnostic,
  RenderResult,
  RenderWorkspace,
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

function createPlanDigest(
  backend: StagingRenderer,
  request: RenderRequest,
  files: readonly PlannedFile[],
): string {
  return digest(
    JSON.stringify({
      backend: backend.name,
      backendVersion: backend.version,
      inputDigest: request.inputDigest,
      ownershipKey: backend.ownershipKey,
      sourceDigest: request.sourceDigest,
      files: files.map((file) => ({
        action: file.action,
        digest: file.expectedDigest,
        path: file.path,
        sourceRefs: file.sourceRefs,
      })),
    }),
  );
}

export class StagedRendererAdapter implements RendererBackend {
  constructor(private readonly backend: StagingRenderer) {}

  async plan(
    request: RenderRequest,
    workspace: RenderWorkspace,
  ): Promise<RenderPlan> {
    const staged = await this.backend.stage(request);
    const diagnostics: RendererDiagnostic[] = [...staged.diagnostics];
    const files: PlannedFile[] = [];
    const stagedByPath = new Map<string, StagedFile>();
    const adoptPaths = new Set(
      (request.adoptPaths ?? []).map(normalizeRelativePath),
    );

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
        action =
          adoptPaths.has(path) && digest(existing) === expectedDigest
            ? "unchanged"
            : "conflict";
      } else if (existing !== null && claim) {
        const existingDigest = digest(existing);
        if (existingDigest !== claim.digest) {
          action = "conflict";
        } else if (existingDigest === expectedDigest) {
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
        expectedContent: stagedFile.content,
        expectedDigest,
        sourceRefs,
      });
    }

    for (const [rawPath, claim] of Object.entries(request.ownership).sort(
      ([left], [right]) => left.localeCompare(right),
    )) {
      const path = normalizeRelativePath(rawPath);
      if (claim.owner !== this.backend.ownershipKey || stagedByPath.has(path)) {
        continue;
      }
      const existing = await workspace.read(path);
      const action =
        existing === null || digest(existing) === claim.digest
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
      planDigest: createPlanDigest(this.backend, request, files),
      files,
      diagnostics,
      safeToApply,
      previousOwnership: request.ownership,
    };
  }

  async render(
    plan: RenderPlan,
    workspace: RenderWorkspace,
  ): Promise<RenderResult> {
    if (!plan.safeToApply) {
      throw new Error("Refusing to apply an unsafe render plan.");
    }

    const written: string[] = [];
    const removed: string[] = [];
    const ownership: Record<string, OwnershipClaim> = {
      ...plan.previousOwnership,
    };

    for (const file of plan.files) {
      if (file.action === "create" || file.action === "update") {
        await workspace.writeAtomically(file.path, file.expectedContent ?? "");
        written.push(file.path);
      } else if (file.action === "delete") {
        await workspace.removeAtomically(file.path);
        removed.push(file.path);
        delete ownership[file.path];
      }

      if (file.action !== "delete" && file.expectedDigest !== null) {
        ownership[file.path] = {
          owner: plan.ownershipKey,
          digest: file.expectedDigest,
        };
      }
    }

    return {
      planDigest: plan.planDigest,
      written,
      removed,
      ownership,
    };
  }

  async verify(
    plan: RenderPlan,
    workspace: RenderWorkspace,
  ): Promise<VerifyResult> {
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
}
