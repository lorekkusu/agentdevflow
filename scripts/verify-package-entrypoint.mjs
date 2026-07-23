import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageBaseName = `${String(manifest.name).replace(/^@/u, "").replace(/\//gu, "-")}-${String(manifest.version)}.tgz`;
const temporaryRoot = await mkdtemp(join(tmpdir(), "agentdevflow-package-entrypoint-"));
const installRoot = join(temporaryRoot, "install");
const projectRoot = join(temporaryRoot, "project");
const issueProjectRoot = join(temporaryRoot, "issue-project");
const draftIssueProjectRoot = join(temporaryRoot, "draft-issue-project");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, cwd, expectedStatuses = [0]) {
  const usesWindowsCommandScript =
    process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
  const executable = usesWindowsCommandScript
    ? (process.env.ComSpec ?? "cmd.exe")
    : command;
  const executableArgs = usesWindowsCommandScript
    ? ["/d", "/s", "/c", command, ...args]
    : args;
  const result = spawnSync(executable, executableArgs, {
    cwd,
    encoding: "utf8",
  });
  if (
    result.error !== undefined ||
    result.status === null ||
    !expectedStatuses.includes(result.status)
  ) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        result.stdout,
        result.stderr,
        result.error?.message,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result;
}

try {
  run(
    npmCommand,
    ["pack", "--pack-destination", temporaryRoot, "--ignore-scripts=false"],
    root,
  );
  await mkdir(installRoot);
  const tarball = join(temporaryRoot, packageBaseName);
  const dependencyTarballs = [];
  for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) {
    const packedDependency = run(
      npmCommand,
      [
        "pack",
        join(root, "node_modules", dependency),
        "--ignore-scripts",
        "--pack-destination",
        temporaryRoot,
        "--json",
      ],
      root,
    );
    const packed = JSON.parse(packedDependency.stdout);
    const filename = packed[0]?.filename;
    if (typeof filename !== "string") {
      throw new Error(`Could not determine the packed filename for ${dependency}.`);
    }
    dependencyTarballs.push(join(temporaryRoot, filename));
  }
  run(
    npmCommand,
    [
      "install",
      "--prefix",
      installRoot,
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      tarball,
      ...dependencyTarballs,
    ],
    root,
  );
  const binName = process.platform === "win32" ? "agentdevflow.cmd" : "agentdevflow";
  const binPath = join(installRoot, "node_modules", ".bin", binName);
  const help = run(binPath, ["--help"], installRoot);
  if (!help.stdout.startsWith("Usage:\n")) {
    throw new Error(`Installed ${basename(binPath)} did not print CLI help.`);
  }
  const helpAssertions = [
    ["init", ["local-reviewed-change", "issue-to-reviewed-pull-request", "linear|github-issues", "fast|balanced", "id,product", "claude-code, codex, cursor"]],
    ["check", ["read-only", "exit 1"]],
    ["diff", ["exact-plan-digest", "Exit 1"]],
    ["render", ["exact-plan-digest", "stale or foreign state fails closed"]],
  ];
  for (const [command, expectedText] of helpAssertions) {
    const commandHelp = run(binPath, [command, "--help"], installRoot);
    for (const text of expectedText) {
      if (!commandHelp.stdout.includes(text)) {
        throw new Error(`Installed ${command} help omitted ${text}.`);
      }
    }
  }
  await mkdir(projectRoot);
  run(
    binPath,
    [
      "init",
      "--workflow",
      "local-reviewed-change",
      "--preset",
      "fast",
      "--tracker",
      "none",
      "--provider",
      "codex-main,codex",
      "--provider",
      "claude-secondary,claude-code",
      "--provider",
      "cursor-developer,cursor",
      "--steward",
      "codex-main",
      "--developer",
      "cursor-developer",
      "--reviewer",
      "claude-secondary",
    ],
    projectRoot,
  );
  const rulesRoot = join(projectRoot, ".agentdevflow", "rules");
  await mkdir(rulesRoot, { recursive: true });
  await Promise.all([
    writeFile(
      join(rulesRoot, "shared.md"),
      "Always report the exact handoff target.\n",
      "utf8",
    ),
    writeFile(
      join(rulesRoot, "steward.md"),
      "Keep acceptance criteria visible.\n",
      "utf8",
    ),
    writeFile(
      join(rulesRoot, "developer.md"),
      "Run the repository verification command before handoff.\n",
      "utf8",
    ),
    writeFile(
      join(rulesRoot, "reviewer.md"),
      "Review only the current revision.\n",
      "utf8",
    ),
  ]);
  const diff = run(binPath, ["diff", "--json"], projectRoot, [1]);
  const diffReport = JSON.parse(diff.stdout);
  const digest = diffReport.exactPlanDigest;
  if (
    diffReport.schemaVersion !== 1 ||
    diffReport.outcome !== "changes-required" ||
    !/^[a-f0-9]{64}$/u.test(digest)
  ) {
    throw new Error("Packed agentdevflow diff did not return a versioned exact plan.");
  }
  run(binPath, ["render", "--approve-plan", digest], projectRoot);
  const [codexInstructions, claudeInstructions, cursorInstructions] =
    await Promise.all([
      readFile(join(projectRoot, "AGENTS.md"), "utf8"),
      readFile(join(projectRoot, "CLAUDE.md"), "utf8"),
      readFile(
        join(projectRoot, ".cursor", "rules", "agentdevflow.mdc"),
        "utf8",
      ),
    ]);
  if (
    new Set([codexInstructions, claudeInstructions, cursorInstructions]).size !==
      3 ||
    !codexInstructions.includes("Keep acceptance criteria visible.") ||
    codexInstructions.includes("Review only the current revision.") ||
    !claudeInstructions.includes("Review only the current revision.") ||
    claudeInstructions.includes(
      "Run the repository verification command before handoff.",
    ) ||
    !cursorInstructions.includes(
      "Run the repository verification command before handoff.",
    ) ||
    cursorInstructions.includes("Keep acceptance criteria visible.")
  ) {
    throw new Error(
      "Packed agentdevflow did not produce distinct responsibility-scoped provider instructions.",
    );
  }
  const convergedDiff = run(binPath, ["diff", "--json"], projectRoot);
  const convergedReport = JSON.parse(convergedDiff.stdout);
  if (
    convergedReport.schemaVersion !== 1 ||
    convergedReport.outcome !== "clean" ||
    !/^[a-f0-9]{64}$/u.test(convergedReport.exactPlanDigest)
  ) {
    throw new Error("Packed agentdevflow did not produce a clean converged plan.");
  }
  run(
    binPath,
    ["render", "--approve-plan", convergedReport.exactPlanDigest],
    projectRoot,
  );
  const check = run(binPath, ["check", "--json"], projectRoot);
  const checkReport = JSON.parse(check.stdout);
  if (checkReport.schemaVersion !== 1 || checkReport.outcome !== "clean") {
    throw new Error("Packed agentdevflow check did not return a clean versioned report.");
  }
  run(binPath, ["diff"], projectRoot);
  await mkdir(issueProjectRoot);
  run(
    binPath,
    [
      "init",
      "--workflow",
      "issue-to-reviewed-pull-request",
      "--preset",
      "balanced",
      "--tracker",
      "linear",
      "--pull-request-state",
      "ready",
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
    issueProjectRoot,
  );
  const issueDiff = run(
    binPath,
    ["diff", "--json"],
    issueProjectRoot,
    [1],
  );
  const issueDiffReport = JSON.parse(issueDiff.stdout);
  run(
    binPath,
    ["render", "--approve-plan", issueDiffReport.exactPlanDigest],
    issueProjectRoot,
  );
  const issueCheck = run(binPath, ["check", "--json"], issueProjectRoot);
  const issueAgents = await readFile(
    join(issueProjectRoot, "AGENTS.md"),
    "utf8",
  );
  const issueCursor = await readFile(
    join(issueProjectRoot, ".cursor", "rules", "agentdevflow.mdc"),
    "utf8",
  );
  if (
    JSON.parse(issueCheck.stdout).outcome !== "clean" ||
    !issueAgents.includes("### Steward") ||
    !issueAgents.includes("### Reviewer") ||
    issueAgents.includes("### Developer") ||
    !issueCursor.includes("### Developer") ||
    issueCursor.includes("### Steward") ||
    issueCursor.includes("### Reviewer")
  ) {
    throw new Error(
      "Packed agentdevflow did not complete the bounded Linear workflow with responsibility-scoped output.",
    );
  }
  await mkdir(draftIssueProjectRoot);
  run(
    binPath,
    [
      "init",
      "--workflow",
      "issue-to-reviewed-pull-request",
      "--preset",
      "balanced",
      "--tracker",
      "github-issues",
      "--pull-request-state",
      "draft",
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
    draftIssueProjectRoot,
  );
  const draftIssueDiff = run(
    binPath,
    ["diff", "--json"],
    draftIssueProjectRoot,
    [1],
  );
  const draftIssueDiffReport = JSON.parse(draftIssueDiff.stdout);
  run(
    binPath,
    ["render", "--approve-plan", draftIssueDiffReport.exactPlanDigest],
    draftIssueProjectRoot,
  );
  const draftIssueCheck = run(
    binPath,
    ["check", "--json"],
    draftIssueProjectRoot,
  );
  const draftIssueAgents = await readFile(
    join(draftIssueProjectRoot, "AGENTS.md"),
    "utf8",
  );
  const draftIssueCursor = await readFile(
    join(draftIssueProjectRoot, ".cursor", "rules", "agentdevflow.mdc"),
    "utf8",
  );
  if (
    JSON.parse(draftIssueCheck.stdout).outcome !== "clean" ||
    !draftIssueAgents.includes("Tracker mode: `github-issues`") ||
    !draftIssueAgents.includes(
      "create the corresponding work item in GitHub Issues",
    ) ||
    !draftIssueAgents.includes(
      "mark the draft pull request ready for review",
    ) ||
    !draftIssueCursor.includes("create a `draft` pull request")
  ) {
    throw new Error(
      "Packed agentdevflow did not complete the bounded GitHub Issues draft workflow.",
    );
  }
  const configurationPath = join(projectRoot, "agentdevflow.config.jsonc");
  const configuration = JSON.parse(await readFile(configurationPath, "utf8"));
  configuration.roles.reviewer = "codex-main";
  configuration.providers = configuration.providers.filter(
    (provider) => provider.id !== "claude-secondary",
  );
  await writeFile(
    configurationPath,
    `${JSON.stringify(configuration, null, 2)}\n`,
    "utf8",
  );
  const claudePath = join(projectRoot, "CLAUDE.md");
  const managedClaude = await readFile(claudePath, "utf8");
  const deletionDiff = run(binPath, ["diff", "--json"], projectRoot, [1]);
  const deletionReport = JSON.parse(deletionDiff.stdout);
  const deletion = deletionReport.changes.find(
    (change) => change.path === "CLAUDE.md",
  );
  if (
    deletionReport.schemaVersion !== 1 ||
    deletionReport.outcome !== "changes-required" ||
    deletion?.kind !== "managed-output" ||
    deletion.action !== "delete" ||
    deletion.afterContent !== null
  ) {
    throw new Error("Packed agentdevflow did not expose the complete managed deletion.");
  }
  const deletionForeignMarker = "PRIVATE_DELETION_DRIFT_MUST_NOT_BE_DISCLOSED";
  await writeFile(claudePath, `${deletionForeignMarker}\n`, "utf8");
  const blockedDeletion = run(binPath, ["diff", "--json"], projectRoot, [2]);
  const blockedDeletionReport = JSON.parse(blockedDeletion.stdout);
  if (
    blockedDeletionReport.schemaVersion !== 1 ||
    blockedDeletionReport.outcome !== "blocked" ||
    blockedDeletion.stdout.includes(deletionForeignMarker)
  ) {
    throw new Error("Packed agentdevflow did not block foreign deletion drift.");
  }
  await writeFile(claudePath, managedClaude, "utf8");
  const approvedDeletion = run(binPath, ["diff", "--json"], projectRoot, [1]);
  const approvedDeletionReport = JSON.parse(approvedDeletion.stdout);
  run(
    binPath,
    ["render", "--approve-plan", approvedDeletionReport.exactPlanDigest],
    projectRoot,
  );
  const deletionCheck = run(binPath, ["check", "--json"], projectRoot);
  if (JSON.parse(deletionCheck.stdout).outcome !== "clean") {
    throw new Error("Packed agentdevflow did not converge after managed deletion.");
  }
  await Promise.all([
    readFile(join(projectRoot, "agentdevflow.config.jsonc"), "utf8"),
    readFile(join(projectRoot, "AGENTS.md"), "utf8"),
    readFile(join(projectRoot, ".agentdevflow", "lock.json"), "utf8"),
  ]);
  const foreignMarker = "PRIVATE_FOREIGN_CONTENT_MUST_NOT_BE_DISCLOSED";
  await writeFile(join(projectRoot, "AGENTS.md"), `${foreignMarker}\n`, "utf8");
  const blocked = run(binPath, ["diff", "--json"], projectRoot, [2]);
  const blockedReport = JSON.parse(blocked.stdout);
  if (
    blockedReport.schemaVersion !== 1 ||
    blockedReport.outcome !== "blocked" ||
    blockedReport.exitCode !== 2 ||
    blocked.stdout.includes(foreignMarker)
  ) {
    throw new Error("Packed agentdevflow diff did not fail closed on foreign bytes.");
  }
  await unlink(join(projectRoot, "AGENTS.md"));
  await symlink(configurationPath, join(projectRoot, "AGENTS.md"));
  const symbolicLink = run(binPath, ["diff", "--json"], projectRoot, [2]);
  const symbolicLinkReport = JSON.parse(symbolicLink.stdout);
  if (
    symbolicLinkReport.schemaVersion !== 1 ||
    symbolicLinkReport.outcome !== "blocked" ||
    symbolicLinkReport.exitCode !== 2
  ) {
    throw new Error("Packed agentdevflow did not retain JSON for a symbolic link.");
  }
  process.stdout.write("Packed agentdevflow entrypoint and quick start passed.\n");
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
