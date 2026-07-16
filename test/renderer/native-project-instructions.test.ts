import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import type { RenderWorkspace } from "../../src/renderer/contract.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { generatedMarkdown } from "../../src/renderer/native/common.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import {
  balancedCandidateConfig,
  fastThreeProviderCandidateConfig,
} from "../fixtures/config/specimens.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";

class MemoryWorkspace implements RenderWorkspace {
  readonly files = new Map<string, string>();

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async writeAtomically(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async removeAtomically(path: string): Promise<void> {
    this.files.delete(path);
  }
}

function compile(input: unknown): CandidateCompilation {
  const result = compileCandidateProjectConfig(input, initialCompilerOptions);
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
}

async function stagedPreset(
  preset: "fast" | "balanced",
): Promise<{
  readonly compilation: CandidateCompilation;
  readonly materialization: ReturnType<typeof materializeCompilation>;
  readonly request: ReturnType<typeof renderRequestFromMaterialization>;
  readonly renderer: NativeProjectInstructionsRenderer;
  readonly files: ReadonlyMap<string, string>;
}> {
  const input =
    preset === "fast"
      ? fastThreeProviderCandidateConfig
      : balancedCandidateConfig;
  const compilation = compile(input);
  const materialization = materializeCompilation(compilation);
  const request = renderRequestFromMaterialization(
    compilation,
    materialization,
  );
  const renderer = new NativeProjectInstructionsRenderer(materialization);
  const staged = await renderer.stage(request);
  assert.deepEqual(staged.diagnostics, []);
  return {
    compilation,
    materialization,
    request,
    renderer,
    files: new Map(staged.files.map((file) => [file.path, file.content])),
  };
}

const goldenByOutputPath = {
  "AGENTS.md": "AGENTS.md",
  "CLAUDE.md": "CLAUDE.md",
  ".cursor/rules/agentdevflow.mdc": "agentdevflow.mdc",
} as const;

for (const preset of ["fast", "balanced"] as const) {
  test(`renders ${preset} golden project instructions for all three providers`, async () => {
    const staged = await stagedPreset(preset);
    assert.deepEqual([...staged.files.keys()], [
      "CLAUDE.md",
      "AGENTS.md",
      ".cursor/rules/agentdevflow.mdc",
    ]);

    for (const [outputPath, fixtureName] of Object.entries(
      goldenByOutputPath,
    )) {
      const expected = await readFile(
        join("test", "fixtures", "renderer", "native", preset, fixtureName),
        "utf8",
      );
      const actual = staged.files.get(outputPath);
      assert.equal(actual, expected, `${preset} ${outputPath}`);
      assert.equal(actual?.endsWith("\n"), true);
      assert.doesNotMatch(actual ?? "", /\r/u);
      assert.doesNotMatch(actual ?? "", /Compiler digest|candidate-config/u);
    }
  });
}

test("retains machine provenance outside provider-facing content", async () => {
  const { materialization, request, renderer } = await stagedPreset("balanced");
  const staged = await renderer.stage(request);
  const sourceRefs = staged.files[0]?.sourceRefs ?? [];

  assert.equal(request.sourceDigest, materialization.digest);
  assert.deepEqual(
    sourceRefs,
    [
      materialization.files[0]?.path ?? "",
      ...(materialization.files[0]?.sourceRefs ?? []),
    ].sort(),
  );
  assert.equal(staged.files.every((file) => file.sourceRefs === sourceRefs), true);
});

test("fails closed for unsupported capabilities or mismatched source materialization", async () => {
  const { request, renderer } = await stagedPreset("balanced");
  const unsupported = await renderer.stage({
    ...request,
    capabilities: ["rules", "commands"],
  });
  assert.deepEqual(unsupported.files, []);
  assert.deepEqual(
    unsupported.diagnostics.map(({ code, provider }) => ({ code, provider })),
    [
      { code: "UNSUPPORTED_CAPABILITY", provider: "claude-code" },
      { code: "UNSUPPORTED_CAPABILITY", provider: "codex" },
      { code: "UNSUPPORTED_CAPABILITY", provider: "cursor" },
    ],
  );

  const mismatch = await renderer.stage({
    ...request,
    sourceDigest: "0".repeat(64),
  });
  assert.deepEqual(mismatch.files, []);
  assert.equal(
    mismatch.diagnostics[0]?.code,
    "SOURCE_MATERIALIZATION_MISMATCH",
  );

  const missing = await renderer.stage({ ...request, capabilities: [] });
  assert.deepEqual(missing.files, []);
  assert.equal(missing.diagnostics[0]?.code, "MISSING_RENDER_CAPABILITY");
});

test("deduplicates provider targets and normalizes line endings", async () => {
  const { request, renderer } = await stagedPreset("balanced");
  const staged = await renderer.stage({
    ...request,
    providers: [...request.providers, "codex", "cursor"],
  });

  assert.equal(staged.files.length, 3);
  assert.equal(generatedMarkdown("first\r\nsecond\r"), [
    "<!-- Generated by agentdevflow. Do not edit this file directly. -->",
    "",
    "first",
    "second",
    "",
  ].join("\n"));
});

test("integrates with ownership planning, apply, and drift verification", async () => {
  const { request, renderer } = await stagedPreset("balanced");
  const adapter = new StagedRendererAdapter(renderer);
  const workspace = new MemoryWorkspace();
  const plan = await adapter.plan(request, workspace);

  assert.equal(plan.safeToApply, true);
  assert.deepEqual(
    plan.files.map(({ action, path }) => ({ action, path })),
    [
      { action: "create", path: ".cursor/rules/agentdevflow.mdc" },
      { action: "create", path: "AGENTS.md" },
      { action: "create", path: "CLAUDE.md" },
    ],
  );

  await adapter.render(plan, workspace);
  assert.equal((await adapter.verify(plan, workspace)).ok, true);
  workspace.files.set("AGENTS.md", "manually modified\n");
  const verification = await adapter.verify(plan, workspace);
  assert.equal(verification.ok, false);
  assert.deepEqual(
    verification.diagnostics.map(({ code, path }) => ({ code, path })),
    [{ code: "GENERATED_FILE_DRIFT", path: "AGENTS.md" }],
  );
});
