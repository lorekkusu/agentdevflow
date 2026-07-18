import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { normalizeCandidateProjectConfig } from "../../src/config/normalize-candidate.js";
import {
  executePrivateInitCommand,
  privateInitProviderPaths,
  type PrivateInitImportAssessment,
  type PrivateInitReadWorkspace,
  type PrivateInitTarget,
} from "../../src/commands/private-init-command-service.js";
import { emitClaudeCodeProjectInstructions } from "../../src/renderer/native/claude-code.js";
import { emitCodexProjectInstructions } from "../../src/renderer/native/codex.js";
import { emitCursorProjectInstructions } from "../../src/renderer/native/cursor.js";
import { PrivateFilesystemWorkspace } from "../../src/workspace/private-filesystem-workspace.js";
import {
  balancedCandidateConfig,
  fastCandidateConfig,
} from "../fixtures/config/specimens.js";

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

class ReadOnlyMemoryWorkspace implements PrivateInitReadWorkspace {
  readonly reads: string[] = [];

  constructor(
    private readonly files: ReadonlyMap<string, string>,
    private readonly failingPaths: ReadonlySet<string> = new Set(),
  ) {}

  async read(path: string): Promise<string | null> {
    this.reads.push(path);
    if (this.failingPaths.has(path)) {
      throw new Error("fixture read failure");
    }
    return this.files.get(path) ?? null;
  }
}

function balancedTargets(): PrivateInitTarget[] {
  const body = "Use the selected development flow.\n";
  return [
    {
      provider: "cursor",
      content: emitCursorProjectInstructions(body).content,
      sourceRefs: ["private/project-instructions.md"],
    },
    {
      provider: "codex",
      content: emitCodexProjectInstructions(body).content,
      sourceRefs: ["private/project-instructions.md"],
    },
    {
      provider: "claude-code",
      content: emitClaudeCodeProjectInstructions(body).content,
      sourceRefs: ["private/project-instructions.md"],
    },
  ];
}

function fastTarget(content = "Generated target.\n"): PrivateInitTarget {
  return {
    provider: "codex",
    content,
    sourceRefs: ["private/project-instructions.md"],
  };
}

function configurationDigest(configuration: unknown): string {
  const normalized = normalizeCandidateProjectConfig(configuration);
  assert.equal(normalized.ok, true);
  if (!normalized.ok) {
    throw new Error("Fixture configuration is invalid.");
  }
  return normalized.digest;
}

function assessment(
  existing: string,
  options: {
    readonly classification?: "lossless" | "lossy" | "unsupported";
    readonly proposedConfigurationDigest?: string | null;
    readonly proposedTargetDigest?: string | null;
    readonly informationLoss?: readonly string[];
  } = {},
): PrivateInitImportAssessment {
  const classification = options.classification ?? "lossless";
  return {
    provider: "codex",
    observedDigest: digest(existing),
    classification,
    proposedConfigurationDigest:
      options.proposedConfigurationDigest === undefined
        ? classification === "unsupported"
          ? null
          : configurationDigest(fastCandidateConfig)
        : options.proposedConfigurationDigest,
    proposedTargetDigest:
      options.proposedTargetDigest === undefined
        ? classification === "unsupported"
          ? null
          : digest(fastTarget().content)
        : options.proposedTargetDigest,
    informationLoss:
      options.informationLoss ??
      (classification === "lossless" ? [] : ["Unsupported provider directive"]),
  };
}

test("proposes deterministic creation for all configured provider products", async () => {
  const targets = balancedTargets();
  const before = structuredClone(targets);
  const workspace = new ReadOnlyMemoryWorkspace(new Map());
  const result = await executePrivateInitCommand({
    proposedConfiguration: balancedCandidateConfig,
    targets,
    importAssessments: [],
    workspace,
  });

  assert.equal(result.outcome, "ready");
  assert.equal(result.candidateExitCode, 0);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.proposedConfiguration?.revision, 1);
  assert.equal(
    result.proposedConfiguration?.digest,
    configurationDigest(balancedCandidateConfig),
  );
  assert.deepEqual(
    result.entries.map((entry) => [entry.path, entry.disposition]),
    [
      [".cursor/rules/agentdevflow.mdc", "create"],
      ["AGENTS.md", "create"],
      ["CLAUDE.md", "create"],
    ],
  );
  assert.deepEqual(workspace.reads, ["CLAUDE.md", "AGENTS.md", ".cursor/rules/agentdevflow.mdc"]);
  assert.deepEqual(targets, before);
});

test("proposes adoption only for byte-exact existing provider content", async () => {
  const target = fastTarget();
  const exactWorkspace = new ReadOnlyMemoryWorkspace(
    new Map([[privateInitProviderPaths.codex, target.content]]),
  );
  const exact = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [target],
    importAssessments: [],
    workspace: exactWorkspace,
  });

  assert.equal(exact.outcome, "ready");
  assert.equal(exact.entries[0]?.disposition, "adopt");
  assert.equal(exact.entries[0]?.requiresExplicitApproval, true);
  assert.equal(exact.entries[0]?.observedDigest, exact.entries[0]?.targetDigest);

  const different = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [target],
    importAssessments: [],
    workspace: new ReadOnlyMemoryWorkspace(
      new Map([[privateInitProviderPaths.codex, `${target.content}foreign`]]),
    ),
  });
  assert.equal(different.outcome, "blocked");
  assert.equal(different.entries[0]?.disposition, "abort");
  assert.equal(
    different.diagnostics[0]?.code,
    "INIT_IMPORT_ANALYSIS_UNAVAILABLE",
  );
});

test("proposes a lossless import bound to file, configuration, and target digests", async () => {
  const existing = "Hand-written Codex instructions.\n";
  const result = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [assessment(existing)],
    workspace: new ReadOnlyMemoryWorkspace(
      new Map([[privateInitProviderPaths.codex, existing]]),
    ),
  });

  assert.equal(result.outcome, "review-required");
  assert.equal(result.candidateExitCode, 1);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.entries[0]?.disposition, "import");
  assert.equal(result.entries[0]?.requiresExplicitApproval, true);
  assert.deepEqual(result.entries[0]?.informationLoss, []);
  assert.equal(result.entries[0]?.targetContent, "Generated target.\n");
});

test("retains explicit information-loss diagnostics on a lossy import proposal", async () => {
  const existing = "Provider-specific command plus instructions.\n";
  const result = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [
      assessment(existing, {
        classification: "lossy",
        informationLoss: ["Provider-specific command cannot be represented"],
      }),
    ],
    workspace: new ReadOnlyMemoryWorkspace(
      new Map([[privateInitProviderPaths.codex, existing]]),
    ),
  });

  assert.equal(result.outcome, "review-required");
  assert.equal(result.entries[0]?.disposition, "import");
  assert.deepEqual(result.entries[0]?.informationLoss, [
    "Provider-specific command cannot be represented",
  ]);
  assert.equal(result.diagnostics[0]?.code, "INIT_IMPORT_INFORMATION_LOSS");
  assert.equal(result.diagnostics[0]?.level, "warning");
});

test("aborts unsupported, stale, configuration-mismatched, and target-mismatched import analyses", async () => {
  const existing = "Foreign provider content.\n";
  const workspace = () =>
    new ReadOnlyMemoryWorkspace(
      new Map([[privateInitProviderPaths.codex, existing]]),
    );

  const unsupported = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [assessment(existing, { classification: "unsupported" })],
    workspace: workspace(),
  });
  assert.equal(unsupported.outcome, "blocked");
  assert.equal(unsupported.entries[0]?.disposition, "abort");
  assert.equal(unsupported.diagnostics[0]?.code, "INIT_IMPORT_UNSUPPORTED");

  const staleAssessment = {
    ...assessment(existing),
    observedDigest: digest("older content"),
  };
  const stale = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [staleAssessment],
    workspace: workspace(),
  });
  assert.equal(stale.outcome, "blocked");
  assert.equal(stale.diagnostics[0]?.code, "INIT_IMPORT_ANALYSIS_STALE");

  const mismatch = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [
      assessment(existing, {
        proposedConfigurationDigest: configurationDigest(balancedCandidateConfig),
      }),
    ],
    workspace: workspace(),
  });
  assert.equal(mismatch.outcome, "blocked");
  assert.equal(
    mismatch.diagnostics[0]?.code,
    "INIT_IMPORT_CONFIGURATION_MISMATCH",
  );

  const targetMismatch = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [
      assessment(existing, {
        proposedTargetDigest: digest("another target"),
      }),
    ],
    workspace: workspace(),
  });
  assert.equal(targetMismatch.outcome, "blocked");
  assert.equal(
    targetMismatch.diagnostics[0]?.code,
    "INIT_IMPORT_TARGET_MISMATCH",
  );
});

test("fails closed for malformed or incomplete private inputs", async () => {
  const malformedAssessment = {
    ...assessment("existing"),
    classification: "lossless" as const,
    informationLoss: ["Contradictory loss"],
  };
  const malformed = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [malformedAssessment],
    workspace: new ReadOnlyMemoryWorkspace(new Map()),
  });
  assert.equal(malformed.outcome, "blocked");
  assert.equal(malformed.proposedConfiguration, null);
  assert.equal(malformed.diagnostics[0]?.code, "INIT_INPUT_INVALID");

  const incomplete = await executePrivateInitCommand({
    proposedConfiguration: balancedCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [],
    workspace: new ReadOnlyMemoryWorkspace(new Map()),
  });
  assert.equal(incomplete.outcome, "blocked");
  assert.equal(incomplete.entries.length, 0);

  const invalidConfig = await executePrivateInitCommand({
    proposedConfiguration: { schemaVersion: 99 },
    targets: [],
    importAssessments: [],
    workspace: new ReadOnlyMemoryWorkspace(new Map()),
  });
  assert.equal(invalidConfig.outcome, "blocked");
  assert.equal(invalidConfig.proposedConfiguration, null);
});

test("records unreadable provider paths as explicit abort outcomes", async () => {
  const result = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [fastTarget()],
    importAssessments: [],
    workspace: new ReadOnlyMemoryWorkspace(
      new Map(),
      new Set([privateInitProviderPaths.codex]),
    ),
  });

  assert.equal(result.outcome, "blocked");
  assert.equal(result.candidateExitCode, 2);
  assert.equal(result.entries[0]?.disposition, "abort");
  assert.equal(result.entries[0]?.observedState, "unreadable");
  assert.equal(result.diagnostics[0]?.code, "INIT_WORKSPACE_READ_FAILED");
});

test("is deterministic for reordered inputs and never exposes foreign bytes", async () => {
  const targets = balancedTargets();
  const existingCodex = "Private local Codex instructions.\n";
  const normalizedDigest = configurationDigest(balancedCandidateConfig);
  const assessments: PrivateInitImportAssessment[] = [
    {
      provider: "codex",
      observedDigest: digest(existingCodex),
      classification: "lossless",
      proposedConfigurationDigest: normalizedDigest,
      proposedTargetDigest: digest(
        targets.find((item) => item.provider === "codex")?.content ?? "",
      ),
      informationLoss: [],
    },
  ];
  const files = new Map([
    [privateInitProviderPaths.codex, existingCodex],
    [privateInitProviderPaths.cursor, targets.find((item) => item.provider === "cursor")?.content ?? ""],
  ]);
  const first = await executePrivateInitCommand({
    proposedConfiguration: balancedCandidateConfig,
    targets,
    importAssessments: assessments,
    workspace: new ReadOnlyMemoryWorkspace(files),
  });
  const second = await executePrivateInitCommand({
    proposedConfiguration: balancedCandidateConfig,
    targets: [...targets].reverse(),
    importAssessments: [...assessments].reverse(),
    workspace: new ReadOnlyMemoryWorkspace(files),
  });

  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(first).includes(existingCodex), false);
  assert.deepEqual(
    first.entries.map((entry) => entry.disposition),
    ["adopt", "import", "create"],
  );
});

test("observes a temporary repository through the hardened workspace without mutation", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "agentdevflow-private-init-"));
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const target = fastTarget();
  const path = join(root, privateInitProviderPaths.codex);
  await writeFile(path, target.content, "utf8");
  const workspace = await PrivateFilesystemWorkspace.open(root);

  const result = await executePrivateInitCommand({
    proposedConfiguration: fastCandidateConfig,
    targets: [target],
    importAssessments: [],
    workspace,
  });

  assert.equal(result.outcome, "ready");
  assert.equal(result.entries[0]?.disposition, "adopt");
  assert.equal(await readFile(path, "utf8"), target.content);
  assert.deepEqual(await readdir(root), [privateInitProviderPaths.codex]);
});
