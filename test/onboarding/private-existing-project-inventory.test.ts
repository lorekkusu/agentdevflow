import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  executePrivateExistingProjectInventory,
  privateExistingProjectInstructionMaxBytes,
} from "../../src/onboarding/private-existing-project-inventory.js";

class MemoryInventoryWorkspace {
  constructor(
    private readonly files: Readonly<Record<string, string>> = {},
    private readonly failures: ReadonlySet<string> = new Set(),
  ) {}

  async readBounded(path: string, maxBytes: number): Promise<string | null> {
    if (this.failures.has(path)) {
      throw new Error(`Unreadable fixture: ${path}`);
    }
    const content = this.files[path] ?? null;
    if (
      content !== null &&
      Buffer.byteLength(content, "utf8") > maxBytes
    ) {
      throw new Error(`Oversized fixture: ${path}`);
    }
    return content;
  }
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

test("inventories only fixed native targets with exact unmanaged bytes", async () => {
  const result = await executePrivateExistingProjectInventory({
    lockPath: ".agentdevflow/lock.json",
    workspace: new MemoryInventoryWorkspace({
      "AGENTS.md": "Shared guidance.\n",
      "CLAUDE.md": "Reviewer guidance.",
      ".cursor/rules/unrelated.mdc": "Not in the bounded inventory.\n",
    }),
  });

  assert.equal(result.outcome, "inventory");
  if (result.outcome !== "inventory") return;
  assert.deepEqual(
    result.targets.map(
      ({ path, disposition, classification, byteCount, observedDigest }) => ({
        path,
        disposition,
        classification,
        byteCount,
        observedDigest,
      }),
    ),
    [
      {
        path: ".cursor/rules/agentdevflow.mdc",
        disposition: "absent",
        classification: "not-applicable",
        byteCount: null,
        observedDigest: null,
      },
      {
        path: "AGENTS.md",
        disposition: "unmanaged-existing",
        classification: "unclassified",
        byteCount: 17,
        observedDigest: digest("Shared guidance.\n"),
      },
      {
        path: "CLAUDE.md",
        disposition: "unmanaged-existing",
        classification: "unclassified",
        byteCount: 18,
        observedDigest: digest("Reviewer guidance."),
      },
    ],
  );
});

test("fails without partial inventory on unreadable or oversized targets", async () => {
  const unreadable = await executePrivateExistingProjectInventory({
    lockPath: ".agentdevflow/lock.json",
    workspace: new MemoryInventoryWorkspace(
      { "AGENTS.md": "Visible.\n" },
      new Set(["CLAUDE.md"]),
    ),
  });
  assert.equal(unreadable.outcome, "blocked");
  assert.equal(unreadable.targets, null);
  assert.equal(
    unreadable.diagnostics[0]?.code,
    "ONBOARD_TARGET_READ_FAILED",
  );

  const oversized = await executePrivateExistingProjectInventory({
    lockPath: ".agentdevflow/lock.json",
    workspace: new MemoryInventoryWorkspace({
      "AGENTS.md": "x".repeat(
        privateExistingProjectInstructionMaxBytes + 1,
      ),
    }),
  });
  assert.equal(oversized.outcome, "blocked");
  assert.equal(oversized.targets, null);
  assert.equal(
    oversized.diagnostics[0]?.code,
    "ONBOARD_TARGET_READ_FAILED",
  );
});

test("fails closed for an invalid ownership lock", async () => {
  const result = await executePrivateExistingProjectInventory({
    lockPath: ".agentdevflow/lock.json",
    workspace: new MemoryInventoryWorkspace({
      ".agentdevflow/lock.json": "{}\n",
      "AGENTS.md": "Existing.\n",
    }),
  });
  assert.equal(result.outcome, "blocked");
  assert.equal(result.targets, null);
  assert.equal(result.diagnostics[0]?.code, "ONBOARD_LOCK_INVALID");
});
