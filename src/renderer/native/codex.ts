import { generatedMarkdown, type ProviderEmission } from "./common.js";

export function emitCodexProjectInstructions(body: string): ProviderEmission {
  return {
    path: "AGENTS.md",
    content: generatedMarkdown(body),
  };
}
