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

import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { createPrivateTemporaryMutationIntent } from "../../src/transaction/private-temporary-intent.js";
import {
  PrivateFilesystemWorkspace,
  PrivateFilesystemWorkspaceError,
  type PrivateFilesystemWorkspaceErrorCode,
} from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import { balancedCandidateConfig } from "../fixtures/config/specimens.js";

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agentdevflow-workspace-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function compile(input: unknown): CandidateCompilation {
  const result = compileCandidateProjectConfig(input, initialCompilerOptions);
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function ownedIntent(content: string, targetPath = "nested/AGENTS.md") {
  return createPrivateTemporaryMutationIntent({
    transactionDigest: "1".repeat(64),
    writerFingerprint: "2".repeat(64),
    targetPath,
    targetDigest: digest(content),
  });
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

test("writes, replaces, reads, and removes regular files within the root", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);

  assert.equal(await workspace.read("nested/AGENTS.md"), null);
  await workspace.writeAtomically("nested/AGENTS.md", "first\n");
  assert.equal(await workspace.read("nested/AGENTS.md"), "first\n");
  await workspace.writeAtomically("nested/AGENTS.md", "second\n");
  assert.equal(await workspace.read("nested/AGENTS.md"), "second\n");
  assert.deepEqual(await readdir(join(root, "nested")), ["AGENTS.md"]);

  await workspace.removeAtomically("nested/AGENTS.md");
  await workspace.removeAtomically("nested/AGENTS.md");
  assert.equal(await workspace.read("nested/AGENTS.md"), null);
});

test("publishes registered owned temporary files atomically", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);
  const content = "owned content\n";
  const intent = ownedIntent(content);
  const events: string[] = [];

  await workspace.writeAtomicallyOwned(intent, content, (event) => {
    events.push(event.kind);
  });

  assert.deepEqual(events, ["temporary-created", "temporary-synced"]);
  assert.equal(await workspace.read(intent.targetPath), content);
  assert.equal(await workspace.inspectOwnedTemporary(intent), "absent");
});

test("removes owned temporary files after cooperative write faults", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);
  const content = "owned content\n";

  for (const boundary of ["temporary-created", "temporary-synced"] as const) {
    const intent = ownedIntent(content, `${boundary}/AGENTS.md`);
    await assert.rejects(
      () =>
        workspace.writeAtomicallyOwned(intent, content, (event) => {
          if (event.kind === boundary) {
            throw new Error(`Injected fault at ${boundary}.`);
          }
        }),
      /Injected fault/u,
    );
    assert.equal(await workspace.inspectOwnedTemporary(intent), "absent");
    assert.equal(await workspace.read(intent.targetPath), null);
  }
});

test("inspects and reclaims only an exact registered regular temporary file", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);
  const intent = ownedIntent("complete content\n");
  await mkdir(join(root, "nested"));
  await writeFile(join(root, intent.temporaryPath), "partial", "utf8");

  assert.equal(await workspace.inspectOwnedTemporary(intent), "present");
  assert.equal(await workspace.removeOwnedTemporary(intent), "removed");
  assert.equal(await workspace.removeOwnedTemporary(intent), "absent");
  assert.equal(await workspace.read(intent.targetPath), null);
});

test(
  "rejects symbolic links and directories at registered temporary paths",
  async (t) => {
    const root = await temporaryDirectory(t);
    const outside = await temporaryDirectory(t);
    const workspace = await PrivateFilesystemWorkspace.open(root);
    const intent = ownedIntent("complete content\n");
    await mkdir(join(root, "nested"));
    await writeFile(join(outside, "foreign"), "foreign\n", "utf8");
    await symlink(join(outside, "foreign"), join(root, intent.temporaryPath));

    await rejectsWithCode(
      () => workspace.removeOwnedTemporary(intent),
      "WORKSPACE_PATH_SYMLINK",
    );
    assert.equal(await readFile(join(outside, "foreign"), "utf8"), "foreign\n");

    await rm(join(root, intent.temporaryPath));
    await mkdir(join(root, intent.temporaryPath));
    await rejectsWithCode(
      () => workspace.removeOwnedTemporary(intent),
      "WORKSPACE_PATH_NOT_FILE",
    );
  },
);

test("rejects invalid owned writes and existing temporary conflicts", async (t) => {
  const root = await temporaryDirectory(t);
  const workspace = await PrivateFilesystemWorkspace.open(root);
  const content = "owned content\n";
  const intent = ownedIntent(content);

  await rejectsWithCode(
    () => workspace.writeAtomicallyOwned(intent, "wrong content\n"),
    "WORKSPACE_OWNED_TEMPORARY_INVALID",
  );
  await rejectsWithCode(
    () =>
      workspace.writeAtomicallyOwned(
        { ...intent, digest: "0".repeat(64) },
        content,
      ),
    "WORKSPACE_OWNED_TEMPORARY_INVALID",
  );

  await mkdir(join(root, "nested"));
  await writeFile(join(root, intent.temporaryPath), "foreign\n", "utf8");
  await rejectsWithCode(
    () => workspace.writeAtomicallyOwned(intent, content),
    "WORKSPACE_OWNED_TEMPORARY_CONFLICT",
  );
  assert.equal(
    await readFile(join(root, intent.temporaryPath), "utf8"),
    "foreign\n",
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

test("creates exclusive files and only removes matching ownership content", async (t) => {
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
  assert.equal(
    await workspace.removeIfContentMatches(
      "private/writer.lock",
      "owner-b\n",
    ),
    false,
  );
  assert.equal(
    await workspace.removeIfContentMatches(
      "private/writer.lock",
      "owner-a\n",
    ),
    true,
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
      () => workspace.writeAtomically("linked-parent/target.md", "changed\n"),
      () => workspace.removeAtomically("linked-parent/target.md"),
    ]) {
      await rejectsWithCode(operation, "WORKSPACE_PATH_SYMLINK");
    }

    await symlink(join(outside, "target.md"), join(root, "linked-file"));
    for (const operation of [
      () => workspace.read("linked-file"),
      () => workspace.writeAtomically("linked-file", "changed\n"),
      () => workspace.removeAtomically("linked-file"),
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
    () => workspace.writeAtomically("directory", "content\n"),
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
  const compilation = compile(balancedCandidateConfig);
  const materialization = materializeCompilation(compilation);
  const adapter = new StagedRendererAdapter(
    new NativeProjectInstructionsRenderer(materialization),
  );
  const plan = await adapter.plan(
    renderRequestFromMaterialization(compilation, materialization),
    workspace,
  );

  assert.equal(plan.safeToApply, true);
  const result = await adapter.render(plan, workspace);
  assert.deepEqual(result.written, [
    ".cursor/rules/agentdevflow.mdc",
    "AGENTS.md",
    "CLAUDE.md",
  ]);
  assert.equal((await adapter.verify(plan, workspace)).ok, true);
  assert.match(await readFile(join(root, "AGENTS.md"), "utf8"), /Developer/u);
});
