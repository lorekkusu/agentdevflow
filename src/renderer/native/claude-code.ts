import {
  generatedMarkdown,
  nativeProjectInstructionPaths,
  type ProviderEmission,
} from "./common.js";

export function emitClaudeCodeProjectInstructions(
  body: string,
): ProviderEmission {
  return {
    path: nativeProjectInstructionPaths["claude-code"],
    content: generatedMarkdown(body),
  };
}
