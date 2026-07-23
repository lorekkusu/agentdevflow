import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  executePrivateRenderCommand,
  PrivateRenderCommandError,
} from "../../src/commands/private-render-command-service.js";
import { createPrivateRenderPlanSnapshot } from "../../src/commands/private-render-plan-snapshot.js";
import {
  derivePrivateRenderLockIntent,
  serializePrivateRenderLock,
  type PrivateRenderLock,
} from "../../src/lock/private-render-lock.js";
import type {
  OwnershipClaim,
  RendererProvider,
  RenderRequest,
} from "../../src/renderer/contract.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { createPrivateDomainProjectFixture } from "../fixtures/project/private-domain-project.js";

const lockPath = ".private-fixture/render-lock.json";

async function temporaryRepository(t: TestContext): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-render-command-"));
  t.after(async () => {
    await rm(container, { recursive: true, force: true });
  });
  const repository = join(container, "repository");
  await mkdir(repository);
  return repository;
}

function ownershipFromLock(
  lock: PrivateRenderLock | null,
): Readonly<Record<string, OwnershipClaim>> {
  return Object.fromEntries(
    (lock?.files ?? []).map((file) => [
      file.path,
      { owner: file.owner, digest: file.contentDigest },
    ]),
  );
}

async function commandFixture(options: {
  readonly repository: string;
  readonly preset: "fast" | "balanced";
  readonly baseLock?: PrivateRenderLock | null;
  readonly ownership?: RenderRequest["ownership"];
  readonly providers?: readonly RendererProvider[];
}) {
  const { materialization, request: baseRequest } =
    createPrivateDomainProjectFixture(options.preset, {
      ownership:
        options.ownership ?? ownershipFromLock(options.baseLock ?? null),
    });
  const renderer = new NativeProjectInstructionsRenderer(materialization);
  const adapter = new StagedRendererAdapter(renderer);
  const workspace = await PrivateFilesystemWorkspace.open(
    options.repository,
  );
  const request = {
    ...baseRequest,
    ...(options.providers === undefined
      ? {}
      : { providers: options.providers }),
  };
  const plan = await adapter.plan(request, workspace);
  return {
    materialization,
    plan,
    snapshot: createPrivateRenderPlanSnapshot(plan),
    workspace,
  };
}

test("publishes a verified lock and makes an exact repeated command a no-op", async (t) => {
  const repository = await temporaryRepository(t);
  const fixture = await commandFixture({ repository, preset: "balanced" });
  const first = await executePrivateRenderCommand({
    ...fixture,
    baseLock: null,
    lockPath,
  });

  assert.equal(first.lockPublished, true);
  assert.equal(
    await fixture.workspace.read(lockPath),
    serializePrivateRenderLock(first.lock),
  );
  assert.equal(first.verification.ok, true);
  assert.deepEqual(first.renderResult.written, [
    ".cursor/rules/agentdevflow.mdc",
    "AGENTS.md",
    "CLAUDE.md",
  ]);

  const repeated = await executePrivateRenderCommand({
    ...fixture,
    baseLock: null,
    lockPath,
  });
  assert.equal(repeated.lockPublished, false);
  assert.deepEqual(repeated.renderResult.written, []);
  assert.deepEqual(repeated.renderResult.removed, []);
  assert.equal(repeated.lock.digest, first.lock.digest);
});

test("updates outputs and lock from exact base ownership", async (t) => {
  const repository = await temporaryRepository(t);
  const fast = await commandFixture({ repository, preset: "fast" });
  const initial = await executePrivateRenderCommand({
    ...fast,
    baseLock: null,
    lockPath,
  });
  const balanced = await commandFixture({
    repository,
    preset: "balanced",
    baseLock: initial.lock,
  });
  const updated = await executePrivateRenderCommand({
    ...balanced,
    baseLock: initial.lock,
    lockPath,
  });

  assert.equal(updated.lockPublished, true);
  assert.notEqual(updated.lock.digest, initial.lock.digest);
  assert.equal(
    await balanced.workspace.read(lockPath),
    serializePrivateRenderLock(updated.lock),
  );
  assert.deepEqual(updated.renderResult.written, [
    ".cursor/rules/agentdevflow.mdc",
    "AGENTS.md",
    "CLAUDE.md",
  ]);
});

test("clears obsolete ownership when a managed output is already absent", async (t) => {
  const repository = await temporaryRepository(t);
  const initial = await commandFixture({ repository, preset: "balanced" });
  const rendered = await executePrivateRenderCommand({
    ...initial,
    baseLock: null,
    lockPath,
  });
  await Promise.all([
    unlink(join(repository, ".cursor/rules/agentdevflow.mdc")),
    unlink(join(repository, "CLAUDE.md")),
  ]);

  const codexOnly = await commandFixture({
    repository,
    preset: "balanced",
    baseLock: rendered.lock,
    providers: ["codex"],
  });
  const absentDelete = codexOnly.plan.files.find(
    (file) => file.path === ".cursor/rules/agentdevflow.mdc",
  );
  assert.equal(absentDelete?.action, "delete");
  assert.equal(absentDelete?.observedDigest, null);
  assert.equal(absentDelete?.expectedDigest, null);

  const result = await executePrivateRenderCommand({
    ...codexOnly,
    baseLock: rendered.lock,
    lockPath,
  });

  assert.equal(result.lockPublished, true);
  assert.deepEqual(result.renderResult.written, []);
  assert.deepEqual(result.renderResult.removed, []);
  assert.deepEqual(
    result.lock.files.map((file) => file.path),
    ["AGENTS.md"],
  );
  assert.equal(
    await codexOnly.workspace.read(".cursor/rules/agentdevflow.mdc"),
    null,
  );
  assert.equal(await codexOnly.workspace.read("CLAUDE.md"), null);
  assert.equal(
    await codexOnly.workspace.read(lockPath),
    serializePrivateRenderLock(result.lock),
  );
});

test("resumes the exact snapshot before and after lock publication", async (t) => {
  for (const boundary of ["render-applied", "lock-target-replaced"] as const) {
    await t.test(boundary, async (boundaryTest) => {
      const repository = await temporaryRepository(boundaryTest);
      const fixture = await commandFixture({ repository, preset: "balanced" });
      await assert.rejects(
        () =>
          executePrivateRenderCommand({
            ...fixture,
            baseLock: null,
            lockPath,
            faultInjector(event) {
              if (event.kind === boundary) {
                throw new Error(`Injected command fault at ${boundary}.`);
              }
            },
          }),
        new RegExp(`Injected command fault at ${boundary}`, "u"),
      );

      const resumedWorkspace =
        await PrivateFilesystemWorkspace.open(repository);
      const resumed = await executePrivateRenderCommand({
        materialization: fixture.materialization,
        snapshot: fixture.snapshot,
        baseLock: null,
        lockPath,
        workspace: resumedWorkspace,
      });
      assert.equal(resumed.verification.ok, true);
      assert.equal(
        await resumedWorkspace.read(lockPath),
        serializePrivateRenderLock(resumed.lock),
      );
      assert.equal(resumed.lockPublished, boundary === "render-applied");
    });
  }
});

test("preserves an intervening third state before lock publication", async (t) => {
  const repository = await temporaryRepository(t);
  const fixture = await commandFixture({
    repository,
    preset: "balanced",
  });
  const foreignContent = "intervening foreign lock\n";

  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        ...fixture,
        baseLock: null,
        lockPath,
        async faultInjector(event) {
          if (event.kind === "lock-temporary-synced") {
            await writeFile(
              join(repository, lockPath),
              foreignContent,
              "utf8",
            );
          }
        },
      }),
    (error: unknown) => {
      assert.equal(error instanceof PrivateRenderCommandError, true);
      assert.equal(
        (error as PrivateRenderCommandError).code,
        "PRIVATE_RENDER_LOCK_STATE_DRIFT",
      );
      assert.equal((error as PrivateRenderCommandError).path, lockPath);
      return true;
    },
  );

  assert.equal(await fixture.workspace.read(lockPath), foreignContent);
});

test("refuses foreign or contradictory lock state before output mutation", async (t) => {
  const foreignRepository = await temporaryRepository(t);
  const foreign = await commandFixture({
    repository: foreignRepository,
    preset: "balanced",
  });
  await mkdir(join(foreignRepository, ".private-fixture"));
  await writeFile(join(foreignRepository, lockPath), "foreign\n", "utf8");
  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        ...foreign,
        baseLock: null,
        lockPath,
      }),
    (error: unknown) => {
      assert.equal(error instanceof PrivateRenderCommandError, true);
      assert.equal(
        (error as PrivateRenderCommandError).code,
        "PRIVATE_RENDER_LOCK_STATE_DRIFT",
      );
      return true;
    },
  );
  assert.equal(await foreign.workspace.read("AGENTS.md"), null);

  const contradictoryRepository = await temporaryRepository(t);
  const contradictory = await commandFixture({
    repository: contradictoryRepository,
    preset: "balanced",
  });
  const targetLock = derivePrivateRenderLockIntent({
    materialization: contradictory.materialization,
    plan: contradictory.plan,
  });
  await mkdir(join(contradictoryRepository, ".private-fixture"));
  await writeFile(
    join(contradictoryRepository, lockPath),
    serializePrivateRenderLock(targetLock),
    "utf8",
  );
  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        ...contradictory,
        baseLock: null,
        lockPath,
      }),
    (error: unknown) => {
      assert.equal(error instanceof PrivateRenderCommandError, true);
      assert.equal(
        (error as PrivateRenderCommandError).code,
        "PRIVATE_RENDER_LOCK_STATE_CONTRADICTORY",
      );
      return true;
    },
  );
  assert.equal(await contradictory.workspace.read("AGENTS.md"), null);
});

test("binds previous ownership and keeps the lock outside managed paths", async (t) => {
  const repository = await temporaryRepository(t);
  const fixture = await commandFixture({ repository, preset: "balanced" });
  const mismatched = await commandFixture({
    repository,
    preset: "balanced",
    ownership: {
      "AGENTS.md": { owner: "foreign", digest: "0".repeat(64) },
    },
  });
  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        ...mismatched,
        baseLock: null,
        lockPath,
      }),
    (error: unknown) => {
      assert.equal(error instanceof PrivateRenderCommandError, true);
      assert.equal(
        (error as PrivateRenderCommandError).code,
        "PRIVATE_RENDER_BASE_OWNERSHIP_MISMATCH",
      );
      return true;
    },
  );

  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        ...fixture,
        baseLock: null,
        lockPath: "AGENTS.md",
      }),
    (error: unknown) => {
      assert.equal(error instanceof PrivateRenderCommandError, true);
      assert.equal(
        (error as PrivateRenderCommandError).code,
        "PRIVATE_RENDER_LOCK_PATH_OVERLAP",
      );
      return true;
    },
  );

  const tampered = {
    ...fixture.snapshot,
    plan: {
      ...fixture.snapshot.plan,
      previousOwnership: {
        "AGENTS.md": { owner: "foreign", digest: "0".repeat(64) },
      },
    },
  };
  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        materialization: fixture.materialization,
        snapshot: tampered,
        baseLock: null,
        lockPath,
        workspace: fixture.workspace,
      }),
    (error: unknown) => {
      assert.equal(error instanceof PrivateRenderCommandError, true);
      assert.equal(
        (error as PrivateRenderCommandError).code,
        "PRIVATE_RENDER_PLAN_SNAPSHOT_INVALID",
      );
      return true;
    },
  );

  const extended = {
    ...fixture.snapshot,
    plan: { ...fixture.snapshot.plan, privateNote: "not allowed" },
  };
  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        materialization: fixture.materialization,
        snapshot: extended,
        baseLock: null,
        lockPath,
        workspace: fixture.workspace,
      }),
    (error: unknown) => {
      assert.equal(error instanceof PrivateRenderCommandError, true);
      assert.equal(
        (error as PrivateRenderCommandError).code,
        "PRIVATE_RENDER_PLAN_SNAPSHOT_INVALID",
      );
      return true;
    },
  );
});
