import { realpath } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import type { PrivateOnboardingAgent } from "../interface/private-cli-arguments.js";
import { createPrivateCodexOnboardingPrompt } from "../onboarding/private-codex-onboarding-prompt.js";
import {
  runPrivateCodexOnboardingProcess,
  type PrivateCodexOnboardingProcessResult,
} from "../onboarding/private-codex-onboarding-process.js";

export interface PrivateOnboardingOperatorOptions {
  readonly acceptWithoutConfirmation: boolean;
  readonly projectConfigPath: string;
  readonly repositoryPath: string;
  readonly renderLockPath: string;
}

export interface PrivateOnboardingOperator {
  readonly canSelectInteractively: boolean;
  selectAgent(): Promise<PrivateOnboardingAgent | null>;
  runCodex(
    options: PrivateOnboardingOperatorOptions,
  ): Promise<PrivateCodexOnboardingProcessResult>;
}

export function createPrivateOnboardingOperator(): PrivateOnboardingOperator {
  return {
    canSelectInteractively:
      process.stdin.isTTY === true && process.stdout.isTTY === true,
    async selectAgent(): Promise<PrivateOnboardingAgent | null> {
      const prompt = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        process.stdout.write(
          "Choose an onboarding method:\n  1. Codex\n  2. Manual\n",
        );
        while (true) {
          const answer = (await prompt.question("Selection [1-2]: "))
            .trim()
            .toLowerCase();
          if (answer === "1" || answer === "codex" || answer === "c") {
            return "codex";
          }
          if (answer === "2" || answer === "manual" || answer === "m") {
            return "manual";
          }
          process.stdout.write("Enter 1 for Codex or 2 for Manual.\n");
        }
      } catch {
        return null;
      } finally {
        prompt.close();
      }
    },
    async runCodex(
      options: PrivateOnboardingOperatorOptions,
    ): Promise<PrivateCodexOnboardingProcessResult> {
      const repositoryPath = await realpath(options.repositoryPath);
      const agentdevflowEntrypoint = await realpath(
        fileURLToPath(new URL("./private-local-cli.js", import.meta.url)),
      );
      const prompt = createPrivateCodexOnboardingPrompt({
        acceptWithoutConfirmation: options.acceptWithoutConfirmation,
        agentdevflowEntrypoint,
        nodeExecutable: process.execPath,
        projectConfigPath: options.projectConfigPath,
        repositoryPath,
        renderLockPath: options.renderLockPath,
      });
      return await runPrivateCodexOnboardingProcess({
        acceptWithoutConfirmation: options.acceptWithoutConfirmation,
        prompt,
        repositoryPath,
      });
    },
  };
}
