import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";

import { preparePrivateDomainProjectPlan } from "../../src/application/private-domain-project-plan.js";
import { executePrivateRenderCommand } from "../../src/commands/private-render-command-service.js";
import type { PrivateDomainProjectIntent } from "../../src/project/private-domain-project-resolution.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";

const entryPoint = fileURLToPath(
  new URL("../../src/cli/private-local-cli.js", import.meta.url),
);
const lockPath = ".agentdevflow/render-lock.json";

interface TestProject {
  readonly container: string;
  readonly repository: string;
  readonly configuration: string;
}

async function testProject(t: TestContext): Promise<TestProject> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-local-cli-"));
  t.after(async () => {
    await rm(container, { recursive: true, force: true });
  });
  const repository = join(container, "repository");
  const configuration = join(repository, "project.jsonc");
  await mkdir(repository);
  return { container, repository, configuration };
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

interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function invoke(
  command: "check" | "diff" | "render",
  project: TestProject,
  selectedLockPath = lockPath,
  approvedPlanDigest?: string,
): CommandResult {
  const args = [
    entryPoint,
    command,
    "--repository",
    project.repository,
    "--config",
    "project.jsonc",
    "--lock",
    selectedLockPath,
  ];
  if (command === "render" && approvedPlanDigest !== undefined) {
    args.push("--approve-plan", approvedPlanDigest);
  }
  const result = spawnSync(
    process.execPath,
    args,
    { encoding: "utf8" },
  );
  assert.equal(result.error, undefined);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function invokeInit(project: TestProject): CommandResult {
  const result = spawnSync(
    process.execPath,
    [
      entryPoint,
      "init",
      "--repository",
      project.repository,
      "--config",
      "project.jsonc",
      "--lock",
      lockPath,
      "--workflow",
      "local-reviewed-change",
      "--preset",
      "balanced",
      "--tracker",
      "none",
      "--provider",
      "codex-steward,codex,cli",
      "--provider",
      "cursor-developer,cursor,ide",
      "--provider",
      "claude-reviewer,claude-code,cli",
      "--steward",
      "codex-steward",
      "--developer",
      "cursor-developer",
      "--reviewer",
      "claude-reviewer",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.error, undefined);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function invokeDoctor(
  project: TestProject,
  observationsPath: string,
): CommandResult {
  const result = spawnSync(
    process.execPath,
    [
      entryPoint,
      "doctor",
      "--repository",
      project.repository,
      "--config",
      "project.jsonc",
      "--observations",
      observationsPath,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.error, undefined);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function localDoctorObservations(): unknown {
  return {
    revision: 1,
    providerObservations: localIntent().providers.map((provider) => ({
      providerId: provider.id,
      product: provider.product,
      surface: provider.surface,
      version: "fixture-1",
      executionContext: "local-project",
      principal: "fixture-user",
      capabilities: [
        {
          capability: "project-instructions",
          strength: "advisory",
          mechanism: "instruction-file",
        },
      ],
      evidence: {
        source: "probe",
        reference: `fixture:${provider.id}`,
        freshness: "current",
      },
    })),
    environmentObservations: ["filesystem-read", "filesystem-write"].map(
      (capability) => ({
        capability,
        availability: "available",
        evidence: {
          source: "probe",
          reference: `fixture:${capability}`,
          freshness: "current",
        },
      }),
    ),
  };
}

function exactPlanDigest(result: CommandResult): string {
  const match = /^exact-plan-digest: ([a-f0-9]{64})$/mu.exec(result.stdout);
  assert.notEqual(match, null);
  return match?.[1] ?? "";
}

async function snapshotDirectory(
  root: string,
  relativePath = "",
): Promise<Readonly<Record<string, string>>> {
  const result: Record<string, string> = {};
  const directory = join(root, relativePath);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = relativePath === "" ? entry.name : `${relativePath}/${entry.name}`;
    if (entry.isDirectory()) {
      Object.assign(result, await snapshotDirectory(root, path));
    } else if (entry.isFile()) {
      result[path] = await readFile(join(root, path), "utf8");
    } else {
      result[path] = `<${entry.isSymbolicLink() ? "symlink" : "other"}>`;
    }
  }
  return result;
}

async function writeConfiguration(
  project: TestProject,
  intent: PrivateDomainProjectIntent,
): Promise<string> {
  const content = document(intent);
  await writeFile(project.configuration, content, "utf8");
  return content;
}

test("reproduces the offline init, diff, render, check, and empty-diff path", async (t) => {
  const first = await testProject(t);
  const second = await testProject(t);

  for (const project of [first, second]) {
    const initialized = invokeInit(project);
    assert.equal(initialized.status, 0);
    assert.equal(initialized.stderr, "");
    assert.match(initialized.stdout, /^agentdevflow init: ready\n/u);
    assert.match(initialized.stdout, /configuration-disposition: create/u);
    assert.match(initialized.stdout, /provider-dispositions: 3/u);
    const configurationContent = await readFile(project.configuration, "utf8");
    assert.deepEqual(JSON.parse(configurationContent), {
      ...localIntent(),
      providers: [...localIntent().providers].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    });
    assert.equal(configurationContent.endsWith("\n"), true);
    assert.equal(await snapshotDirectory(project.repository).then((files) => files["AGENTS.md"]), undefined);
    const repeatedInit = invokeInit(project);
    assert.equal(repeatedInit.status, 0);
    assert.match(repeatedInit.stdout, /configuration-disposition: adopt/u);

    const diff = invoke("diff", project);
    assert.equal(diff.status, 1);
    const rendered = invoke("render", project, lockPath, exactPlanDigest(diff));
    assert.equal(rendered.status, 0);
    assert.equal(invoke("check", project).status, 0);
    const empty = invoke("diff", project);
    assert.equal(empty.status, 0);
    assert.match(empty.stdout, /changes: none\n$/u);
  }

  assert.deepEqual(
    await snapshotDirectory(second.repository),
    await snapshotDirectory(first.repository),
  );
});

test("reports exact adopt, lossless import, and abort initialization outcomes", async (t) => {
  const exactProject = await testProject(t);
  const exactWorkspace = await PrivateFilesystemWorkspace.openReadOnly(
    exactProject.repository,
  );
  const exactPrepared = await preparePrivateDomainProjectPlan({
    content: `${JSON.stringify(localIntent(), null, 2)}\n`,
    lockPath,
    workspace: exactWorkspace,
  });
  assert.equal(exactPrepared.ok, true);
  if (!exactPrepared.ok) return;
  const agentTarget = exactPrepared.plan.files.find(
    (file) => file.path === "AGENTS.md",
  )?.expectedContent;
  assert.notEqual(agentTarget, null);
  assert.notEqual(agentTarget, undefined);
  await writeFile(join(exactProject.repository, "AGENTS.md"), agentTarget ?? "", "utf8");
  const adopted = invokeInit(exactProject);
  assert.equal(adopted.status, 0);
  assert.match(adopted.stdout, /disposition: adopt/u);
  const adoptDiff = invoke("diff", exactProject);
  assert.equal(adoptDiff.status, 1);
  assert.equal(
    invoke("render", exactProject, lockPath, exactPlanDigest(adoptDiff)).status,
    0,
  );
  assert.equal(invoke("check", exactProject).status, 0);

  const importProject = await testProject(t);
  const importWorkspace = await PrivateFilesystemWorkspace.openReadOnly(
    importProject.repository,
  );
  const importPrepared = await preparePrivateDomainProjectPlan({
    content: `${JSON.stringify(localIntent(), null, 2)}\n`,
    lockPath,
    workspace: importWorkspace,
  });
  assert.equal(importPrepared.ok, true);
  if (!importPrepared.ok) return;
  const sourceBody = importPrepared.materialization.files[0]?.content;
  assert.notEqual(sourceBody, undefined);
  await writeFile(join(importProject.repository, "AGENTS.md"), sourceBody ?? "", "utf8");
  const imported = invokeInit(importProject);
  assert.equal(imported.status, 1);
  assert.match(imported.stdout, /^agentdevflow init: review-required\n/u);
  assert.match(imported.stdout, /disposition: import/u);
  const importDiff = invoke("diff", importProject);
  assert.equal(importDiff.status, 1);
  const importContent = await readFile(importProject.configuration, "utf8");
  const mutableImportWorkspace =
    await PrivateFilesystemWorkspace.openForProcessTermination(
      importProject.repository,
    );
  const approvedImport = await preparePrivateDomainProjectPlan({
    content: importContent,
    lockPath,
    workspace: mutableImportWorkspace,
  });
  assert.equal(approvedImport.ok, true);
  if (!approvedImport.ok) return;
  assert.equal(approvedImport.snapshot.digest, exactPlanDigest(importDiff));
  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        materialization: approvedImport.materialization,
        snapshot: approvedImport.snapshot,
        baseLock: approvedImport.baseLock,
        lockPath,
        workspace: mutableImportWorkspace,
        applyFaultInjector(event) {
          if (event.kind === "path-applied" && event.path === "AGENTS.md") {
            throw new Error("Injected interrupted initialization import.");
          }
        },
      }),
    /Injected interrupted initialization import/u,
  );
  const staleImportApproval = invoke(
    "render",
    importProject,
    lockPath,
    exactPlanDigest(importDiff),
  );
  assert.equal(staleImportApproval.status, 2);
  assert.match(staleImportApproval.stdout, /CLI_PLAN_APPROVAL_MISMATCH/u);
  const recoveryDiff = invoke("diff", importProject);
  assert.equal(recoveryDiff.status, 1);
  assert.equal(
    invoke(
      "render",
      importProject,
      lockPath,
      exactPlanDigest(recoveryDiff),
    ).status,
    0,
  );
  assert.equal(invoke("check", importProject).status, 0);

  const blockedProject = await testProject(t);
  const foreign = "PRIVATE FOREIGN INIT CONTENT\n";
  await writeFile(join(blockedProject.repository, "AGENTS.md"), foreign, "utf8");
  const blocked = invokeInit(blockedProject);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stdout, /INITIALIZATION_IMPORT_UNSUPPORTED/u);
  assert.equal(blocked.stdout.includes(foreign.trim()), false);
  await assert.rejects(() => readFile(blockedProject.configuration, "utf8"));
});

test("executes initial check and exact diff without mutating the repository", async (t) => {
  const project = await testProject(t);
  await writeConfiguration(project, localIntent());
  const before = await snapshotDirectory(project.repository);

  const check = invoke("check", project);
  const diff = invoke("diff", project);

  assert.equal(check.status, 1);
  assert.equal(check.stderr, "");
  assert.match(check.stdout, /^agentdevflow check: changes-required\n/u);
  assert.match(check.stdout, /CHECK_PATH_CHANGE_REQUIRED/u);
  assert.match(check.stdout, /CHECK_LOCK_CHANGE_REQUIRED/u);
  assert.equal(diff.status, 1);
  assert.equal(diff.stderr, "");
  assert.match(diff.stdout, /^agentdevflow diff: changes-required\n/u);
  assert.match(diff.stdout, /changes: 4\n/u);
  for (const path of [
    ".agentdevflow/render-lock.json",
    ".cursor/rules/agentdevflow.mdc",
    "AGENTS.md",
    "CLAUDE.md",
  ]) {
    assert.match(diff.stdout, new RegExp(`path: ${path.replaceAll(".", "\\.")}`, "u"));
  }
  assert.equal(
    diff.stdout.match(/after-content-json: "/gu)?.length,
    4,
  );
  assert.deepEqual(await snapshotDirectory(project.repository), before);
});

test("reports clean check and empty diff from an already rendered exact state", async (t) => {
  const project = await testProject(t);
  const content = await writeConfiguration(project, localIntent());
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    project.repository,
  );
  const prepared = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const rendered = await executePrivateRenderCommand({
    materialization: prepared.materialization,
    snapshot: prepared.snapshot,
    baseLock: prepared.baseLock,
    lockPath,
    workspace,
  });
  assert.equal(rendered.verification.ok, true);
  assert.equal(rendered.lockPublished, true);
  const before = await snapshotDirectory(project.repository);

  const check = invoke("check", project);
  const diff = invoke("diff", project);

  assert.equal(check.status, 0);
  assert.match(check.stdout, /^agentdevflow check: clean\n/u);
  assert.match(check.stdout, /diagnostics: none\n/u);
  assert.equal(diff.status, 0);
  assert.match(diff.stdout, /^agentdevflow diff: clean\n/u);
  assert.match(diff.stdout, /changes: none\n$/u);
  assert.deepEqual(await snapshotDirectory(project.repository), before);
});

test("applies an approved exact diff and repeats the current plan as a no-op", async (t) => {
  const project = await testProject(t);
  await writeConfiguration(project, localIntent());
  const initial = invoke("diff", project);
  const approvedDigest = exactPlanDigest(initial);

  const rendered = invoke("render", project, lockPath, approvedDigest);

  assert.equal(rendered.status, 0);
  assert.equal(rendered.stderr, "");
  assert.match(rendered.stdout, /^agentdevflow render: applied\n/u);
  assert.match(rendered.stdout, new RegExp(`exact-plan-digest: ${approvedDigest}`, "u"));
  assert.match(rendered.stdout, /written: \.cursor\/rules\/agentdevflow\.mdc, AGENTS\.md, CLAUDE\.md/u);
  assert.match(rendered.stdout, /lock-published: yes\n$/u);
  assert.notEqual(await readFile(join(project.repository, "AGENTS.md"), "utf8"), "");

  const cleanDiff = invoke("diff", project);
  const cleanDigest = exactPlanDigest(cleanDiff);
  const beforeRepeated = await snapshotDirectory(project.repository);
  const repeated = invoke("render", project, lockPath, cleanDigest);

  assert.equal(cleanDiff.status, 0);
  assert.equal(repeated.status, 0);
  assert.match(repeated.stdout, /^agentdevflow render: clean\n/u);
  assert.match(repeated.stdout, /written: none\n/u);
  assert.match(repeated.stdout, /removed: none\n/u);
  assert.match(repeated.stdout, /lock-published: no\n$/u);
  assert.deepEqual(await snapshotDirectory(project.repository), beforeRepeated);
});

test("resumes an interrupted before-or-after plan with its original approval", async (t) => {
  const project = await testProject(t);
  const content = await writeConfiguration(project, localIntent());
  const initialDiff = invoke("diff", project);
  const approvedDigest = exactPlanDigest(initialDiff);
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    project.repository,
  );
  const prepared = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.snapshot.digest, approvedDigest);
  await assert.rejects(
    () =>
      executePrivateRenderCommand({
        materialization: prepared.materialization,
        snapshot: prepared.snapshot,
        baseLock: prepared.baseLock,
        lockPath,
        workspace,
        applyFaultInjector(event) {
          if (event.kind === "path-applied" && event.path === "AGENTS.md") {
            throw new Error("Injected interrupted local render.");
          }
        },
      }),
    /Injected interrupted local render/u,
  );
  assert.equal(await workspace.read(lockPath), null);
  assert.notEqual(await workspace.read("AGENTS.md"), null);
  assert.equal(await workspace.read("CLAUDE.md"), null);

  const resumed = invoke("render", project, lockPath, approvedDigest);

  assert.equal(resumed.status, 0);
  assert.match(resumed.stdout, /^agentdevflow render: applied\n/u);
  assert.match(resumed.stdout, new RegExp(`exact-plan-digest: ${approvedDigest}`, "u"));
  assert.match(resumed.stdout, /written: CLAUDE\.md/u);
  assert.match(resumed.stdout, /lock-published: yes\n$/u);
  assert.equal(invoke("check", project).status, 0);
});

test("rejects an unapproved or stale exact plan before repository mutation", async (t) => {
  const project = await testProject(t);
  await writeConfiguration(project, localIntent());
  const initial = invoke("diff", project);
  const approvedDigest = exactPlanDigest(initial);
  const beforeWrongApproval = await snapshotDirectory(project.repository);

  const wrongApproval = invoke("render", project, lockPath, "f".repeat(64));

  assert.equal(wrongApproval.status, 2);
  assert.match(wrongApproval.stdout, /CLI_PLAN_APPROVAL_MISMATCH/u);
  assert.deepEqual(
    await snapshotDirectory(project.repository),
    beforeWrongApproval,
  );

  await writeConfiguration(project, { ...localIntent(), preset: "fast" });
  const beforeStaleApproval = await snapshotDirectory(project.repository);
  const staleApproval = invoke("render", project, lockPath, approvedDigest);

  assert.equal(staleApproval.status, 2);
  assert.match(staleApproval.stdout, /CLI_PLAN_APPROVAL_MISMATCH/u);
  assert.deepEqual(
    await snapshotDirectory(project.repository),
    beforeStaleApproval,
  );
});

test("blocks a foreign ownership conflict without disclosing its bytes", async (t) => {
  const project = await testProject(t);
  await writeConfiguration(project, localIntent());
  const approvedDigest = exactPlanDigest(invoke("diff", project));
  const foreignContent = "PRIVATE FOREIGN CONTENT MUST NOT APPEAR\n";
  await writeFile(join(project.repository, "AGENTS.md"), foreignContent, "utf8");
  const before = await snapshotDirectory(project.repository);

  const check = invoke("check", project);
  const diff = invoke("diff", project);
  const render = invoke("render", project, lockPath, approvedDigest);

  assert.equal(check.status, 2);
  assert.match(check.stdout, /^agentdevflow check: blocked\n/u);
  assert.match(check.stdout, /CHECK_PATH_CONFLICT/u);
  assert.equal(check.stdout.includes(foreignContent.trim()), false);
  assert.equal(diff.status, 2);
  assert.match(diff.stdout, /^agentdevflow diff: blocked\n/u);
  assert.match(diff.stdout, /changes: unavailable\n$/u);
  assert.equal(diff.stdout.includes(foreignContent.trim()), false);
  assert.equal(render.status, 2);
  assert.match(render.stdout, /OWNERSHIP_CONFLICT/u);
  assert.equal(render.stdout.includes(foreignContent.trim()), false);
  assert.deepEqual(await snapshotDirectory(project.repository), before);
});

test("blocks drift from retained ownership without disclosing changed bytes", async (t) => {
  const project = await testProject(t);
  const content = await writeConfiguration(project, localIntent());
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    project.repository,
  );
  const prepared = await preparePrivateDomainProjectPlan({
    content,
    lockPath,
    workspace,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  await executePrivateRenderCommand({
    materialization: prepared.materialization,
    snapshot: prepared.snapshot,
    baseLock: prepared.baseLock,
    lockPath,
    workspace,
  });
  const changedContent = "PRIVATE OWNED DRIFT MUST NOT APPEAR\n";
  await writeFile(join(project.repository, "CLAUDE.md"), changedContent, "utf8");
  const before = await snapshotDirectory(project.repository);

  const result = invoke("diff", project);

  assert.equal(result.status, 2);
  assert.match(result.stdout, /OWNERSHIP_CONFLICT/u);
  assert.match(result.stdout, /CHECK_PATH_CONFLICT/u);
  assert.match(result.stdout, /changes: unavailable\n$/u);
  assert.equal(result.stdout.includes(changedContent.trim()), false);
  assert.deepEqual(await snapshotDirectory(project.repository), before);
});

test("fails unsupported external capabilities closed with actionable diagnostics", async (t) => {
  const project = await testProject(t);
  await writeConfiguration(project, issueIntent());
  const before = await snapshotDirectory(project.repository);

  const result = invoke("check", project);

  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^agentdevflow check: blocked\n/u);
  assert.match(result.stdout, /CAPABILITY_UNAVAILABLE/u);
  assert.match(result.stdout, /WORKFLOW_COMPILATION_FAILED/u);
  assert.deepEqual(await snapshotDirectory(project.repository), before);
});

test("blocks invalid configuration and unsafe lock paths before mutation", async (t) => {
  const project = await testProject(t);
  await writeFile(project.configuration, "{ invalid", "utf8");
  const beforeInvalid = await snapshotDirectory(project.repository);

  const invalidConfiguration = invoke("check", project);
  assert.equal(invalidConfiguration.status, 2);
  assert.match(invalidConfiguration.stdout, /SYNTAX_INVALID/u);
  assert.deepEqual(
    await snapshotDirectory(project.repository),
    beforeInvalid,
  );

  await writeConfiguration(project, localIntent());
  const beforeUnsafeLock = await snapshotDirectory(project.repository);
  const unsafeLock = invoke("diff", project, "/absolute/render-lock.json");
  assert.equal(unsafeLock.status, 2);
  assert.match(unsafeLock.stdout, /LOCK_READ_FAILED/u);
  assert.match(unsafeLock.stdout, /changes: unavailable\n$/u);
  assert.deepEqual(
    await snapshotDirectory(project.repository),
    beforeUnsafeLock,
  );
});

test("prints bounded private help without requiring a CLI framework", () => {
  const result = spawnSync(process.execPath, [entryPoint, "--help"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^Usage:\n/u);
  assert.match(result.stdout, /Check and diff are read-only\./u);
  assert.match(result.stdout, /Render requires an exact plan digest from diff\./u);
});

test("executes through an npm-style symbolic link", async (t) => {
  const project = await testProject(t);
  const linkedEntryPoint = join(project.container, "agentdevflow");
  await symlink(entryPoint, linkedEntryPoint);

  const result = spawnSync(process.execPath, [linkedEntryPoint, "--help"], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^Usage:\n/u);
});

test("uses exact-root defaults and emits one versioned JSON report", async (t) => {
  const project = await testProject(t);
  const defaultConfiguration = join(
    project.repository,
    "agentdevflow.config.jsonc",
  );
  await writeFile(defaultConfiguration, document(localIntent()), "utf8");

  const result = spawnSync(
    process.execPath,
    [entryPoint, "diff", "--json"],
    { cwd: project.repository, encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.command, "diff");
  assert.equal(report.outcome, "changes-required");
  assert.equal(report.exitCode, 1);
  assert.equal(Array.isArray(report.changes), true);
  assert.equal(
    await readFile(defaultConfiguration, "utf8"),
    document(localIntent()),
  );
});

test("does not discover configuration from a parent directory", async (t) => {
  const project = await testProject(t);
  const nested = join(project.repository, "nested");
  await mkdir(nested);
  await writeFile(
    join(project.repository, "agentdevflow.config.jsonc"),
    document(localIntent()),
    "utf8",
  );

  const result = spawnSync(process.execPath, [entryPoint, "check", "--json"], {
    cwd: nested,
    encoding: "utf8",
  });

  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout) as {
    readonly diagnostics: readonly { readonly code: string }[];
  };
  assert.equal(report.diagnostics[0]?.code, "CLI_CONFIGURATION_READ_FAILED");
});

test("evaluates explicit local doctor observations without live probes", async (t) => {
  const project = await testProject(t);
  await writeConfiguration(project, localIntent());
  const observationsPath = join(project.container, "observations.json");
  await writeFile(
    observationsPath,
    `${JSON.stringify(localDoctorObservations())}\n`,
    "utf8",
  );
  const before = await snapshotDirectory(project.repository);

  const healthy = invokeDoctor(project, observationsPath);

  assert.equal(healthy.status, 0);
  assert.equal(healthy.stderr, "");
  assert.match(healthy.stdout, /^agentdevflow doctor: healthy\n/u);
  assert.match(healthy.stdout, /providers-observed: 3/u);
  assert.match(healthy.stdout, /environment-capabilities-observed: 2/u);
  assert.deepEqual(await snapshotDirectory(project.repository), before);

  await writeConfiguration(project, issueIntent());
  const unsupported = invokeDoctor(project, observationsPath);
  assert.equal(unsupported.status, 2);
  assert.match(unsupported.stdout, /CLI_DOCTOR_WORKFLOW_UNSUPPORTED/u);
});
