import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  createPrivateRenderLock,
  parsePrivateRenderLock,
  serializePrivateRenderLock,
  validatePrivateRenderLock,
  type PrivateRenderLock,
} from "../../src/lock/private-render-lock.js";
import type {
  OwnershipClaim,
  RenderPlan,
  RenderResult,
  VerifyResult,
} from "../../src/renderer/contract.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { applyPrivateConvergentRenderPlan } from "../../src/renderer/private-convergent-apply.js";
import {
  StagedRendererAdapter,
  verifyRenderPlan,
} from "../../src/renderer/staged-adapter.js";
import type { PrivateConvergentMutationIntent } from "../../src/workspace/private-convergent-intent.js";
import type {
  PrivateConvergentAllowedDigests,
  PrivateConvergentMutationOutcome,
  PrivateConvergentWorkspace,
} from "../../src/workspace/private-filesystem-workspace.js";
import { createPrivateDomainProjectFixture } from "../fixtures/project/private-domain-project.js";

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

class MemoryWorkspace implements PrivateConvergentWorkspace {
  readonly files = new Map<string, string>();

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async removeAtomically(
    path: string,
    allowedDigests: PrivateConvergentAllowedDigests,
  ): Promise<PrivateConvergentMutationOutcome> {
    const current = this.files.get(path);
    if (current === undefined) {
      return "already-applied";
    }
    if (digest(current) !== allowedDigests.beforeDigest) {
      return "drift";
    }
    this.files.delete(path);
    return "applied";
  }

  async writeConvergently(
    intent: PrivateConvergentMutationIntent,
    content: string,
    allowedDigests: PrivateConvergentAllowedDigests,
  ): Promise<PrivateConvergentMutationOutcome> {
    const current = this.files.get(intent.targetPath);
    const currentDigest = current === undefined ? null : digest(current);
    if (currentDigest === allowedDigests.afterDigest) {
      return "already-applied";
    }
    if (currentDigest !== allowedDigests.beforeDigest) {
      return "drift";
    }
    this.files.set(intent.targetPath, content);
    return "applied";
  }

  async discardConvergentTemporary(): Promise<"absent"> {
    return "absent";
  }
}

interface AppliedFixture {
  readonly lock: PrivateRenderLock;
  readonly plan: RenderPlan;
  readonly result: RenderResult;
  readonly verification: VerifyResult;
  readonly workspace: MemoryWorkspace;
  readonly compilerDigest: string;
  readonly materialization: ReturnType<
    typeof createPrivateDomainProjectFixture
  >["materialization"];
}

async function applyFixture(
  workspace = new MemoryWorkspace(),
  ownership: Readonly<Record<string, OwnershipClaim>> = {},
): Promise<AppliedFixture> {
  const { project, materialization, request } =
    createPrivateDomainProjectFixture("balanced", { ownership });
  const adapter = new StagedRendererAdapter(
    new NativeProjectInstructionsRenderer(materialization),
  );
  const plan = await adapter.plan(request, workspace);
  const result = await applyPrivateConvergentRenderPlan(plan, workspace);
  const verification = await verifyRenderPlan(plan, workspace);
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
    compilerDigest: project.workflowCompilation.compilationDigest,
    materialization,
  };
}

test("creates a deterministic private lock from applied and verified output", async () => {
  const fixture = await applyFixture();
  validatePrivateRenderLock(fixture.lock);

  assert.equal(fixture.lock.revision, 1);
  assert.equal(fixture.lock.compilerDigest, fixture.compilerDigest);
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
  assert.match(fixture.lock.digest, /^[a-f0-9]{64}$/u);
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

test("keeps the lock stable across repeated intent and a no-op render", async () => {
  const first = await applyFixture();
  const repeated = await applyFixture();
  assert.deepEqual(repeated.lock, first.lock);

  const noOp = await applyFixture(
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

test("round-trips only bounded canonical private lock bytes", async () => {
  const { lock } = await applyFixture();
  const content = serializePrivateRenderLock(lock);

  assert.deepEqual(parsePrivateRenderLock(content), lock);
  assert.throws(
    () => parsePrivateRenderLock(` ${content}`),
    /bytes are not canonical/u,
  );
  assert.throws(
    () => parsePrivateRenderLock(content, { maxBytes: 1 }),
    /exceeds the 1-byte limit/u,
  );
  assert.throws(
    () => parsePrivateRenderLock(content, { maxBytes: 0 }),
    /positive safe integer/u,
  );
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
