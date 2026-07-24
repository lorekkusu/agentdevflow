import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join, posix } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageBaseName = `${String(manifest.name).replace(/^@/u, "").replace(/\//gu, "-")}-${String(manifest.version)}.tgz`;
const temporaryRoot = await mkdtemp(join(tmpdir(), "agentdevflow-package-entrypoint-"));
const installRoot = join(temporaryRoot, "install");
const projectRoot = join(temporaryRoot, "project");
const issueProjectRoot = join(temporaryRoot, "issue-project");
const draftIssueProjectRoot = join(temporaryRoot, "draft-issue-project");
const aggregateProjectRoot = join(temporaryRoot, "aggregate-project");
const onboardingProjectRoot = join(temporaryRoot, "onboarding-project");
const codexOnboardingProjectRoot = join(
  temporaryRoot,
  "codex-onboarding-project",
);
const fakeCodexBinRoot = join(temporaryRoot, "fake-codex-bin");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, cwd, expectedStatuses = [0], input, env) {
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
    ...(input === undefined ? {} : { input }),
    ...(env === undefined ? {} : { env }),
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
  const packageListing = JSON.parse(
    run(
      npmCommand,
      ["pack", "--dry-run", "--ignore-scripts", "--json"],
      root,
    ).stdout,
  );
  const privateCompilerArtifact = packageListing[0]?.files?.find(
    ({ path }) => path.endsWith(".d.ts") || path.endsWith(".js.map"),
  );
  if (privateCompilerArtifact !== undefined) {
    throw new Error(
      `CLI-only package contains a private compiler artifact: ${privateCompilerArtifact.path}`,
    );
  }
  const packagePaths = new Set(
    packageListing[0]?.files?.map(({ path }) => path) ?? [],
  );
  for (const markdownPath of ["README.md", "docs/getting-started.md"]) {
    const markdown = await readFile(join(root, markdownPath), "utf8");
    for (const link of markdown.matchAll(/\]\(([^)]+)\)/gu)) {
      const target = link[1] ?? "";
      if (/^(?:#|https?:|mailto:)/u.test(target)) continue;
      const targetPath = posix.normalize(
        posix.join(posix.dirname(markdownPath), target.split("#")[0] ?? ""),
      );
      if (!packagePaths.has(targetPath)) {
        throw new Error(
          `Packaged ${markdownPath} links to omitted package path: ${targetPath}`,
        );
      }
    }
  }
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
    ["onboard", ["Run init before onboard", "--agent manual", "--agent codex", "--yes", "read-only inventory"]],
    ["render", ["exact-plan-digest", "stale or foreign state fails closed"]],
    ["rule", ["rule list", "rule add", "--config", "requires the valid selected configuration"]],
  ];
  for (const [command, expectedText] of helpAssertions) {
    const commandHelp = run(binPath, [command, "--help"], installRoot);
    for (const text of expectedText) {
      if (!commandHelp.stdout.includes(text)) {
        throw new Error(`Installed ${command} help omitted ${text}.`);
      }
    }
  }
  for (const operation of ["list", "show", "add", "update", "remove"]) {
    const operationHelp = run(
      binPath,
      ["rule", operation, "--help"],
      installRoot,
    );
    if (!operationHelp.stdout.includes(`agentdevflow rule ${operation}`)) {
      throw new Error(`Installed rule ${operation} help was unavailable.`);
    }
  }
  await mkdir(codexOnboardingProjectRoot);
  const codexExistingAgents =
    "Run the repository test command before handoff.\n";
  await writeFile(
    join(codexOnboardingProjectRoot, "AGENTS.md"),
    codexExistingAgents,
    "utf8",
  );
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
      "--steward",
      "codex-main",
      "--developer",
      "codex-main",
      "--reviewer",
      "codex-main",
    ],
    codexOnboardingProjectRoot,
    [1],
  );
  const preexistingCanonicalRule =
    "Keep the existing canonical project rule.\n";
  run(
    binPath,
    [
      "rule",
      "add",
      "existing-canonical-rule",
      "--scope",
      "shared",
      "--stdin",
    ],
    codexOnboardingProjectRoot,
    [0],
    preexistingCanonicalRule,
  );
  await mkdir(fakeCodexBinRoot);
  const fakeCodexImplementationPath = join(
    fakeCodexBinRoot,
    "fake-codex.cjs",
  );
  await writeFile(
    fakeCodexImplementationPath,
    `const { spawnSync } = require("node:child_process");

let prompt = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  prompt += chunk;
});
process.stdin.on("end", () => {
const invocation = process.argv.slice(2).join(" ");
if (
  (invocation !== "exec -" && invocation !== "-") ||
  !prompt.includes("onboard --agent manual") ||
  !prompt.includes("rule add <rule-id> --scope <shared|steward|developer|reviewer> --stdin") ||
  !prompt.includes("rule show <rule-id>") ||
  prompt.includes("exit this Codex session")
) {
  process.exit(91);
}
const prefixMatch = prompt.match(/The exact agentdevflow argv prefix for every agentdevflow command is:\\n(\\[[^\\n]+\\])/u);
if (prefixMatch === null) process.exit(92);
const prefix = JSON.parse(prefixMatch[1]);
if (
  !Array.isArray(prefix) ||
  prefix.length !== 2 ||
  prefix[0] !== ${JSON.stringify(process.execPath)} ||
  !/[\\\\/]agentdevflow[\\\\/]dist[\\\\/]src[\\\\/]cli[\\\\/]private-local-cli\\.js$/u.test(prefix[1])
) {
  process.exit(93);
}
function invoke(args, statuses = [0], input) {
  const result = spawnSync(prefix[0], [prefix[1], ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
  });
  if (result.error !== undefined || result.status === null || !statuses.includes(result.status)) {
    process.stderr.write([result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\\n"));
    process.exit(94);
  }
  return result.stdout;
}
const inventory = JSON.parse(invoke(["onboard", "--agent", "manual", "--json"]));
const existingTarget = inventory.targets?.find((target) => target.path === "AGENTS.md");
if (
  existingTarget?.disposition !== "unmanaged-existing" ||
  typeof existingTarget.observedDigest !== "string"
) {
  process.exit(95);
}
const existingRules = JSON.parse(invoke(["rule", "list", "--json"]));
if (
  !existingRules.rules?.some((rule) => rule.id === "existing-canonical-rule")
) {
  process.exit(96);
}
const existingRule = JSON.parse(
  invoke(["rule", "show", "existing-canonical-rule", "--json"]),
);
if (
  existingRule.rule?.content !== ${JSON.stringify(preexistingCanonicalRule)}
) {
  process.exit(97);
}
invoke(
  ["rule", "add", "run-tests-before-handoff", "--scope", "developer", "--stdin"],
  [0],
  "Run the repository test command before handoff.\\n",
);
const replacement = \`AGENTS.md=\${existingTarget.observedDigest}\`;
const diff = JSON.parse(
  invoke(["diff", "--replace-existing", replacement, "--json"], [1]),
);
invoke([
  "render",
  "--approve-plan",
  diff.exactPlanDigest,
  "--replace-existing",
  replacement,
]);
invoke(["check"]);
});
`,
    "utf8",
  );
  const fakeCodexPath = join(
    fakeCodexBinRoot,
    process.platform === "win32" ? "codex.exe" : "codex",
  );
  if (process.platform === "win32") {
    await copyFile(process.execPath, fakeCodexPath);
    await writeFile(
      join(codexOnboardingProjectRoot, "exec"),
      await readFile(fakeCodexImplementationPath, "utf8"),
      "utf8",
    );
  } else {
    await writeFile(
      fakeCodexPath,
      `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(fakeCodexImplementationPath)} "$@"\n`,
      "utf8",
    );
    await chmod(fakeCodexPath, 0o755);
  }
  const codexOnboarding = run(
    binPath,
    ["onboard", "--agent", "codex", "--yes"],
    codexOnboardingProjectRoot,
    [0],
    undefined,
    {
      ...process.env,
      PATH: `${fakeCodexBinRoot}${delimiter}${process.env.PATH ?? ""}`,
    },
  );
  if (!codexOnboarding.stdout.includes("agentdevflow check: clean")) {
    throw new Error(
      "Packed agentdevflow did not independently verify Codex-operated onboarding.",
    );
  }
  const codexOnboardingRule = await readFile(
    join(
      codexOnboardingProjectRoot,
      ".agentdevflow",
      "rules",
      "developer",
      "run-tests-before-handoff.md",
    ),
    "utf8",
  );
  if (codexOnboardingRule !== codexExistingAgents) {
    throw new Error(
      "Packed Codex-operated onboarding did not preserve existing guidance as a canonical rule.",
    );
  }
  const retainedCanonicalRule = await readFile(
    join(
      codexOnboardingProjectRoot,
      ".agentdevflow",
      "rules",
      "shared",
      "existing-canonical-rule.md",
    ),
    "utf8",
  );
  if (retainedCanonicalRule !== preexistingCanonicalRule) {
    throw new Error(
      "Packed Codex-operated onboarding did not preserve the pre-existing canonical rule.",
    );
  }
  await mkdir(onboardingProjectRoot);
  const existingAgents = "Retain this existing project policy.\nOmit this obsolete sentence.\n";
  await writeFile(
    join(onboardingProjectRoot, "AGENTS.md"),
    existingAgents,
    "utf8",
  );
  const blockedBeforeInit = JSON.parse(
    run(binPath, ["onboard", "--agent", "manual", "--json"], onboardingProjectRoot, [2]).stdout,
  );
  if (
    blockedBeforeInit.targets !== null ||
    blockedBeforeInit.diagnostics?.[0]?.code !==
      "CLI_ONBOARD_CONFIGURATION_REQUIRED"
  ) {
    throw new Error("Packed agentdevflow did not require init before onboard.");
  }
  const blockedRuleBeforeInit = JSON.parse(
    run(
      binPath,
      ["rule", "list", "--json"],
      onboardingProjectRoot,
      [2],
    ).stdout,
  );
  if (
    blockedRuleBeforeInit.rules !== null ||
    blockedRuleBeforeInit.diagnostics?.[0]?.code !==
      "CLI_RULE_CONFIGURATION_REQUIRED"
  ) {
    throw new Error(
      "Packed agentdevflow allowed rule access before initialization.",
    );
  }
  const blockedReservedRuleConfiguration = JSON.parse(
    run(
      binPath,
      [
        "rule",
        "add",
        "verification",
        "--scope",
        "shared",
        "--stdin",
        "--config",
        "AGENTS.md",
        "--json",
      ],
      onboardingProjectRoot,
      [2],
      "Run verification.\n",
    ).stdout,
  );
  if (
    blockedReservedRuleConfiguration.diagnostics?.[0]?.code !==
      "CLI_PATH_COLLISION" ||
    await readFile(
      join(
        onboardingProjectRoot,
        ".agentdevflow/rules/shared/verification.md",
      ),
      "utf8",
    ).then(
      () => true,
      () => false,
    )
  ) {
    throw new Error(
      "Packed agentdevflow allowed a reserved rule configuration path.",
    );
  }
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
      "--steward",
      "codex-main",
      "--developer",
      "codex-main",
      "--reviewer",
      "codex-main",
    ],
    onboardingProjectRoot,
    [1],
  );
  const onboardingInventory = JSON.parse(
    run(binPath, ["onboard", "--agent", "manual", "--json"], onboardingProjectRoot).stdout,
  );
  const unmanagedAgents = onboardingInventory.targets?.find(
    (target) => target.path === "AGENTS.md",
  );
  if (
    unmanagedAgents?.disposition !== "unmanaged-existing" ||
    unmanagedAgents?.classification !== "unclassified" ||
    unmanagedAgents?.content !== existingAgents
  ) {
    throw new Error(
      "Packed agentdevflow did not inventory exact unmanaged AGENTS.md bytes after init.",
    );
  }
  run(
    binPath,
    ["rule", "add", "retained-policy", "--scope", "shared", "--stdin"],
    onboardingProjectRoot,
    [0],
    "Retain this existing project policy.\n",
  );
  run(binPath, ["diff", "--json"], onboardingProjectRoot, [2]);
  const existingAgentsDigest = createHash("sha256")
    .update(existingAgents)
    .digest("hex");
  const replacementInput = `AGENTS.md=${existingAgentsDigest}`;
  const onboardingDiff = JSON.parse(
    run(
      binPath,
      ["diff", "--replace-existing", replacementInput, "--json"],
      onboardingProjectRoot,
      [1],
    ).stdout,
  );
  const replacementChange = onboardingDiff.changes?.find(
    (change) => change.path === "AGENTS.md",
  );
  if (
    replacementChange?.beforeContent !== existingAgents ||
    typeof onboardingDiff.exactPlanDigest !== "string"
  ) {
    throw new Error(
      "Packed agentdevflow did not disclose the exact authorized replacement diff.",
    );
  }
  run(
    binPath,
    [
      "render",
      "--approve-plan",
      onboardingDiff.exactPlanDigest,
      "--replace-existing",
      replacementInput,
    ],
    onboardingProjectRoot,
  );
  const managedOnboardingInventory = JSON.parse(
    run(binPath, ["onboard", "--agent", "manual", "--json"], onboardingProjectRoot).stdout,
  );
  if (
    managedOnboardingInventory.targets?.find(
      (target) => target.path === "AGENTS.md",
    )?.disposition !== "managed-exact"
  ) {
    throw new Error(
      "Packed agentdevflow did not report the rendered target as managed exact.",
    );
  }
  const existingClaude =
    "Legacy Claude review policy intentionally replaced after classification.\n";
  await writeFile(
    join(onboardingProjectRoot, "CLAUDE.md"),
    existingClaude,
    "utf8",
  );
  await writeFile(
    join(onboardingProjectRoot, "agentdevflow.config.jsonc"),
    `${JSON.stringify(
      {
        revision: 1,
        preset: "fast",
        providers: [
          { id: "claude-reviewer", product: "claude-code" },
          { id: "codex-main", product: "codex" },
        ],
        roles: {
          steward: "codex-main",
          developer: "codex-main",
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
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const existingClaudeDigest = createHash("sha256")
    .update(existingClaude)
    .digest("hex");
  const claudeReplacementInput = `CLAUDE.md=${existingClaudeDigest}`;
  const incrementalDiff = JSON.parse(
    run(
      binPath,
      ["diff", "--replace-existing", claudeReplacementInput, "--json"],
      onboardingProjectRoot,
      [1],
    ).stdout,
  );
  if (
    incrementalDiff.changes?.find((change) => change.path === "CLAUDE.md")
      ?.beforeContent !== existingClaude ||
    typeof incrementalDiff.exactPlanDigest !== "string"
  ) {
    throw new Error(
      "Packed agentdevflow did not plan an unmanaged provider target after another target was managed.",
    );
  }
  run(
    binPath,
    [
      "render",
      "--approve-plan",
      incrementalDiff.exactPlanDigest,
      "--replace-existing",
      claudeReplacementInput,
    ],
    onboardingProjectRoot,
  );
  run(binPath, ["check"], onboardingProjectRoot);
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
  run(binPath, ["onboard", "--agent", "manual"], projectRoot);
  const emptyRules = JSON.parse(
    run(binPath, ["rule", "list", "--json"], projectRoot).stdout,
  );
  if (
    emptyRules.schemaVersion !== 1 ||
    emptyRules.operation !== "list" ||
    emptyRules.rules.length !== 0
  ) {
    throw new Error("Packed agentdevflow did not report an empty rule catalog.");
  }
  run(
    binPath,
    [
      "rule",
      "add",
      "handoff-target",
      "--scope",
      "shared",
      "--stdin",
    ],
    projectRoot,
    [0],
    "Always report the exact handoff target.\n",
  );
  run(
    binPath,
    [
      "rule",
      "add",
      "acceptance-criteria",
      "--scope",
      "steward",
      "--stdin",
    ],
    projectRoot,
    [0],
    "Keep acceptance criteria visible.\n",
  );
  const developerInputPath = join(projectRoot, "developer-rule-input.md");
  await writeFile(
    developerInputPath,
    "Run the repository verification command before handoff.\n",
    "utf8",
  );
  run(
    binPath,
    [
      "rule",
      "add",
      "repository-verification",
      "--scope",
      "developer",
      "--file",
      "developer-rule-input.md",
    ],
    projectRoot,
  );
  run(
    binPath,
    [
      "rule",
      "add",
      "current-revision",
      "--scope",
      "reviewer",
      "--stdin",
    ],
    projectRoot,
    [0],
    "Review only the current revision.\n",
  );
  run(
    binPath,
    [
      "rule",
      "add",
      "temporary-rule",
      "--scope",
      "shared",
      "--stdin",
    ],
    projectRoot,
    [0],
    "Temporary content.\n",
  );
  run(
    binPath,
    ["rule", "update", "temporary-rule", "--stdin"],
    projectRoot,
    [0],
    "Updated temporary content.\n",
  );
  const shownRule = JSON.parse(
    run(
      binPath,
      ["rule", "show", "temporary-rule", "--json"],
      projectRoot,
    ).stdout,
  );
  if (
    shownRule.rule?.scope !== "shared" ||
    shownRule.rule?.content !== "Updated temporary content.\n"
  ) {
    throw new Error("Packed agentdevflow did not preserve an updated rule.");
  }
  run(
    binPath,
    ["rule", "remove", "temporary-rule"],
    projectRoot,
  );
  const listedRules = JSON.parse(
    run(binPath, ["rule", "list", "--json"], projectRoot).stdout,
  );
  if (
    listedRules.rules.length !== 4 ||
    listedRules.rules.map((rule) => rule.id).join(",") !==
      "acceptance-criteria,current-revision,handoff-target,repository-verification"
  ) {
    throw new Error("Packed agentdevflow did not return the expected sorted rules.");
  }
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
    !codexInstructions.includes(
      "declares coding-agent product `codex` and project provider id `codex-main`",
    ) ||
    !claudeInstructions.includes(
      "declares coding-agent product `claude-code` and project provider id `claude-secondary`",
    ) ||
    !cursorInstructions.includes(
      "declares coding-agent product `cursor` and project provider id `cursor-developer`",
    ) ||
    ![codexInstructions, claudeInstructions, cursorInstructions].every(
      (content) =>
        content.includes(
          "If the runtime product does not match, ignore this entire projection",
        ) &&
        content.includes("Do not combine responsibilities across products."),
    ) ||
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
      "Packed agentdevflow did not produce responsibility-filtered provider instructions with explicit product applicability.",
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
  await mkdir(aggregateProjectRoot);
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
      "--steward",
      "codex-main",
      "--developer",
      "codex-main",
      "--reviewer",
      "codex-main",
    ],
    aggregateProjectRoot,
  );
  run(binPath, ["onboard", "--agent", "manual"], aggregateProjectRoot);
  await mkdir(
    join(aggregateProjectRoot, ".agentdevflow", "rules"),
    { recursive: true },
  );
  const aggregateEntries = [
    ["shared", "shared-guidance"],
    ["steward", "steward-guidance"],
    ["developer", "developer-guidance"],
    ["reviewer", "reviewer-guidance"],
  ];
  for (const [scope] of aggregateEntries) {
    await writeFile(
      join(
        aggregateProjectRoot,
        ".agentdevflow",
        "rules",
        `${scope}.md`,
      ),
      `Legacy ${scope} aggregate guidance.\n`,
      "utf8",
    );
  }
  const partiallyMovedPath = join(
    aggregateProjectRoot,
    ".agentdevflow",
    "rules",
    "shared",
    "shared-guidance.md",
  );
  await mkdir(dirname(partiallyMovedPath), { recursive: true });
  await writeFile(
    partiallyMovedPath,
    "Partially moved shared guidance.\n",
    "utf8",
  );
  for (const args of [
    ["rule", "list", "--json"],
    ["diff", "--json"],
  ]) {
    const blockedAggregate = run(
      binPath,
      args,
      aggregateProjectRoot,
      [2],
    );
    const blockedAggregateReport = JSON.parse(blockedAggregate.stdout);
    if (
      blockedAggregateReport.outcome !== "blocked" ||
      blockedAggregateReport.diagnostics.length !== aggregateEntries.length
    ) {
      throw new Error(
        "Packed agentdevflow did not fail closed on aggregate rule guidance.",
      );
    }
    for (const [scope, targetId] of aggregateEntries) {
      const sourcePath = `.agentdevflow/rules/${scope}.md`;
      const targetPath = `.agentdevflow/rules/${scope}/${targetId}.md`;
      if (
        !blockedAggregateReport.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "RULE_AGGREGATE_LAYOUT_UNSUPPORTED" &&
            diagnostic.path === sourcePath &&
            diagnostic.message.includes(targetPath),
        ) ||
        (await readFile(join(aggregateProjectRoot, sourcePath), "utf8")) !==
          `Legacy ${scope} aggregate guidance.\n`
      ) {
        throw new Error(
          `Packed agentdevflow did not preserve aggregate rule guidance at ${sourcePath}.`,
        );
      }
    }
    if (
      (await readFile(partiallyMovedPath, "utf8")) !==
      "Partially moved shared guidance.\n"
    ) {
      throw new Error(
        "Packed agentdevflow modified a partially moved per-rule target.",
      );
    }
  }
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
  run(binPath, ["onboard", "--agent", "manual"], issueProjectRoot);
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
  run(binPath, ["onboard", "--agent", "manual"], draftIssueProjectRoot);
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
      "ensure the pull request is ready for review; mark it ready only if it is still a draft",
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
  configuration.roles.developer = "codex-main";
  configuration.providers = configuration.providers.filter(
    (provider) => provider.id !== "cursor-developer",
  );
  await writeFile(
    configurationPath,
    `${JSON.stringify(configuration, null, 2)}\n`,
    "utf8",
  );
  const cursorPath = join(
    projectRoot,
    ".cursor",
    "rules",
    "agentdevflow.mdc",
  );
  await unlink(cursorPath);
  const absentDeletionDiff = run(
    binPath,
    ["diff", "--json"],
    projectRoot,
    [1],
  );
  const absentDeletionReport = JSON.parse(absentDeletionDiff.stdout);
  if (
    absentDeletionReport.schemaVersion !== 1 ||
    absentDeletionReport.outcome !== "changes-required" ||
    absentDeletionReport.changes.some(
      (change) =>
        change.kind === "managed-output" &&
        change.path === ".cursor/rules/agentdevflow.mdc",
    ) ||
    !absentDeletionReport.changes.some(
      (change) =>
        change.kind === "render-lock" && change.action === "update",
    )
  ) {
    throw new Error(
      "Packed agentdevflow did not isolate already-absent output cleanup to ownership state.",
    );
  }
  run(
    binPath,
    [
      "render",
      "--approve-plan",
      absentDeletionReport.exactPlanDigest,
    ],
    projectRoot,
  );
  const absentDeletionCheck = run(
    binPath,
    ["check", "--json"],
    projectRoot,
  );
  const contractedLock = JSON.parse(
    await readFile(
      join(projectRoot, ".agentdevflow", "lock.json"),
      "utf8",
    ),
  );
  if (
    JSON.parse(absentDeletionCheck.stdout).outcome !== "clean" ||
    contractedLock.files.some(
      (file) =>
        file.path === "CLAUDE.md" ||
        file.path === ".cursor/rules/agentdevflow.mdc",
    ) ||
    contractedLock.files.length !== 1 ||
    contractedLock.files[0]?.path !== "AGENTS.md"
  ) {
    throw new Error(
      "Packed agentdevflow did not converge ownership after an obsolete output was already absent.",
    );
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
