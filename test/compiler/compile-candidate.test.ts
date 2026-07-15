import assert from "node:assert/strict";
import test from "node:test";

import {
  balancedWorkflowDefinition,
  fastWorkflowDefinition,
} from "../../src/compiler/built-in-definitions.js";
import {
  compileCandidateProjectConfig,
  compileCandidateWithDefinition,
} from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilationResult } from "../../src/compiler/private-model.js";
import {
  balancedCandidateConfig,
  fastCandidateConfig,
  reorderedBalancedCandidateConfig,
} from "../fixtures/config/specimens.js";
import {
  directBypassDefinition,
  staleEvidenceDefinition,
} from "../fixtures/compiler/definitions.js";
import {
  initialCapabilityAvailability,
  initialCompilerOptions,
} from "../fixtures/compiler/capabilities.js";

function expectSuccess(
  result: CandidateCompilationResult,
): asserts result is Extract<CandidateCompilationResult, { ok: true }> {
  assert.equal(result.ok, true);
}

function expectFailure(
  result: CandidateCompilationResult,
): asserts result is Extract<CandidateCompilationResult, { ok: false }> {
  assert.equal(result.ok, false);
}

test("compiles the versioned Fast workflow with a review policy", () => {
  const result = compileCandidateProjectConfig(
    fastCandidateConfig,
    initialCompilerOptions,
  );
  expectSuccess(result);
  assert.equal(result.compilation.workflow.definitionId, "builtin/fast");
  assert.equal(result.compilation.workflow.definitionRevision, 1);
  assert.equal(result.compilation.workflow.transitions.length, 3);
  assert.deepEqual(
    result.compilation.policies.map((policy) => policy.id),
    ["merge-requires-review-verdict"],
  );
  assert.equal(result.compilation.policyValidation.safe, true);
  assert.equal(result.compilation.policyValidation.exploredStates, 4);
  assert.equal(
    result.compilation.compilerDigest,
    "178d3655e56585c1ccb655e6ef036faaf2a3ba5bcf89911358a9d2c2c62f2631",
  );
  assert.deepEqual(result.compilation.capabilityResolutions, [
    {
      requirementId: "project-guidance",
      providerId: "codex-primary",
      capability: "project-instructions",
      requiredStrength: "advisory",
      observedStrength: "advisory",
      mechanism: "instruction-file",
    },
  ]);
  assert.deepEqual(result.compilation.budget, {
    nodeCount: 4,
    artifactTypeCount: 1,
    theoreticalMaxStates: "8",
    configuredMaxStates: 128,
  });
});

test("compiles a safe cyclic Balanced workflow with closed policies", () => {
  const result = compileCandidateProjectConfig(
    balancedCandidateConfig,
    initialCompilerOptions,
  );
  expectSuccess(result);
  assert.equal(result.compilation.workflow.definitionId, "builtin/balanced");
  assert.equal(result.compilation.workflow.definitionRevision, 1);
  assert.deepEqual(
    result.compilation.policies.map((policy) => policy.id),
    [
      "merge-forbids-blocking-finding",
      "merge-requires-review-verdict",
    ],
  );
  assert.equal(result.compilation.policyValidation.safe, true);
  assert.equal(result.compilation.policyValidation.exploredStates, 5);
  assert.equal(
    result.compilation.compilerDigest,
    "b8c20f566071abf4fbd85058f2183d20bb4fa54fa8a554ab514325b8ebd8c9f8",
  );
  assert.deepEqual(result.compilation.budget, {
    nodeCount: 5,
    artifactTypeCount: 2,
    theoreticalMaxStates: "20",
    configuredMaxStates: 128,
  });
});

test("keeps compiler output deterministic for reorder-equivalent intent", () => {
  const first = compileCandidateProjectConfig(
    balancedCandidateConfig,
    initialCompilerOptions,
  );
  const second = compileCandidateProjectConfig(
    reorderedBalancedCandidateConfig,
    initialCompilerOptions,
  );
  expectSuccess(first);
  expectSuccess(second);
  assert.deepEqual(second.compilation, first.compilation);
  assert.equal(
    first.compilation.compilerDigest,
    "b8c20f566071abf4fbd85058f2183d20bb4fa54fa8a554ab514325b8ebd8c9f8",
  );
});

test("rejects a direct merge bypass with the shortest counterexample", () => {
  const first = compileCandidateWithDefinition(
    balancedCandidateConfig,
    directBypassDefinition,
    initialCompilerOptions,
  );
  const second = compileCandidateWithDefinition(
    balancedCandidateConfig,
    directBypassDefinition,
    initialCompilerOptions,
  );
  expectFailure(first);
  expectFailure(second);
  assert.deepEqual(second.diagnostics, first.diagnostics);
  const diagnostic = first.diagnostics[0];
  assert.equal(diagnostic?.stage, "policy");
  if (diagnostic?.stage !== "policy") {
    assert.fail("Expected a policy diagnostic.");
  }
  assert.equal(diagnostic.violation.code, "MISSING_REQUIRED_ARTIFACT");
  assert.deepEqual(
    diagnostic.violation.counterexample.map((step) => step.transition),
    ["01-plan-implement", "02-implement-merge-bypass"],
  );
});

test("rejects stale review evidence after implementation resumes", () => {
  const result = compileCandidateWithDefinition(
    balancedCandidateConfig,
    staleEvidenceDefinition,
    initialCompilerOptions,
  );
  expectFailure(result);
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic?.stage, "policy");
  if (diagnostic?.stage !== "policy") {
    assert.fail("Expected a policy diagnostic.");
  }
  assert.deepEqual(
    diagnostic.violation.counterexample.map((step) => step.transition),
    [
      "01-plan-implement",
      "02-implement-review",
      "03-review-reimplement",
      "04-reimplement-merge",
    ],
  );
  assert.deepEqual(
    diagnostic.violation.counterexample[2]?.invalidates,
    ["ReviewVerdict"],
  );
});

test("rejects a workflow before exploration when its upper bound exceeds budget", () => {
  const result = compileCandidateProjectConfig(balancedCandidateConfig, {
    ...initialCompilerOptions,
    maxAbstractStates: 19,
  });
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      stage: "budget",
      code: "STATE_SPACE_BUDGET_EXCEEDED",
      path: "$.workflow",
      message:
        "Workflow builtin/balanced@1 has a theoretical 20 abstract states, exceeding the configured limit 19.",
      budget: {
        nodeCount: 5,
        artifactTypeCount: 2,
        theoreticalMaxStates: "20",
        configuredMaxStates: 19,
      },
    },
  ]);
});

test("keeps the compiler digest independent from a passing analysis budget", () => {
  const defaultBudget = compileCandidateProjectConfig(
    balancedCandidateConfig,
    initialCompilerOptions,
  );
  const exactBudget = compileCandidateProjectConfig(balancedCandidateConfig, {
    ...initialCompilerOptions,
    maxAbstractStates: 20,
  });
  expectSuccess(defaultBudget);
  expectSuccess(exactBudget);
  assert.equal(
    exactBudget.compilation.compilerDigest,
    defaultBudget.compilation.compilerDigest,
  );
  assert.equal(exactBudget.compilation.budget.configuredMaxStates, 20);
});

test("rejects a definition that does not match the selected preset", () => {
  const result = compileCandidateWithDefinition(
    fastCandidateConfig,
    balancedWorkflowDefinition,
    initialCompilerOptions,
  );
  expectFailure(result);
  assert.equal(result.diagnostics[0]?.code, "PRESET_DEFINITION_MISMATCH");
});

test("rejects malformed private definitions instead of normalizing them away", () => {
  const malformedDefinition = {
    ...fastWorkflowDefinition,
    id: "fixture/malformed",
    nodes: [...fastWorkflowDefinition.nodes, "plan"],
    transitions: [
      ...fastWorkflowDefinition.transitions,
      {
        id: "04-undeclared-artifact",
        from: "review",
        to: "merge",
        role: "reviewer",
        produces: ["UndeclaredEvidence"],
      },
    ],
  } as const;
  const result = compileCandidateWithDefinition(
    fastCandidateConfig,
    malformedDefinition,
    initialCompilerOptions,
  );
  expectFailure(result);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.message),
    [
      "Transition 04-undeclared-artifact uses undeclared workflow artifact type UndeclaredEvidence.",
      "Workflow definition has duplicate node: plan.",
    ],
  );
});

test("rejects workflow artifact requirements absent from candidate intent", () => {
  const input = {
    ...balancedCandidateConfig,
    review: {
      ...balancedCandidateConfig.review,
      requiredBeforeMerge: false,
      artifactTypes: ["ReviewVerdict"] as const,
    },
  };
  const result = compileCandidateWithDefinition(
    input,
    balancedWorkflowDefinition,
    initialCompilerOptions,
  );
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      stage: "resolution",
      code: "MISSING_ARTIFACT_TYPE",
      path: "$.review.artifactTypes",
      message:
        "Workflow definition builtin/balanced@1 requires undeclared artifact type BlockingFinding.",
    },
  ]);
});

test("maps candidate configuration failures into the compiler stage", () => {
  const result = compileCandidateProjectConfig(
    {
      ...fastCandidateConfig,
      preset: "unknown",
    },
    initialCompilerOptions,
  );
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      stage: "configuration",
      code: "CONFIG_INVALID_VALUE",
      path: "$.preset",
      message: "$.preset must be one of: balanced, fast.",
    },
  ]);
});

test("rejects invalid internal state-space budget options", () => {
  assert.throws(
    () =>
      compileCandidateWithDefinition(fastCandidateConfig, fastWorkflowDefinition, {
        ...initialCompilerOptions,
        maxAbstractStates: 0,
      }),
    /maxAbstractStates must be a positive safe integer\./u,
  );
});

test("rejects duplicate internal capability observations", () => {
  assert.throws(
    () =>
      compileCandidateProjectConfig(fastCandidateConfig, {
        capabilityAvailability: [
          initialCapabilityAvailability[2],
          initialCapabilityAvailability[2],
        ],
      }),
    /Capability availability is duplicated for codex-primary and project-instructions\./u,
  );
});

test("fails visibly when required capability availability is missing", () => {
  const result = compileCandidateProjectConfig(fastCandidateConfig);
  expectFailure(result);
  assert.equal(result.diagnostics[0]?.stage, "capability");
  assert.equal(result.diagnostics[0]?.code, "CAPABILITY_UNAVAILABLE");
  assert.equal(result.diagnostics[0]?.path, "$.providers[id=codex-primary]");
});

test("rejects a weaker capability instead of silently degrading", () => {
  const guardedDefinition = {
    ...fastWorkflowDefinition,
    id: "fixture/guarded-capability",
    capabilityRequirements: [
      {
        id: "guarded-project-guidance",
        capability: "project-instructions",
        providerScope: "all-provider-instances",
        requiredStrength: "guarded",
      },
    ],
  } as const;
  const result = compileCandidateWithDefinition(
    fastCandidateConfig,
    guardedDefinition,
    { capabilityAvailability: initialCapabilityAvailability },
  );
  expectFailure(result);
  const diagnostic = result.diagnostics[0];
  assert.equal(diagnostic?.stage, "capability");
  if (diagnostic?.stage !== "capability") {
    assert.fail("Expected a capability diagnostic.");
  }
  assert.equal(diagnostic.code, "CAPABILITY_STRENGTH_INSUFFICIENT");
  assert.match(diagnostic.message, /below required guarded strength/u);
});
