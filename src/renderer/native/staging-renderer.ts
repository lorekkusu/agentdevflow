import type {
  RenderRequest,
  RendererDiagnostic,
  RendererProvider,
  StagedRender,
  StagingRenderer,
} from "../contract.js";
import {
  validatePrivateRendererSourceMaterialization,
  type PrivateRendererSourceMaterialization,
} from "../materialize-compilation.js";
import { emitClaudeCodeProjectInstructions } from "./claude-code.js";
import { emitCodexProjectInstructions } from "./codex.js";
import type { ProviderEmission } from "./common.js";
import { emitCursorProjectInstructions } from "./cursor.js";

export const nativeProjectInstructionsRendererRevision = 1;

const emitByProvider: Readonly<
  Record<RendererProvider, (body: string) => ProviderEmission>
> = {
  codex: emitCodexProjectInstructions,
  "claude-code": emitClaudeCodeProjectInstructions,
  cursor: emitCursorProjectInstructions,
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sourcePaths(
  materialization: PrivateRendererSourceMaterialization,
): string[] {
  return materialization.files.map((file) => file.path).sort(compareText);
}

function sameValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export class NativeProjectInstructionsRenderer implements StagingRenderer {
  readonly name = "agentdevflow-native";
  readonly ownershipKey = "agentdevflow.renderer.native";
  readonly version = String(nativeProjectInstructionsRendererRevision);

  constructor(
    private readonly materialization: PrivateRendererSourceMaterialization,
  ) {
    validatePrivateRendererSourceMaterialization(materialization);
  }

  async stage(request: RenderRequest): Promise<StagedRender> {
    validatePrivateRendererSourceMaterialization(this.materialization);
    const diagnostics: RendererDiagnostic[] = [];

    if (!request.capabilities.includes("rules")) {
      diagnostics.push({
        code: "MISSING_RENDER_CAPABILITY",
        severity: "error",
        message:
          "The native project-instructions renderer requires the rules capability.",
        capability: "rules",
      });
    }

    for (const capability of [...request.capabilities].sort(compareText)) {
      if (capability === "rules") {
        continue;
      }
      for (const provider of [...request.providers].sort(compareText)) {
        diagnostics.push({
          code: "UNSUPPORTED_CAPABILITY",
          severity: "error",
          message: `${provider} does not support project-scope ${capability} through the native project-instructions renderer.`,
          provider,
          capability,
        });
      }
    }

    const requestedPaths = [...request.sourceFiles].sort(compareText);
    if (
      request.sourceDigest !== this.materialization.digest ||
      !sameValues(requestedPaths, sourcePaths(this.materialization))
    ) {
      diagnostics.push({
        code: "SOURCE_MATERIALIZATION_MISMATCH",
        severity: "error",
        message:
          "The render request does not match the private source materialization.",
      });
    }

    if (
      this.materialization.files.length !== 1 ||
      this.materialization.files[0]?.capability !== "project-instructions"
    ) {
      diagnostics.push({
        code: "UNSUPPORTED_SOURCE_LAYOUT",
        severity: "error",
        message:
          "The native renderer requires exactly one project-instructions source document.",
      });
    }

    diagnostics.sort((left, right) =>
      compareText(left.code, right.code) ||
      compareText(left.provider ?? "", right.provider ?? "") ||
      compareText(left.capability ?? "", right.capability ?? ""),
    );
    if (diagnostics.length > 0) {
      return { files: [], diagnostics };
    }

    const source = this.materialization.files[0];
    if (!source) {
      throw new Error("Validated source materialization is unexpectedly empty.");
    }
    const sourceRefs = [...new Set([source.path, ...source.sourceRefs])].sort(
      compareText,
    );
    const files = [...new Set(request.providers)]
      .sort(compareText)
      .map((provider) => ({
        ...emitByProvider[provider](source.content),
        sourceRefs,
      }));

    return { files, diagnostics: [] };
  }
}
