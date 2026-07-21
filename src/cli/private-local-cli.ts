#!/usr/bin/env node

import { realpath } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  preparePrivateDomainProjectPlan,
  reconstructPrivateDomainProjectConvergentPlan,
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
import {
  parsePrivateCliArguments,
  type PrivateCliInvocation,
} from "../interface/private-cli-arguments.js";
import {
  PrivateFilesystemWorkspace,
  PrivateFilesystemWorkspaceError,
} from "../workspace/private-filesystem-workspace.js";
import { runPrivateDoctor } from "./private-doctor-command.js";
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
  formatRender,
  planningDiagnostics,
  writeBoundedOutput,
  writeLine,
  type PrivateLocalCliIo,
} from "./private-local-cli-output.js";

const usage = `Usage:
  agentdevflow init [--repository <path>] [--config <relative-path>] [--lock <relative-path>] --workflow local-reviewed-change --preset <fast|balanced> --tracker <local|none> --provider <id,product,surface>... --steward <id> --developer <id> --reviewer <id> [--json]
  agentdevflow check [--repository <path>] [--config <relative-path>] [--lock <relative-path>] [--json]
  agentdevflow diff [--repository <path>] [--config <relative-path>] [--lock <relative-path>] [--json]
  agentdevflow doctor [--repository <path>] [--config <relative-path>] --observations <path> [--json]
  agentdevflow render [--repository <path>] [--config <relative-path>] [--lock <relative-path>] --approve-plan <exact-plan-digest> [--json]

Init creates only an absent revision-1 configuration after validating provider-file dispositions.
Check and diff are read-only. Render requires an exact plan digest from diff.
Defaults: repository '.', config 'agentdevflow.config.jsonc', lock '.agentdevflow/lock.json'.
Beta configuration and JSON schema versions may require documented migration before 1.0.`;

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
      workspace.read(invocation.projectConfigPath),
      workspace.read(invocation.lockPath),
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
  if (invocation.projectConfigPath === invocation.lockPath) {
    writeLine(
      io.stdout,
      blockedBeforePlanning("init", {
        code: "CLI_INIT_PATH_COLLISION",
        level: "error",
        message: "The configuration and render lock paths must be different.",
        path: invocation.projectConfigPath,
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
  if (
    prepared.plan.files.some(
      (file) => file.path === invocation.projectConfigPath,
    )
  ) {
    writeLine(
      io.stdout,
      blockedWithPlan("init", {
        planDigest: prepared.plan.planDigest,
        snapshotDigest: prepared.snapshot.digest,
        diagnostics: [
          {
            code: "CLI_INIT_PATH_COLLISION",
            level: "error",
            message:
              "The configuration path collides with a generated provider path.",
            path: invocation.projectConfigPath,
          },
        ],
      }, invocation.outputFormat),
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
  if (check.outcome === "blocked") {
    writeLine(
      io.stdout,
      blockedWithPlan("init", {
        planDigest: prepared.plan.planDigest,
        snapshotDigest: prepared.snapshot.digest,
        diagnostics: check.diagnostics,
      }, invocation.outputFormat),
    );
    return 2;
  }

  const configurationDisposition =
    existingConfiguration === null ? "create" : "adopt";
  if (configurationDisposition === "create") {
    let mutableWorkspace: Awaited<ReturnType<typeof PrivateFilesystemWorkspace.open>>;
    try {
      mutableWorkspace = await PrivateFilesystemWorkspace.open(
        invocation.repositoryPath,
      );
      const [freshConfiguration, freshLock] = await Promise.all([
        mutableWorkspace.read(invocation.projectConfigPath),
        mutableWorkspace.read(invocation.lockPath),
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

  const outcome = prepared.plan.files.some((file) => file.action === "update")
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
    }, invocation.outputFormat);
  if (!writeBoundedOutput(
    io.stdout,
    "init",
    invocation.outputFormat,
    output,
  )) return 2;
  return outcome === "ready" ? 0 : 1;
}

export async function runPrivateLocalCli(
  args: readonly string[],
  io: PrivateLocalCliIo = { stdout: process.stdout, stderr: process.stderr },
): Promise<0 | 1 | 2> {
  if (
    args.length === 1 &&
    (args[0] === "--help" || args[0] === "-h")
  ) {
    writeLine(io.stdout, usage);
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
  if (invocation.command === "init") {
    return runPrivateInit(invocation, io);
  }
  if (invocation.command === "doctor") {
    return runPrivateDoctor(invocation, io);
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
    content = await workspace.read(invocation.projectConfigPath);
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
    mutableWorkspace = await PrivateFilesystemWorkspace.open(
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
    const observed = await mutableWorkspace.read(invocation.projectConfigPath);
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
