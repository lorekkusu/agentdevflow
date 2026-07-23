import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  preparePrivateDomainProjectPlan,
  reconstructPrivateDomainProjectConvergentPlan,
} from "../../src/application/private-domain-project-plan.js";
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
      { id: "codex-steward", product: "codex" },
      { id: "cursor-developer", product: "cursor" },
      { id: "claude-reviewer", product: "claude-code" },
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

test("rereads user-owned guidance and binds it into provider-specific plans", async (t) => {
  const repository = await temporaryRepository(t);
  await mkdir(join(repository, ".agentdevflow/rules/shared"), {
    recursive: true,
  });
  await mkdir(join(repository, ".agentdevflow/rules/developer"), {
    recursive: true,
  });
  await writeFile(
    join(repository, ".agentdevflow/rules/shared/verification.md"),
    "Report verification before handoff.\n",
    "utf8",
  );
  await writeFile(
    join(repository, ".agentdevflow/rules/developer/implementation-scope.md"),
    "Keep changes within the accepted plan.\n",
    "utf8",
  );
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(repository);
  const content = document(localIntent());
  const first = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });
  expectPrepared(first);

  const firstCodex =
    first.plan.files.find((file) => file.path === "AGENTS.md")
      ?.expectedContent ?? "";
  const firstCursor =
    first.plan.files.find(
      (file) => file.path === ".cursor/rules/agentdevflow.mdc",
    )?.expectedContent ?? "";
  const firstClaude =
    first.plan.files.find((file) => file.path === "CLAUDE.md")
      ?.expectedContent ?? "";
  assert.match(firstCodex, /Report verification before handoff/u);
  assert.doesNotMatch(firstCodex, /Keep changes within the accepted plan/u);
  assert.match(firstCursor, /Keep changes within the accepted plan/u);
  assert.doesNotMatch(firstClaude, /Keep changes within the accepted plan/u);

  await writeFile(
    join(repository, ".agentdevflow/rules/developer/implementation-scope.md"),
    "Run the complete verification command before handoff.\n",
    "utf8",
  );
  const second = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });
  expectPrepared(second);
  const secondCursor =
    second.plan.files.find(
      (file) => file.path === ".cursor/rules/agentdevflow.mdc",
    )?.expectedContent ?? "";

  assert.match(secondCursor, /Run the complete verification command/u);
  assert.notEqual(second.materialization.digest, first.materialization.digest);
  assert.notEqual(second.plan.planDigest, first.plan.planDigest);
  assert.notEqual(second.snapshot.digest, first.snapshot.digest);
});

test("feeds the exact plan into check, diff, render, and clean recheck", async (t) => {
  const repository = await temporaryRepository(t);
  const workspace = await PrivateFilesystemWorkspace.open(
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

test("reconstructs the approved base plan after a partial owned update", async (t) => {
  const repository = await temporaryRepository(t);
  const workspace = await PrivateFilesystemWorkspace.open(
    repository,
  );
  const balanced = await preparePrivateDomainProjectPlan({
    content: document(localIntent()),
    lockPath,
    workspace,
  });
  expectPrepared(balanced);
  await executePrivateRenderCommand({
    materialization: balanced.materialization,
    snapshot: balanced.snapshot,
    baseLock: balanced.baseLock,
    lockPath,
    workspace,
  });

  const fastContent = document({ ...localIntent(), preset: "fast" });
  const original = await preparePrivateDomainProjectPlan({
    content: fastContent,
    lockPath,
    workspace,
  });
  expectPrepared(original);
  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        materialization: original.materialization,
        snapshot: original.snapshot,
        baseLock: original.baseLock,
        lockPath,
        workspace,
        applyFaultInjector(event) {
          if (event.kind === "path-applied" && event.path === "AGENTS.md") {
            throw new Error("Injected partial owned update.");
          }
        },
      }),
    /Injected partial owned update/u,
  );

  const partial = await preparePrivateDomainProjectPlan({
    content: fastContent,
    lockPath,
    workspace,
  });
  expectPrepared(partial);
  assert.equal(partial.plan.safeToApply, false);
  const reconstructed = reconstructPrivateDomainProjectConvergentPlan(partial);
  assert.deepEqual(reconstructed.snapshot, original.snapshot);

  const resumed = await executePrivateRenderCommand({
    materialization: reconstructed.materialization,
    snapshot: reconstructed.snapshot,
    baseLock: reconstructed.baseLock,
    lockPath,
    workspace,
  });
  assert.equal(resumed.verification.ok, true);
});

test("does not reconstruct foreign bytes as an approved after-state", async (t) => {
  const repository = await temporaryRepository(t);
  const workspace = await PrivateFilesystemWorkspace.open(
    repository,
  );
  const original = await preparePrivateDomainProjectPlan({
    content: document(localIntent()),
    lockPath,
    workspace,
  });
  expectPrepared(original);
  await writeFile(join(repository, "AGENTS.md"), "foreign bytes\n", "utf8");

  const conflicted = await preparePrivateDomainProjectPlan({
    content: document(localIntent()),
    lockPath,
    workspace,
  });
  expectPrepared(conflicted);
  const reconstructed =
    reconstructPrivateDomainProjectConvergentPlan(conflicted);

  assert.equal(reconstructed.plan.safeToApply, false);
  assert.equal(
    reconstructed.plan.files.find((file) => file.path === "AGENTS.md")?.action,
    "conflict",
  );
  assert.notEqual(reconstructed.snapshot.digest, original.snapshot.digest);
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

test("plans role-specific issue-to-reviewed-pull-request procedures", async (t) => {
  const repository = await temporaryRepository(t);
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(repository);
  const result = await preparePrivateDomainProjectPlan({
    content: document(issueIntent()),
    lockPath,
    workspace,
  });

  expectPrepared(result);
  const codex =
    result.plan.files.find((file) => file.path === "AGENTS.md")
      ?.expectedContent ?? "";
  const cursor =
    result.plan.files.find(
      (file) => file.path === ".cursor/rules/agentdevflow.mdc",
    )?.expectedContent ?? "";
  const claude =
    result.plan.files.find((file) => file.path === "CLAUDE.md")
      ?.expectedContent ?? "";

  assert.match(codex, /create the corresponding work item in Linear/u);
  assert.match(codex, /Delegate the accepted plan/u);
  assert.match(codex, /Auxiliary review is disabled/u);
  assert.match(codex, /perform a `squash` merge/u);
  assert.doesNotMatch(codex, /create a `ready` pull request/u);

  assert.match(cursor, /create a `ready` pull request/u);
  assert.match(cursor, /Do not approve, authorize, or merge your own work/u);
  assert.doesNotMatch(cursor, /create the corresponding work item in Linear/u);

  assert.match(claude, /clean execution context distinct from the Developer/u);
  assert.match(claude, /Treat a verdict as stale/u);
  assert.doesNotMatch(claude, /Delegate the accepted plan/u);
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
      async readBounded() {
        throw new Error("fixture bounded read failure");
      },
      async listDirectoryBounded() {
        throw new Error("fixture directory read failure");
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
