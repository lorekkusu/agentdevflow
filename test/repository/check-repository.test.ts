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

test("keeps project resolution independent from execution exports", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-project-boundary-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "src", "project"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await writeFile(
      join(root, "src", "project", "bypass.ts"),
      defaultImport("../execution/private-execution-contract.js"),
    );

    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PROJECT_EXECUTION_BOUNDARY_BYPASSED/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps normal source independent from frozen transaction code", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-transaction-boundary-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "src", "workspace"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await writeFile(
      join(root, "src", "workspace", "bypass.ts"),
      defaultImport("../transaction/private-render-transaction.js"),
    );

    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /FROZEN_TRANSACTION_BOUNDARY_BYPASSED/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("requires a private allowlisted package boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-package-boundary-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({
        private: false,
        bin: { agentdevflow: "dist/src/other.js" },
        files: ["dist/src/transaction/"],
      })}\n`,
    );

    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PACKAGE_PUBLICATION_ENABLED/u);
    assert.match(result.stderr, /PACKAGE_BETA_METADATA_INVALID/u);
    assert.match(result.stderr, /PACKAGE_LICENSE_INVALID/u);
    assert.match(result.stderr, /PACKAGE_BIN_INVALID/u);
    assert.match(result.stderr, /PACKAGE_ALLOWLIST_TOO_BROAD/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
