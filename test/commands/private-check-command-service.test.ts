import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { executePrivateCheckCommand } from "../../src/commands/private-check-command-service.js";
import { executePrivateRenderCommand } from "../../src/commands/private-render-command-service.js";
import { createPrivateRenderPlanSnapshot } from "../../src/commands/private-render-plan-snapshot.js";
import {
  derivePrivateRenderLockIntent,
  serializePrivateRenderLock,
  type PrivateRenderLock,
} from "../../src/lock/private-render-lock.js";
import type {
  OwnershipClaim,
  RendererCapability,
  RenderRequest,
} from "../../src/renderer/contract.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { createPrivateDomainProjectFixture } from "../fixtures/project/private-domain-project.js";

const lockPath = ".private-fixture/render-lock.json";

async function temporaryRepository(t: TestContext): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-check-command-"));
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

async function fixture(options: {
  readonly repository: string;
  readonly preset?: "fast" | "balanced";
  readonly baseLock?: PrivateRenderLock | null;
  readonly ownership?: RenderRequest["ownership"];
  readonly capabilities?: readonly RendererCapability[];
}) {
  const { materialization, request: baseRequest } =
    createPrivateDomainProjectFixture(options.preset ?? "balanced", {
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
    ...(options.capabilities === undefined
      ? {}
      : { capabilities: options.capabilities }),
  };
  const plan = await adapter.plan(request, workspace);
  return {
    materialization,
    plan,
    snapshot: createPrivateRenderPlanSnapshot(plan),
    workspace,
  };
}

function diagnosticCodes(
  result: Awaited<ReturnType<typeof executePrivateCheckCommand>>,
): readonly string[] {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

test("reports planned creates and lock publication without modifying the repository", async (t) => {
  const repository = await temporaryRepository(t);
  const current = await fixture({ repository });
  const result = await executePrivateCheckCommand({
    ...current,
    baseLock: null,
    lockPath,
  });

  assert.equal(result.outcome, "changes-required");
  assert.equal(result.candidateExitCode, 1);
  assert.equal(result.observedLockState, "base");
  assert.deepEqual(diagnosticCodes(result), [
    "CHECK_LOCK_CHANGE_REQUIRED",
    "CHECK_PATH_CHANGE_REQUIRED",
    "CHECK_PATH_CHANGE_REQUIRED",
    "CHECK_PATH_CHANGE_REQUIRED",
  ]);
  assert.equal(await current.workspace.read("AGENTS.md"), null);
  assert.equal(await current.workspace.read(lockPath), null);
});

test("reports clean after render and remains an exact read-only no-op", async (t) => {
  const repository = await temporaryRepository(t);
  const initial = await fixture({ repository });
  const rendered = await executePrivateRenderCommand({
    ...initial,
    baseLock: null,
    lockPath,
  });
  const current = await fixture({
    repository,
    baseLock: rendered.lock,
  });
  const before = await Promise.all([
    current.workspace.read(".cursor/rules/agentdevflow.mdc"),
    current.workspace.read("AGENTS.md"),
    current.workspace.read("CLAUDE.md"),
    current.workspace.read(lockPath),
  ]);

  const result = await executePrivateCheckCommand({
    ...current,
    baseLock: rendered.lock,
    lockPath,
  });
  const repeated = await executePrivateCheckCommand({
    ...current,
    baseLock: rendered.lock,
    lockPath,
  });
  const after = await Promise.all([
    current.workspace.read(".cursor/rules/agentdevflow.mdc"),
    current.workspace.read("AGENTS.md"),
    current.workspace.read("CLAUDE.md"),
    current.workspace.read(lockPath),
  ]);

  assert.equal(result.outcome, "clean");
  assert.equal(result.candidateExitCode, 0);
  assert.equal(result.observedLockState, "target");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(repeated, result);
  assert.deepEqual(after, before);
});

test("distinguishes desired changes from foreign managed-path drift", async (t) => {
  const repository = await temporaryRepository(t);
  const current = await fixture({ repository });
  await writeFile(join(repository, "AGENTS.md"), "foreign\n", "utf8");

  const first = await executePrivateCheckCommand({
    ...current,
    baseLock: null,
    lockPath,
  });
  const repeated = await executePrivateCheckCommand({
    ...current,
    baseLock: null,
    lockPath,
  });

  assert.equal(first.outcome, "blocked");
  assert.equal(first.candidateExitCode, 2);
  assert.equal(
    first.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "CHECK_PATH_DRIFT" &&
        diagnostic.path === "AGENTS.md",
    ),
    true,
  );
  assert.deepEqual(repeated, first);
});

test("reports ownership conflicts and unsupported capabilities as blocked", async (t) => {
  const conflictRepository = await temporaryRepository(t);
  await writeFile(join(conflictRepository, "AGENTS.md"), "manual\n", "utf8");
  const conflict = await fixture({ repository: conflictRepository });
  const conflictResult = await executePrivateCheckCommand({
    ...conflict,
    baseLock: null,
    lockPath,
  });
  assert.equal(conflictResult.outcome, "blocked");
  assert.equal(diagnosticCodes(conflictResult).includes("OWNERSHIP_CONFLICT"), true);
  assert.equal(diagnosticCodes(conflictResult).includes("CHECK_PATH_CONFLICT"), true);
  assert.equal(diagnosticCodes(conflictResult).includes("CHECK_PLAN_UNSAFE"), true);

  const capabilityRepository = await temporaryRepository(t);
  const capability = await fixture({
    repository: capabilityRepository,
    capabilities: ["commands"],
  });
  const capabilityResult = await executePrivateCheckCommand({
    ...capability,
    baseLock: null,
    lockPath,
  });
  assert.equal(capabilityResult.outcome, "blocked");
  assert.equal(
    diagnosticCodes(capabilityResult).includes("MISSING_RENDER_CAPABILITY"),
    true,
  );
  assert.equal(
    diagnosticCodes(capabilityResult).includes("UNSUPPORTED_CAPABILITY"),
    true,
  );
});

test("fails closed for malformed snapshots, base locks, and foreign lock bytes", async (t) => {
  const repository = await temporaryRepository(t);
  const current = await fixture({ repository });
  const malformedSnapshot = await executePrivateCheckCommand({
    ...current,
    snapshot: { ...current.snapshot, extension: true },
    baseLock: null,
    lockPath,
  });
  assert.equal(malformedSnapshot.outcome, "blocked");
  assert.deepEqual(diagnosticCodes(malformedSnapshot), ["CHECK_SNAPSHOT_INVALID"]);

  const malformedMaterialization = await executePrivateCheckCommand({
    ...current,
    materialization: null,
    baseLock: null,
    lockPath,
  });
  assert.equal(malformedMaterialization.outcome, "blocked");
  assert.deepEqual(diagnosticCodes(malformedMaterialization), [
    "CHECK_MATERIALIZATION_INVALID",
  ]);

  const malformedLock = await executePrivateCheckCommand({
    ...current,
    baseLock: {},
    lockPath,
  });
  assert.equal(malformedLock.outcome, "blocked");
  assert.deepEqual(diagnosticCodes(malformedLock), ["CHECK_BASE_LOCK_INVALID"]);

  await mkdir(join(repository, ".private-fixture"));
  await writeFile(join(repository, lockPath), "not a lock\n", "utf8");
  const foreignLock = await executePrivateCheckCommand({
    ...current,
    baseLock: null,
    lockPath,
  });
  assert.equal(foreignLock.outcome, "blocked");
  assert.equal(foreignLock.observedLockState, "foreign");
  assert.equal(diagnosticCodes(foreignLock).includes("CHECK_LOCK_DRIFT"), true);
});

test("rejects a target lock paired with incomplete managed outputs", async (t) => {
  const repository = await temporaryRepository(t);
  const current = await fixture({ repository });
  const targetLock = derivePrivateRenderLockIntent({
    materialization: current.materialization,
    plan: current.plan,
  });
  await mkdir(join(repository, ".private-fixture"));
  await writeFile(
    join(repository, lockPath),
    serializePrivateRenderLock(targetLock),
    "utf8",
  );

  const result = await executePrivateCheckCommand({
    ...current,
    baseLock: null,
    lockPath,
  });
  assert.equal(result.outcome, "blocked");
  assert.equal(result.observedLockState, "target");
  assert.equal(
    diagnosticCodes(result).includes("CHECK_LOCK_CONTRADICTORY"),
    true,
  );
});
