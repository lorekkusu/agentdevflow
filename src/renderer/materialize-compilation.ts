import { createHash } from "node:crypto";

import type { CandidateCompilation } from "../compiler/private-model.js";
import type { PrivateCapability } from "../compiler/private-model.js";

export const privateRendererSourceRevision = 1;

export interface PrivateRendererSourceFile {
  readonly path: string;
  readonly capability: PrivateCapability;
  readonly content: string;
  readonly contentDigest: string;
  readonly sourceRefs: readonly string[];
}

export interface PrivateRendererSourceMaterialization {
  readonly revision: number;
  readonly compilerDigest: string;
  readonly digest: string;
  readonly files: readonly PrivateRendererSourceFile[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function digestText(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function digestValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function effectText(values: readonly string[] | undefined): string {
  return values && values.length > 0
    ? values.map((value) => `\`${value}\``).join(", ")
    : "none";
}

function materializedContent(compilation: CandidateCompilation): string {
  const workflow = compilation.workflow;
  const providers = new Map(
    workflow.providers.map((provider) => [provider.id, provider]),
  );
  const roles = ["steward", "developer", "reviewer"] as const;
  const lines = [
    "# Agent development flow",
    "",
    "Follow this project development flow when planning, implementing, reviewing, or preparing a merge.",
    "",
    `- Preset: \`${workflow.preset}\``,
    "",
    "## Responsibilities",
    "",
  ];

  for (const role of roles) {
    const providerId = workflow.roleBindings[role];
    const provider = providers.get(providerId);
    if (!provider) {
      throw new Error(
        `Workflow role ${role} references missing provider ${providerId}.`,
      );
    }
    lines.push(
      `- ${role[0]?.toUpperCase()}${role.slice(1)}: \`${provider.id}\` using \`${provider.product}\` on the \`${provider.surface}\` surface.`,
    );
  }

  lines.push("", "## Workflow", "");
  for (const transition of [...workflow.transitions].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    lines.push(
      `- Move from \`${transition.from}\` to \`${transition.to}\` under the \`${transition.role}\` responsibility. Produce: ${effectText(transition.produces)}. Invalidate: ${effectText(transition.invalidates)}.`,
    );
  }

  lines.push("", "## Safety requirements", "");
  for (const policy of [...compilation.policies].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    const requirement =
      policy.kind === "requires-valid-artifact"
        ? `requires a currently valid \`${policy.artifact}\``
        : `forbids a currently valid \`${policy.artifact}\``;
    lines.push(`- At \`${policy.at}\`, the workflow ${requirement}.`);
  }

  lines.push(
    "",
    "## Enforcement boundary",
    "",
    "- Project instructions are advisory and do not mechanically authorize transitions, authenticate a producer, or prove semantic truth.",
    "- A transition is ready only when the separately validated policy and artifact state permits it.",
    "- A weaker provider mechanism must not satisfy a stronger configured requirement.",
    "",
  );
  return lines.join("\n");
}

function expectedMaterializationDigest(
  materialization: Omit<PrivateRendererSourceMaterialization, "digest">,
): string {
  return digestValue({
    revision: materialization.revision,
    compilerDigest: materialization.compilerDigest,
    files: materialization.files.map((file) => ({
      path: file.path,
      capability: file.capability,
      contentDigest: file.contentDigest,
      sourceRefs: file.sourceRefs,
    })),
  });
}

export function validatePrivateRendererSourceMaterialization(
  materialization: PrivateRendererSourceMaterialization,
): void {
  if (materialization.revision !== privateRendererSourceRevision) {
    throw new Error(
      `Unsupported private renderer source revision: ${materialization.revision}.`,
    );
  }
  if (materialization.files.length === 0) {
    throw new Error("Private renderer source materialization is empty.");
  }
  const seenPaths = new Set<string>();
  for (const file of materialization.files) {
    if (seenPaths.has(file.path)) {
      throw new Error(`Private renderer source path is duplicated: ${file.path}`);
    }
    seenPaths.add(file.path);
    if (digestText(file.content) !== file.contentDigest) {
      throw new Error(
        `Private renderer source content digest does not match: ${file.path}`,
      );
    }
  }
  const expected = expectedMaterializationDigest({
    revision: materialization.revision,
    compilerDigest: materialization.compilerDigest,
    files: materialization.files,
  });
  if (expected !== materialization.digest) {
    throw new Error("Private renderer source materialization digest does not match.");
  }
}

export function materializeCompilation(
  compilation: CandidateCompilation,
): PrivateRendererSourceMaterialization {
  if (!compilation.policyValidation.safe) {
    throw new Error("Refusing to materialize an unsafe compilation.");
  }
  const content = materializedContent(compilation);
  const files: readonly PrivateRendererSourceFile[] = [
    {
      path: "project-instructions/development-flow.md",
      capability: "project-instructions",
      content,
      contentDigest: digestText(content),
      sourceRefs: [
        `candidate-config:sha256:${compilation.configDigest}`,
        `workflow-definition:${compilation.workflow.definitionId}@${compilation.workflow.definitionRevision}`,
      ],
    },
  ];
  const base = {
    revision: privateRendererSourceRevision,
    compilerDigest: compilation.compilerDigest,
    files,
  };
  return { ...base, digest: expectedMaterializationDigest(base) };
}
