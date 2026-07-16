import { generatedMarkdown, type ProviderEmission } from "./common.js";

export function emitClaudeCodeProjectInstructions(
  body: string,
): ProviderEmission {
  return {
    path: "CLAUDE.md",
    content: generatedMarkdown(body),
  };
}
