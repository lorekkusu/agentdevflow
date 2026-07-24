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

async function writeGovernanceFiles(root: string): Promise<void> {
  await mkdir(join(root, ".claude"), { recursive: true });
  await writeFile(join(root, ".claude", "CLAUDE.md"), "@../AGENTS.md\n");
  await writeFile(
    join(root, "AGENTS.md"),
    "# Repository guidance\n\n## Product, authority, and design gate\n\nUse `ROADMAP.md`.\n\n## Roadmap governance and independent review\n\nReview independently.\n",
  );
  await writeFile(
    join(root, "ROADMAP.md"),
    "# Product roadmap\n\n## Product objective\n\n## Current sequence\n\n## Explicitly out of scope\n\n## Open decisions\n\n## Completed summary\n",
  );
  await writeFile(join(root, "SECURITY.md"), "# Security Policy\n");
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
    await writeGovernanceFiles(root);
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

test("requires the exact Claude Code guidance adapter", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-claude-guidance-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, ".github", "workflows"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await copyFile(
      resolve(".github/workflows/publish.yml"),
      join(root, ".github", "workflows", "publish.yml"),
    );
    await writeGovernanceFiles(root);

    await unlink(join(root, ".claude", "CLAUDE.md"));
    const missing = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(missing.status, 1);
    assert.match(
      missing.stderr,
      /\.claude\/CLAUDE\.md:1 REQUIRED_ROOT_FILE_MISSING/u,
    );

    await writeFile(join(root, ".claude", "CLAUDE.md"), "@AGENTS.md\n");
    const drifted = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(drifted.status, 1);
    assert.match(drifted.stderr, /CLAUDE_GUIDANCE_ADAPTER_INVALID/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("requires root roadmap governance and rejects the former duplicate path", async () => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-roadmap-boundary-"));
  try {
    await mkdir(join(root, "scripts"), { recursive: true });
    await mkdir(join(root, "docs", "development"), { recursive: true });
    const script = join(root, "scripts", "check-repository.mjs");
    await copyFile(resolve("scripts/check-repository.mjs"), script);
    await writeGovernanceFiles(root);
    await writeFile(
      join(root, "docs", "development", "roadmap.md"),
      "# Development roadmap\n",
    );

    const duplicate = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /FORMER_ROADMAP_PATH_FORBIDDEN/u);

    await unlink(join(root, "docs", "development", "roadmap.md"));
    await writeFile(join(root, "AGENTS.md"), "# Repository guidance\n");
    const missingGovernance = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(missingGovernance.status, 1);
    assert.match(missingGovernance.stderr, /ROADMAP_GOVERNANCE_MISSING/u);

    await writeGovernanceFiles(root);
    await writeFile(
      join(root, "ROADMAP.md"),
      "# Product roadmap\n\n## Current sequence\n\n## Completed summary\n",
    );
    const missingAuthority = spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(missingAuthority.status, 1);
    assert.match(
      missingAuthority.stderr,
      /ROADMAP_AUTHORITY_STRUCTURE_MISSING/u,
    );
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
    await writeGovernanceFiles(root);
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
    assert.match(result.stderr, /PACKAGE_BIN_PREPARATION_INVALID/u);
    assert.match(result.stderr, /PACKAGE_ENTRYPOINT_CHECK_INVALID/u);
    assert.match(result.stderr, /PACKAGE_GETTING_STARTED_MISSING/u);
    assert.match(result.stderr, /PACKAGE_ALLOWLIST_TOO_BROAD/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
