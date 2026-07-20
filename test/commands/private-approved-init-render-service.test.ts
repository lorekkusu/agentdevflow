import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";

import {
  approvePrivateInitProposal,
  executePrivateApprovedInitRender,
  preparePrivateApprovedInitRender,
  PrivateApprovedInitRenderError,
} from "../../src/commands/private-approved-init-render-service.js";
import {
  executePrivateInitCommand,
  privateInitProviderPaths,
  type PrivateInitTarget,
} from "../../src/commands/private-init-command-service.js";
import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import { analyzePrivateProjectInstructionsImport } from "../../src/import/private-project-instructions-analyzer.js";
import { serializePrivateRenderLock } from "../../src/lock/private-render-lock.js";
import { materializeCompilation } from "../../src/renderer/materialize-compilation.js";
import { emitClaudeCodeProjectInstructions } from "../../src/renderer/native/claude-code.js";
import { emitCodexProjectInstructions } from "../../src/renderer/native/codex.js";
import {
  cursorProjectInstructionsFrontmatter,
  emitCursorProjectInstructions,
} from "../../src/renderer/native/cursor.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { StagedRendererAdapter } from "../../src/renderer/staged-adapter.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";
import {
  balancedCandidateConfig,
  fastCandidateConfig,
} from "../fixtures/config/specimens.js";

const lockPath = ".private-fixture/render-lock.json";

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function temporaryRepository(t: TestContext): Promise<string> {
  const container = await mkdtemp(join(tmpdir(), "agentdevflow-approved-init-"));
  t.after(async () => {
    await rm(container, { recursive: true, force: true });
  });
  const repository = join(container, "repository");
  await mkdir(repository);
  return repository;
}

function compile(configuration: unknown): CandidateCompilation {
  const result = compileCandidateProjectConfig(configuration, initialCompilerOptions);
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
}

function targetFixture(compilation: CandidateCompilation): {
  readonly targets: readonly PrivateInitTarget[];
  readonly sourceBody: string;
} {
  const materialization = materializeCompilation(compilation);
  const source = materialization.files[0];
  assert.ok(source);
  const sourceRefs = [...new Set([source.path, ...source.sourceRefs])].sort();
  const emitters = {
    "claude-code": emitClaudeCodeProjectInstructions,
    codex: emitCodexProjectInstructions,
    cursor: emitCursorProjectInstructions,
  } as const;
  const providers = [
    ...new Set(compilation.workflow.providers.map((provider) => provider.product)),
  ].sort();
  return {
    sourceBody: source.content,
    targets: providers.map((provider) => ({
      provider,
      content: emitters[provider](source.content).content,
      sourceRefs,
    })),
  };
}

test("prepares and executes exact create, adopt, and lossless import dispositions", async (t) => {
  const repository = await temporaryRepository(t);
  const compilation = compile(balancedCandidateConfig);
  const materialization = materializeCompilation(compilation);
  const fixture = targetFixture(compilation);
  const codexTarget = fixture.targets.find((target) => target.provider === "codex");
  const claudeTarget = fixture.targets.find(
    (target) => target.provider === "claude-code",
  );
  assert.ok(codexTarget);
  assert.ok(claudeTarget);
  await writeFile(join(repository, "AGENTS.md"), `${fixture.sourceBody}\r\n`, "utf8");
  await writeFile(join(repository, "CLAUDE.md"), claudeTarget.content, "utf8");
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    repository,
  );
  const assessment = analyzePrivateProjectInstructionsImport({
    provider: "codex",
    existingContent: `${fixture.sourceBody}\r\n`,
    targetContent: codexTarget.content,
    proposedConfigurationDigest: compilation.configDigest,
  });
  const proposal = await executePrivateInitCommand({
    proposedConfiguration: balancedCandidateConfig,
    targets: fixture.targets,
    importAssessments: [assessment],
    workspace,
  });
  assert.deepEqual(
    proposal.entries.map((entry) => [entry.path, entry.disposition]),
    [
      [".cursor/rules/agentdevflow.mdc", "create"],
      ["AGENTS.md", "import"],
      ["CLAUDE.md", "adopt"],
    ],
  );

  const approval = approvePrivateInitProposal(proposal);
  const prepared = await preparePrivateApprovedInitRender({
    proposal,
    approval,
    compilation,
    materialization,
    backend: new StagedRendererAdapter(
      new NativeProjectInstructionsRenderer(materialization),
    ),
    workspace,
  });
  assert.deepEqual(
    prepared.snapshot.plan.files.map((file) => [file.path, file.action]),
    [
      [".cursor/rules/agentdevflow.mdc", "create"],
      ["AGENTS.md", "update"],
      ["CLAUDE.md", "unchanged"],
    ],
  );

  const result = await executePrivateApprovedInitRender({
    proposal,
    approval,
    prepared,
    materialization,
    lockPath,
    workspace,
  });
  assert.equal(result.preparedDigest, prepared.digest);
  assert.deepEqual(result.command.renderResult.written, [
    ".cursor/rules/agentdevflow.mdc",
    "AGENTS.md",
  ]);
  assert.equal(await workspace.read("AGENTS.md"), codexTarget.content);
  assert.equal(
    await workspace.read(".cursor/rules/agentdevflow.mdc"),
    emitCursorProjectInstructions(fixture.sourceBody).content,
  );
  assert.equal(
    await workspace.read(lockPath),
    serializePrivateRenderLock(result.command.lock),
  );
});

test("rejects stale observations and approval changes before planning", async (t) => {
  const repository = await temporaryRepository(t);
  const compilation = compile(fastCandidateConfig);
  const materialization = materializeCompilation(compilation);
  const fixture = targetFixture(compilation);
  const target = fixture.targets[0];
  assert.ok(target);
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    repository,
  );
  const proposal = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: fixture.targets,
    importAssessments: [],
    workspace,
  });
  const approval = approvePrivateInitProposal(proposal);
  assert.throws(
    () =>
      approvePrivateInitProposal({
        ...proposal,
        privateNote: "not allowed",
      } as unknown as typeof proposal),
    (error: unknown) =>
      error instanceof PrivateApprovedInitRenderError &&
      error.code === "PRIVATE_INIT_PROPOSAL_INVALID",
  );
  assert.throws(
    () =>
      approvePrivateInitProposal({
        ...proposal,
        entries: proposal.entries.map((entry) => ({
          ...entry,
          disposition: "overwrite",
        })),
      } as unknown as typeof proposal),
    (error: unknown) =>
      error instanceof PrivateApprovedInitRenderError &&
      error.code === "PRIVATE_INIT_PROPOSAL_INVALID",
  );
  await writeFile(join(repository, privateInitProviderPaths.codex), "late file\n", "utf8");

  await assert.rejects(
    () =>
      preparePrivateApprovedInitRender({
        proposal,
        approval,
        compilation,
        materialization,
        backend: new StagedRendererAdapter(
          new NativeProjectInstructionsRenderer(materialization),
        ),
        workspace,
      }),
    (error: unknown) =>
      error instanceof PrivateApprovedInitRenderError &&
      error.code === "PRIVATE_INIT_OBSERVATION_STALE",
  );

  const changedApproval = {
    ...approval,
    entries: approval.entries.map((entry) => ({
      ...entry,
      targetDigest: "0".repeat(64),
    })),
  };
  await assert.rejects(
    () =>
      preparePrivateApprovedInitRender({
        proposal,
        approval: changedApproval,
        compilation,
        materialization,
        backend: new StagedRendererAdapter(
          new NativeProjectInstructionsRenderer(materialization),
        ),
        workspace,
      }),
    (error: unknown) =>
      error instanceof PrivateApprovedInitRenderError &&
      error.code === "PRIVATE_INIT_APPROVAL_MISMATCH",
  );
});

test("rechecks import semantics instead of trusting an asserted lossless assessment", async (t) => {
  const repository = await temporaryRepository(t);
  const compilation = compile(fastCandidateConfig);
  const materialization = materializeCompilation(compilation);
  const fixture = targetFixture(compilation);
  const target = fixture.targets[0];
  assert.ok(target);
  const existing = "Different hand-written instructions.\n";
  await writeFile(join(repository, privateInitProviderPaths.codex), existing, "utf8");
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    repository,
  );
  const proposal = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: fixture.targets,
    importAssessments: [
      {
        provider: "codex",
        observedDigest: digest(existing),
        classification: "lossless",
        proposedConfigurationDigest: compilation.configDigest,
        proposedTargetDigest: digest(target.content),
        informationLoss: [],
      },
    ],
    workspace,
  });
  const approval = approvePrivateInitProposal(proposal);

  await assert.rejects(
    () =>
      preparePrivateApprovedInitRender({
        proposal,
        approval,
        compilation,
        materialization,
        backend: new StagedRendererAdapter(
          new NativeProjectInstructionsRenderer(materialization),
        ),
        workspace,
      }),
    (error: unknown) =>
      error instanceof PrivateApprovedInitRenderError &&
      error.code === "PRIVATE_INIT_IMPORT_NOT_LOSSLESS",
  );
  assert.equal(await workspace.read(privateInitProviderPaths.codex), existing);
  assert.equal(await workspace.read(lockPath), null);
});

test("resumes the retained approved snapshot after output application", async (t) => {
  const repository = await temporaryRepository(t);
  const compilation = compile(fastCandidateConfig);
  const materialization = materializeCompilation(compilation);
  const fixture = targetFixture(compilation);
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    repository,
  );
  const proposal = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: fixture.targets,
    importAssessments: [],
    workspace,
  });
  const approval = approvePrivateInitProposal(proposal);
  const prepared = await preparePrivateApprovedInitRender({
    proposal,
    approval,
    compilation,
    materialization,
    backend: new StagedRendererAdapter(
      new NativeProjectInstructionsRenderer(materialization),
    ),
    workspace,
  });

  await assert.rejects(
    () =>
      executePrivateApprovedInitRender({
        proposal,
        approval,
        prepared,
        materialization,
        lockPath,
        workspace,
        faultInjector(event) {
          if (event.kind === "render-applied") {
            throw new Error("injected approved init interruption");
          }
        },
      }),
    /injected approved init interruption/u,
  );
  assert.notEqual(await workspace.read(privateInitProviderPaths.codex), null);
  assert.equal(await workspace.read(lockPath), null);

  const resumed = await executePrivateApprovedInitRender({
    proposal,
    approval,
    prepared,
    materialization,
    lockPath,
    workspace,
  });
  assert.equal(resumed.command.verification.ok, true);
  assert.notEqual(await workspace.read(lockPath), null);
});

test("rejects a changed prepared package before mutation", async (t) => {
  const repository = await temporaryRepository(t);
  const compilation = compile(fastCandidateConfig);
  const materialization = materializeCompilation(compilation);
  const fixture = targetFixture(compilation);
  const workspace = await PrivateFilesystemWorkspace.openForProcessTermination(
    repository,
  );
  const proposal = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: fixture.targets,
    importAssessments: [],
    workspace,
  });
  const approval = approvePrivateInitProposal(proposal);
  const prepared = await preparePrivateApprovedInitRender({
    proposal,
    approval,
    compilation,
    materialization,
    backend: new StagedRendererAdapter(
      new NativeProjectInstructionsRenderer(materialization),
    ),
    workspace,
  });

  await assert.rejects(
    () =>
      executePrivateApprovedInitRender({
        proposal,
        approval,
        prepared: { ...prepared, approvalDigest: "0".repeat(64) },
        materialization,
        lockPath,
        workspace,
      }),
    (error: unknown) =>
      error instanceof PrivateApprovedInitRenderError &&
      error.code === "PRIVATE_INIT_PREPARED_PLAN_INVALID",
  );
  await assert.rejects(
    () =>
      executePrivateApprovedInitRender({
        proposal,
        approval,
        prepared: {
          ...prepared,
          privateNote: "not allowed",
        } as typeof prepared,
        materialization,
        lockPath,
        workspace,
      }),
    (error: unknown) =>
      error instanceof PrivateApprovedInitRenderError &&
      error.code === "PRIVATE_INIT_PREPARED_PLAN_INVALID",
  );
  assert.equal(await workspace.read(privateInitProviderPaths.codex), null);
  assert.equal(await workspace.read(lockPath), null);
});
