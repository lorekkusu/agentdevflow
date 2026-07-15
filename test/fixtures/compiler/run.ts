import { compileCandidateProjectConfig } from "../../../src/compiler/compile-candidate.js";
import {
  balancedCandidateConfig,
  fastCandidateConfig,
} from "../config/specimens.js";
import { initialCompilerOptions } from "./capabilities.js";

const fixtures = [
  ["balanced", balancedCandidateConfig],
  ["fast", fastCandidateConfig],
] as const;

const output = fixtures.map(([name, input]) => {
  const result = compileCandidateProjectConfig(input, initialCompilerOptions);
  if (!result.ok) {
    throw new Error(`Compiler fixture ${name} failed.`);
  }
  return {
    name,
    configDigest: result.compilation.configDigest,
    compilerDigest: result.compilation.compilerDigest,
    definition: `${result.compilation.workflow.definitionId}@${result.compilation.workflow.definitionRevision}`,
    budget: result.compilation.budget,
    capabilities: result.compilation.capabilityResolutions,
    exploredStates: result.compilation.policyValidation.exploredStates,
  };
});

console.log(JSON.stringify(output, null, 2));
