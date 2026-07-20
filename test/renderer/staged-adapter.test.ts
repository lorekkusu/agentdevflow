import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type {
  OwnershipClaim,
  RenderRequest,
  RenderWorkspace,
  StagedRender,
  StagingRenderer,
} from "../../src/renderer/contract.js";
import { RulesyncProcessRenderer } from "../../src/renderer/rulesync-process.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";

const ownershipKey = "agentdevflow.renderer.rulesync";

class MemoryWorkspace implements RenderWorkspace {
  readonly files = new Map<string, string>();

  constructor(initial: Readonly<Record<string, string>> = {}) {
    for (const [path, content] of Object.entries(initial)) {
      this.files.set(path, content);
    }
  }

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async writeAtomically(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async removeAtomically(path: string): Promise<void> {
    this.files.delete(path);
  }
}

function backend(result: StagedRender): StagingRenderer {
  return {
    name: "rulesync",
    version: "9.6.3",
    ownershipKey,
    async stage() {
      return result;
    },
  };
}

function request(
  ownership: Readonly<Record<string, OwnershipClaim>> = {},
  adoptPaths: readonly string[] = [],
  initializationImports: RenderRequest["initializationImports"] = [],
): RenderRequest {
  return {
    inputDigest: "fixture-input",
    sourceDigest: "fixture-source",
    providers: ["codex", "claude-code", "cursor"],
    capabilities: ["rules"],
    sourceFiles: ["rules/overview.md"],
    ownership,
    adoptPaths,
    initializationImports,
  };
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

test("plans deterministic creates and renders owned files", async () => {
  const workspace = new MemoryWorkspace();
  const adapter = new StagedRendererAdapter(
    backend({
      files: [
        {
          path: "CLAUDE.md",
          content: "generated\n",
          sourceRefs: ["rules/overview.md"],
        },
        {
          path: "AGENTS.md",
          content: "generated\n",
          sourceRefs: ["rules/overview.md"],
        },
      ],
      diagnostics: [],
    }),
  );

  const plan = await adapter.plan(request(), workspace);
  assert.equal(plan.safeToApply, true);
  assert.deepEqual(
    plan.files.map(({ action, path }) => ({ action, path })),
    [
      { action: "create", path: "AGENTS.md" },
      { action: "create", path: "CLAUDE.md" },
    ],
  );

  const result = await adapter.render(plan, workspace);
  assert.deepEqual(result.written, ["AGENTS.md", "CLAUDE.md"]);
  assert.equal((await adapter.verify(plan, workspace)).ok, true);
  assert.equal(result.ownership["AGENTS.md"]?.owner, ownershipKey);
});

test("rejects a hand-written provider file unless adoption is explicit and exact", async () => {
  const workspace = new MemoryWorkspace({ "CLAUDE.md": "hand-written\n" });
  const adapter = new StagedRendererAdapter(
    backend({
      files: [{ path: "CLAUDE.md", content: "generated\n" }],
      diagnostics: [],
    }),
  );

  const plan = await adapter.plan(request(), workspace);
  assert.equal(plan.safeToApply, false);
  assert.equal(plan.files[0]?.action, "conflict");
  assert.equal(plan.diagnostics[0]?.code, "OWNERSHIP_CONFLICT");

  const exactWorkspace = new MemoryWorkspace({ "CLAUDE.md": "generated\n" });
  const adoption = await adapter.plan(
    request({}, ["CLAUDE.md"]),
    exactWorkspace,
  );
  assert.equal(adoption.safeToApply, true);
  assert.equal(adoption.files[0]?.action, "unchanged");
});

test("authorizes initialization import only for exact observed and target digests", async () => {
  const workspace = new MemoryWorkspace({ "CLAUDE.md": "existing\n" });
  const adapter = new StagedRendererAdapter(
    backend({
      files: [{ path: "CLAUDE.md", content: "generated\n" }],
      diagnostics: [],
    }),
  );
  const authorization = {
    path: "CLAUDE.md",
    observedDigest: digest("existing\n"),
    targetDigest: digest("generated\n"),
  };
  const exact = await adapter.plan(request({}, [], [authorization]), workspace);
  assert.equal(exact.safeToApply, true);
  assert.equal(exact.files[0]?.action, "update");

  const stale = await adapter.plan(
    request({}, [], [
      { ...authorization, observedDigest: digest("different\n") },
    ]),
    workspace,
  );
  assert.equal(stale.safeToApply, false);
  assert.equal(stale.files[0]?.action, "conflict");
  assert.deepEqual(
    stale.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "INITIALIZATION_IMPORT_STALE",
      "OWNERSHIP_CONFLICT",
      "TRACEABILITY_UNAVAILABLE",
    ],
  );
});

test("rejects drift when an owned generated file was modified", async () => {
  const workspace = new MemoryWorkspace({ "CLAUDE.md": "modified\n" });
  const adapter = new StagedRendererAdapter(
    backend({
      files: [{ path: "CLAUDE.md", content: "next\n" }],
      diagnostics: [],
    }),
  );
  const plan = await adapter.plan(
    request({
      "CLAUDE.md": {
        owner: ownershipKey,
        digest:
          "a42a6c7fb63a73e350b09cd00b3bf82bf150383f7f5d9dde97083523a12f360b",
      },
    }),
    workspace,
  );

  assert.equal(plan.safeToApply, false);
  assert.equal(plan.files[0]?.action, "conflict");
  await assert.rejects(
    adapter.render(plan, workspace),
    /Refusing to apply an unsafe render plan/,
  );
});

test("fails visibly when the staging backend reports an unsupported capability", async () => {
  const workspace = new MemoryWorkspace();
  const adapter = new StagedRendererAdapter(
    backend({
      files: [],
      diagnostics: [
        {
          code: "UNSUPPORTED_CAPABILITY",
          severity: "error",
          message: "Codex project commands require simulation.",
          provider: "codex",
          capability: "commands",
        },
      ],
    }),
  );

  const plan = await adapter.plan(
    { ...request(), capabilities: ["commands"] },
    workspace,
  );
  assert.equal(plan.safeToApply, false);
  assert.equal(plan.diagnostics[0]?.code, "UNSUPPORTED_CAPABILITY");
});

test("the Rulesync process boundary rejects unsupported capabilities before spawning", async () => {
  const renderer = new RulesyncProcessRenderer({
    command: "this-command-must-not-run",
    prefixArgs: [],
    inputRoot: ".",
    configPath: "rulesync.jsonc",
    version: "9.6.3",
  });
  const staged = await renderer.stage({
    ...request(),
    providers: ["codex"],
    capabilities: ["commands"],
  });

  assert.deepEqual(staged.files, []);
  assert.equal(staged.diagnostics[0]?.code, "UNSUPPORTED_CAPABILITY");
  assert.equal(staged.diagnostics[0]?.severity, "error");
});

test("reports deterministic path-specific verify diagnostics", async () => {
  const workspace = new MemoryWorkspace();
  const adapter = new StagedRendererAdapter(
    backend({
      files: [
        {
          path: "CLAUDE.md",
          content: "generated\n",
          sourceRefs: ["rules/overview.md"],
        },
        {
          path: "AGENTS.md",
          content: "generated\n",
          sourceRefs: ["rules/overview.md"],
        },
      ],
      diagnostics: [],
    }),
  );
  const plan = await adapter.plan(request(), workspace);
  const verify = await adapter.verify(plan, workspace);

  assert.equal(verify.ok, false);
  assert.deepEqual(
    verify.diagnostics.map(({ code, path }) => ({ code, path })),
    [
      { code: "GENERATED_FILE_DRIFT", path: "AGENTS.md" },
      { code: "GENERATED_FILE_DRIFT", path: "CLAUDE.md" },
    ],
  );
});

test("clears an ownership claim when the obsolete generated file is already absent", async () => {
  const workspace = new MemoryWorkspace();
  const adapter = new StagedRendererAdapter(
    backend({ files: [], diagnostics: [] }),
  );
  const ownership = {
    "obsolete.md": {
      owner: ownershipKey,
      digest: "0".repeat(64),
    },
  };

  const plan = await adapter.plan(request(ownership), workspace);
  assert.equal(plan.safeToApply, true);
  assert.deepEqual(
    plan.files.map(({ action, path }) => ({ action, path })),
    [{ action: "delete", path: "obsolete.md" }],
  );
  const result = await adapter.render(plan, workspace);
  assert.deepEqual(result.ownership, {});
  assert.equal((await adapter.verify(plan, workspace)).ok, true);
});
