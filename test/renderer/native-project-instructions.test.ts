import assert from "node:assert/strict";
import test from "node:test";

import type { RenderReadWorkspace } from "../../src/renderer/contract.js";
import { generatedMarkdown } from "../../src/renderer/native/common.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import {
  StagedRendererAdapter,
  verifyRenderPlan,
} from "../../src/renderer/staged-adapter.js";
import { createPrivateDomainProjectFixture } from "../fixtures/project/private-domain-project.js";

class MemoryWorkspace implements RenderReadWorkspace {
  readonly files = new Map<string, string>();

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }
}

async function stagedPreset(
  preset: "fast" | "balanced",
): Promise<{
  readonly materialization: ReturnType<
    typeof createPrivateDomainProjectFixture
  >["materialization"];
  readonly request: ReturnType<
    typeof createPrivateDomainProjectFixture
  >["request"];
  readonly renderer: NativeProjectInstructionsRenderer;
  readonly files: ReadonlyMap<string, string>;
}> {
  const { materialization, request } = createPrivateDomainProjectFixture(preset);
  const renderer = new NativeProjectInstructionsRenderer(materialization);
  const staged = await renderer.stage(request);
  assert.deepEqual(staged.diagnostics, []);
  return {
    materialization,
    request,
    renderer,
    files: new Map(staged.files.map((file) => [file.path, file.content])),
  };
}

for (const preset of ["fast", "balanced"] as const) {
  test(`renders ${preset} project instructions for all three providers`, async () => {
    const staged = await stagedPreset(preset);
    assert.deepEqual([...staged.files.keys()], [
      "CLAUDE.md",
      "AGENTS.md",
      ".cursor/rules/agentdevflow.mdc",
    ]);

    for (const actual of staged.files.values()) {
      assert.equal(actual?.endsWith("\n"), true);
      assert.doesNotMatch(actual ?? "", /\r/u);
      assert.doesNotMatch(actual ?? "", /Compiler digest|candidate-config/u);
      assert.equal(actual?.includes(`Preset: ${"`"}${preset}${"`"}`), true);
      assert.match(actual ?? "", /Workflow family: `local-reviewed-change`/u);
    }

    const steward = staged.files.get("AGENTS.md") ?? "";
    const reviewer = staged.files.get("CLAUDE.md") ?? "";
    if (preset === "balanced") {
      assert.match(steward, /reviewer-isolation evidence/u);
      assert.match(steward, /no blocking finding remains/u);
      assert.match(reviewer, /clean execution context/u);
      assert.match(reviewer, /no blocking finding remains/u);
    } else {
      assert.doesNotMatch(steward, /reviewer-isolation evidence/u);
      assert.doesNotMatch(steward, /no blocking finding remains/u);
      assert.doesNotMatch(reviewer, /clean execution context/u);
      assert.doesNotMatch(reviewer, /no blocking finding remains/u);
      assert.match(reviewer, /explicit acceptance verdict/u);
    }
  });
}

test("retains machine provenance outside provider-facing content", async () => {
  const { materialization, request, renderer } = await stagedPreset("balanced");
  const staged = await renderer.stage(request);

  assert.equal(request.sourceDigest, materialization.digest);
  const productByTarget = new Map([
    ["AGENTS.md", "codex"],
    ["CLAUDE.md", "claude-code"],
    [".cursor/rules/agentdevflow.mdc", "cursor"],
  ]);
  for (const file of staged.files) {
    const product = productByTarget.get(file.path);
    const source = materialization.files.find(
      (candidate) => candidate.provider === product,
    );
    assert.ok(source);
    assert.deepEqual(
      file.sourceRefs,
      [source.path, ...source.sourceRefs].sort(),
    );
  }
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

  for (const file of plan.files) {
    if (file.expectedContent !== null) {
      workspace.files.set(file.path, file.expectedContent);
    }
  }
  assert.equal((await verifyRenderPlan(plan, workspace)).ok, true);
  workspace.files.set("AGENTS.md", "manually modified\n");
  const verification = await verifyRenderPlan(plan, workspace);
  assert.equal(verification.ok, false);
  assert.deepEqual(
    verification.diagnostics.map(({ code, path }) => ({ code, path })),
    [{ code: "GENERATED_FILE_DRIFT", path: "AGENTS.md" }],
  );
});
