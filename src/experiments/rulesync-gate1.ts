import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import type { RenderWorkspace } from "../renderer/contract.js";
import { RulesyncProcessRenderer } from "../renderer/rulesync-process.js";
import { StagedRendererAdapter } from "../renderer/staged-adapter.js";

const rulesyncVersion = "9.6.3";

class EmptyWorkspace implements RenderWorkspace {
  async read(): Promise<null> {
    return null;
  }

  async writeAtomically(): Promise<void> {
    throw new Error("The renderer experiment is plan-only.");
  }

  async removeAtomically(): Promise<void> {
    throw new Error("The renderer experiment is plan-only.");
  }
}

async function listFiles(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(root, absolutePath)));
    } else if (entry.isFile()) {
      files.push(relative(root, absolutePath).replaceAll("\\", "/"));
    }
  }
  return files;
}

async function fixtureDigest(root: string, files: readonly string[]): Promise<string> {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(join(root, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function runner(): { command: string; prefixArgs: string[] } {
  if (process.env.RULESYNC_RUNNER === "pnpm") {
    return {
      command: process.env.PNPM_BIN ?? "pnpm",
      prefixArgs: ["dlx", `rulesync@${rulesyncVersion}`],
    };
  }
  return {
    command: "npx",
    prefixArgs: ["--yes", `rulesync@${rulesyncVersion}`],
  };
}

const fixtureRoot = resolve("test/fixtures/renderer/minimal");
const sourceFiles = await listFiles(fixtureRoot);
const selectedRunner = runner();
const backend = new RulesyncProcessRenderer({
  ...selectedRunner,
  inputRoot: fixtureRoot,
  configPath: join(fixtureRoot, "rulesync.jsonc"),
  version: rulesyncVersion,
});
const adapter = new StagedRendererAdapter(backend);
const plan = await adapter.plan(
  {
    inputDigest: await fixtureDigest(fixtureRoot, sourceFiles),
    providers: ["codex", "claude-code", "cursor"],
    capabilities: ["rules"],
    sourceFiles,
    ownership: {},
  },
  new EmptyWorkspace(),
);

console.log(
  JSON.stringify(
    {
      backend: plan.backend,
      backendVersion: plan.backendVersion,
      inputDigest: plan.inputDigest,
      planDigest: plan.planDigest,
      safeToApply: plan.safeToApply,
      files: plan.files.map(({ action, expectedDigest, path }) => ({
        action,
        expectedDigest,
        path,
      })),
      diagnostics: plan.diagnostics,
    },
    null,
    2,
  ),
);
