import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { executePrivateDiffCommand } from "../../src/commands/private-diff-command-service.js";
import { executePrivateRenderCommand } from "../../src/commands/private-render-command-service.js";
import { createPrivateRenderPlanSnapshot } from "../../src/commands/private-render-plan-snapshot.js";
import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import type { PrivateRenderLock } from "../../src/lock/private-render-lock.js";
import type {
  OwnershipClaim,
  RendererProvider,
  RenderRequest,
} from "../../src/renderer/contract.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import {
  balancedCandidateConfig,
  fastThreeProviderCandidateConfig,
} from "../fixtures/config/specimens.js";

const lockPath = ".private-fixture/render-lock.json";
const outputPaths = [
  ".cursor/rules/agentdevflow.mdc",
  "AGENTS.md",
  "CLAUDE.md",
] as const;

async function temporaryRepository(t: TestContext): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-diff-command-"));
  t.after(async () => {
    await rm(container, { recursive: true, force: true });
  });
  const repository = join(container, "repository");
  await mkdir(repository);
  return repository;
}

function compile(preset: "fast" | "balanced"): CandidateCompilation {
  const result = compileCandidateProjectConfig(
    preset === "fast"
      ? fastThreeProviderCandidateConfig
      : balancedCandidateConfig,
    initialCompilerOptions,
  );
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
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
  readonly preset: "fast" | "balanced";
  readonly baseLock?: PrivateRenderLock | null;
  readonly ownership?: RenderRequest["ownership"];
  readonly providers?: readonly RendererProvider[];
}) {
  const compilation = compile(options.preset);
  const materialization = materializeCompilation(compilation);
  const renderer = new NativeProjectInstructionsRenderer(materialization);
  const adapter = new StagedRendererAdapter(renderer);
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    options.repository,
  );
  const request = {
    ...renderRequestFromMaterialization(compilation, materialization, {
      ownership:
        options.ownership ?? ownershipFromLock(options.baseLock ?? null),
    }),
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

async function observedBytes(
  workspace: PrivateFilesystemWorkspace,
): Promise<readonly (string | null)[]> {
  return Promise.all([
    ...outputPaths.map((path) => workspace.read(path)),
    workspace.read(lockPath),
  ]);
}

test("returns exact creates and target lock bytes without modifying the repository", async (t) => {
  const repository = await temporaryRepository(t);
  const current = await fixture({ repository, preset: "balanced" });
  const before = await observedBytes(current.workspace);
  const result = await executePrivateDiffCommand({
    ...current,
    baseLock: null,
    lockPath,
  });
  const repeated = await executePrivateDiffCommand({
    ...current,
    baseLock: null,
    lockPath,
  });
  const after = await observedBytes(current.workspace);

  assert.equal(result.outcome, "changes-required");
  assert.equal(result.candidateExitCode, 1);
  assert.deepEqual(
    result.changes.map((change) => [change.kind, change.path, change.action]),
    [
      ["managed-output", ".cursor/rules/agentdevflow.mdc", "create"],
      ["render-lock", lockPath, "create"],
      ["managed-output", "AGENTS.md", "create"],
      ["managed-output", "CLAUDE.md", "create"],
    ],
  );
  for (const change of result.changes) {
    assert.equal(change.beforeContent, null);
    assert.equal(change.beforeDigest, null);
    assert.notEqual(change.afterContent, null);
    assert.notEqual(change.afterDigest, null);
  }
  assert.deepEqual(repeated, result);
  assert.deepEqual(after, before);
});

test("returns clean with no changes after an exact render", async (t) => {
  const repository = await temporaryRepository(t);
  const initial = await fixture({ repository, preset: "balanced" });
  const rendered = await executePrivateRenderCommand({
    ...initial,
    baseLock: null,
    lockPath,
  });
  const current = await fixture({
    repository,
    preset: "balanced",
    baseLock: rendered.lock,
  });
  const before = await observedBytes(current.workspace);
  const result = await executePrivateDiffCommand({
    ...current,
    baseLock: rendered.lock,
    lockPath,
  });

  assert.equal(result.outcome, "clean");
  assert.equal(result.candidateExitCode, 0);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(await observedBytes(current.workspace), before);
});

test("returns exact update bytes from a retained base lock", async (t) => {
  const repository = await temporaryRepository(t);
  const fast = await fixture({ repository, preset: "fast" });
  const rendered = await executePrivateRenderCommand({
    ...fast,
    baseLock: null,
    lockPath,
  });
  const balanced = await fixture({
    repository,
    preset: "balanced",
    baseLock: rendered.lock,
  });
  const result = await executePrivateDiffCommand({
    ...balanced,
    baseLock: rendered.lock,
    lockPath,
  });

  assert.equal(result.outcome, "changes-required");
  assert.equal(
    result.changes.filter((change) => change.kind === "managed-output").length,
    3,
  );
  for (const change of result.changes) {
    assert.equal(change.action, "update");
    assert.notEqual(change.beforeContent, null);
    assert.notEqual(change.afterContent, null);
    assert.notEqual(change.beforeDigest, change.afterDigest);
  }
});

test("returns exact deletes when the desired provider set contracts", async (t) => {
  const repository = await temporaryRepository(t);
  const initial = await fixture({ repository, preset: "balanced" });
  const rendered = await executePrivateRenderCommand({
    ...initial,
    baseLock: null,
    lockPath,
  });
  const codexOnly = await fixture({
    repository,
    preset: "balanced",
    baseLock: rendered.lock,
    providers: ["codex"],
  });
  const result = await executePrivateDiffCommand({
    ...codexOnly,
    baseLock: rendered.lock,
    lockPath,
  });
  const deletions = result.changes.filter(
    (change) => change.action === "delete",
  );

  assert.equal(result.outcome, "changes-required");
  assert.deepEqual(
    deletions.map((change) => change.path),
    [".cursor/rules/agentdevflow.mdc", "CLAUDE.md"],
  );
  for (const deletion of deletions) {
    assert.notEqual(deletion.beforeContent, null);
    assert.notEqual(deletion.beforeDigest, null);
    assert.equal(deletion.afterContent, null);
    assert.equal(deletion.afterDigest, null);
  }
  assert.equal(
    result.changes.some(
      (change) => change.kind === "render-lock" && change.action === "update",
    ),
    true,
  );
});

test("omits outputs already at target and reports only remaining exact changes", async (t) => {
  const repository = await temporaryRepository(t);
  const current = await fixture({ repository, preset: "balanced" });
  const agents = current.plan.files.find((file) => file.path === "AGENTS.md");
  assert.notEqual(agents, undefined);
  await current.workspace.writeAtomically(
    "AGENTS.md",
    agents?.expectedContent ?? "",
  );
  const result = await executePrivateDiffCommand({
    ...current,
    baseLock: null,
    lockPath,
  });

  assert.equal(result.outcome, "changes-required");
  assert.equal(
    result.changes.some((change) => change.path === "AGENTS.md"),
    false,
  );
  assert.deepEqual(
    result.changes.map((change) => change.path),
    [".cursor/rules/agentdevflow.mdc", lockPath, "CLAUDE.md"],
  );
});

test("returns no partial diff for blocked or malformed state", async (t) => {
  const driftRepository = await temporaryRepository(t);
  const drift = await fixture({ repository: driftRepository, preset: "balanced" });
  await writeFile(join(driftRepository, "AGENTS.md"), "foreign\n", "utf8");
  const driftResult = await executePrivateDiffCommand({
    ...drift,
    baseLock: null,
    lockPath,
  });
  assert.equal(driftResult.outcome, "blocked");
  assert.equal(driftResult.candidateExitCode, 2);
  assert.deepEqual(driftResult.changes, []);

  const malformedResult = await executePrivateDiffCommand({
    ...drift,
    snapshot: { ...drift.snapshot, extension: true },
    baseLock: null,
    lockPath,
  });
  assert.equal(malformedResult.outcome, "blocked");
  assert.deepEqual(malformedResult.changes, []);
  assert.deepEqual(
    malformedResult.diagnostics.map((diagnostic) => diagnostic.code),
    ["CHECK_SNAPSHOT_INVALID"],
  );
});

test("discards every partial entry when an observation changes after check", async (t) => {
  const repository = await temporaryRepository(t);
  const current = await fixture({ repository, preset: "balanced" });
  let agentsReads = 0;
  const result = await executePrivateDiffCommand({
    materialization: current.materialization,
    snapshot: current.snapshot,
    baseLock: null,
    lockPath,
    workspace: {
      async read(path) {
        if (path === "AGENTS.md") {
          agentsReads += 1;
          if (agentsReads === 2) {
            return "concurrent foreign content\n";
          }
        }
        return current.workspace.read(path);
      },
    },
  });

  assert.equal(result.outcome, "blocked");
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    ["DIFF_OBSERVATION_CHANGED"],
  );
});
