import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { type TestContext } from "node:test";

import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { applyPrivateConvergentRenderPlan } from "../../src/renderer/private-convergent-apply.js";
import {
  StagedRendererAdapter,
  verifyRenderPlan,
} from "../../src/renderer/staged-adapter.js";
import {
  PrivateFilesystemWorkspace,
  PrivateFilesystemWorkspaceError,
  type PrivateFilesystemWorkspaceErrorCode,
} from "../../src/workspace/private-filesystem-workspace.js";
import { createPrivateDomainProjectFixture } from "../fixtures/project/private-domain-project.js";

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function removalDigests(content: string) {
  return {
    beforeDigest: digest(content),
    afterDigest: null,
  } as const;
}

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agentdevflow-workspace-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function rejectsWithCode(
  operation: () => Promise<unknown>,
  code: PrivateFilesystemWorkspaceErrorCode,
): Promise<void> {
  return assert.rejects(operation, (error: unknown) => {
    assert.equal(error instanceof PrivateFilesystemWorkspaceError, true);
    assert.equal((error as PrivateFilesystemWorkspaceError).code, code);
    return true;
  });
}

test("creates, reads, and removes regular files within the root", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);

  assert.equal(await workspace.read("nested/AGENTS.md"), null);
  assert.equal(
    await workspace.createExclusively("nested/AGENTS.md", "first\n"),
    true,
  );
  assert.equal(await workspace.read("nested/AGENTS.md"), "first\n");
  assert.deepEqual(await readdir(join(root, "nested")), ["AGENTS.md"]);

  assert.equal(
    await workspace.removeAtomically(
      "nested/AGENTS.md",
      removalDigests("first\n"),
    ),
    "applied",
  );
  assert.equal(
    await workspace.removeAtomically(
      "nested/AGENTS.md",
      removalDigests("first\n"),
    ),
    "already-applied",
  );
  assert.equal(await workspace.read("nested/AGENTS.md"), null);
});

test("opens a hardened read-only view without exposing mutation methods", async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(join(root, "AGENTS.md"), "observed\n", "utf8");
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(root);

  assert.equal(await workspace.read("AGENTS.md"), "observed\n");
  assert.equal("writeAtomically" in workspace, false);
  assert.equal("removeAtomically" in workspace, false);
  assert.equal("listDirectoryBounded" in workspace, true);
  await assert.rejects(
    () => workspace.read("../outside"),
    (error: unknown) =>
      error instanceof PrivateFilesystemWorkspaceError &&
      error.code === "UNSAFE_WORKSPACE_PATH",
  );
});

test("enumerates directory entries deterministically within an explicit bound", async (t) => {
  const root = await temporaryDirectory(t);
  const rules = join(root, ".agentdevflow", "rules", "shared");
  await mkdir(join(rules, "archive"), { recursive: true });
  await writeFile(join(rules, "zeta.md"), "zeta\n", "utf8");
  await writeFile(join(rules, "alpha.txt"), "alpha\n", "utf8");
  await symlink(join(rules, "zeta.md"), join(rules, "linked.md"));
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(root);

  assert.equal(
    await workspace.listDirectoryBounded(".agentdevflow/missing", 10),
    null,
  );
  assert.deepEqual(
    await workspace.listDirectoryBounded(
      ".agentdevflow/rules/shared",
      4,
    ),
    [
      { name: "alpha.txt", kind: "file" },
      { name: "archive", kind: "directory" },
      { name: "linked.md", kind: "symbolic-link" },
      { name: "zeta.md", kind: "file" },
    ],
  );
  await rejectsWithCode(
    () =>
      workspace.listDirectoryBounded(
        ".agentdevflow/rules/shared",
        3,
      ),
    "WORKSPACE_DIRECTORY_TOO_LARGE",
  );
  await rejectsWithCode(
    () =>
      workspace.listDirectoryBounded(
        ".agentdevflow/rules/shared/zeta.md",
        1,
      ),
    "WORKSPACE_PATH_NOT_DIRECTORY",
  );
  await assert.rejects(
    () => workspace.listDirectoryBounded(".agentdevflow/rules/shared", -1),
    /non-negative safe integer/u,
  );
});

test("reads bounded UTF-8 bytes without first accepting oversized content", async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(join(root, "exact.txt"), "four", "utf8");
  await writeFile(
    join(root, "invalid.txt"),
    Buffer.from([0xc3, 0x28]),
  );
  const workspace = await PrivateFilesystemWorkspace.openReadOnly(root);

  assert.equal(await workspace.readBounded("missing.txt", 0), null);
  assert.equal(await workspace.readBounded("exact.txt", 4), "four");
  await rejectsWithCode(
    () => workspace.readBounded("exact.txt", 3),
    "WORKSPACE_FILE_TOO_LARGE",
  );
  await rejectsWithCode(
    () => workspace.readBounded("invalid.txt", 2),
    "WORKSPACE_FILE_INVALID_UTF8",
  );
  await assert.rejects(
    () => workspace.readBounded("exact.txt", -1),
    /non-negative safe integer/u,
  );
});

test("requires an existing non-symlink directory as the workspace root", async (t) => {
  const container = await temporaryDirectory(t);
  const fileRoot = join(container, "file-root");
  await writeFile(fileRoot, "content\n", "utf8");

  await rejectsWithCode(
    () => PrivateFilesystemWorkspace.open(join(container, "missing")),
    "WORKSPACE_ROOT_NOT_DIRECTORY",
  );
  await rejectsWithCode(
    () => PrivateFilesystemWorkspace.open(fileRoot),
    "WORKSPACE_ROOT_NOT_DIRECTORY",
  );
});

test("creates exclusive files without overwriting existing content", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);

  assert.equal(
    await workspace.createExclusively("private/writer.lock", "owner-a\n"),
    true,
  );
  assert.equal(
    await workspace.createExclusively("private/writer.lock", "owner-b\n"),
    false,
  );
  assert.equal(await workspace.read("private/writer.lock"), "owner-a\n");
  await workspace.removeAtomically(
    "private/writer.lock",
    removalDigests("owner-a\n"),
  );
  assert.equal(await workspace.read("private/writer.lock"), null);
});

test("rejects non-canonical and escaping relative paths", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);
  const unsafePaths = [
    "",
    ".",
    "..",
    "../outside",
    "/absolute",
    "nested/../outside",
    "nested//file",
    "nested\\file",
    " trailing",
    "trailing ",
    "line\nbreak",
  ];

  for (const path of unsafePaths) {
    await rejectsWithCode(
      () => workspace.read(path),
      "UNSAFE_WORKSPACE_PATH",
    );
  }
});

test(
  "rejects symbolic-link roots, parents, and files without touching their targets",
  async (t) => {
    const container = await temporaryDirectory(t);
    const root = join(container, "root");
    const outside = join(container, "outside");
    await mkdir(root);
    await mkdir(outside);
    await writeFile(join(outside, "target.md"), "outside\n", "utf8");

    const rootLink = join(container, "root-link");
    await symlink(root, rootLink, "dir");
    await rejectsWithCode(
      () => PrivateFilesystemWorkspace.open(rootLink),
      "WORKSPACE_ROOT_SYMLINK",
    );

    const workspace = await PrivateFilesystemWorkspace.open(root);
    await symlink(outside, join(root, "linked-parent"), "dir");
    for (const operation of [
      () => workspace.read("linked-parent/target.md"),
      () => workspace.listDirectoryBounded("linked-parent", 1),
      () =>
        workspace.removeAtomically(
          "linked-parent/target.md",
          removalDigests("outside\n"),
        ),
    ]) {
      await rejectsWithCode(operation, "WORKSPACE_PATH_SYMLINK");
    }

    await symlink(join(outside, "target.md"), join(root, "linked-file"));
    for (const operation of [
      () => workspace.read("linked-file"),
      () => workspace.listDirectoryBounded("linked-file", 1),
      () =>
        workspace.removeAtomically(
          "linked-file",
          removalDigests("outside\n"),
        ),
    ]) {
      await rejectsWithCode(operation, "WORKSPACE_PATH_SYMLINK");
    }

    assert.equal(
      await readFile(join(outside, "target.md"), "utf8"),
      "outside\n",
    );
  },
);

test("rejects directories as files and files as parent directories", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);
  await mkdir(join(root, "directory"));
  await writeFile(join(root, "parent-file"), "content\n", "utf8");

  await rejectsWithCode(
    () => workspace.read("directory"),
    "WORKSPACE_PATH_NOT_FILE",
  );
  await rejectsWithCode(
    () => workspace.read("parent-file/child"),
    "WORKSPACE_PARENT_NOT_DIRECTORY",
  );
});

test("implements the renderer workspace contract in a temporary repository", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);
  const { materialization, request } = createPrivateDomainProjectFixture();
  const adapter = new StagedRendererAdapter(
    new NativeProjectInstructionsRenderer(materialization),
  );
  const plan = await adapter.plan(request, workspace);

  assert.equal(plan.safeToApply, true);
  const result = await applyPrivateConvergentRenderPlan(plan, workspace);
  assert.deepEqual(result.written, [
    ".cursor/rules/agentdevflow.mdc",
    "AGENTS.md",
    "CLAUDE.md",
  ]);
  assert.equal((await verifyRenderPlan(plan, workspace)).ok, true);
  assert.match(await readFile(join(root, "AGENTS.md"), "utf8"), /Developer/u);
});
