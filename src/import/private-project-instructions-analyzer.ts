import { createHash } from "node:crypto";

import type { PrivateInitImportAssessment } from "./private-assessment.js";
import type { RendererProvider } from "../renderer/contract.js";
import {
  nativeGeneratedNotice,
  parseGeneratedMarkdown,
} from "../renderer/native/common.js";
import { cursorProjectInstructionsFrontmatter } from "../renderer/native/cursor.js";

export type PrivateProjectInstructionsImportErrorCode =
  | "IMPORT_CONFIGURATION_DIGEST_INVALID"
  | "IMPORT_TARGET_INVALID";

export class PrivateProjectInstructionsImportError extends Error {
  override readonly name = "PrivateProjectInstructionsImportError";

  constructor(
    readonly code: PrivateProjectInstructionsImportErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface AnalyzePrivateProjectInstructionsImportOptions {
  readonly provider: RendererProvider;
  readonly existingContent: string;
  readonly targetContent: string;
  readonly proposedConfigurationDigest: string;
}

const sha256Pattern = /^[a-f0-9]{64}$/u;
const cursorPrefix = `${cursorProjectInstructionsFrontmatter}\n\n`;

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeLineEndings(content: string): string {
  return content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function normalizeLogicalBody(content: string): string {
  return normalizeLineEndings(content).trimEnd();
}

function generatedBodyOrRaw(content: string):
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly reason: string } {
  const normalizedContent = normalizeLineEndings(content);
  const generatedBody = parseGeneratedMarkdown(normalizedContent);
  if (generatedBody !== null) {
    return { ok: true, body: generatedBody };
  }
  if (normalizedContent.startsWith(nativeGeneratedNotice)) {
    return {
      ok: false,
      reason: "The agentdevflow generated notice is present in an unsupported form.",
    };
  }
  return { ok: true, body: normalizeLogicalBody(content) };
}

function targetBody(
  provider: RendererProvider,
  targetContent: string,
): string {
  const providerContent =
    provider === "cursor"
      ? targetContent.startsWith(cursorPrefix)
        ? targetContent.slice(cursorPrefix.length)
        : null
      : targetContent;
  const body =
    providerContent === null ? null : parseGeneratedMarkdown(providerContent);
  if (body === null) {
    throw new PrivateProjectInstructionsImportError(
      "IMPORT_TARGET_INVALID",
      `The ${provider} target is not canonical native project-instructions output.`,
    );
  }
  return body;
}

function existingBody(
  provider: RendererProvider,
  existingContent: string,
):
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly reason: string } {
  if (provider !== "cursor") {
    return generatedBodyOrRaw(existingContent);
  }
  const normalizedContent = normalizeLineEndings(existingContent);
  if (!normalizedContent.startsWith(cursorPrefix)) {
    return {
      ok: false,
      reason:
        "Cursor frontmatter is not the supported project-wide always-apply form.",
    };
  }
  return generatedBodyOrRaw(normalizedContent.slice(cursorPrefix.length));
}

function unsupported(
  provider: RendererProvider,
  existingContent: string,
  reason: string,
): PrivateInitImportAssessment {
  return {
    provider,
    observedDigest: digest(existingContent),
    classification: "unsupported",
    proposedConfigurationDigest: null,
    proposedTargetDigest: null,
    informationLoss: [reason],
  };
}

export function analyzePrivateProjectInstructionsImport(
  options: AnalyzePrivateProjectInstructionsImportOptions,
): PrivateInitImportAssessment {
  if (!sha256Pattern.test(options.proposedConfigurationDigest)) {
    throw new PrivateProjectInstructionsImportError(
      "IMPORT_CONFIGURATION_DIGEST_INVALID",
      "The proposed configuration digest must be a lowercase SHA-256 digest.",
    );
  }
  const proposedBody = targetBody(options.provider, options.targetContent);
  const existing = existingBody(options.provider, options.existingContent);
  if (!existing.ok) {
    return unsupported(
      options.provider,
      options.existingContent,
      existing.reason,
    );
  }
  if (existing.body !== proposedBody) {
    return unsupported(
      options.provider,
      options.existingContent,
      "Existing project-instruction content is not preserved by the proposed target.",
    );
  }
  return {
    provider: options.provider,
    observedDigest: digest(options.existingContent),
    classification: "lossless",
    proposedConfigurationDigest: options.proposedConfigurationDigest,
    proposedTargetDigest: digest(options.targetContent),
    informationLoss: [],
  };
}
