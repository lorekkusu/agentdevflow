import { spawn, type ChildProcess } from "node:child_process";

export const privateCodexOnboardingTimeoutMilliseconds = 15 * 60 * 1_000;
const privateCodexOnboardingForceStopMilliseconds = 5_000;

export type PrivateCodexOnboardingProcessResult =
  | { readonly outcome: "completed" }
  | {
      readonly outcome: "blocked";
      readonly code:
        | "CLI_ONBOARD_CODEX_CANCELLED"
        | "CLI_ONBOARD_CODEX_FAILED"
        | "CLI_ONBOARD_CODEX_NOT_FOUND"
        | "CLI_ONBOARD_CODEX_TIMEOUT";
      readonly message: string;
    };

interface PrivateCodexSpawnOptions {
  readonly cwd: string;
  readonly stdio: "inherit" | ["pipe", "inherit", "inherit"];
  readonly shell: false;
}

export type PrivateCodexSpawn = (
  executable: string,
  args: readonly string[],
  options: PrivateCodexSpawnOptions,
) => ChildProcess;

export interface PrivateCodexOnboardingProcessOptions {
  readonly acceptWithoutConfirmation: boolean;
  readonly prompt: string;
  readonly repositoryPath: string;
}

function spawnCodex(
  executable: string,
  args: readonly string[],
  options: PrivateCodexSpawnOptions,
): ChildProcess {
  return spawn(executable, [...args], options);
}

function stopChild(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
}

export async function runPrivateCodexOnboardingProcess(
  options: PrivateCodexOnboardingProcessOptions,
  spawnProcess: PrivateCodexSpawn = spawnCodex,
  timeoutMilliseconds = privateCodexOnboardingTimeoutMilliseconds,
  forceStopMilliseconds = privateCodexOnboardingForceStopMilliseconds,
): Promise<PrivateCodexOnboardingProcessResult> {
  const args = options.acceptWithoutConfirmation
    ? ["exec", "-"]
    : [options.prompt];
  const child = spawnProcess("codex", args, {
    cwd: options.repositoryPath,
    shell: false,
    stdio: options.acceptWithoutConfirmation
      ? ["pipe", "inherit", "inherit"]
      : "inherit",
  });

  return await new Promise((resolve) => {
    let finished = false;
    let cancelled = false;
    let timedOut = false;
    let forceStopTimer: NodeJS.Timeout | undefined;

    const forceStop = (): void => {
      forceStopTimer ??= setTimeout(() => {
        stopChild(child, "SIGKILL");
      }, forceStopMilliseconds);
    };
    const cancel = (signal: NodeJS.Signals): void => {
      cancelled = true;
      stopChild(child, signal);
      forceStop();
    };
    const cancelInterrupt = (): void => cancel("SIGINT");
    const cancelTermination = (): void => cancel("SIGTERM");
    process.once("SIGINT", cancelInterrupt);
    process.once("SIGTERM", cancelTermination);

    const timeout = setTimeout(() => {
      timedOut = true;
      stopChild(child, "SIGTERM");
      forceStop();
    }, timeoutMilliseconds);

    const finish = (result: PrivateCodexOnboardingProcessResult): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (forceStopTimer !== undefined) clearTimeout(forceStopTimer);
      process.off("SIGINT", cancelInterrupt);
      process.off("SIGTERM", cancelTermination);
      resolve(result);
    };

    child.once("error", (error: NodeJS.ErrnoException) => {
      finish({
        outcome: "blocked",
        code:
          error.code === "ENOENT"
            ? "CLI_ONBOARD_CODEX_NOT_FOUND"
            : "CLI_ONBOARD_CODEX_FAILED",
        message:
          error.code === "ENOENT"
            ? "The codex executable was not found. Install and authenticate Codex CLI, or use --agent manual."
            : "Codex CLI could not be started.",
      });
    });
    child.once("close", (code, signal) => {
      if (timedOut) {
        finish({
          outcome: "blocked",
          code: "CLI_ONBOARD_CODEX_TIMEOUT",
          message: "Codex onboarding exceeded the 15-minute limit and was stopped.",
        });
        return;
      }
      if (cancelled) {
        finish({
          outcome: "blocked",
          code: "CLI_ONBOARD_CODEX_CANCELLED",
          message: "Codex onboarding was cancelled.",
        });
        return;
      }
      if (code === 0) {
        finish({ outcome: "completed" });
        return;
      }
      finish({
        outcome: "blocked",
        code: "CLI_ONBOARD_CODEX_FAILED",
        message:
          signal === null
            ? `Codex CLI exited with status ${code ?? "unknown"}.`
            : `Codex CLI exited after signal ${signal}.`,
      });
    });
    if (options.acceptWithoutConfirmation) {
      child.stdin?.once("error", () => undefined);
      child.stdin?.end(options.prompt);
    }
  });
}
