import assert from "node:assert/strict";
import test from "node:test";

import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import {
  createPrivateRenderLock,
  validatePrivateRenderLock,
  type PrivateRenderLock,
} from "../../src/lock/private-render-lock.js";
import type {
  OwnershipClaim,
  RenderPlan,
  RenderResult,
  RenderWorkspace,
  VerifyResult,
} from "../../src/renderer/contract.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import {
  balancedCandidateConfig,
  reorderedBalancedCandidateConfig,
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

interface AppliedFixture {
  readonly lock: PrivateRenderLock;
  readonly plan: RenderPlan;
  readonly result: RenderResult;
  readonly verification: VerifyResult;
  readonly workspace: MemoryWorkspace;
  readonly compilation: CandidateCompilation;
  readonly materialization: ReturnType<typeof materializeCompilation>;
}

function compile(input: unknown): CandidateCompilation {
  const result = compileCandidateProjectConfig(input, initialCompilerOptions);
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
}

async function applyFixture(
  input: unknown = balancedCandidateConfig,
  workspace = new MemoryWorkspace(),
  ownership: Readonly<Record<string, OwnershipClaim>> = {},
): Promise<AppliedFixture> {
  const compilation = compile(input);
  const materialization = materializeCompilation(compilation);
  const request = renderRequestFromMaterialization(
    compilation,
    materialization,
    { ownership },
  );
  const adapter = new StagedRendererAdapter(
    new NativeProjectInstructionsRenderer(materialization),
  );
  const plan = await adapter.plan(request, workspace);
  const result = await adapter.render(plan, workspace);
  const verification = await adapter.verify(plan, workspace);
  const lock = createPrivateRenderLock({
    materialization,
    plan,
    result,
    verification,
  });
  return {
    lock,
    plan,
    result,
    verification,
    workspace,
    compilation,
    materialization,
  };
}

test("creates a deterministic private lock from applied and verified output", async () => {
  const fixture = await applyFixture();
  validatePrivateRenderLock(fixture.lock);

  assert.equal(fixture.lock.revision, 1);
  assert.equal(fixture.lock.compilerDigest, fixture.compilation.compilerDigest);
  assert.equal(fixture.lock.source.digest, fixture.materialization.digest);
  assert.equal(fixture.lock.renderer.name, "agentdevflow-native");
  assert.equal(
    fixture.lock.renderer.ownershipKey,
    "agentdevflow.renderer.native",
  );
  assert.deepEqual(
    fixture.lock.files.map(({ path, owner }) => ({ path, owner })),
    [
      {
        path: ".cursor/rules/agentdevflow.mdc",
        owner: "agentdevflow.renderer.native",
      },
      { path: "AGENTS.md", owner: "agentdevflow.renderer.native" },
      { path: "CLAUDE.md", owner: "agentdevflow.renderer.native" },
    ],
  );
  assert.equal(
    fixture.lock.digest,
    "c677b6542ee1d1d0ddf61c979a136d16624f7ee72ea9c03fbe99854a0eb79779",
  );
  assert.equal("createdAt" in fixture.lock, false);
  assert.equal("hostname" in fixture.lock, false);

  assert.doesNotThrow(() =>
    validatePrivateRenderLock({
      digest: fixture.lock.digest,
      files: fixture.lock.files,
      renderer: {
        inputDigest: fixture.lock.renderer.inputDigest,
        ownershipKey: fixture.lock.renderer.ownershipKey,
        version: fixture.lock.renderer.version,
        name: fixture.lock.renderer.name,
      },
      source: {
        digest: fixture.lock.source.digest,
        revision: fixture.lock.source.revision,
      },
      compilerDigest: fixture.lock.compilerDigest,
      revision: fixture.lock.revision,
    }),
  );
});

test("keeps the lock stable across reordered intent and a no-op render", async () => {
  const first = await applyFixture();
  const reordered = await applyFixture(reorderedBalancedCandidateConfig);
  assert.deepEqual(reordered.lock, first.lock);

  const noOp = await applyFixture(
    balancedCandidateConfig,
    first.workspace,
    first.result.ownership,
  );
  assert.notEqual(noOp.plan.planDigest, first.plan.planDigest);
  assert.deepEqual(
    noOp.plan.files.map(({ action }) => action),
    ["unchanged", "unchanged", "unchanged"],
  );
  assert.deepEqual(noOp.lock, first.lock);
});

test("rejects corrupted, unsafe, unsorted, or extended lock data", async () => {
  const { lock } = await applyFixture();

  assert.throws(
    () =>
      validatePrivateRenderLock({
        ...lock,
        createdAt: "2026-07-16T00:00:00Z",
      }),
    /unexpected or missing fields/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderLock({
        ...lock,
        files: lock.files.map((file, index) =>
          index === 0 ? { ...file, path: "/tmp/output" } : file,
        ),
      }),
    /file path is unsafe/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderLock({
        ...lock,
        files: [...lock.files].reverse(),
      }),
    /file paths are not unique and sorted/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderLock({
        ...lock,
        files: lock.files.map((file, index) =>
          index === 0
            ? { ...file, contentDigest: "0".repeat(64) }
            : file,
        ),
      }),
    /lock digest does not match/u,
  );
  assert.throws(
    () =>
      validatePrivateRenderLock({
        ...lock,
        files: lock.files.map((file, index) =>
          index === 0
            ? { ...file, sourceRefs: [file.sourceRefs[0], file.sourceRefs[0]] }
            : file,
        ),
      }),
    /source references are not unique and sorted/u,
  );
});

test("refuses to lock unsafe, mismatched, or unverified render state", async () => {
  const fixture = await applyFixture();
  const options = {
    materialization: fixture.materialization,
    plan: fixture.plan,
    result: fixture.result,
    verification: fixture.verification,
  };

  assert.throws(
    () =>
      createPrivateRenderLock({
        ...options,
        plan: { ...fixture.plan, safeToApply: false },
      }),
    /unsafe render plan/u,
  );
  assert.throws(
    () =>
      createPrivateRenderLock({
        ...options,
        result: { ...fixture.result, planDigest: "0".repeat(64) },
      }),
    /different plan/u,
  );
  assert.throws(
    () =>
      createPrivateRenderLock({
        ...options,
        verification: {
          planDigest: fixture.plan.planDigest,
          ok: false,
          diagnostics: [
            {
              code: "GENERATED_FILE_DRIFT",
              severity: "error",
              message: "Generated output drifted.",
            },
          ],
        },
      }),
    /unverified render result/u,
  );
  assert.throws(
    () =>
      createPrivateRenderLock({
        ...options,
        verification: {
          ...fixture.verification,
          planDigest: "0".repeat(64),
        },
      }),
    /verification belongs to a different plan/u,
  );
  assert.throws(
    () =>
      createPrivateRenderLock({
        ...options,
        plan: { ...fixture.plan, sourceDigest: "0".repeat(64) },
      }),
    /different source materialization/u,
  );
  assert.throws(
    () =>
      createPrivateRenderLock({
        ...options,
        plan: { ...fixture.plan, inputDigest: "0".repeat(64) },
      }),
    /input digest does not match materialization/u,
  );
  assert.throws(
    () =>
      createPrivateRenderLock({
        ...options,
        result: {
          ...fixture.result,
          ownership: {
            ...fixture.result.ownership,
            "unexpected.md": {
              owner: fixture.plan.ownershipKey,
              digest: "0".repeat(64),
            },
          },
        },
      }),
    /unexpected ownership claims/u,
  );
});
