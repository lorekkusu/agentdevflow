import {
  generatedMarkdown,
  nativeProjectInstructionPaths,
  type ProviderEmission,
} from "./common.js";

export function emitCodexProjectInstructions(body: string): ProviderEmission {
  return {
    path: nativeProjectInstructionPaths.codex,
    content: generatedMarkdown(body),
  };
}
