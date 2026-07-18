import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import {
  applyPrivateConvergentRenderPlan,
  PrivateConvergentApplyError,
  type PrivateConvergentApplyEvent,
} from "../../src/renderer/private-convergent-apply.js";
import type {
  RenderPlan,
  RenderRequest,
  StagingRenderer,
} from "../../src/renderer/contract.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { createPrivateConvergentMutationIntent } from "../../src/workspace/private-convergent-intent.js";
import {
  PrivateFilesystemWorkspace,
  PrivateFilesystemWorkspaceError,
} from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import { balancedCandidateConfig } from "../fixtures/config/specimens.js";

async function temporaryDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agentdevflow-convergent-"));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function compile(): CandidateCompilation {
  const result = compileCandidateProjectConfig(
    balancedCandidateConfig,
    initialCompilerOptions,
  );
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
}

async function createPlan(root: string): Promise<{
  readonly plan: RenderPlan;
  readonly request: RenderRequest;
  readonly renderer: NativeProjectInstructionsRenderer;
}> {
  const compilation = compile();
  const materialization = materializeCompilation(compilation);
  const renderer = new NativeProjectInstructionsRenderer(materialization);
  const adapter = new StagedRendererAdapter(renderer);
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(root);
  const request = renderRequestFromMaterialization(compilation, materialization);
  return {
    plan: await adapter.plan(request, workspace),
    request,
    renderer,
  };
}

async function privateTemporaryPaths(root: string): Promise<readonly string[]> {
  const paths: string[] = [];
  async function visit(directory: string, prefix = ""): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        await visit(join(directory, entry.name), relative);
      } else if (entry.name.includes(".agentdevflow-converge-")) {
        paths.push(relative);
      }
    }
  }
  await visit(root);
  return paths.sort();
}

test("converges after every cooperative write boundary", async (t) => {
  const paths = [".cursor/rules/agentdevflow.mdc", "AGENTS.md", "CLAUDE.md"];
  const kinds: readonly PrivateConvergentApplyEvent["kind"][] = [
    "temporary-ready",
    "temporary-synced",
    "target-replaced",
    "path-applied",
  ];

  for (const path of paths) {
    for (const kind of kinds) {
      await t.test(`${kind}:${path}`, async (boundaryTest) => {
        const root = await temporaryDirectory(boundaryTest);
        const { plan } = await createPlan(root);
        const workspace =
          await PrivateFilesystemWorkspace.openForProcessTermination(root);
        await assert.rejects(
          () =>
            applyPrivateConvergentRenderPlan(plan, workspace, (event) => {
              if (event.kind === kind && event.path === path) {
                throw new Error(`Injected fault at ${kind}:${path}.`);
              }
            }),
          /Injected fault/u,
        );

        const resumed =
          await PrivateFilesystemWorkspace.openForProcessTermination(root);
        const result = await applyPrivateConvergentRenderPlan(plan, resumed);
        assert.equal(result.planDigest, plan.planDigest);
        for (const file of plan.files) {
          assert.equal(await resumed.read(file.path), file.expectedContent);
        }
        assert.deepEqual(await privateTemporaryPaths(root), []);
        assert.deepEqual(
          await applyPrivateConvergentRenderPlan(plan, resumed),
          {
            planDigest: plan.planDigest,
            written: [],
            removed: [],
            ownership: result.ownership,
          },
        );
      });
    }
  }
});

test("fails all-path preflight before mutation on foreign target drift", async (t) => {
  const root = await temporaryDirectory(t);
  const { plan } = await createPlan(root);
  await writeFile(join(root, "CLAUDE.md"), "foreign\n", "utf8");
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(root);

  await assert.rejects(
    () => applyPrivateConvergentRenderPlan(plan, workspace),
    (error: unknown) => {
      assert.equal(error instanceof PrivateConvergentApplyError, true);
      assert.equal(
        (error as PrivateConvergentApplyError).code,
        "CONVERGENT_PATH_DRIFT",
      );
      assert.equal((error as PrivateConvergentApplyError).path, "CLAUDE.md");
      return true;
    },
  );
  assert.equal(await workspace.read("AGENTS.md"), null);
  assert.equal(await workspace.read(".cursor/rules/agentdevflow.mdc"), null);
});

test("reclaims only a regular deterministic temporary path", async (t) => {
  const root = await temporaryDirectory(t);
  const { plan } = await createPlan(root);
  const first = plan.files[0];
  assert.ok(first?.expectedDigest);
  const intent = createPrivateConvergentMutationIntent({
    planDigest: plan.planDigest,
    targetPath: first.path,
    targetDigest: first.expectedDigest,
  });
  await mkdir(join(root, ".cursor", "rules"), { recursive: true });
  await writeFile(join(root, intent.temporaryPath), "partial\n", "utf8");
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(root);
  await applyPrivateConvergentRenderPlan(plan, workspace);
  assert.deepEqual(await privateTemporaryPaths(root), []);
  assert.equal(await workspace.read(first.path), first.expectedContent);

  const otherRoot = await temporaryDirectory(t);
  const otherPlan = (await createPlan(otherRoot)).plan;
  const otherFirst = otherPlan.files[0];
  assert.ok(otherFirst?.expectedDigest);
  const otherIntent = createPrivateConvergentMutationIntent({
    planDigest: otherPlan.planDigest,
    targetPath: otherFirst.path,
    targetDigest: otherFirst.expectedDigest,
  });
  await mkdir(join(otherRoot, ".cursor", "rules"), { recursive: true });
  const outside = join(otherRoot, "outside");
  await writeFile(outside, "outside\n", "utf8");
  await symlink(outside, join(otherRoot, otherIntent.temporaryPath));
  const otherWorkspace =
    await PrivateFilesystemWorkspace.openForProcessTermination(otherRoot);
  await assert.rejects(
    () => applyPrivateConvergentRenderPlan(otherPlan, otherWorkspace),
    (error: unknown) => {
      assert.equal(error instanceof PrivateFilesystemWorkspaceError, true);
      assert.equal(
        (error as PrivateFilesystemWorkspaceError).code,
        "WORKSPACE_PATH_SYMLINK",
      );
      return true;
    },
  );
});

test("converges delete operations before and after unlink", async (t) => {
  for (const boundary of ["path-removing", "path-applied"] as const) {
    await t.test(boundary, async (boundaryTest) => {
      const root = await temporaryDirectory(boundaryTest);
      const { plan, renderer, request } = await createPlan(root);
      const workspace =
        await PrivateFilesystemWorkspace.openForProcessTermination(root);
      const initial = await applyPrivateConvergentRenderPlan(plan, workspace);
      const staged = await renderer.stage(request);
      const agents = staged.files.find((file) => file.path === "AGENTS.md");
      assert.ok(agents);
      const reduced: StagingRenderer = {
        name: "convergent-delete-fixture",
        version: "1",
        ownershipKey: renderer.ownershipKey,
        async stage() {
          return { files: [agents], diagnostics: [] };
        },
      };
      const deleteAdapter = new StagedRendererAdapter(reduced);
      const deletePlan = await deleteAdapter.plan(
        { ...request, ownership: initial.ownership },
        workspace,
      );
      const deletePath = ".cursor/rules/agentdevflow.mdc";
      await assert.rejects(
        () =>
          applyPrivateConvergentRenderPlan(deletePlan, workspace, (event) => {
            if (event.kind === boundary && event.path === deletePath) {
              throw new Error(`Injected fault at ${boundary}.`);
            }
          }),
        /Injected fault/u,
      );
      const resumed =
        await PrivateFilesystemWorkspace.openForProcessTermination(root);
      await applyPrivateConvergentRenderPlan(deletePlan, resumed);
      assert.equal(await resumed.read(deletePath), null);
      assert.equal(await resumed.read("CLAUDE.md"), null);
      assert.equal(await resumed.read("AGENTS.md"), agents.content);
    });
  }
});
