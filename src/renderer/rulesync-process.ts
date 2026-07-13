import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import type {
  RenderRequest,
  RendererCapability,
  RendererDiagnostic,
  RendererProvider,
  StagedFile,
  StagedRender,
  StagingRenderer,
} from "./contract.js";

const targetByProvider: Readonly<Record<RendererProvider, string>> = {
  codex: "codexcli",
  "claude-code": "claudecode",
  cursor: "cursor",
};

const supportedCapabilities: Readonly<
  Record<RendererProvider, ReadonlySet<RendererCapability>>
> = {
  codex: new Set(["rules"]),
  "claude-code": new Set(["rules", "commands"]),
  cursor: new Set(["rules", "commands"]),
};

interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface RulesyncProcessOptions {
  readonly command: string;
  readonly prefixArgs: readonly string[];
  readonly inputRoot: string;
  readonly configPath: string;
  readonly version: string;
  readonly environment?: NodeJS.ProcessEnv;
}

async function runProcess(
  command: string,
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
): Promise<ProcessResult> {
  return await new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", rejectProcess);
    child.on("close", (exitCode) => {
      resolveProcess({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}

async function collectFiles(
  root: string,
  directory = root,
): Promise<StagedFile[]> {
  const files: StagedFile[] = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, absolutePath)));
    } else if (entry.isFile()) {
      files.push({
        path: relative(root, absolutePath).replaceAll("\\", "/"),
        content: await readFile(absolutePath, "utf8"),
      });
    }
  }

  return files;
}

function unsupportedDiagnostics(
  request: RenderRequest,
): RendererDiagnostic[] {
  const diagnostics: RendererDiagnostic[] = [];
  for (const provider of [...request.providers].sort()) {
    for (const capability of [...request.capabilities].sort()) {
      if (!supportedCapabilities[provider].has(capability)) {
        diagnostics.push({
          code: "UNSUPPORTED_CAPABILITY",
          severity: "error",
          message: `${provider} does not support project-scope ${capability} through the pinned Rulesync adapter.`,
          provider,
          capability,
        });
      }
    }
  }
  return diagnostics;
}

export class RulesyncProcessRenderer implements StagingRenderer {
  readonly name = "rulesync";
  readonly ownershipKey = "agentdevflow.renderer.rulesync";

  constructor(private readonly options: RulesyncProcessOptions) {}

  get version(): string {
    return this.options.version;
  }

  async stage(request: RenderRequest): Promise<StagedRender> {
    const diagnostics = unsupportedDiagnostics(request);
    if (diagnostics.length > 0) {
      return { files: [], diagnostics };
    }

    const temporaryRoot = await mkdtemp(
      join(tmpdir(), "agentdevflow-rulesync-stage-"),
    );
    const outputRoot = join(temporaryRoot, "output");
    await mkdir(outputRoot);

    try {
      const targets = [...new Set(request.providers.map((provider) =>
        targetByProvider[provider],
      ))].sort();
      const capabilities = [...new Set(request.capabilities)].sort();
      const args = [
        ...this.options.prefixArgs,
        "--json",
        "generate",
        "--config",
        resolve(this.options.configPath),
        "--input-root",
        resolve(this.options.inputRoot),
        "--output-roots",
        outputRoot,
        "--targets",
        targets.join(","),
        "--features",
        capabilities.join(","),
      ];
      const result = await runProcess(this.options.command, args, {
        ...process.env,
        ...this.options.environment,
      });

      if (result.exitCode !== 0) {
        return {
          files: [],
          diagnostics: [
            {
              code: "BACKEND_FAILURE",
              severity: "error",
              message:
                result.stderr.trim() ||
                result.stdout.trim() ||
                `Rulesync exited with code ${result.exitCode}.`,
            },
          ],
        };
      }

      const response = JSON.parse(result.stdout) as {
        readonly success?: boolean;
        readonly version?: string;
      };
      if (response.success !== true || response.version !== this.version) {
        return {
          files: [],
          diagnostics: [
            {
              code: "BACKEND_PROTOCOL_ERROR",
              severity: "error",
              message: "Rulesync returned an unexpected JSON response.",
            },
          ],
        };
      }

      return {
        files: await collectFiles(outputRoot),
        diagnostics: [],
      };
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}
