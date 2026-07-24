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
export const nativeProjectInstructionsOwnershipKey =
  "agentdevflow.renderer.native";

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
  readonly ownershipKey = nativeProjectInstructionsOwnershipKey;
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

    const requestedProviders = [...new Set(request.providers)].sort(compareText);
    const sourceByProvider = new Map(
      this.materialization.files.map((source) => [source.provider, source]),
    );
    if (
      this.materialization.files.some(
        (source) => source.capability !== "project-instructions",
      ) ||
      requestedProviders.some((provider) => !sourceByProvider.has(provider))
    ) {
      diagnostics.push({
        code: "UNSUPPORTED_SOURCE_LAYOUT",
        severity: "error",
        message:
          "The native renderer requires exactly one project-instructions source document for each requested provider product.",
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

    const files = requestedProviders.map((provider) => {
      const source = sourceByProvider.get(provider);
      if (!source) {
        throw new Error(
          `Validated source materialization is missing provider ${provider}.`,
        );
      }
      return {
        ...emitByProvider[provider](source.content),
        sourceRefs: [...new Set([source.path, ...source.sourceRefs])].sort(
          compareText,
        ),
      };
    });

    return { files, diagnostics: [] };
  }
}
