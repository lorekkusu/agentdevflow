import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  advancePrivateRenderTransactionJournal,
  createPrivateRenderTransactionJournal,
  decidePrivateRenderTransactionRecovery,
  type ObservedPrivateRenderTransactionState,
  type PrivateRenderTransaction,
} from "../transaction/private-render-transaction.js";

const executeFile = promisify(execFile);

interface ComparisonOperation {
  readonly path: string;
  readonly before: string | null;
  readonly after: string;
}

export interface GitResetObservation {
  readonly preflightClean: boolean;
  readonly resetRestoredExactBase: boolean;
  readonly resetRemovedUntrackedOutput: boolean;
  readonly resetRestoredIgnoredOutput: boolean;
  readonly resetPreservedConcurrentWork: boolean;
  readonly rerunReachedTarget: boolean;
  readonly statusAfterReset: string;
}

export interface ConvergentApplyObservation {
  readonly requiresCleanGit: boolean;
  readonly rerunReachedTarget: boolean;
  readonly rerunPreservedConcurrentWork: boolean;
  readonly acceptedOnlyBeforeOrAfterDigests: boolean;
  readonly foreignTargetDriftFailedClosed: boolean;
  readonly foreignDriftAttemptMutatedNoTargets: boolean;
}

export interface JournalObservation {
  readonly baseAnchorAction: string;
  readonly baseAnchorOperationCount: number;
  readonly targetAnchorAction: string;
  readonly targetAnchorOperationCount: number;
  readonly foreignTargetAction: string;
}

export interface RecoveryStrategyComparison {
  readonly revision: 1;
  readonly faultBoundary: string;
  readonly operations: readonly string[];
  readonly gitReset: GitResetObservation;
  readonly convergentApply: ConvergentApplyObservation;
  readonly writeAheadJournal: JournalObservation;
}

interface Sandbox {
  readonly container: string;
  readonly repository: string;
}

const operations: readonly ComparisonOperation[] = [
  {
    path: "AGENTS.md",
    before: "base agents\n",
    after: "target agents\n",
  },
  {
    path: ".agentdevflow/local.txt",
    before: "base ignored\n",
    after: "target ignored\n",
  },
  {
    path: ".cursor/rules/agentdevflow.mdc",
    before: null,
    after: "target cursor\n",
  },
  {
    path: "CLAUDE.md",
    before: "base claude\n",
    after: "target claude\n",
  },
];

const unrelatedPath = "src/app.ts";
const unrelatedBase = "export const value = 'base';\n";
const unrelatedConcurrent = "export const value = 'concurrent';\n";

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

async function writeProjectFile(
  repository: string,
  path: string,
  content: string,
): Promise<void> {
  const absolutePath = join(repository, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function git(repository: string, args: readonly string[]): Promise<string> {
  const result = await executeFile("git", [...args], {
    cwd: repository,
    encoding: "utf8",
  });
  return result.stdout.trim();
}

async function createSandbox(): Promise<Sandbox> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-recovery-"));
  const repository = join(container, "repository");
  await mkdir(repository);
  await git(repository, ["init", "--quiet"]);
  await git(repository, ["config", "user.name", "Recovery Experiment"]);
  await git(repository, ["config", "user.email", "recovery@example.invalid"]);
  await git(repository, ["config", "commit.gpgsign", "false"]);
  await git(repository, ["config", "core.autocrlf", "false"]);
  await writeProjectFile(repository, ".gitignore", ".agentdevflow/\n");
  await writeProjectFile(repository, "AGENTS.md", operations[0]?.before ?? "");
  await writeProjectFile(repository, "CLAUDE.md", operations[3]?.before ?? "");
  await writeProjectFile(repository, unrelatedPath, unrelatedBase);
  await git(repository, ["add", ".gitignore", "AGENTS.md", "CLAUDE.md", unrelatedPath]);
  await git(repository, [
    "commit",
    "--quiet",
    "--no-verify",
    "-m",
    "Create experiment baseline",
  ]);
  await writeProjectFile(
    repository,
    operations[1]?.path ?? "",
    operations[1]?.before ?? "",
  );
  return { container, repository };
}

async function managedStateMatches(
  repository: string,
  side: "before" | "after",
): Promise<boolean> {
  for (const operation of operations) {
    const expected = side === "before" ? operation.before : operation.after;
    if ((await readOptional(join(repository, operation.path))) !== expected) {
      return false;
    }
  }
  return true;
}

async function applyPrefix(repository: string, count: number): Promise<void> {
  for (const operation of operations.slice(0, count)) {
    await writeProjectFile(repository, operation.path, operation.after);
  }
}

async function runGitResetExperiment(): Promise<GitResetObservation> {
  const sandbox = await createSandbox();
  try {
    const preflightClean = (await git(sandbox.repository, ["status", "--porcelain"])) === "";
    await applyPrefix(sandbox.repository, 3);
    await writeProjectFile(sandbox.repository, unrelatedPath, unrelatedConcurrent);
    await git(sandbox.repository, ["reset", "--hard", "HEAD"]);

    const observation: GitResetObservation = {
      preflightClean,
      resetRestoredExactBase: await managedStateMatches(sandbox.repository, "before"),
      resetRemovedUntrackedOutput:
        (await readOptional(
          join(sandbox.repository, ".cursor/rules/agentdevflow.mdc"),
        )) === null,
      resetRestoredIgnoredOutput:
        (await readOptional(join(sandbox.repository, ".agentdevflow/local.txt"))) ===
        "base ignored\n",
      resetPreservedConcurrentWork:
        (await readOptional(join(sandbox.repository, unrelatedPath))) ===
        unrelatedConcurrent,
      rerunReachedTarget: false,
      statusAfterReset: await git(sandbox.repository, [
        "status",
        "--porcelain",
        "--untracked-files=all",
      ]),
    };

    await applyPrefix(sandbox.repository, operations.length);
    return {
      ...observation,
      rerunReachedTarget: await managedStateMatches(sandbox.repository, "after"),
    };
  } finally {
    await rm(sandbox.container, { recursive: true, force: true });
  }
}

type ApplyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly conflictPath: string };

async function stageOutputs(root: string): Promise<string> {
  const stagingRoot = join(root, "staged");
  for (const operation of operations) {
    await writeProjectFile(stagingRoot, operation.path, operation.after);
  }
  return stagingRoot;
}

async function applyStagedPrefix(
  repository: string,
  stagingRoot: string,
  count: number,
): Promise<void> {
  for (const operation of operations.slice(0, count)) {
    const stagedContent = await readFile(join(stagingRoot, operation.path), "utf8");
    await writeProjectFile(repository, operation.path, stagedContent);
  }
}

async function convergentApply(
  repository: string,
  stagingRoot: string,
): Promise<ApplyResult> {
  const observedDigests = new Map<string, string | null>();
  for (const operation of operations) {
    const stagedContent = await readOptional(join(stagingRoot, operation.path));
    if (stagedContent !== operation.after) {
      throw new Error(`Staged output does not match the target: ${operation.path}`);
    }
    const content = await readOptional(join(repository, operation.path));
    const observedDigest = content === null ? null : digest(content);
    const beforeDigest = operation.before === null ? null : digest(operation.before);
    const afterDigest = digest(operation.after);
    observedDigests.set(operation.path, observedDigest);
    if (observedDigest !== beforeDigest && observedDigest !== afterDigest) {
      return { ok: false, conflictPath: operation.path };
    }
  }

  for (const operation of operations) {
    if (observedDigests.get(operation.path) !== digest(operation.after)) {
      const stagedContent = await readFile(join(stagingRoot, operation.path), "utf8");
      await writeProjectFile(repository, operation.path, stagedContent);
    }
  }
  return { ok: true };
}

async function targetSnapshot(repository: string): Promise<readonly string[]> {
  return Promise.all(
    operations.map(async (operation) =>
      digest((await readOptional(join(repository, operation.path))) ?? "<absent>"),
    ),
  );
}

async function runConvergentApplyExperiment(): Promise<ConvergentApplyObservation> {
  const interrupted = await createSandbox();
  const drifted = await createSandbox();
  try {
    const interruptedStaging = await stageOutputs(interrupted.container);
    const driftedStaging = await stageOutputs(drifted.container);
    await applyStagedPrefix(interrupted.repository, interruptedStaging, 3);
    await writeProjectFile(interrupted.repository, unrelatedPath, unrelatedConcurrent);
    const rerun = await convergentApply(
      interrupted.repository,
      interruptedStaging,
    );

    await applyStagedPrefix(drifted.repository, driftedStaging, 1);
    await writeProjectFile(drifted.repository, "CLAUDE.md", "foreign claude\n");
    const beforeAttempt = await targetSnapshot(drifted.repository);
    const foreignAttempt = await convergentApply(
      drifted.repository,
      driftedStaging,
    );
    const afterAttempt = await targetSnapshot(drifted.repository);

    return {
      requiresCleanGit: false,
      rerunReachedTarget:
        rerun.ok && (await managedStateMatches(interrupted.repository, "after")),
      rerunPreservedConcurrentWork:
        (await readOptional(join(interrupted.repository, unrelatedPath))) ===
        unrelatedConcurrent,
      acceptedOnlyBeforeOrAfterDigests: true,
      foreignTargetDriftFailedClosed:
        !foreignAttempt.ok && foreignAttempt.conflictPath === "CLAUDE.md",
      foreignDriftAttemptMutatedNoTargets:
        JSON.stringify(beforeAttempt) === JSON.stringify(afterAttempt),
    };
  } finally {
    await Promise.all([
      rm(interrupted.container, { recursive: true, force: true }),
      rm(drifted.container, { recursive: true, force: true }),
    ]);
  }
}

function transactionDigest(
  transaction: Omit<PrivateRenderTransaction, "digest">,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        revision: transaction.revision,
        planDigest: transaction.planDigest,
        baseLockDigest: transaction.baseLockDigest,
        targetLockDigest: transaction.targetLockDigest,
        operations: transaction.operations.map((operation) => ({
          path: operation.path,
          kind: operation.kind,
          beforeDigest: operation.beforeDigest,
          afterDigest: operation.afterDigest,
        })),
      }),
    )
    .digest("hex");
}

function createComparisonTransaction(): PrivateRenderTransaction {
  const base = {
    revision: 1,
    planDigest: digest("comparison plan"),
    baseLockDigest: digest("base lock"),
    targetLockDigest: digest("target lock"),
    operations: [...operations]
      .sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      )
      .map((operation) => ({
        path: operation.path,
        kind: "write" as const,
        beforeDigest: operation.before === null ? null : digest(operation.before),
        afterDigest: digest(operation.after),
      })),
  } satisfies Omit<PrivateRenderTransaction, "digest">;
  return { ...base, digest: transactionDigest(base) };
}

function observedState(
  transaction: PrivateRenderTransaction,
  lockDigest: string | null,
  appliedCount: number,
): ObservedPrivateRenderTransactionState {
  return {
    lockDigest,
    files: Object.fromEntries(
      transaction.operations.map((operation, index) => [
        operation.path,
        index < appliedCount ? operation.afterDigest : operation.beforeDigest,
      ]),
    ),
  };
}

function runJournalExperiment(): JournalObservation {
  const transaction = createComparisonTransaction();
  const prepared = createPrivateRenderTransactionJournal(transaction);
  const applying = advancePrivateRenderTransactionJournal(
    prepared,
    "outputs-applying",
  );
  const baseDecision = decidePrivateRenderTransactionRecovery(
    transaction,
    applying,
    observedState(transaction, transaction.baseLockDigest, 3),
  );
  const lockWritten = advancePrivateRenderTransactionJournal(
    applying,
    "lock-written",
  );
  const targetDecision = decidePrivateRenderTransactionRecovery(
    transaction,
    lockWritten,
    observedState(transaction, transaction.targetLockDigest, 3),
  );
  const foreign = observedState(transaction, transaction.baseLockDigest, 3);
  const firstPath = transaction.operations[0]?.path;
  if (!firstPath) {
    throw new Error("The comparison transaction has no operations.");
  }
  const foreignDecision = decidePrivateRenderTransactionRecovery(
    transaction,
    applying,
    {
      ...foreign,
      files: { ...foreign.files, [firstPath]: digest("foreign content") },
    },
  );
  return {
    baseAnchorAction: baseDecision.action,
    baseAnchorOperationCount: baseDecision.operations.length,
    targetAnchorAction: targetDecision.action,
    targetAnchorOperationCount: targetDecision.operations.length,
    foreignTargetAction: foreignDecision.action,
  };
}

export async function runRecoveryStrategyComparison(): Promise<RecoveryStrategyComparison> {
  return {
    revision: 1,
    faultBoundary: "after three complete managed-file writes and before the fourth",
    operations: operations.map((operation) => operation.path),
    gitReset: await runGitResetExperiment(),
    convergentApply: await runConvergentApplyExperiment(),
    writeAheadJournal: runJournalExperiment(),
  };
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(JSON.stringify(await runRecoveryStrategyComparison(), null, 2));
}
