import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  analyzePrivateProjectInstructionsImport,
  PrivateProjectInstructionsImportError,
} from "../../src/import/private-project-instructions-analyzer.js";
import { nativeGeneratedNotice } from "../../src/renderer/native/common.js";
import { emitClaudeCodeProjectInstructions } from "../../src/renderer/native/claude-code.js";
import { emitCodexProjectInstructions } from "../../src/renderer/native/codex.js";
import {
  cursorProjectInstructionsFrontmatter,
  emitCursorProjectInstructions,
} from "../../src/renderer/native/cursor.js";

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function configurationDigest(): string {
  return "a".repeat(64);
}

test("creates a lossless Codex assessment", () => {
  const body = "Preserve these project instructions.\n";
  const target = emitCodexProjectInstructions(body).content;
  const assessment = analyzePrivateProjectInstructionsImport({
    provider: "codex",
    existingContent: body,
    targetContent: target,
    proposedConfigurationDigest: configurationDigest(),
  });

  assert.deepEqual(assessment, {
    provider: "codex",
    observedDigest: digest(body),
    classification: "lossless",
    proposedConfigurationDigest: configurationDigest(),
    proposedTargetDigest: digest(target),
    informationLoss: [],
  });

});

test("treats line-ending normalization as lossless instruction intent", () => {
  const existing = "First instruction.\r\nSecond instruction.\r\n";
  const target = emitClaudeCodeProjectInstructions(
    "First instruction.\nSecond instruction.\n",
  ).content;
  const result = analyzePrivateProjectInstructionsImport({
    provider: "claude-code",
    existingContent: existing,
    targetContent: target,
    proposedConfigurationDigest: configurationDigest(),
  });

  assert.equal(result.classification, "lossless");
  assert.equal(result.observedDigest, digest(existing));
  assert.equal(result.proposedTargetDigest, digest(target));

  const generatedWithCrLf = target.replaceAll("\n", "\r\n");
  const generatedResult = analyzePrivateProjectInstructionsImport({
    provider: "claude-code",
    existingContent: generatedWithCrLf,
    targetContent: target,
    proposedConfigurationDigest: configurationDigest(),
  });
  assert.equal(generatedResult.classification, "lossless");
  assert.equal(generatedResult.observedDigest, digest(generatedWithCrLf));
});

test("accepts only the fixed Cursor project-wide frontmatter", () => {
  const body = "Cursor project instruction.\n";
  const existing = `${cursorProjectInstructionsFrontmatter}\n\n${body}`;
  const target = emitCursorProjectInstructions(body).content;
  const supported = analyzePrivateProjectInstructionsImport({
    provider: "cursor",
    existingContent: existing,
    targetContent: target,
    proposedConfigurationDigest: configurationDigest(),
  });
  assert.equal(supported.classification, "lossless");

  const generatedWithCrLf = target.replaceAll("\n", "\r\n");
  const normalizedGenerated = analyzePrivateProjectInstructionsImport({
    provider: "cursor",
    existingContent: generatedWithCrLf,
    targetContent: target,
    proposedConfigurationDigest: configurationDigest(),
  });
  assert.equal(normalizedGenerated.classification, "lossless");

  const unknownFrontmatter = existing.replace(
    "alwaysApply: true",
    "alwaysApply: false",
  );
  const unsupported = analyzePrivateProjectInstructionsImport({
    provider: "cursor",
    existingContent: unknownFrontmatter,
    targetContent: target,
    proposedConfigurationDigest: configurationDigest(),
  });
  assert.equal(unsupported.classification, "unsupported");
  assert.deepEqual(unsupported.informationLoss, [
    "Cursor frontmatter is not the supported project-wide always-apply form.",
  ]);
  assert.equal(unsupported.proposedConfigurationDigest, null);
  assert.equal(unsupported.proposedTargetDigest, null);
});

test("rejects content differences instead of inventing a merge", () => {
  const result = analyzePrivateProjectInstructionsImport({
    provider: "codex",
    existingContent: "Existing instruction.\n",
    targetContent: emitCodexProjectInstructions("Different instruction.\n")
      .content,
    proposedConfigurationDigest: configurationDigest(),
  });

  assert.equal(result.classification, "unsupported");
  assert.deepEqual(result.informationLoss, [
    "Existing project-instruction content is not preserved by the proposed target.",
  ]);
  assert.equal(result.proposedConfigurationDigest, null);
  assert.equal(result.proposedTargetDigest, null);
});

test("rejects a malformed agentdevflow notice instead of importing it as user content", () => {
  const existing = `${nativeGeneratedNotice}\nMalformed spacing.\n`;
  const result = analyzePrivateProjectInstructionsImport({
    provider: "claude-code",
    existingContent: existing,
    targetContent: emitClaudeCodeProjectInstructions("Malformed spacing.\n")
      .content,
    proposedConfigurationDigest: configurationDigest(),
  });

  assert.equal(result.classification, "unsupported");
  assert.deepEqual(result.informationLoss, [
    "The agentdevflow generated notice is present in an unsupported form.",
  ]);
});

test("fails closed for invalid configuration digests and non-native targets", () => {
  assert.throws(
    () =>
      analyzePrivateProjectInstructionsImport({
        provider: "codex",
        existingContent: "Instruction.\n",
        targetContent: emitCodexProjectInstructions("Instruction.\n").content,
        proposedConfigurationDigest: "not-a-digest",
      }),
    (error: unknown) =>
      error instanceof PrivateProjectInstructionsImportError &&
      error.code === "IMPORT_CONFIGURATION_DIGEST_INVALID",
  );

  assert.throws(
    () =>
      analyzePrivateProjectInstructionsImport({
        provider: "codex",
        existingContent: "Instruction.\n",
        targetContent: "Instruction.\n",
        proposedConfigurationDigest: configurationDigest(),
      }),
    (error: unknown) =>
      error instanceof PrivateProjectInstructionsImportError &&
      error.code === "IMPORT_TARGET_INVALID",
  );
});

test("returns identical assessments for identical inputs without mutation", () => {
  const options = {
    provider: "cursor" as const,
    existingContent: `${cursorProjectInstructionsFrontmatter}\n\nStable body.\n`,
    targetContent: emitCursorProjectInstructions("Stable body.\n").content,
    proposedConfigurationDigest: configurationDigest(),
  };
  const before = structuredClone(options);

  assert.deepEqual(
    analyzePrivateProjectInstructionsImport(options),
    analyzePrivateProjectInstructionsImport(options),
  );
  assert.deepEqual(options, before);
});
