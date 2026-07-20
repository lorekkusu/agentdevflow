import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { preparePrivateDomainProjectPlan } from "../../src/application/private-domain-project-plan.js";
import { executePrivateCheckCommand } from "../../src/commands/private-check-command-service.js";
import { executePrivateDiffCommand } from "../../src/commands/private-diff-command-service.js";
import { executePrivateRenderCommand } from "../../src/commands/private-render-command-service.js";
import type { PrivateDomainProjectIntent } from "../../src/project/private-domain-project-resolution.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";

const lockPath = ".private-fixture/render-lock.json";

async function temporaryRepository(t: TestContext): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-project-plan-"));
  t.after(async () => {
    await rm(container, { recursive: true, force: true });
  });
  const repository = join(container, "repository");
  await mkdir(repository);
  return repository;
}

function localIntent(): PrivateDomainProjectIntent {
  return {
    revision: 1,
    preset: "balanced",
    providers: [
      { id: "codex-steward", product: "codex", surface: "cli" },
      { id: "cursor-developer", product: "cursor", surface: "ide" },
      { id: "claude-reviewer", product: "claude-code", surface: "cli" },
    ],
    roles: {
      steward: "codex-steward",
      developer: "cursor-developer",
      reviewer: "claude-reviewer",
    },
    tracker: { mode: "none" },
    workflow: { family: "local-reviewed-change" },
    capabilityBindings: [
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
    ],
  };
}

function issueIntent(): PrivateDomainProjectIntent {
  return {
    ...localIntent(),
    tracker: { mode: "linear" },
    workflow: {
      family: "issue-to-reviewed-pull-request",
      initialState: "ready",
      auxiliaryReview: "disabled",
      mergeMethod: "squash",
    },
    capabilityBindings: [
      { binding: "tracker", target: { kind: "tracker" } },
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "pull-request-host",
        target: { kind: "external", id: "github" },
      },
      { binding: "ci", target: { kind: "external", id: "github-actions" } },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
    ],
  };
}

function document(intent: PrivateDomainProjectIntent): string {
  return JSON.stringify(intent, null, 2)
    .replace("{\n", "{\n  // Private fixture.\n")
    .replace(/\n\}$/u, ",\n}\n");
}

type Prepared = Extract<
  Awaited<ReturnType<typeof preparePrivateDomainProjectPlan>>,
  { readonly ok: true }
>;

function expectPrepared(
  result: Awaited<ReturnType<typeof preparePrivateDomainProjectPlan>>,
): asserts result is Prepared {
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected private domain project planning to succeed.");
  }
}

test("creates a deterministic exact plan from revision-1 configuration bytes", async (t) => {
  const repository = await temporaryRepository(t);
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(repository);
  const content = document(localIntent());
  const first = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });
  const second = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });

  expectPrepared(first);
  expectPrepared(second);
  assert.deepEqual(second, first);
  assert.equal(first.project.resolution.workflow.family, "local-reviewed-change");
  assert.deepEqual(first.request.providers, ["claude-code", "codex", "cursor"]);
  assert.deepEqual(
    first.plan.files.map((file) => [file.path, file.action]),
    [
      [".cursor/rules/agentdevflow.mdc", "create"],
      ["AGENTS.md", "create"],
      ["CLAUDE.md", "create"],
    ],
  );
  assert.equal(first.plan.safeToApply, true);
  assert.equal(await workspace.read("AGENTS.md"), null);
  assert.equal(await workspace.read(lockPath), null);
});

test("feeds the exact plan into check, diff, render, and clean recheck", async (t) => {
  const repository = await temporaryRepository(t);
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    repository,
  );
  const content = document(localIntent());
  const initial = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });
  expectPrepared(initial);

  const check = await executePrivateCheckCommand({
    ...initial,
    baseLock: null,
    lockPath,
    workspace,
  });
  const diff = await executePrivateDiffCommand({
    ...initial,
    baseLock: null,
    lockPath,
    workspace,
  });
  assert.equal(check.outcome, "changes-required");
  assert.equal(diff.outcome, "changes-required");
  assert.deepEqual(
    diff.changes.map((change) => [change.path, change.action]),
    [
      [".cursor/rules/agentdevflow.mdc", "create"],
      [".private-fixture/render-lock.json", "create"],
      ["AGENTS.md", "create"],
      ["CLAUDE.md", "create"],
    ],
  );

  const rendered = await executePrivateRenderCommand({
    ...initial,
    baseLock: null,
    lockPath,
    workspace,
  });
  const repeated = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });
  expectPrepared(repeated);
  const cleanCheck = await executePrivateCheckCommand({
    ...repeated,
    baseLock: repeated.baseLock,
    lockPath,
    workspace,
  });
  const cleanDiff = await executePrivateDiffCommand({
    ...repeated,
    baseLock: repeated.baseLock,
    lockPath,
    workspace,
  });

  assert.equal(cleanCheck.outcome, "clean");
  assert.equal(cleanDiff.outcome, "clean");
  assert.deepEqual(cleanDiff.changes, []);
  assert.deepEqual(
    repeated.plan.files.map((file) => file.action),
    ["unchanged", "unchanged", "unchanged"],
  );
});

test("retains a foreign project-instructions file as an exact conflict", async (t) => {
  const repository = await temporaryRepository(t);
  await writeFile(join(repository, "AGENTS.md"), "manual instructions\n", "utf8");
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(repository);
  const result = await preparePrivateDomainProjectPlan({
    content: document(localIntent()),
    lockPath,
    workspace,
  });
  expectPrepared(result);

  assert.equal(result.plan.safeToApply, false);
  assert.equal(
    result.plan.files.find((file) => file.path === "AGENTS.md")?.action,
    "conflict",
  );
  const check = await executePrivateCheckCommand({
    ...result,
    baseLock: null,
    lockPath,
    workspace,
  });
  assert.equal(check.outcome, "blocked");
  assert.equal(await workspace.read("AGENTS.md"), "manual instructions\n");
});

test("does not invent unavailable issue, pull-request, CI, or merge adapters", async (t) => {
  const repository = await temporaryRepository(t);
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(repository);
  const result = await preparePrivateDomainProjectPlan({
    content: document(issueIntent()),
    lockPath,
    workspace,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected unavailable external capabilities to block planning.");
  }
  const resolutionFailure = result.diagnostics.find(
    (diagnostic) =>
      diagnostic.stage === "resolution" &&
      diagnostic.cause?.code === "WORKFLOW_COMPILATION_FAILED",
  );
  assert.equal(resolutionFailure?.stage, "resolution");
  if (
    resolutionFailure?.stage !== "resolution" ||
    resolutionFailure.cause?.code !== "WORKFLOW_COMPILATION_FAILED"
  ) {
    assert.fail("Expected a workflow compilation diagnostic.");
  }
  assert.equal(resolutionFailure.cause.causes.length > 0, true);
  assert.equal(
    resolutionFailure.cause.causes.every(
      (cause) => cause.code === "CAPABILITY_UNAVAILABLE",
    ),
    true,
  );
});

test("rejects an invalid base lock before repository planning", async (t) => {
  const repository = await temporaryRepository(t);
  await mkdir(join(repository, ".private-fixture"), { recursive: true });
  await writeFile(join(repository, lockPath), "{}\n", "utf8");
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(repository);
  const result = await preparePrivateDomainProjectPlan({
    content: document(localIntent()),
    lockPath,
    workspace,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected invalid base lock rejection.");
  }
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    ["BASE_LOCK_INVALID"],
  );
});

test("reports a lock observation failure without requesting mutation access", async () => {
  const result = await preparePrivateDomainProjectPlan({
    content: document(localIntent()),
    lockPath,
    workspace: {
      async read() {
        throw new Error("fixture read failure");
      },
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected lock observation failure.");
  }
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code),
    ["LOCK_READ_FAILED"],
  );
});
