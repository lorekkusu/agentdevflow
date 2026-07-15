import assert from "node:assert/strict";
import test from "node:test";

import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import { renderRequestFromCompilation } from "../../src/renderer/from-compilation.js";
import type {
  RenderWorkspace,
  StagingRenderer,
} from "../../src/renderer/contract.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import {
  balancedCandidateConfig,
  reorderedBalancedCandidateConfig,
} from "../fixtures/config/specimens.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";

const materializedInputDigest =
  "7c93b615116e0e872bd80a5fd603b6e5d426fef4d6f582991d0a7fdf9b961e4c";

function compileBalanced(input: unknown): CandidateCompilation {
  const result = compileCandidateProjectConfig(input, initialCompilerOptions);
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
}

test("maps compiled provider intent to a deterministic renderer request", () => {
  const request = renderRequestFromCompilation(
    compileBalanced(balancedCandidateConfig),
    {
      materializedInputDigest,
      sourceFiles: ["rules/review.md", "rules/workflow.md"],
    },
  );

  assert.deepEqual(request.providers, ["claude-code", "codex", "cursor"]);
  assert.deepEqual(request.capabilities, ["rules"]);
  assert.deepEqual(request.sourceFiles, [
    "rules/review.md",
    "rules/workflow.md",
  ]);
  assert.equal(
    request.inputDigest,
    "8602d77a95295d20e9d4f43e8c13d4991b02165cd02a68766528306f039f78ee",
  );
});

test("carries compiler intent through a replaceable staging backend", async () => {
  const request = renderRequestFromCompilation(
    compileBalanced(balancedCandidateConfig),
    {
      materializedInputDigest,
      sourceFiles: ["rules/review.md", "rules/workflow.md"],
    },
  );
  const backend: StagingRenderer = {
    name: "fixture-renderer",
    version: "1",
    ownershipKey: "agentdevflow.renderer.fixture",
    async stage(received) {
      assert.deepEqual(received, request);
      return {
        files: [
          {
            path: "CLAUDE.md",
            content: "generated\n",
            sourceRefs: received.sourceFiles,
          },
          {
            path: "AGENTS.md",
            content: "generated\n",
            sourceRefs: received.sourceFiles,
          },
          {
            path: ".cursor/rules/agentdevflow.mdc",
            content: "generated\n",
            sourceRefs: received.sourceFiles,
          },
        ],
        diagnostics: [],
      };
    },
  };
  const workspace: RenderWorkspace = {
    async read() {
      return null;
    },
    async writeAtomically() {
      throw new Error("This test is plan-only.");
    },
    async removeAtomically() {
      throw new Error("This test is plan-only.");
    },
  };

  const plan = await new StagedRendererAdapter(backend).plan(
    request,
    workspace,
  );
  assert.equal(plan.safeToApply, true);
  assert.deepEqual(
    plan.files.map((file) => ({
      path: file.path,
      sourceRefs: file.sourceRefs,
    })),
    [
      {
        path: ".cursor/rules/agentdevflow.mdc",
        sourceRefs: ["rules/review.md", "rules/workflow.md"],
      },
      {
        path: "AGENTS.md",
        sourceRefs: ["rules/review.md", "rules/workflow.md"],
      },
      {
        path: "CLAUDE.md",
        sourceRefs: ["rules/review.md", "rules/workflow.md"],
      },
    ],
  );
});

test("keeps the request stable for reorder-equivalent candidate and source input", () => {
  const first = renderRequestFromCompilation(
    compileBalanced(balancedCandidateConfig),
    {
      materializedInputDigest,
      sourceFiles: ["rules/review.md", "rules/workflow.md"],
      ownership: {
        "CLAUDE.md": { owner: "fixture", digest: materializedInputDigest },
        "AGENTS.md": { owner: "fixture", digest: materializedInputDigest },
      },
      adoptPaths: ["CLAUDE.md", "AGENTS.md"],
    },
  );
  const second = renderRequestFromCompilation(
    compileBalanced(reorderedBalancedCandidateConfig),
    {
      materializedInputDigest,
      sourceFiles: ["rules/workflow.md", "rules/review.md"],
      ownership: {
        "AGENTS.md": { owner: "fixture", digest: materializedInputDigest },
        "CLAUDE.md": { owner: "fixture", digest: materializedInputDigest },
      },
      adoptPaths: ["AGENTS.md", "CLAUDE.md"],
    },
  );

  assert.deepEqual(second, first);
});

test("rejects incomplete capability evidence instead of degrading", () => {
  const compilation = compileBalanced(balancedCandidateConfig);
  const incomplete: CandidateCompilation = {
    ...compilation,
    capabilityResolutions: compilation.capabilityResolutions.slice(1),
  };

  assert.throws(
    () =>
      renderRequestFromCompilation(incomplete, {
        materializedInputDigest,
        sourceFiles: ["rules/workflow.md"],
      }),
    /missing capability resolution project-guidance for provider claude-reviewer/u,
  );
});

test("rejects untrusted materialization metadata", () => {
  const compilation = compileBalanced(balancedCandidateConfig);

  assert.throws(
    () =>
      renderRequestFromCompilation(compilation, {
        materializedInputDigest: "not-a-digest",
        sourceFiles: ["rules/workflow.md"],
      }),
    /must be a lowercase SHA-256 digest/u,
  );
  assert.throws(
    () =>
      renderRequestFromCompilation(compilation, {
        materializedInputDigest,
        sourceFiles: ["../outside.md"],
      }),
    /Materialized source path is unsafe/u,
  );
  assert.throws(
    () =>
      renderRequestFromCompilation(compilation, {
        materializedInputDigest,
        sourceFiles: ["rules/workflow.md", "rules\\workflow.md"],
      }),
    /Materialized source path is duplicated/u,
  );
});
