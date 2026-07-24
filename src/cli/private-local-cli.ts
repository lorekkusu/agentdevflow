#!/usr/bin/env node

import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  preparePrivateDomainProjectPlan,
  reconstructPrivateDomainProjectConvergentPlan,
  type PrivateDomainProjectPlanPreparation,
} from "../application/private-domain-project-plan.js";
import {
  executePrivateCheckCommand,
} from "../commands/private-check-command-service.js";
import {
  executePrivateDiffCommand,
} from "../commands/private-diff-command-service.js";
import {
  executePrivateRenderCommand,
  PrivateRenderCommandError,
} from "../commands/private-render-command-service.js";
import { executePrivateRuleCommand } from "../commands/private-rule-command-service.js";
import {
  parsePrivateCliArguments,
  privateCliCommands,
  privateRuleOperations,
  type PrivateCliInvocation,
} from "../interface/private-cli-arguments.js";
import {
  compilePrivateDomainProjectDocument,
  parsePrivateDomainProjectDocument,
  privateDomainProjectDocumentDefaultMaxBytes,
} from "../interface/private-domain-project-document.js";
import {
  privateProjectGuidanceFileMaxBytes,
  privateProjectGuidanceRulesRoot,
} from "../guidance/private-project-guidance.js";
import {
  derivePrivateRenderLockIntent,
  privateRenderLockDefaultMaxBytes,
  serializePrivateRenderLock,
} from "../lock/private-render-lock.js";
import {
  executePrivateExistingProjectInventory,
  type PrivateExistingProjectInventoryResult,
} from "../onboarding/private-existing-project-inventory.js";
import { nativeProjectInstructionPaths } from "../renderer/native/common.js";
import { privateIssueToPullRequestCapabilityObservations } from "../workflows/private-issue-to-reviewed-pull-request.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../workflows/private-local-reviewed-change.js";
import { createPrivateConvergentMutationIntent } from "../workspace/private-convergent-intent.js";
import {
  PrivateFilesystemWorkspace,
  PrivateFilesystemWorkspaceError,
  type PrivateFilesystemReadWorkspace,
} from "../workspace/private-filesystem-workspace.js";
import {
  blockedBeforePlanning,
  blockedWithoutPlan,
  blockedWithPlan,
  cliDiagnostics,
  formatArgumentFailure,
  formatCheck,
  formatCleanRenderPlan,
  formatDiff,
  formatInit,
  formatExistingProjectInventory,
  formatRuleResult,
  formatRender,
  planningDiagnostics,
  writeBoundedOutput,
  writeBoundedOnboardOutput,
  writeBoundedRuleOutput,
  writeLine,
  type DisplayDiagnostic,
  type PrivateLocalCliIo,
  type PrivateRuleCommandResult,
} from "./private-local-cli-output.js";
import {
  readPrivateRuleInputStream,
  type PrivateRuleInputStream,
} from "./private-rule-input.js";

const usage = `Usage:
  agentdevflow init [--repository <path>] [--config <relative-path>] [--lock <relative-path>] --workflow local-reviewed-change --preset <fast|balanced> --tracker <local|none> --provider <id,product>... --steward <id> --developer <id> --reviewer <id> [--json]
  agentdevflow init [--repository <path>] [--config <relative-path>] [--lock <relative-path>] --workflow issue-to-reviewed-pull-request --preset <fast|balanced> --tracker <linear|github-issues> --pull-request-state <draft|ready> --pull-request-host <id> --ci <id> --provider <id,product>... --steward <id> --developer <id> --reviewer <id> [--json]
  agentdevflow onboard [--repository <path>] [--config <relative-path>] [--lock <relative-path>] [--json]
  agentdevflow rule list [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow rule show <id> [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow rule add <id> --scope <shared|steward|developer|reviewer> (--file <repository-relative-path> | --stdin) [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow rule update <id> (--file <repository-relative-path> | --stdin) [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow rule remove <id> [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow diff [--repository <path>] [--config <relative-path>] [--lock <relative-path>] [--replace-existing <path=observed-sha256>]... [--json]
  agentdevflow render [--repository <path>] [--config <relative-path>] [--lock <relative-path>] --approve-plan <exact-plan-digest> [--replace-existing <path=observed-sha256>]... [--json]
  agentdevflow check [--repository <path>] [--config <relative-path>] [--lock <relative-path>] [--json]

Init creates an absent revision-1 configuration or accepts byte-identical existing configuration after validating provider-file dispositions.
Onboard requires the valid configuration created by init, then reads a bounded inventory of supported existing provider targets.
Rule commands require the valid selected configuration and read or mutate only canonical project-rule files; provider outputs still require diff and render.
Diff and check are read-only. Render requires an exact plan digest from diff.
Issue workflows compile advisory procedures; agentdevflow does not contact trackers, pull-request hosts, or CI services.
Defaults: repository '.', config 'agentdevflow.config.jsonc', lock '.agentdevflow/lock.json'.
Beta configuration and JSON schema versions may require documented migration before 1.0.`;

const commandUsage: Readonly<Record<(typeof privateCliCommands)[number], string>> = {
  init: `Usage:
  agentdevflow init [--repository <path>] [--config <relative-path>] [--lock <relative-path>] --workflow local-reviewed-change --preset <fast|balanced> --tracker <local|none> --provider <id,product>... --steward <id> --developer <id> --reviewer <id> [--json]
  agentdevflow init [--repository <path>] [--config <relative-path>] [--lock <relative-path>] --workflow issue-to-reviewed-pull-request --preset <fast|balanced> --tracker <linear|github-issues> --pull-request-state <draft|ready> --pull-request-host <id> --ci <id> --provider <id,product>... --steward <id> --developer <id> --reviewer <id> [--json]

Provider products: claude-code, codex, cursor.
The id is a user-chosen provider-instance name referenced by each role option.
Issue workflows compile instructions for the selected tracker, pull-request host, and CI binding. They do not verify or invoke those services.
Auxiliary review is disabled and squash is the merge method in the current issue-workflow CLI surface.
Init creates an absent configuration or accepts byte-identical existing configuration. It never overwrites different configuration bytes.
It reports provider-file dispositions but does not write provider files or the lock.
Exact adopt or lossless import makes the complete provider path a managed file; no managed section is created.`,
  check: `Usage:
  agentdevflow check [--repository <path>] [--config <relative-path>] [--lock <relative-path>] [--json]

Check is read-only. Exit 0 is clean, exit 1 means reviewable changes are required, and exit 2 is blocked or invalid.`,
  diff: `Usage:
  agentdevflow diff [--repository <path>] [--config <relative-path>] [--lock <relative-path>] [--replace-existing <path=observed-sha256>]... [--json]

Diff is read-only. Review its complete recognized target and copy exact-plan-digest into render --approve-plan. Exit 1 is expected when changes are required.
Each --replace-existing input states that the exact complete unmanaged target was reviewed, retained content is represented in current canonical rules, and omitted remainder is intentional.`,
  onboard: `Usage:
  agentdevflow onboard [--repository <path>] [--config <relative-path>] [--lock <relative-path>] [--json]

Run init before onboard. Onboard refuses to inspect provider targets until the selected configuration is present and valid.
It then performs a read-only inventory of AGENTS.md, CLAUDE.md, and .cursor/rules/agentdevflow.mdc.
It reports exact bounded content, digests, ownership dispositions, and whether unmanaged content remains unclassified.`,
  render: `Usage:
  agentdevflow render [--repository <path>] [--config <relative-path>] [--lock <relative-path>] --approve-plan <exact-plan-digest> [--replace-existing <path=observed-sha256>]... [--json]

Render mutates only the complete plan whose exact-plan-digest was reviewed through diff. A stale or foreign state fails closed.
The exact --replace-existing inputs used for diff must be repeated for render.
Adopted, imported, or explicitly replaced paths become whole-file managed targets. A later approved plan can delete one when its exact locked bytes still match.`,
  rule: `Usage:
  agentdevflow rule list [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow rule show <id> [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow rule add <id> --scope <shared|steward|developer|reviewer> (--file <repository-relative-path> | --stdin) [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow rule update <id> (--file <repository-relative-path> | --stdin) [--repository <path>] [--config <relative-path>] [--json]
  agentdevflow rule remove <id> [--repository <path>] [--config <relative-path>] [--json]

Rule ids are globally unique lowercase ASCII slugs of at most 64 characters and must not be reserved Windows filenames. --file paths are relative to the selected repository.
Run init and onboard before rule commands. Every rule operation requires the valid selected configuration.
Rule mutations change only canonical files under .agentdevflow/rules. Run diff and exact-approved render separately to update provider outputs.`,
};

const ruleOperationUsage = {
  list: `Usage:
  agentdevflow rule list [--repository <path>] [--config <relative-path>] [--json]

Lists canonical project rules in deterministic rule-id order. Requires the valid selected configuration.`,
  show: `Usage:
  agentdevflow rule show <id> [--repository <path>] [--config <relative-path>] [--json]

Shows one canonical rule including its exact content. Requires the valid selected configuration.`,
  add: `Usage:
  agentdevflow rule add <id> --scope <shared|steward|developer|reviewer> (--file <repository-relative-path> | --stdin) [--repository <path>] [--config <relative-path>] [--json]

Creates one absent canonical rule after validating the selected configuration. Exactly one of --file or --stdin is required.`,
  update: `Usage:
  agentdevflow rule update <id> (--file <repository-relative-path> | --stdin) [--repository <path>] [--config <relative-path>] [--json]

Updates one existing canonical rule without changing its scope after validating the selected configuration.`,
  remove: `Usage:
  agentdevflow rule remove <id> [--repository <path>] [--config <relative-path>] [--json]

Removes one existing canonical rule after validating the selected configuration. Provider outputs are unchanged until a later exact-approved render.`,
} as const satisfies Readonly<
  Record<(typeof privateRuleOperations)[number], string>
>;

function pathsOverlap(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

const reservedConfigurationPaths = [
  {
    label: "canonical rule root",
    path: privateProjectGuidanceRulesRoot,
  },
  ...Object.entries(nativeProjectInstructionPaths).map(([product, path]) => ({
    label: `${product} generated output`,
    path,
  })),
] as const;

function configurationPathLayoutDiagnostic(
  projectConfigPath: string,
): DisplayDiagnostic | null {
  for (const reserved of reservedConfigurationPaths) {
    if (pathsOverlap(projectConfigPath, reserved.path)) {
      return {
        code: "CLI_PATH_COLLISION",
        level: "error",
        message: `The configuration path overlaps the ${reserved.label} path (${reserved.path}).`,
        path: projectConfigPath,
      };
    }
  }
  return null;
}

function pathLayoutDiagnostic(
  invocation: Exclude<PrivateCliInvocation, { readonly command: "rule" }>,
): DisplayDiagnostic | null {
  const configuration = {
    label: "configuration",
    path: invocation.projectConfigPath,
  };
  const lock = { label: "ownership lock", path: invocation.lockPath };
  if (pathsOverlap(configuration.path, lock.path)) {
    return {
      code: "CLI_PATH_COLLISION",
      level: "error",
      message: `The ${configuration.label} path overlaps the ${lock.label} path (${lock.path}).`,
      path: configuration.path,
    };
  }
  const configurationDiagnostic =
    configurationPathLayoutDiagnostic(configuration.path);
  if (configurationDiagnostic !== null) {
    return configurationDiagnostic;
  }
  for (const right of reservedConfigurationPaths) {
    const left = lock;
    if (pathsOverlap(left.path, right.path)) {
      return {
        code: "CLI_PATH_COLLISION",
        level: "error",
        message: `The ${left.label} path overlaps the ${right.label} path (${right.path}).`,
        path: left.path,
      };
    }
  }
  return null;
}

function plannedPathLayoutDiagnostic(
  invocation: Exclude<
    PrivateCliInvocation,
    { readonly command: "onboard" | "rule" }
  >,
  prepared: PrivateDomainProjectPlanPreparation,
): DisplayDiagnostic | null {
  const plan = prepared.snapshot.plan;
  if (!plan.safeToApply) {
    return null;
  }
  const targetLock = derivePrivateRenderLockIntent({
    materialization: prepared.materialization,
    plan,
  });
  const targetLockContent = serializePrivateRenderLock(targetLock);
  const lockTemporaryPath = createPrivateConvergentMutationIntent({
    planDigest: prepared.snapshot.digest,
    targetPath: invocation.lockPath,
    targetDigest: createHash("sha256").update(targetLockContent).digest("hex"),
  }).temporaryPath;
  const protectedInputs = [
    {
      label: "configuration",
      path: invocation.projectConfigPath,
    },
    {
      label: "canonical rule root",
      path: privateProjectGuidanceRulesRoot,
    },
  ];
  const mutationPaths = [
    { label: "ownership lock", path: invocation.lockPath },
    { label: "ownership lock temporary file", path: lockTemporaryPath },
    ...plan.files.flatMap((file) => {
      const target = {
        label: `generated output ${file.path}`,
        path: file.path,
      };
      if (file.expectedDigest === null) {
        return [target];
      }
      return [
        target,
        {
          label: `generated output temporary file ${file.path}`,
          path: createPrivateConvergentMutationIntent({
            planDigest: plan.planDigest,
            targetPath: file.path,
            targetDigest: file.expectedDigest,
          }).temporaryPath,
        },
      ];
    }),
  ];
  for (const input of protectedInputs) {
    for (const mutation of mutationPaths) {
      if (pathsOverlap(input.path, mutation.path)) {
        return {
          code: "CLI_PATH_COLLISION",
          level: "error",
          message: `The ${input.label} path overlaps the ${mutation.label} path (${mutation.path}).`,
          path: input.path,
        };
      }
    }
  }
  return null;
}

async function runPrivateInit(
  invocation: Extract<PrivateCliInvocation, { readonly command: "init" }>,
  io: PrivateLocalCliIo,
): Promise<0 | 1 | 2> {
  let workspace: Awaited<ReturnType<typeof PrivateFilesystemWorkspace.openReadOnly>>;
  try {
    workspace = await PrivateFilesystemWorkspace.openReadOnly(
      invocation.repositoryPath,
    );
  } catch (error) {
    writeLine(
      io.stdout,
      blockedBeforePlanning("init", {
        code:
          error instanceof PrivateFilesystemWorkspaceError
            ? error.code
            : "CLI_REPOSITORY_OPEN_FAILED",
        level: "error",
        message:
          error instanceof Error
            ? error.message
            : "The repository could not be opened read-only.",
        path: invocation.repositoryPath,
      }, invocation.outputFormat),
    );
    return 2;
  }

  let existingConfiguration: string | null;
  let existingLock: string | null;
  try {
    [existingConfiguration, existingLock] = await Promise.all([
      workspace.readBounded(
        invocation.projectConfigPath,
        privateDomainProjectDocumentDefaultMaxBytes,
      ),
      workspace.readBounded(
        invocation.lockPath,
        privateRenderLockDefaultMaxBytes,
      ),
    ]);
  } catch (error) {
    writeLine(
      io.stdout,
      blockedBeforePlanning("init", {
        code: "CLI_INIT_OBSERVATION_FAILED",
        level: "error",
        message:
          error instanceof Error
            ? error.message
            : "Initialization paths could not be inspected.",
      }, invocation.outputFormat),
    );
    return 2;
  }
  if (existingLock !== null) {
    writeLine(
      io.stdout,
      blockedBeforePlanning("init", {
        code: "CLI_INIT_LOCK_PRESENT",
        level: "error",
        message:
          "Initialization requires an absent render lock. Use check, diff, or render for an initialized repository.",
        path: invocation.lockPath,
      }, invocation.outputFormat),
    );
    return 2;
  }
  if (
    existingConfiguration !== null &&
    existingConfiguration !== invocation.configurationContent
  ) {
    writeLine(
      io.stdout,
      blockedBeforePlanning("init", {
        code: "CLI_INIT_CONFIGURATION_CONFLICT",
        level: "error",
        message:
          "The configuration path already contains different bytes. Initialization never overwrites it.",
        path: invocation.projectConfigPath,
      }, invocation.outputFormat),
    );
    return 2;
  }

  const prepared = await preparePrivateDomainProjectPlan({
    content: invocation.configurationContent,
    lockPath: invocation.lockPath,
    workspace,
  });
  if (!prepared.ok) {
    writeLine(
      io.stdout,
      blockedWithoutPlan(
        "init",
        planningDiagnostics(prepared.diagnostics),
        invocation.outputFormat,
      ),
    );
    return 2;
  }
  const plannedLayoutDiagnostic = plannedPathLayoutDiagnostic(
    invocation,
    prepared,
  );
  if (plannedLayoutDiagnostic !== null) {
    writeLine(
      io.stdout,
      blockedWithPlan(
        "init",
        {
          planDigest: prepared.plan.planDigest,
          snapshotDigest: prepared.snapshot.digest,
          diagnostics: [plannedLayoutDiagnostic],
        },
        invocation.outputFormat,
      ),
    );
    return 2;
  }
  const check = await executePrivateCheckCommand({
    materialization: prepared.materialization,
    snapshot: prepared.snapshot,
    baseLock: prepared.baseLock,
    lockPath: invocation.lockPath,
    workspace,
  });
  const onboardingConflictCodes = new Set([
    "CHECK_PATH_CONFLICT",
    "CHECK_PLAN_UNSAFE",
    "INITIALIZATION_IMPORT_UNSUPPORTED",
    "OWNERSHIP_CONFLICT",
  ]);
  const blockingDiagnostics = check.diagnostics.filter(
    (diagnostic) =>
      diagnostic.level === "error" &&
      !onboardingConflictCodes.has(diagnostic.code),
  );
  if (check.outcome === "blocked" && blockingDiagnostics.length > 0) {
    writeLine(
      io.stdout,
      blockedWithPlan("init", {
        planDigest: prepared.plan.planDigest,
        snapshotDigest: prepared.snapshot.digest,
        diagnostics: blockingDiagnostics,
      }, invocation.outputFormat),
    );
    return 2;
  }

  const configurationDisposition =
    existingConfiguration === null ? "create" : "adopt";
  if (configurationDisposition === "create") {
    let mutableWorkspace: Awaited<
      ReturnType<typeof PrivateFilesystemWorkspace.open>
    >;
    try {
      mutableWorkspace =
        await PrivateFilesystemWorkspace.open(
          invocation.repositoryPath,
        );
      const [freshConfiguration, freshLock] = await Promise.all([
        mutableWorkspace.readBounded(
          invocation.projectConfigPath,
          privateDomainProjectDocumentDefaultMaxBytes,
        ),
        mutableWorkspace.readBounded(
          invocation.lockPath,
          privateRenderLockDefaultMaxBytes,
        ),
      ]);
      if (freshConfiguration !== null || freshLock !== null) {
        throw new Error(
          "Initialization paths changed after validation; rerun init to inspect the current state.",
        );
      }
      const fresh = await preparePrivateDomainProjectPlan({
        content: invocation.configurationContent,
        lockPath: invocation.lockPath,
        workspace: mutableWorkspace,
      });
      if (!fresh.ok || fresh.snapshot.digest !== prepared.snapshot.digest) {
        throw new Error(
          "Provider state changed after validation; rerun init to inspect the current state.",
        );
      }
      const created = await mutableWorkspace.createExclusively(
        invocation.projectConfigPath,
        invocation.configurationContent,
      );
      if (!created) {
        throw new Error(
          "The configuration path changed before exclusive creation completed.",
        );
      }
    } catch (error) {
      writeLine(
        io.stdout,
        blockedWithPlan("init", {
          planDigest: prepared.plan.planDigest,
          snapshotDigest: prepared.snapshot.digest,
          diagnostics: [
            {
              code: "CLI_INIT_CONFIGURATION_CREATE_FAILED",
              level: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "The configuration file could not be created safely.",
              path: invocation.projectConfigPath,
            },
          ],
        }, invocation.outputFormat),
      );
      return 2;
    }
  }

  const outcome =
    check.outcome === "blocked" ||
    prepared.plan.files.some((file) => file.action === "update")
    ? "review-required"
    : "ready";
  const output = formatInit({
      outcome,
      configurationDisposition,
      configurationPath: invocation.projectConfigPath,
      configurationContent: invocation.configurationContent,
      planDigest: prepared.plan.planDigest,
      snapshotDigest: prepared.snapshot.digest,
      files: prepared.plan.files,
      diagnostics:
        check.outcome === "blocked" ? check.diagnostics : [],
    }, invocation.outputFormat);
  if (!writeBoundedOutput(
    io.stdout,
    "init",
    invocation.outputFormat,
    output,
  )) return 2;
  return outcome === "ready" ? 0 : 1;
}

function blockedRuleResult(
  operation: Extract<
    PrivateCliInvocation,
    { readonly command: "rule" }
  >["operation"],
  diagnostics: readonly DisplayDiagnostic[],
): PrivateRuleCommandResult {
  return {
    operation,
    outcome: "blocked",
    exitCode: 2,
    diagnostics,
  };
}

type RequiredProjectConfigurationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly diagnostics: readonly (Omit<DisplayDiagnostic, "level"> & {
        readonly level: "error";
      })[];
    };

async function requireValidProjectConfiguration(
  workspace: PrivateFilesystemReadWorkspace,
  projectConfigPath: string,
  command: "onboard" | "rule",
): Promise<RequiredProjectConfigurationResult> {
  let configurationContent: string | null;
  try {
    configurationContent = await workspace.readBounded(
      projectConfigPath,
      privateDomainProjectDocumentDefaultMaxBytes,
    );
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          code:
            command === "onboard"
              ? "CLI_ONBOARD_CONFIGURATION_READ_FAILED"
              : "CLI_RULE_CONFIGURATION_READ_FAILED",
          level: "error",
          message:
            error instanceof Error
              ? error.message
              : "The project configuration could not be read.",
          path: projectConfigPath,
        },
      ],
    };
  }
  if (configurationContent === null) {
    return {
      ok: false,
      diagnostics: [
        {
          code:
            command === "onboard"
              ? "CLI_ONBOARD_CONFIGURATION_REQUIRED"
              : "CLI_RULE_CONFIGURATION_REQUIRED",
          level: "error",
          message:
            command === "onboard"
              ? "Onboard requires the valid project configuration created by init. Run init before onboard."
              : "Rule commands require the valid project configuration created by init. Run init and onboard before using rule commands.",
          path: projectConfigPath,
        },
      ],
    };
  }
  const parsedConfiguration =
    parsePrivateDomainProjectDocument(configurationContent);
  if (!parsedConfiguration.ok) {
    return {
      ok: false,
      diagnostics: planningDiagnostics(parsedConfiguration.diagnostics).map(
        (diagnostic) => ({ ...diagnostic, level: "error" as const }),
      ),
    };
  }
  const compiledConfiguration = compilePrivateDomainProjectDocument(
    configurationContent,
    {
      capabilityObservations:
        parsedConfiguration.document.intent.workflow.family ===
        "local-reviewed-change"
          ? privateLocalReviewedChangeCapabilityObservations
          : privateIssueToPullRequestCapabilityObservations,
    },
  );
  if (!compiledConfiguration.ok) {
    return {
      ok: false,
      diagnostics: planningDiagnostics(compiledConfiguration.diagnostics).map(
        (diagnostic) => ({ ...diagnostic, level: "error" as const }),
      ),
    };
  }
  return { ok: true };
}

async function runPrivateRule(
  invocation: Extract<PrivateCliInvocation, { readonly command: "rule" }>,
  io: PrivateLocalCliIo,
  stdin: PrivateRuleInputStream,
): Promise<0 | 2> {
  const layoutDiagnostic = configurationPathLayoutDiagnostic(
    invocation.projectConfigPath,
  );
  if (layoutDiagnostic !== null) {
    const result = blockedRuleResult(invocation.operation, [
      layoutDiagnostic,
    ]);
    const content = formatRuleResult(result, invocation.outputFormat);
    writeBoundedRuleOutput(
      io.stdout,
      invocation.operation,
      invocation.outputFormat,
      content,
    );
    return 2;
  }

  let readWorkspace: PrivateFilesystemReadWorkspace;
  try {
    readWorkspace = await PrivateFilesystemWorkspace.openReadOnly(
      invocation.repositoryPath,
    );
  } catch (error) {
    const result = blockedRuleResult(invocation.operation, [
      {
        code:
          error instanceof PrivateFilesystemWorkspaceError
            ? error.code
            : "CLI_REPOSITORY_OPEN_FAILED",
        level: "error",
        message:
          error instanceof Error
            ? error.message
            : "The repository could not be opened read-only.",
        path: invocation.repositoryPath,
      },
    ]);
    const content = formatRuleResult(result, invocation.outputFormat);
    writeBoundedRuleOutput(
      io.stdout,
      invocation.operation,
      invocation.outputFormat,
      content,
    );
    return 2;
  }
  const configuration = await requireValidProjectConfiguration(
    readWorkspace,
    invocation.projectConfigPath,
    "rule",
  );
  if (!configuration.ok) {
    const result = blockedRuleResult(
      invocation.operation,
      configuration.diagnostics,
    );
    const content = formatRuleResult(result, invocation.outputFormat);
    writeBoundedRuleOutput(
      io.stdout,
      invocation.operation,
      invocation.outputFormat,
      content,
    );
    return 2;
  }

  let workspace: PrivateFilesystemWorkspace;
  try {
    workspace = await PrivateFilesystemWorkspace.open(invocation.repositoryPath);
  } catch (error) {
    const result = blockedRuleResult(invocation.operation, [{
      code:
        error instanceof PrivateFilesystemWorkspaceError
          ? error.code
          : "CLI_REPOSITORY_OPEN_FAILED",
      level: "error",
      message:
        error instanceof Error
          ? error.message
          : "The repository could not be opened.",
      path: invocation.repositoryPath,
    }]);
    const content = formatRuleResult(result, invocation.outputFormat);
    writeBoundedRuleOutput(
      io.stdout,
      invocation.operation,
      invocation.outputFormat,
      content,
    );
    return 2;
  }

  let stdinContent: string | undefined;
  if (
    (invocation.operation === "add" ||
      invocation.operation === "update") &&
    invocation.input.kind === "stdin"
  ) {
    const observed = await readPrivateRuleInputStream(
      stdin,
      privateProjectGuidanceFileMaxBytes,
    );
    if (!observed.ok) {
      const result = blockedRuleResult(invocation.operation, [{
        code: observed.code,
        level: "error",
        message: observed.message,
      }]);
      const content = formatRuleResult(result, invocation.outputFormat);
      writeBoundedRuleOutput(
        io.stdout,
        invocation.operation,
        invocation.outputFormat,
        content,
      );
      return 2;
    }
    stdinContent = observed.content;
  }

  let result: PrivateRuleCommandResult;
  try {
    result = await executePrivateRuleCommand({
      invocation,
      workspace,
      ...(stdinContent === undefined ? {} : { stdinContent }),
    });
  } catch (error) {
    result = blockedRuleResult(invocation.operation, [{
      code: "RULE_COMMAND_FAILED",
      level: "error",
      message:
        error instanceof Error
          ? error.message
          : "The rule command failed unexpectedly.",
    }]);
  }
  const content = formatRuleResult(result, invocation.outputFormat);
  if (
    !writeBoundedRuleOutput(
      io.stdout,
      invocation.operation,
      invocation.outputFormat,
      content,
    )
  ) {
    return 2;
  }
  return result.exitCode;
}

type BlockedOnboardResult = Extract<
  PrivateExistingProjectInventoryResult,
  { readonly outcome: "blocked" }
>;

function blockedOnboardResult(
  diagnostics: BlockedOnboardResult["diagnostics"],
): BlockedOnboardResult {
  return {
    outcome: "blocked",
    exitCode: 2,
    diagnostics,
    targets: null,
  };
}

function writeOnboardResult(
  result: PrivateExistingProjectInventoryResult,
  invocation: Extract<
    PrivateCliInvocation,
    { readonly command: "onboard" }
  >,
  io: PrivateLocalCliIo,
): 0 | 2 {
  const content = formatExistingProjectInventory(
    result,
    invocation.outputFormat,
  );
  if (
    !writeBoundedOnboardOutput(
      io.stdout,
      invocation.outputFormat,
      content,
    )
  ) {
    return 2;
  }
  return result.exitCode;
}

async function runPrivateOnboard(
  invocation: Extract<PrivateCliInvocation, { readonly command: "onboard" }>,
  io: PrivateLocalCliIo,
): Promise<0 | 2> {
  let workspace: Awaited<
    ReturnType<typeof PrivateFilesystemWorkspace.openReadOnly>
  >;
  try {
    workspace = await PrivateFilesystemWorkspace.openReadOnly(
      invocation.repositoryPath,
    );
  } catch (error) {
    return writeOnboardResult(
      blockedOnboardResult([
        {
          code:
            error instanceof PrivateFilesystemWorkspaceError
              ? error.code
              : "CLI_REPOSITORY_OPEN_FAILED",
          level: "error" as const,
          message:
            error instanceof Error
              ? error.message
              : "The repository could not be opened read-only.",
          path: invocation.repositoryPath,
        },
      ]),
      invocation,
      io,
    );
  }
  const configuration = await requireValidProjectConfiguration(
    workspace,
    invocation.projectConfigPath,
    "onboard",
  );
  if (!configuration.ok) {
    return writeOnboardResult(
      blockedOnboardResult(configuration.diagnostics),
      invocation,
      io,
    );
  }
  const result = await executePrivateExistingProjectInventory({
    lockPath: invocation.lockPath,
    workspace,
  });
  return writeOnboardResult(result, invocation, io);
}

export async function runPrivateLocalCli(
  args: readonly string[],
  io: PrivateLocalCliIo = { stdout: process.stdout, stderr: process.stderr },
  stdin: PrivateRuleInputStream = process.stdin,
): Promise<0 | 1 | 2> {
  if (
    args.length === 1 &&
    (args[0] === "--help" || args[0] === "-h")
  ) {
    writeLine(io.stdout, usage);
    return 0;
  }
  if (
    args.length === 2 &&
    privateCliCommands.includes(args[0] as (typeof privateCliCommands)[number]) &&
    (args[1] === "--help" || args[1] === "-h")
  ) {
    writeLine(
      io.stdout,
      commandUsage[args[0] as (typeof privateCliCommands)[number]],
    );
    return 0;
  }
  if (
    args.length === 3 &&
    args[0] === "rule" &&
    privateRuleOperations.includes(
      args[1] as (typeof privateRuleOperations)[number],
    ) &&
    (args[2] === "--help" || args[2] === "-h")
  ) {
    writeLine(
      io.stdout,
      ruleOperationUsage[
        args[1] as (typeof privateRuleOperations)[number]
      ],
    );
    return 0;
  }

  const parsed = parsePrivateCliArguments(args);
  if (!parsed.ok) {
    const outputFormat = args.includes("--json") ? "json" : "human";
    writeLine(
      io.stderr,
      formatArgumentFailure(cliDiagnostics(parsed.diagnostics), outputFormat),
    );
    if (outputFormat === "human") writeLine(io.stderr, usage);
    return 2;
  }
  const invocation = parsed.invocation;
  if (invocation.command === "rule") {
    return await runPrivateRule(invocation, io, stdin);
  }
  const layoutDiagnostic = pathLayoutDiagnostic(invocation);
  if (layoutDiagnostic !== null) {
    if (invocation.command === "onboard") {
      return writeOnboardResult(
        blockedOnboardResult([
          { ...layoutDiagnostic, level: "error" },
        ]),
        invocation,
        io,
      );
    }
    writeLine(
      io.stdout,
      blockedBeforePlanning(
        invocation.command,
        layoutDiagnostic,
        invocation.outputFormat,
      ),
    );
    return 2;
  }
  if (invocation.command === "onboard") {
    return await runPrivateOnboard(invocation, io);
  }
  try {
    if (invocation.command === "init") {
      return await runPrivateInit(invocation, io);
    }
  let workspace: Awaited<
    ReturnType<typeof PrivateFilesystemWorkspace.openReadOnly>
  >;
  try {
    workspace = await PrivateFilesystemWorkspace.openReadOnly(
      invocation.repositoryPath,
    );
  } catch (error) {
    const code =
      error instanceof PrivateFilesystemWorkspaceError
        ? error.code
        : "CLI_REPOSITORY_OPEN_FAILED";
    const message =
      error instanceof Error
        ? error.message
        : "The repository could not be opened read-only.";
    writeLine(
      io.stdout,
      blockedBeforePlanning(invocation.command, {
        code,
        level: "error",
        message,
        path: invocation.repositoryPath,
      }, invocation.outputFormat),
    );
    return 2;
  }

  let content: string | null;
  try {
    content = await workspace.readBounded(
      invocation.projectConfigPath,
      privateDomainProjectDocumentDefaultMaxBytes,
    );
  } catch {
    content = null;
  }
  if (content === null) {
    writeLine(
      io.stdout,
      blockedBeforePlanning(invocation.command, {
        code: "CLI_CONFIGURATION_READ_FAILED",
        level: "error",
        message:
          "The repository-relative configuration path must identify a readable regular UTF-8 file below the selected root.",
        path: invocation.projectConfigPath,
      }, invocation.outputFormat),
    );
    return 2;
  }

  const prepared = await preparePrivateDomainProjectPlan({
    content,
    lockPath: invocation.lockPath,
    workspace,
    ...(invocation.command === "diff" || invocation.command === "render"
      ? {
          existingTargetReplacements:
            invocation.existingTargetReplacements,
        }
      : {}),
  });
  if (!prepared.ok) {
    writeLine(
      io.stdout,
      blockedWithoutPlan(
        invocation.command,
        planningDiagnostics(prepared.diagnostics),
        invocation.outputFormat,
      ),
    );
    return 2;
  }

  const reconstructedPrepared =
    invocation.command === "render"
      ? reconstructPrivateDomainProjectConvergentPlan(prepared)
      : prepared;
  const effectivePrepared =
    invocation.command === "render" &&
    invocation.approvedPlanSnapshotDigest !== prepared.snapshot.digest &&
    invocation.approvedPlanSnapshotDigest ===
      reconstructedPrepared.snapshot.digest
      ? reconstructedPrepared
      : prepared;
  const plannedLayoutFailure = plannedPathLayoutDiagnostic(
    invocation,
    effectivePrepared,
  );
  if (plannedLayoutFailure !== null) {
    writeLine(
      io.stdout,
      blockedWithPlan(
        invocation.command,
        {
          planDigest: effectivePrepared.plan.planDigest,
          snapshotDigest: effectivePrepared.snapshot.digest,
          diagnostics: [plannedLayoutFailure],
        },
        invocation.outputFormat,
      ),
    );
    return 2;
  }
  const options = {
    materialization: effectivePrepared.materialization,
    snapshot: effectivePrepared.snapshot,
    baseLock: effectivePrepared.baseLock,
    lockPath: invocation.lockPath,
    workspace,
  };
  if (invocation.command === "check") {
    const result = await executePrivateCheckCommand(options);
    if (!writeBoundedOutput(
      io.stdout,
      "check",
      invocation.outputFormat,
      formatCheck(result, invocation.outputFormat),
    )) return 2;
    return result.candidateExitCode;
  }
  if (invocation.command === "diff") {
    const result = await executePrivateDiffCommand(options);
    const content = formatDiff(result, invocation.outputFormat);
    if (!writeBoundedOutput(
      io.stdout,
      "diff",
      invocation.outputFormat,
      content,
    )) return 2;
    return result.candidateExitCode;
  }
  if (invocation.command !== "render") {
    throw new Error("Private local CLI command narrowing failed.");
  }

  const initialCheck = await executePrivateCheckCommand(options);
  if (initialCheck.outcome === "blocked") {
    writeLine(
      io.stdout,
      blockedWithPlan("render", {
        planDigest: effectivePrepared.plan.planDigest,
        snapshotDigest: effectivePrepared.snapshot.digest,
        diagnostics: initialCheck.diagnostics,
      }, invocation.outputFormat),
    );
    return 2;
  }
  if (
    invocation.approvedPlanSnapshotDigest !== effectivePrepared.snapshot.digest
  ) {
    writeLine(
      io.stdout,
      blockedWithPlan("render", {
        planDigest: effectivePrepared.plan.planDigest,
        snapshotDigest: effectivePrepared.snapshot.digest,
        diagnostics: [
          {
            code: "CLI_PLAN_APPROVAL_MISMATCH",
            level: "error",
            message:
              "The supplied approval does not match the current exact plan digest. Run diff and review the complete target again.",
          },
        ],
      }, invocation.outputFormat),
    );
    return 2;
  }
  if (initialCheck.outcome === "clean") {
    if (!writeBoundedOutput(
      io.stdout,
      "render",
      invocation.outputFormat,
      formatCleanRenderPlan({
        planDigest: effectivePrepared.plan.planDigest,
        snapshotDigest: effectivePrepared.snapshot.digest,
      }, invocation.outputFormat),
    )) return 2;
    return 0;
  }

  let mutableWorkspace: Awaited<
    ReturnType<typeof PrivateFilesystemWorkspace.open>
  >;
  try {
    mutableWorkspace =
      await PrivateFilesystemWorkspace.open(
        invocation.repositoryPath,
      );
  } catch (error) {
    const code =
      error instanceof PrivateFilesystemWorkspaceError
        ? error.code
        : "CLI_MUTABLE_REPOSITORY_OPEN_FAILED";
    writeLine(
      io.stdout,
      blockedWithPlan("render", {
        planDigest: effectivePrepared.plan.planDigest,
        snapshotDigest: effectivePrepared.snapshot.digest,
        diagnostics: [
          {
            code,
            level: "error",
            message:
              error instanceof Error
                ? error.message
                : "The repository could not be opened for approved render.",
            path: invocation.repositoryPath,
          },
        ],
      }, invocation.outputFormat),
    );
    return 2;
  }

  let freshContent: string;
  try {
    const observed = await mutableWorkspace.readBounded(
      invocation.projectConfigPath,
      privateDomainProjectDocumentDefaultMaxBytes,
    );
    if (observed === null) throw new Error("Configuration is absent.");
    freshContent = observed;
  } catch {
    writeLine(
      io.stdout,
      blockedBeforePlanning("render", {
        code: "CLI_CONFIGURATION_REREAD_FAILED",
        level: "error",
        message:
          "The approved repository-relative configuration file could not be reread before mutation.",
        path: invocation.projectConfigPath,
      }, invocation.outputFormat),
    );
    return 2;
  }

  const freshResult = await preparePrivateDomainProjectPlan({
    content: freshContent,
    lockPath: invocation.lockPath,
    workspace: mutableWorkspace,
    existingTargetReplacements: invocation.existingTargetReplacements,
  });
  if (!freshResult.ok) {
    writeLine(
      io.stdout,
      blockedWithoutPlan(
        "render",
        planningDiagnostics(freshResult.diagnostics),
        invocation.outputFormat,
      ),
    );
    return 2;
  }
  const reconstructedFresh =
    reconstructPrivateDomainProjectConvergentPlan(freshResult);
  const fresh =
    invocation.approvedPlanSnapshotDigest !== freshResult.snapshot.digest &&
    invocation.approvedPlanSnapshotDigest === reconstructedFresh.snapshot.digest
      ? reconstructedFresh
      : freshResult;
  const freshLayoutFailure = plannedPathLayoutDiagnostic(invocation, fresh);
  if (freshLayoutFailure !== null) {
    writeLine(
      io.stdout,
      blockedWithPlan(
        "render",
        {
          planDigest: fresh.plan.planDigest,
          snapshotDigest: fresh.snapshot.digest,
          diagnostics: [freshLayoutFailure],
        },
        invocation.outputFormat,
      ),
    );
    return 2;
  }
  if (fresh.snapshot.digest !== invocation.approvedPlanSnapshotDigest) {
    const freshCheck = await executePrivateCheckCommand({
      materialization: fresh.materialization,
      snapshot: fresh.snapshot,
      baseLock: fresh.baseLock,
      lockPath: invocation.lockPath,
      workspace: mutableWorkspace,
    });
    writeLine(
      io.stdout,
      blockedWithPlan("render", {
        planDigest: fresh.plan.planDigest,
        snapshotDigest: fresh.snapshot.digest,
        diagnostics: [
          ...freshCheck.diagnostics,
          {
            code: "CLI_APPROVED_PLAN_STALE",
            level: "error",
            message:
              "Repository or configuration state changed after approval validation. Run diff and approve the new exact plan.",
          },
        ],
      }, invocation.outputFormat),
    );
    return 2;
  }

  try {
    const result = await executePrivateRenderCommand({
      materialization: fresh.materialization,
      snapshot: fresh.snapshot,
      baseLock: fresh.baseLock,
      lockPath: invocation.lockPath,
      workspace: mutableWorkspace,
    });
    if (!writeBoundedOutput(
      io.stdout,
      "render",
      invocation.outputFormat,
      formatRender(result, invocation.outputFormat),
    )) return 2;
    return 0;
  } catch (error) {
    writeLine(
      io.stdout,
      blockedWithPlan("render", {
        planDigest: fresh.plan.planDigest,
        snapshotDigest: fresh.snapshot.digest,
        diagnostics: [
          {
            code:
              error instanceof PrivateRenderCommandError
                ? error.code
                : "CLI_RENDER_FAILED",
            level: "error",
            message:
              error instanceof Error
                ? error.message
                : "The approved render failed before verified completion.",
            ...(error instanceof PrivateRenderCommandError &&
            error.path !== undefined
              ? { path: error.path }
              : {}),
          },
        ],
      }, invocation.outputFormat),
    );
    return 2;
  }
  } catch (error) {
    const workspaceError =
      error instanceof PrivateFilesystemWorkspaceError ? error : null;
    writeLine(
      io.stdout,
      blockedBeforePlanning(invocation.command, {
        code: workspaceError?.code ?? "CLI_UNEXPECTED_FAILURE",
        level: "error",
        message: workspaceError?.message ??
          "The command failed while observing or planning repository state.",
        ...(workspaceError?.path === undefined
          ? {}
          : { path: workspaceError.path }),
      }, invocation.outputFormat),
    );
    return 2;
  }
}

const invokedPath = process.argv[1];

async function isDirectInvocation(path: string): Promise<boolean> {
  try {
    const [modulePath, executablePath] = await Promise.all([
      realpath(fileURLToPath(import.meta.url)),
      realpath(path),
    ]);
    return modulePath === executablePath;
  } catch {
    return import.meta.url === pathToFileURL(path).href;
  }
}

if (
  invokedPath !== undefined &&
  await isDirectInvocation(invokedPath)
) {
  runPrivateLocalCli(process.argv.slice(2)).then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `diagnostics:\n  [error] CLI_UNEXPECTED_FAILURE: ${message}\n`,
      );
      process.exitCode = 2;
    },
  );
}
