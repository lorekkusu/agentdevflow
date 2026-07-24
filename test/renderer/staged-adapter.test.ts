import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import type {
  OwnershipClaim,
  RenderReadWorkspace,
  RenderRequest,
  StagedRender,
  StagingRenderer,
} from "../../src/renderer/contract.js";
import {
  StagedRendererAdapter,
  verifyRenderPlan,
} from "../../src/renderer/staged-adapter.js";

const ownershipKey = "agentdevflow.renderer.native";

class MemoryWorkspace implements RenderReadWorkspace {
  readonly files = new Map<string, string>();

  constructor(initial: Readonly<Record<string, string>> = {}) {
    for (const [path, content] of Object.entries(initial)) {
      this.files.set(path, content);
    }
  }

  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

}

function backend(result: StagedRender): StagingRenderer {
  return {
    name: "native-fixture",
    version: "1",
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
  existingTargetReplacements: RenderRequest["existingTargetReplacements"] = [],
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
    existingTargetReplacements,
  };
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

test("plans deterministic creates for owned files", async () => {
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

  for (const file of plan.files) {
    if (file.expectedContent !== null) {
      workspace.files.set(file.path, file.expectedContent);
    }
  }
  assert.equal((await verifyRenderPlan(plan, workspace)).ok, true);
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

test("authorizes explicit whole-file replacement only for exact unmanaged bytes", async () => {
  const workspace = new MemoryWorkspace({ "AGENTS.md": "Existing policy.\n" });
  const adapter = new StagedRendererAdapter(
    backend({
      files: [{ path: "AGENTS.md", content: "Generated policy.\n" }],
      diagnostics: [],
    }),
  );
  const authorization = {
    path: "AGENTS.md",
    observedDigest: digest("Existing policy.\n"),
    targetDigest: digest("Generated policy.\n"),
  };
  const exact = await adapter.plan(
    request({}, [], [], [authorization]),
    workspace,
  );
  assert.equal(exact.safeToApply, true);
  assert.equal(exact.files[0]?.action, "update");

  const stale = await adapter.plan(
    request({}, [], [], [
      { ...authorization, observedDigest: digest("Changed policy.\n") },
    ]),
    workspace,
  );
  assert.equal(stale.safeToApply, false);
  assert.equal(stale.files[0]?.action, "conflict");
  assert.deepEqual(
    stale.diagnostics.map((diagnostic) => diagnostic.code),
    [
      "EXISTING_TARGET_REPLACEMENT_STALE",
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
  const verify = await verifyRenderPlan(plan, workspace);

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
  assert.equal((await verifyRenderPlan(plan, workspace)).ok, true);
});
