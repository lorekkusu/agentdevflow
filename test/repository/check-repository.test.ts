import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function sideEffectImport(specifier: string): string {
  return `import ${JSON.stringify(specifier)};\n`;
}

function defaultImport(specifier: string): string {
  return `import dependency from ${JSON.stringify(specifier)};\nvoid dependency;\n`;
}

function dynamicImport(specifier: string): string {
  return `const dependency = import(${JSON.stringify(specifier)});\nvoid dependency;\n`;
}

function commonJsRequire(specifier: string): string {
  return `const dependency = require(${JSON.stringify(specifier)});\nvoid dependency;\n`;
}

test("enforces dependency boundaries for direct import forms", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-repository-audit-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "src", "interface"), { recursive: true });
    await mkdir(join(root, "src", "other"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await writeFile(
      join(root, "src", "interface", "private-zod.ts"),
      sideEffectImport("zod"),
    );
    await writeFile(
      join(root, "src", "interface", "private-domain-project-document.ts"),
      dynamicImport("jsonc-parser"),
    );

    const allowed = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(allowed.status, 0, allowed.stderr);

    const bypassPath = join(root, "src", "other", "bypass.ts");
    for (const source of [
      sideEffectImport("zod"),
      defaultImport("zod"),
      dynamicImport("jsonc-parser"),
      commonJsRequire("zod/v4"),
    ]) {
      await writeFile(bypassPath, source);
      const bypassed = spawnSync(process.execPath, [script], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(bypassed.status, 1, source);
      assert.match(bypassed.stderr, /DEPENDENCY_BOUNDARY_BYPASSED/u);
      await unlink(bypassPath);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
