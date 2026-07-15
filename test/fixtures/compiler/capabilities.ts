import type {
  CandidateCompilerOptions,
  PrivateCapabilityAvailability,
} from "../../../src/compiler/private-model.js";

export const initialCapabilityAvailability = [
  {
    providerId: "claude-reviewer",
    capability: "project-instructions",
    strength: "advisory",
    mechanism: "instruction-file",
  },
  {
    providerId: "codex-developer",
    capability: "project-instructions",
    strength: "advisory",
    mechanism: "instruction-file",
  },
  {
    providerId: "codex-primary",
    capability: "project-instructions",
    strength: "advisory",
    mechanism: "instruction-file",
  },
  {
    providerId: "cursor-steward",
    capability: "project-instructions",
    strength: "advisory",
    mechanism: "instruction-file",
  },
] as const satisfies readonly PrivateCapabilityAvailability[];

export const initialCompilerOptions = {
  capabilityAvailability: initialCapabilityAvailability,
} as const satisfies CandidateCompilerOptions;
