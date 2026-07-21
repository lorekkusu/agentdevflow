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
    await mkdir(join(root, ".github", "workflows"), { recursive: true });
    await mkdir(join(root, "src", "interface"), { recursive: true });
    await mkdir(join(root, "src", "other"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await copyFile(
      resolve(".github/workflows/publish.yml"),
      join(root, ".github", "workflows", "publish.yml"),
    );
    await writeFile(join(root, "SECURITY.md"), "# Security Policy\n");
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

test("requires a root security policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-security-policy-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);

    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /REQUIRED_ROOT_FILE_MISSING/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("limits write access to the manual npm publish workflow", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-publish-workflow-"));
  const allowedWorkflow = `name: Publish npm beta
on:
  workflow_dispatch:
permissions:
  contents: read
  id-token: write
jobs:
  publish:
    environment: npm-publish
    steps:
      - run: npm publish --access public --tag next --provenance
`;
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, ".github", "workflows"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    const workflow = join(root, ".github", "workflows", "publish.yml");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await writeFile(join(root, "SECURITY.md"), "# Security Policy\n");
    await writeFile(workflow, allowedWorkflow);

    const allowed = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(allowed.status, 0, allowed.stderr);

    await writeFile(
      workflow,
      allowedWorkflow.replace("contents: read", "contents: write"),
    );
    const writableContents = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(writableContents.status, 1);
    assert.match(writableContents.stderr, /WORKFLOW_WRITE_PERMISSION/u);

    await writeFile(
      workflow,
      allowedWorkflow.replace(
        "      - run: npm publish --access public --tag next --provenance",
        `      - run: npm publish --access public --tag next --provenance
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}`,
      ),
    );
    const unexpectedSecret = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(unexpectedSecret.status, 1);
    assert.match(unexpectedSecret.stderr, /WORKFLOW_SECRET_UNEXPECTED/u);

    await writeFile(
      workflow,
      allowedWorkflow.replace("  workflow_dispatch:\n", "  workflow_dispatch:\n  push:\n"),
    );
    const automatic = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(automatic.status, 1);
    assert.match(automatic.stderr, /PUBLISH_WORKFLOW_AUTOMATIC_TRIGGER/u);
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

test("requires the accepted release-candidate package boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-package-boundary-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await writeFile(
      join(root, "package.json"),
      `${JSON.stringify({
        private: true,
        bin: { agentdevflow: "dist/src/other.js" },
        files: ["dist/src/transaction/"],
      })}\n`,
    );

    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /PACKAGE_PUBLICATION_GUARD_INVALID/u);
    assert.match(result.stderr, /PACKAGE_BETA_METADATA_INVALID/u);
    assert.match(result.stderr, /PACKAGE_LICENSE_INVALID/u);
    assert.match(result.stderr, /PACKAGE_BIN_INVALID/u);
    assert.match(result.stderr, /PACKAGE_ALLOWLIST_TOO_BROAD/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
