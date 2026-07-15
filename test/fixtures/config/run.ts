import { normalizeCandidateProjectConfig } from "../../../src/config/normalize-candidate.js";
import {
  balancedCandidateConfig,
  fastCandidateConfig,
} from "./specimens.js";

const specimens = [
  ["balanced", balancedCandidateConfig],
  ["fast", fastCandidateConfig],
] as const;

const output = specimens.map(([name, input]) => {
  const result = normalizeCandidateProjectConfig(input);
  if (!result.ok) {
    throw new Error(`Candidate specimen ${name} failed normalization.`);
  }
  return {
    name,
    digest: result.digest,
    config: result.config,
  };
});

console.log(JSON.stringify(output, null, 2));
