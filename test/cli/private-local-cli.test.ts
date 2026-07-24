import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";

import { preparePrivateDomainProjectPlan } from "../../src/application/private-domain-project-plan.js";
import { runPrivateLocalCli } from "../../src/cli/private-local-cli.js";
import type { PrivateOnboardingOperator } from "../../src/cli/private-onboarding-operator.js";
import { executePrivateRenderCommand } from "../../src/commands/private-render-command-service.js";
import { privateDomainProjectDocumentDefaultMaxBytes } from "../../src/interface/private-domain-project-document.js";
import { privateRenderLockDefaultMaxBytes } from "../../src/lock/private-render-lock.js";
import type { PrivateDomainProjectIntent } from "../../src/project/private-domain-project-resolution.js";
import { createPrivateConvergentMutationIntent } from "../../src/workspace/private-convergent-intent.js";
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

function codexOnlyIntent(): PrivateDomainProjectIntent {
  return {
    ...localIntent(),
    providers: [{ id: "codex-primary", product: "codex" }],
    roles: {
      steward: "codex-primary",
      developer: "codex-primary",
      reviewer: "codex-primary",
    },
  };
}

function codexAndClaudeIntent(): PrivateDomainProjectIntent {
  return {
    ...codexOnlyIntent(),
    providers: [
      { id: "codex-primary", product: "codex" },
      { id: "claude-reviewer", product: "claude-code" },
    ],
    roles: {
      steward: "codex-primary",
      developer: "codex-primary",
      reviewer: "claude-reviewer",
    },
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

function invokeWithReplacements(
  command: "diff" | "render",
  project: TestProject,
  replacements: Readonly<Record<string, string>>,
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
    lockPath,
  ];
  for (const [path, observedDigest] of Object.entries(replacements).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    args.push("--replace-existing", `${path}=${observedDigest}`);
  }
  if (command === "render" && approvedPlanDigest !== undefined) {
    args.push("--approve-plan", approvedPlanDigest);
  }
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(result.error, undefined);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function invokeOnboard(
  project: TestProject,
  json = false,
  selectedConfigurationPath = "project.jsonc",
): CommandResult {
  const args = [
    entryPoint,
    "onboard",
    "--agent",
    "manual",
    "--repository",
    project.repository,
    "--config",
    selectedConfigurationPath,
    "--lock",
    lockPath,
  ];
  if (json) args.push("--json");
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(result.error, undefined);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function invokeInit(
  project: TestProject,
  json = false,
  selectedConfigurationPath = "project.jsonc",
  selectedLockPath = lockPath,
): CommandResult {
  const args = [
    entryPoint,
    "init",
    "--repository",
    project.repository,
    "--config",
    selectedConfigurationPath,
    "--lock",
    selectedLockPath,
    "--workflow",
    "local-reviewed-change",
    "--preset",
    "balanced",
    "--tracker",
    "none",
    "--provider",
    "codex-steward,codex",
    "--provider",
    "cursor-developer,cursor",
    "--provider",
    "claude-reviewer,claude-code",
    "--steward",
    "codex-steward",
    "--developer",
    "cursor-developer",
    "--reviewer",
    "claude-reviewer",
  ];
  if (json) args.push("--json");
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

function invokeIssueInit(
  project: TestProject,
  initialState: "draft" | "ready" = "ready",
): CommandResult {
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
      "issue-to-reviewed-pull-request",
      "--preset",
      "balanced",
      "--tracker",
      "linear",
      "--pull-request-state",
      initialState,
      "--pull-request-host",
      "github",
      "--ci",
      "github-actions",
      "--provider",
      "codex-control,codex",
      "--provider",
      "cursor-developer,cursor",
      "--steward",
      "codex-control",
      "--developer",
      "cursor-developer",
      "--reviewer",
      "codex-control",
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

function invokeRule(
  project: TestProject,
  args: readonly string[],
  input?: string | Uint8Array,
  selectedConfigurationPath = "project.jsonc",
): CommandResult {
  const result = spawnSync(
    process.execPath,
    [
      entryPoint,
      "rule",
      ...args,
      "--repository",
      project.repository,
      "--config",
      selectedConfigurationPath,
    ],
    {
      encoding: "utf8",
      ...(input === undefined ? {} : { input }),
    },
  );
  assert.equal(result.error, undefined);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
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

test("reproduces the offline init, onboard, diff, render, check, and empty-diff path", async (t) => {
  const first = await testProject(t);
  const second = await testProject(t);

  for (const project of [first, second]) {
    const initialized = invokeInit(project);
    assert.equal(initialized.status, 0);
    assert.equal(initialized.stderr, "");
    assert.match(initialized.stdout, /^agentdevflow init: ready\n/u);
    assert.match(initialized.stdout, /configuration-disposition: create/u);
    assert.match(initialized.stdout, /provider-dispositions: 3/u);
    assert.match(
      initialized.stdout,
      /next: run onboard with --config set to the configuration-path above; then use rule commands as needed and run diff without replacement inputs/u,
    );
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

    const inventory = JSON.parse(invokeOnboard(project, true).stdout);
    assert.deepEqual(
      inventory.targets.map(
        (target: { readonly disposition: string }) => target.disposition,
      ),
      ["absent", "absent", "absent"],
    );

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

test("requires an explicit agent outside a terminal after config validation", async (t) => {
  const project = await testProject(t);
  assert.equal(invokeInit(project).status, 0);
  let stdout = "";
  let stderr = "";
  const operator: PrivateOnboardingOperator = {
    canSelectInteractively: false,
    async selectAgent() {
      assert.fail("non-interactive onboarding must not open a selection prompt");
    },
    async runCodex() {
      assert.fail("non-interactive onboarding without --agent must not launch Codex");
    },
  };
  const status = await runPrivateLocalCli(
    [
      "onboard",
      "--repository",
      project.repository,
      "--config",
      "project.jsonc",
      "--lock",
      lockPath,
    ],
    {
      stdout: { write: (content) => (stdout += String(content)) },
      stderr: { write: (content) => (stderr += String(content)) },
    },
    Readable.from([]),
    operator,
  );

  assert.equal(status, 2);
  assert.equal(stderr, "");
  assert.match(stdout, /CLI_ONBOARD_AGENT_REQUIRED/u);
  assert.match(stdout, /targets: unavailable/u);
});

test("uses the interactive selection for one bounded manual path", async (t) => {
  const project = await testProject(t);
  assert.equal(invokeInit(project).status, 0);
  let stdout = "";
  const operator: PrivateOnboardingOperator = {
    canSelectInteractively: true,
    async selectAgent() {
      return "manual";
    },
    async runCodex() {
      assert.fail("manual selection must not launch Codex");
    },
  };
  const status = await runPrivateLocalCli(
    [
      "onboard",
      "--repository",
      project.repository,
      "--config",
      "project.jsonc",
      "--lock",
      lockPath,
    ],
    {
      stdout: { write: (content) => (stdout += String(content)) },
      stderr: { write: () => undefined },
    },
    Readable.from([]),
    operator,
  );

  assert.equal(status, 0);
  assert.match(stdout, /^agentdevflow onboard: inventory/u);
});

test("runs one Codex operation and independently requires a clean final check", async (t) => {
  const project = await testProject(t);
  assert.equal(invokeInit(project).status, 0);
  let stdout = "";
  let observedAcceptWithoutConfirmation: boolean | undefined;
  const operator: PrivateOnboardingOperator = {
    canSelectInteractively: false,
    async selectAgent() {
      assert.fail("an explicit Codex selection must not open the picker");
    },
    async runCodex(options) {
      observedAcceptWithoutConfirmation = options.acceptWithoutConfirmation;
      const diff = invoke("diff", project);
      assert.equal(diff.status, 1);
      assert.equal(
        invoke("render", project, lockPath, exactPlanDigest(diff)).status,
        0,
      );
      return { outcome: "completed" };
    },
  };
  const status = await runPrivateLocalCli(
    [
      "onboard",
      "--agent",
      "codex",
      "--yes",
      "--repository",
      project.repository,
      "--config",
      "project.jsonc",
      "--lock",
      lockPath,
    ],
    {
      stdout: { write: (content) => (stdout += String(content)) },
      stderr: { write: () => undefined },
    },
    Readable.from([]),
    operator,
  );

  assert.equal(observedAcceptWithoutConfirmation, true);
  assert.equal(status, 0);
  assert.match(stdout, /^agentdevflow check: clean/u);
});

test("does not treat a successful Codex exit as a clean onboarding result", async (t) => {
  const project = await testProject(t);
  assert.equal(invokeInit(project).status, 0);
  let stdout = "";
  const operator: PrivateOnboardingOperator = {
    canSelectInteractively: false,
    async selectAgent() {
      assert.fail("an explicit Codex selection must not open the picker");
    },
    async runCodex() {
      return { outcome: "completed" };
    },
  };
  const status = await runPrivateLocalCli(
    [
      "onboard",
      "--agent",
      "codex",
      "--yes",
      "--repository",
      project.repository,
      "--config",
      "project.jsonc",
      "--lock",
      lockPath,
    ],
    {
      stdout: { write: (content) => (stdout += String(content)) },
      stderr: { write: () => undefined },
    },
    Readable.from([]),
    operator,
  );

  assert.equal(status, 2);
  assert.match(stdout, /^agentdevflow check: changes-required/u);
});

test("blocks Codex launch before target inspection when config is absent", async (t) => {
  const project = await testProject(t);
  let launched = false;
  let stdout = "";
  const operator: PrivateOnboardingOperator = {
    canSelectInteractively: false,
    async selectAgent() {
      return "codex";
    },
    async runCodex() {
      launched = true;
      return { outcome: "completed" };
    },
  };
  const status = await runPrivateLocalCli(
    [
      "onboard",
      "--agent",
      "codex",
      "--repository",
      project.repository,
      "--config",
      "project.jsonc",
      "--lock",
      lockPath,
    ],
    {
      stdout: { write: (content) => (stdout += String(content)) },
      stderr: { write: () => undefined },
    },
    Readable.from([]),
    operator,
  );

  assert.equal(status, 2);
  assert.equal(launched, false);
  assert.match(stdout, /CLI_ONBOARD_CONFIGURATION_REQUIRED/u);
  assert.doesNotMatch(stdout, /AGENTS\\.md/u);
});

test("keeps the selected configuration path through init, onboard, and rule guidance", async (t) => {
  const project = await testProject(t);
  const selectedConfigurationPath = "custom-project.jsonc";
  const initialized = invokeInit(
    project,
    false,
    selectedConfigurationPath,
  );
  assert.equal(initialized.status, 0);
  assert.match(
    initialized.stdout,
    /configuration-path: custom-project\.jsonc/u,
  );
  assert.match(
    initialized.stdout,
    /next: run onboard with --config set to the configuration-path above/u,
  );
  assert.equal(
    invokeOnboard(project, false, selectedConfigurationPath).status,
    0,
  );
  assert.equal(
    invokeRule(
      project,
      ["list", "--json"],
      undefined,
      selectedConfigurationPath,
    ).status,
    0,
  );
});

test("reports exact adopt, lossless import, and onboarding-required initialization outcomes", async (t) => {
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
  const sourceBody = importPrepared.materialization.files.find(
    (file) => file.provider === "codex",
  )?.content;
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
    await PrivateFilesystemWorkspace.open(
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
  assert.equal(blocked.status, 1);
  assert.match(blocked.stdout, /^agentdevflow init: review-required\n/u);
  assert.match(blocked.stdout, /INITIALIZATION_IMPORT_UNSUPPORTED/u);
  assert.equal(blocked.stdout.includes(foreign.trim()), false);
  assert.deepEqual(
    JSON.parse(await readFile(blockedProject.configuration, "utf8")).providers.map(
      (provider: { readonly id: string }) => provider.id,
    ),
    ["claude-reviewer", "codex-steward", "cursor-developer"],
  );
  assert.equal(
    await readFile(join(blockedProject.repository, "AGENTS.md"), "utf8"),
    foreign,
  );
  await assert.rejects(() =>
    readFile(join(blockedProject.repository, lockPath), "utf8"),
  );
});

test("onboards exact whole-file dispositions without silent content loss", async (t) => {
  const project = await testProject(t);
  const existing = {
    "AGENTS.md":
      "Retain shared legacy policy.\nCodex-only stewardship.\nDo not run tests.\n",
    "CLAUDE.md":
      "Retain shared legacy policy.\nReviewer-only verification.\nSkip independent review.\n",
    ".cursor/rules/agentdevflow.mdc":
      "Retain shared legacy policy.\nDeveloper-only implementation.\n",
  } as const;
  for (const [path, content] of Object.entries(existing)) {
    await mkdir(join(project.repository, path, ".."), { recursive: true });
    await writeFile(join(project.repository, path), content, "utf8");
  }

  const beforeInit = invokeOnboard(project, true);
  assert.equal(beforeInit.status, 2);
  const beforeInitReport = JSON.parse(beforeInit.stdout);
  assert.equal(beforeInitReport.targets, null);
  assert.equal(
    beforeInitReport.diagnostics[0]?.code,
    "CLI_ONBOARD_CONFIGURATION_REQUIRED",
  );

  const initialized = invokeInit(project);
  assert.equal(initialized.status, 1);
  assert.match(
    initialized.stdout,
    /next: run onboard with --config set to the configuration-path above; then use rule commands as needed and run diff without replacement inputs/u,
  );
  assert.doesNotMatch(initialized.stdout, /--replace-existing/u);

  const inventory = invokeOnboard(project, true);
  assert.equal(inventory.status, 0);
  const inventoryReport = JSON.parse(inventory.stdout);
  assert.deepEqual(
    inventoryReport.targets.map(
      (target: {
        readonly path: string;
        readonly disposition: string;
        readonly classification: string;
      }) => ({
        path: target.path,
        disposition: target.disposition,
        classification: target.classification,
      }),
    ),
    [
      {
        path: ".cursor/rules/agentdevflow.mdc",
        disposition: "unmanaged-existing",
        classification: "unclassified",
      },
      {
        path: "AGENTS.md",
        disposition: "unmanaged-existing",
        classification: "unclassified",
      },
      {
        path: "CLAUDE.md",
        disposition: "unmanaged-existing",
        classification: "unclassified",
      },
    ],
  );
  assert.equal(inventoryReport.targets[1]?.content, existing["AGENTS.md"]);

  assert.equal(
    invokeRule(
      project,
      [
        "add",
        "retained-shared-policy",
        "--scope",
        "shared",
        "--stdin",
      ],
      "Retain shared legacy policy.\n",
    ).status,
    0,
  );
  assert.equal(
    invokeRule(
      project,
      [
        "add",
        "codex-stewardship",
        "--scope",
        "steward",
        "--stdin",
      ],
      "Codex-only stewardship.\n",
    ).status,
    0,
  );
  assert.equal(
    invokeRule(
      project,
      [
        "add",
        "reviewer-verification",
        "--scope",
        "reviewer",
        "--stdin",
      ],
      "Reviewer-only verification.\n",
    ).status,
    0,
  );
  assert.equal(
    invokeRule(
      project,
      [
        "add",
        "developer-implementation",
        "--scope",
        "developer",
        "--stdin",
      ],
      "Developer-only implementation.\n",
    ).status,
    0,
  );

  const blockedDiff = invoke("diff", project);
  assert.equal(blockedDiff.status, 2);
  assert.match(blockedDiff.stdout, /OWNERSHIP_CONFLICT/u);
  assert.equal(blockedDiff.stdout.includes("Do not run tests."), false);

  const replacements = Object.fromEntries(
    Object.entries(existing).map(([path, content]) => [path, sha256(content)]),
  );
  const reviewed = invokeWithReplacements("diff", project, replacements);
  assert.equal(reviewed.status, 1);
  for (const content of Object.values(existing)) {
    for (const line of content.trim().split("\n")) {
      assert.equal(reviewed.stdout.includes(line), true, line);
    }
  }
  assert.match(reviewed.stdout, /Retain shared legacy policy/u);

  await writeFile(
    join(project.repository, "AGENTS.md"),
    `${existing["AGENTS.md"]}Intervening edit.\n`,
    "utf8",
  );
  const staleTarget = invokeWithReplacements(
    "render",
    project,
    replacements,
    exactPlanDigest(reviewed),
  );
  assert.equal(staleTarget.status, 2);
  assert.match(
    staleTarget.stdout,
    /EXISTING_TARGET_REPLACEMENT_STALE|CLI_PLAN_APPROVAL_MISMATCH/u,
  );
  await writeFile(
    join(project.repository, "AGENTS.md"),
    existing["AGENTS.md"],
    "utf8",
  );

  const current = invokeWithReplacements("diff", project, replacements);
  assert.equal(current.status, 1);
  const rendered = invokeWithReplacements(
    "render",
    project,
    replacements,
    exactPlanDigest(current),
  );
  assert.equal(rendered.status, 0);
  assert.equal(invoke("check", project).status, 0);

  const generatedAgents = await readFile(
    join(project.repository, "AGENTS.md"),
    "utf8",
  );
  assert.match(generatedAgents, /Retain shared legacy policy/u);
  assert.match(generatedAgents, /Codex-only stewardship/u);
  assert.equal(generatedAgents.includes("Do not run tests."), false);

  const managedInventory = JSON.parse(invokeOnboard(project, true).stdout);
  assert.deepEqual(
    managedInventory.targets.map(
      (target: { readonly disposition: string }) => target.disposition,
    ),
    ["managed-exact", "managed-exact", "managed-exact"],
  );
});

test("onboards a new unmanaged provider target after other targets are managed", async (t) => {
  const project = await testProject(t);
  await writeConfiguration(project, codexOnlyIntent());
  const initialDiff = invoke("diff", project);
  assert.equal(initialDiff.status, 1);
  assert.equal(
    invoke("render", project, lockPath, exactPlanDigest(initialDiff)).status,
    0,
  );
  assert.equal(invoke("check", project).status, 0);

  const existingClaude =
    "Legacy Claude review policy intentionally replaced after classification.\n";
  await writeFile(
    join(project.repository, "CLAUDE.md"),
    existingClaude,
    "utf8",
  );
  await writeConfiguration(project, codexAndClaudeIntent());
  const replacements = { "CLAUDE.md": sha256(existingClaude) };
  const reviewed = invokeWithReplacements("diff", project, replacements);
  assert.equal(reviewed.status, 1);
  assert.match(reviewed.stdout, /Legacy Claude review policy/u);

  const rendered = invokeWithReplacements(
    "render",
    project,
    replacements,
    exactPlanDigest(reviewed),
  );
  assert.equal(rendered.status, 0);
  assert.equal(invoke("check", project).status, 0);
  const managedReplacement = invokeWithReplacements(
    "diff",
    project,
    replacements,
  );
  assert.equal(managedReplacement.status, 2);
  assert.match(
    managedReplacement.stdout,
    /EXISTING_TARGET_REPLACEMENT_MANAGED_STATE/u,
  );

  const inventory = JSON.parse(invokeOnboard(project, true).stdout);
  const claude = inventory.targets.find(
    (target: { readonly path: string }) => target.path === "CLAUDE.md",
  );
  assert.equal(claude?.disposition, "managed-exact");
});

test("blocks onboarding inventory without partial target disclosure", async (t) => {
  const project = await testProject(t);
  await writeConfiguration(project, localIntent());
  const outside = join(project.container, "outside.md");
  await writeFile(outside, "Outside target.\n", "utf8");
  await writeFile(
    join(project.repository, "AGENTS.md"),
    "Visible unmanaged content.\n",
    "utf8",
  );
  await symlink(outside, join(project.repository, "CLAUDE.md"));

  const result = invokeOnboard(project, true);
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.targets, null);
  assert.equal(
    report.diagnostics.some(
      (diagnostic: { readonly code: string }) =>
        diagnostic.code === "ONBOARD_TARGET_READ_FAILED",
    ),
    true,
  );
  assert.equal(result.stdout.includes("Visible unmanaged content."), false);
});

test("blocks onboard before reading targets when configuration is absent or invalid", async (t) => {
  const project = await testProject(t);
  const outside = join(project.container, "outside.md");
  await writeFile(outside, "Outside target.\n", "utf8");
  await symlink(outside, join(project.repository, "AGENTS.md"));

  const absent = invokeOnboard(project, true);
  assert.equal(absent.status, 2);
  const absentReport = JSON.parse(absent.stdout);
  assert.equal(absentReport.targets, null);
  assert.equal(
    absentReport.diagnostics[0]?.code,
    "CLI_ONBOARD_CONFIGURATION_REQUIRED",
  );
  assert.equal(
    absentReport.diagnostics.some(
      (diagnostic: { readonly code: string }) =>
        diagnostic.code === "ONBOARD_TARGET_READ_FAILED",
    ),
    false,
  );

  await writeFile(project.configuration, "{ invalid", "utf8");
  const invalid = invokeOnboard(project, true);
  assert.equal(invalid.status, 2);
  const invalidReport = JSON.parse(invalid.stdout);
  assert.equal(invalidReport.targets, null);
  assert.equal(
    invalidReport.diagnostics.some(
      (diagnostic: { readonly code: string }) =>
        diagnostic.code === "SYNTAX_INVALID",
    ),
    true,
  );
  assert.equal(
    invalidReport.diagnostics.some(
      (diagnostic: { readonly code: string }) =>
        diagnostic.code === "ONBOARD_TARGET_READ_FAILED",
    ),
    false,
  );
});

test("onboards through the selected valid configuration path", async (t) => {
  const project = await testProject(t);
  await writeFile(
    join(project.repository, "custom-project.jsonc"),
    document(localIntent()),
    "utf8",
  );

  assert.equal(invokeOnboard(project, true).status, 2);
  const selected = invokeOnboard(project, true, "custom-project.jsonc");
  assert.equal(selected.status, 0);
  assert.deepEqual(
    JSON.parse(selected.stdout).targets.map(
      (target: { readonly disposition: string }) => target.disposition,
    ),
    ["absent", "absent", "absent"],
  );
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
    diff.stdout.match(/  after-content:\n/gu)?.length,
    4,
  );
  assert.equal(diff.stdout.includes("content-json"), false);
  assert.deepEqual(await snapshotDirectory(project.repository), before);
});

test("reports clean check and empty diff from an already rendered exact state", async (t) => {
  const project = await testProject(t);
  const content = await writeConfiguration(project, localIntent());
  const workspace = await PrivateFilesystemWorkspace.open(
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
  const workspace = await PrivateFilesystemWorkspace.open(
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

test("resumes an explicitly replaced target before lock publication", async (t) => {
  const project = await testProject(t);
  const existing = "Legacy policy selected for replacement.\n";
  await writeFile(join(project.repository, "AGENTS.md"), existing, "utf8");
  assert.equal(invokeInit(project).status, 1);
  assert.equal(
    invokeRule(
      project,
      ["add", "legacy-policy", "--scope", "shared", "--stdin"],
      existing,
    ).status,
    0,
  );
  const replacements = { "AGENTS.md": sha256(existing) };
  const reviewed = invokeWithReplacements("diff", project, replacements);
  assert.equal(reviewed.status, 1);
  const approvedDigest = exactPlanDigest(reviewed);

  const configuration = await readFile(project.configuration, "utf8");
  const workspace = await PrivateFilesystemWorkspace.open(project.repository);
  const prepared = await preparePrivateDomainProjectPlan({
    content: configuration,
    lockPath,
    workspace,
    existingTargetReplacements: [
      { path: "AGENTS.md", observedDigest: replacements["AGENTS.md"] },
    ],
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
        faultInjector(event) {
          if (event.kind === "render-applied") {
            throw new Error("Injected interruption before lock publication.");
          }
        },
      }),
    /Injected interruption before lock publication/u,
  );

  const resumed = invokeWithReplacements(
    "render",
    project,
    replacements,
    approvedDigest,
  );
  assert.equal(resumed.status, 0);
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
  const workspace = await PrivateFilesystemWorkspace.open(
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

test("runs the bounded Linear workflow through init, render, and clean check", async (t) => {
  const project = await testProject(t);
  const initialized = invokeIssueInit(project);
  assert.equal(initialized.status, 0);
  assert.equal(initialized.stderr, "");
  assert.match(initialized.stdout, /^agentdevflow init: ready\n/u);

  const configuration = JSON.parse(
    await readFile(project.configuration, "utf8"),
  ) as PrivateDomainProjectIntent;
  assert.deepEqual(configuration, {
    ...issueIntent(),
    providers: [
      { id: "codex-control", product: "codex" },
      { id: "cursor-developer", product: "cursor" },
    ],
    roles: {
      developer: "cursor-developer",
      reviewer: "codex-control",
      steward: "codex-control",
    },
    capabilityBindings: [
      {
        binding: "ci",
        target: { kind: "external", id: "github-actions" },
      },
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "pull-request-host",
        target: { kind: "external", id: "github" },
      },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
      { binding: "tracker", target: { kind: "tracker" } },
    ],
  });

  const diff = invoke("diff", project);
  assert.equal(diff.status, 1);
  const rendered = invoke("render", project, lockPath, exactPlanDigest(diff));
  assert.equal(rendered.status, 0);
  assert.equal(invoke("check", project).status, 0);

  const agents = await readFile(join(project.repository, "AGENTS.md"), "utf8");
  const cursor = await readFile(
    join(project.repository, ".cursor/rules/agentdevflow.mdc"),
    "utf8",
  );
  assert.match(agents, /Steward/u);
  assert.match(agents, /Reviewer/u);
  assert.doesNotMatch(agents, /^### Developer$/mu);
  assert.match(cursor, /Developer/u);
  assert.doesNotMatch(cursor, /^### Steward$/mu);
  assert.doesNotMatch(cursor, /^### Reviewer$/mu);
  assert.notEqual(agents, cursor);
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

test("rejects overlapping configuration, lock, guidance, and generated namespaces before mutation", async (t) => {
  const outputAncestor = await testProject(t);
  const outputAncestorResult = invokeInit(
    outputAncestor,
    false,
    "AGENTS.md/project.jsonc",
  );
  assert.equal(outputAncestorResult.status, 2);
  assert.match(outputAncestorResult.stdout, /CLI_PATH_COLLISION/u);
  assert.deepEqual(await snapshotDirectory(outputAncestor.repository), {});

  const lockAncestor = await testProject(t);
  const lockAncestorResult = invokeInit(
    lockAncestor,
    false,
    "state/project.jsonc",
    "state",
  );
  assert.equal(lockAncestorResult.status, 2);
  assert.match(lockAncestorResult.stdout, /CLI_PATH_COLLISION/u);
  assert.deepEqual(await snapshotDirectory(lockAncestor.repository), {});

  const guidanceLock = await testProject(t);
  const guidanceLockResult = invokeInit(
    guidanceLock,
    false,
    "project.jsonc",
    ".agentdevflow/rules/shared.md",
  );
  assert.equal(guidanceLockResult.status, 2);
  assert.match(guidanceLockResult.stdout, /CLI_PATH_COLLISION/u);
  assert.deepEqual(await snapshotDirectory(guidanceLock.repository), {});

  const seed = await testProject(t);
  assert.equal(invokeInit(seed).status, 0);
  const configurationContent = await readFile(seed.configuration, "utf8");
  const temporaryCollision = await testProject(t);
  const temporaryWorkspace = await PrivateFilesystemWorkspace.openReadOnly(
    temporaryCollision.repository,
  );
  const prepared = await preparePrivateDomainProjectPlan({
    content: configurationContent,
    lockPath,
    workspace: temporaryWorkspace,
  });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  const agents = prepared.plan.files.find((file) => file.path === "AGENTS.md");
  assert.notEqual(agents?.expectedDigest, null);
  assert.notEqual(agents?.expectedDigest, undefined);
  const temporaryPath = createPrivateConvergentMutationIntent({
    planDigest: prepared.plan.planDigest,
    targetPath: "AGENTS.md",
    targetDigest: agents?.expectedDigest ?? "",
  }).temporaryPath;
  const temporaryResult = invokeInit(
    temporaryCollision,
    false,
    temporaryPath,
  );
  assert.equal(temporaryResult.status, 2);
  assert.match(temporaryResult.stdout, /CLI_PATH_COLLISION/u);
  assert.deepEqual(await snapshotDirectory(temporaryCollision.repository), {});
});

test("rejects oversized and invalid UTF-8 configuration and lock files", async (t) => {
  const oversizedConfiguration = await testProject(t);
  await writeFile(
    oversizedConfiguration.configuration,
    Buffer.alloc(privateDomainProjectDocumentDefaultMaxBytes + 1, 0x20),
  );
  const oversizedConfigurationResult = invoke("check", oversizedConfiguration);
  assert.equal(oversizedConfigurationResult.status, 2);
  assert.match(
    oversizedConfigurationResult.stdout,
    /CLI_CONFIGURATION_READ_FAILED/u,
  );
  await assert.rejects(
    () => readFile(join(oversizedConfiguration.repository, "AGENTS.md")),
  );

  const invalidConfiguration = await testProject(t);
  await writeFile(invalidConfiguration.configuration, Buffer.from([0xff]));
  const invalidConfigurationResult = invoke("check", invalidConfiguration);
  assert.equal(invalidConfigurationResult.status, 2);
  assert.match(
    invalidConfigurationResult.stdout,
    /CLI_CONFIGURATION_READ_FAILED/u,
  );

  for (const [name, content] of [
    [
      "oversized",
      Buffer.alloc(privateRenderLockDefaultMaxBytes + 1, 0x20),
    ],
    ["invalid-utf8", Buffer.from([0xff])],
  ] as const) {
    const project = await testProject(t);
    await writeConfiguration(project, localIntent());
    await mkdir(join(project.repository, ".agentdevflow"), { recursive: true });
    await writeFile(join(project.repository, lockPath), content);
    const result = invoke("check", project);
    assert.equal(result.status, 2, name);
    assert.match(result.stdout, /LOCK_READ_FAILED/u, name);
    await assert.rejects(
      () => readFile(join(project.repository, "AGENTS.md")),
      name,
    );
  }
});

test("manages per-rule files while leaving provider outputs for exact-approved render", async (t) => {
  const project = await testProject(t);
  assert.equal(invokeInit(project).status, 0);
  assert.equal(invokeOnboard(project).status, 0);
  const initialDiff = invoke("diff", project);
  assert.equal(initialDiff.status, 1);
  assert.equal(
    invoke(
      "render",
      project,
      lockPath,
      exactPlanDigest(initialDiff),
    ).status,
    0,
  );
  const generatedPaths = [
    ".cursor/rules/agentdevflow.mdc",
    "AGENTS.md",
    "CLAUDE.md",
  ] as const;
  const generatedBefore = Object.fromEntries(
    await Promise.all(
      generatedPaths.map(async (path) => [
        path,
        await readFile(join(project.repository, path), "utf8"),
      ]),
    ),
  );

  const empty = invokeRule(project, ["list", "--json"]);
  assert.equal(empty.status, 0);
  assert.deepEqual(JSON.parse(empty.stdout).rules, []);

  const sharedContent = "Run the documented verification before handoff.\n";
  const addedShared = invokeRule(
    project,
    [
      "add",
      "verification",
      "--scope",
      "shared",
      "--stdin",
      "--json",
    ],
    sharedContent,
  );
  assert.equal(addedShared.status, 0);
  assert.deepEqual(JSON.parse(addedShared.stdout).rule, {
    id: "verification",
    scope: "shared",
    path: ".agentdevflow/rules/shared/verification.md",
  });

  await mkdir(join(project.repository, "inputs"));
  await writeFile(
    join(project.repository, "inputs/developer.md"),
    "Keep implementation within the accepted scope.\n",
    "utf8",
  );
  const addedDeveloper = invokeRule(project, [
    "add",
    "implementation-scope",
    "--scope",
    "developer",
    "--file",
    "inputs/developer.md",
  ]);
  assert.equal(addedDeveloper.status, 0);

  const listed = invokeRule(project, ["list", "--json"]);
  assert.equal(listed.status, 0);
  assert.deepEqual(
    JSON.parse(listed.stdout).rules.map(
      (rule: { readonly id: string }) => rule.id,
    ),
    ["implementation-scope", "verification"],
  );
  const shown = invokeRule(project, ["show", "verification", "--json"]);
  assert.equal(shown.status, 0);
  assert.equal(JSON.parse(shown.stdout).rule.content, sharedContent);
  assert.equal(
    await readFile(
      join(
        project.repository,
        ".agentdevflow/rules/developer/implementation-scope.md",
      ),
      "utf8",
    ),
    "Keep implementation within the accepted scope.\n",
  );

  for (const path of generatedPaths) {
    assert.equal(
      await readFile(join(project.repository, path), "utf8"),
      generatedBefore[path],
      path,
    );
  }
  const changed = invoke("diff", project);
  assert.equal(changed.status, 1);
  assert.match(changed.stdout, /Run the documented verification/u);
  assert.match(changed.stdout, /Keep implementation within the accepted scope/u);

  const updatedContent =
    "Run the complete documented verification before handoff.\n";
  const updated = invokeRule(
    project,
    ["update", "verification", "--stdin", "--json"],
    updatedContent,
  );
  assert.equal(updated.status, 0);
  assert.equal(
    JSON.parse(
      invokeRule(project, ["show", "verification", "--json"]).stdout,
    ).rule.content,
    updatedContent,
  );
  assert.equal(
    invokeRule(project, [
      "remove",
      "implementation-scope",
      "--json",
    ]).status,
    0,
  );
  assert.deepEqual(
    JSON.parse(invokeRule(project, ["list", "--json"]).stdout).rules.map(
      (rule: { readonly id: string }) => rule.id,
    ),
    ["verification"],
  );

  const finalDiff = invoke("diff", project);
  assert.equal(finalDiff.status, 1);
  assert.equal(
    invoke(
      "render",
      project,
      lockPath,
      exactPlanDigest(finalDiff),
    ).status,
    0,
  );
  assert.equal(invoke("check", project).status, 0);
  for (const path of generatedPaths) {
    assert.match(
      await readFile(join(project.repository, path), "utf8"),
      /Run the complete documented verification before handoff/u,
      path,
    );
  }
});

test("blocks duplicate, missing, and aggregate rule states without mutation", async (t) => {
  const project = await testProject(t);
  const beforeInit = invokeRule(
    project,
    [
      "add",
      "verification",
      "--scope",
      "shared",
      "--stdin",
      "--json",
    ],
    "Run verification.\n",
  );
  assert.equal(beforeInit.status, 2);
  assert.equal(
    JSON.parse(beforeInit.stdout).diagnostics[0]?.code,
    "CLI_RULE_CONFIGURATION_REQUIRED",
  );
  assert.deepEqual(await snapshotDirectory(project.repository), {});

  await writeFile(project.configuration, "{ invalid", "utf8");
  const invalidConfiguration = invokeRule(
    project,
    ["list", "--json"],
  );
  assert.equal(invalidConfiguration.status, 2);
  assert.equal(
    JSON.parse(invalidConfiguration.stdout).diagnostics[0]?.code,
    "SYNTAX_INVALID",
  );
  assert.equal(
    (await snapshotDirectory(project.repository))[
      ".agentdevflow/rules/shared/verification.md"
    ],
    undefined,
  );

  await writeFile(
    join(project.repository, "AGENTS.md"),
    document(localIntent()),
    "utf8",
  );
  const reservedConfigurationPath = invokeRule(
    project,
    [
      "add",
      "verification",
      "--scope",
      "shared",
      "--stdin",
      "--json",
    ],
    "Run verification.\n",
    "AGENTS.md",
  );
  assert.equal(reservedConfigurationPath.status, 2);
  assert.equal(
    JSON.parse(reservedConfigurationPath.stdout).diagnostics[0]?.code,
    "CLI_PATH_COLLISION",
  );
  assert.equal(
    (await snapshotDirectory(project.repository))[
      ".agentdevflow/rules/shared/verification.md"
    ],
    undefined,
  );
  await rm(join(project.repository, "AGENTS.md"));

  await rm(project.configuration);
  assert.equal(invokeInit(project).status, 0);
  assert.equal(invokeOnboard(project).status, 0);
  assert.equal(
    invokeRule(
      project,
      [
        "add",
        "verification",
        "--scope",
        "shared",
        "--stdin",
      ],
      "Run verification.\n",
    ).status,
    0,
  );
  const duplicate = invokeRule(
    project,
    [
      "add",
      "verification",
      "--scope",
      "developer",
      "--stdin",
      "--json",
    ],
    "Different content.\n",
  );
  assert.equal(duplicate.status, 2);
  assert.equal(
    JSON.parse(duplicate.stdout).diagnostics[0]?.code,
    "RULE_ALREADY_EXISTS",
  );
  for (const [operation, args, input] of [
    ["show", ["show", "missing", "--json"], undefined],
    [
      "update",
      ["update", "missing", "--stdin", "--json"],
      "Replacement.\n",
    ],
    ["remove", ["remove", "missing", "--json"], undefined],
  ] as const) {
    const result = invokeRule(project, args, input);
    assert.equal(result.status, 2, operation);
    assert.equal(
      JSON.parse(result.stdout).diagnostics[0]?.code,
      "RULE_NOT_FOUND",
      operation,
    );
  }

  const aggregate = await testProject(t);
  assert.equal(invokeInit(aggregate).status, 0);
  assert.equal(invokeOnboard(aggregate).status, 0);
  await mkdir(join(aggregate.repository, ".agentdevflow/rules"), {
    recursive: true,
  });
  await writeFile(
    join(aggregate.repository, ".agentdevflow/rules/shared.md"),
    "Legacy aggregate guidance.\n",
    "utf8",
  );
  const before = await snapshotDirectory(aggregate.repository);
  for (const [operation, args, input] of [
    ["list", ["list", "--json"], undefined],
    ["show", ["show", "legacy", "--json"], undefined],
    [
      "add",
      ["add", "new-rule", "--scope", "shared", "--stdin", "--json"],
      "New content.\n",
    ],
    [
      "update",
      ["update", "legacy", "--stdin", "--json"],
      "Updated content.\n",
    ],
    ["remove", ["remove", "legacy", "--json"], undefined],
  ] as const) {
    const result = invokeRule(aggregate, args, input);
    assert.equal(result.status, 2, operation);
    const report = JSON.parse(result.stdout);
    assert.equal(
      report.diagnostics[0]?.code,
      "RULE_AGGREGATE_LAYOUT_UNSUPPORTED",
      operation,
    );
    assert.match(
      report.diagnostics[0]?.message ?? "",
      /\.agentdevflow\/rules\/shared\/shared-guidance\.md/u,
      operation,
    );
    assert.deepEqual(
      await snapshotDirectory(aggregate.repository),
      before,
      operation,
    );
  }
});

test("invalidates a reviewed render plan when canonical rules change", async (t) => {
  const project = await testProject(t);
  assert.equal(invokeInit(project).status, 0);
  assert.equal(invokeOnboard(project).status, 0);
  const reviewed = invoke("diff", project);
  assert.equal(reviewed.status, 1);
  const staleDigest = exactPlanDigest(reviewed);

  assert.equal(
    invokeRule(
      project,
      [
        "add",
        "verification",
        "--scope",
        "shared",
        "--stdin",
      ],
      "Run verification before handoff.\n",
    ).status,
    0,
  );
  const staleRender = invoke("render", project, lockPath, staleDigest);
  assert.equal(staleRender.status, 2);
  assert.match(staleRender.stdout, /CLI_PLAN_APPROVAL_MISMATCH/u);
  await assert.rejects(
    () => readFile(join(project.repository, "AGENTS.md"), "utf8"),
  );
  await assert.rejects(
    () => readFile(join(project.repository, lockPath), "utf8"),
  );

  const current = invoke("diff", project);
  assert.equal(current.status, 1);
  assert.notEqual(exactPlanDigest(current), staleDigest);
  assert.equal(
    invoke(
      "render",
      project,
      lockPath,
      exactPlanDigest(current),
    ).status,
    0,
  );
  assert.equal(invoke("check", project).status, 0);
});

test("prints bounded private help without requiring a CLI framework", () => {
  const result = spawnSync(process.execPath, [entryPoint, "--help"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^Usage:\n/u);
  assert.match(result.stdout, /Diff and check are read-only\./u);
  assert.match(result.stdout, /Render requires an exact plan digest from diff\./u);
  assert.match(result.stdout, /agentdevflow rule list/u);
  const journeyCommands = [
    "agentdevflow init",
    "agentdevflow onboard",
    "agentdevflow rule list",
    "agentdevflow diff",
    "agentdevflow render",
    "agentdevflow check",
  ];
  for (const [index, command] of journeyCommands.entries()) {
    if (index === 0) continue;
    assert.ok(
      result.stdout.indexOf(journeyCommands[index - 1] ?? "") <
        result.stdout.indexOf(command),
      `${command} must follow the previous first-use command in global help`,
    );
  }
});

test("prints focused help for every beta command", () => {
  for (const command of [
    "init",
    "onboard",
    "rule",
    "diff",
    "render",
    "check",
  ]) {
    const result = spawnSync(process.execPath, [entryPoint, command, "--help"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, new RegExp(`agentdevflow ${command}`, "u"));
  }

  const init = spawnSync(process.execPath, [entryPoint, "init", "--help"], {
    encoding: "utf8",
  });
  assert.match(init.stdout, /local-reviewed-change/u);
  assert.match(init.stdout, /issue-to-reviewed-pull-request/u);
  assert.match(init.stdout, /linear\|github-issues/u);
  assert.match(init.stdout, /fast\|balanced/u);
  assert.match(init.stdout, /--provider <id,product>/u);
  assert.doesNotMatch(init.stdout, /id,product,surface|Provider surfaces/u);
  assert.match(init.stdout, /claude-code, codex, cursor/u);
  assert.match(init.stdout, /do not verify or invoke those services/u);
  assert.match(init.stdout, /complete provider path a managed file/u);

  const diff = spawnSync(process.execPath, [entryPoint, "diff", "--help"], {
    encoding: "utf8",
  });
  assert.match(diff.stdout, /exact-plan-digest/u);
  assert.match(diff.stdout, /Exit 1/u);

  const render = spawnSync(process.execPath, [entryPoint, "render", "--help"], {
    encoding: "utf8",
  });
  assert.match(render.stdout, /stale or foreign state fails closed/u);
  assert.match(render.stdout, /whole-file managed targets/u);

  const rule = spawnSync(process.execPath, [entryPoint, "rule", "--help"], {
    encoding: "utf8",
  });
  assert.match(rule.stdout, /rule list/u);
  assert.match(rule.stdout, /globally unique lowercase ASCII slugs/u);
  assert.match(rule.stdout, /Run diff and exact-approved render separately/u);

  for (const operation of ["list", "show", "add", "update", "remove"]) {
    const operationHelp = spawnSync(
      process.execPath,
      [entryPoint, "rule", operation, "--help"],
      { encoding: "utf8" },
    );
    assert.equal(
      operationHelp.status,
      0,
      `${operation}: ${operationHelp.stderr}`,
    );
    assert.match(
      operationHelp.stdout,
      new RegExp(`agentdevflow rule ${operation}`, "u"),
    );
  }
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

test("keeps JSON output versioned when a managed target is a symbolic link", async (t) => {
  const initProject = await testProject(t);
  const initOutside = join(initProject.container, "outside-init.md");
  await writeFile(initOutside, "outside init\n", "utf8");
  await symlink(initOutside, join(initProject.repository, "AGENTS.md"));

  const init = invokeInit(initProject, true);
  assert.equal(init.status, 2);
  assert.equal(init.stderr, "");
  const initReport = JSON.parse(init.stdout) as {
    readonly schemaVersion: number;
    readonly command: string;
    readonly outcome: string;
    readonly exitCode: number;
  };
  assert.deepEqual(
    [initReport.schemaVersion, initReport.command, initReport.outcome, initReport.exitCode],
    [1, "init", "blocked", 2],
  );

  const project = await testProject(t);
  await writeConfiguration(project, localIntent());
  const outside = join(project.container, "outside.md");
  await writeFile(outside, "outside\n", "utf8");
  await symlink(outside, join(project.repository, "AGENTS.md"));

  for (const command of ["check", "diff", "render"] as const) {
    const args = [
      entryPoint,
      command,
      "--repository",
      project.repository,
      "--config",
      "project.jsonc",
      "--lock",
      lockPath,
      "--json",
    ];
    if (command === "render") {
      args.push("--approve-plan", "0".repeat(64));
    }
    const result = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(result.status, 2, `${command}: ${result.stderr}`);
    assert.equal(result.stderr, "");
    const report = JSON.parse(result.stdout) as {
      readonly schemaVersion: number;
      readonly command: string;
      readonly outcome: string;
      readonly exitCode: number;
    };
    assert.deepEqual(
      [report.schemaVersion, report.command, report.outcome, report.exitCode],
      [1, command, "blocked", 2],
    );
  }
});
