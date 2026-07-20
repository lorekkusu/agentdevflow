import type { SafetyPolicy } from "../policy/model.js";
import type {
  PrivateDomainProjectResolutionResult,
  PrivateResolvedCapabilityTarget,
} from "../project/private-domain-project-resolution.js";
import {
  createPrivateRendererSourceMaterialization,
  type PrivateRendererSourceMaterialization,
} from "./materialize-compilation.js";

export type PrivateResolvedDomainProject = Extract<
  PrivateDomainProjectResolutionResult,
  { readonly ok: true }
>;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function codeList(values: readonly string[] | undefined): string {
  return values && values.length > 0
    ? values.map((value) => `\`${value}\``).join(", ")
    : "none";
}

function policyText(policy: SafetyPolicy): string {
  return policy.kind === "requires-valid-artifact"
    ? `requires a currently valid \`${policy.artifact}\``
    : `forbids a currently valid \`${policy.artifact}\``;
}

function targetText(target: PrivateResolvedCapabilityTarget): string {
  switch (target.kind) {
    case "responsibility":
      return `responsibility \`${target.responsibility}\` through provider \`${target.provider.id}\``;
    case "tracker":
      return `tracker \`${target.tracker}\``;
    case "external":
      return `external integration \`${target.id}\``;
  }
}

function materializedDomainContent(project: PrivateResolvedDomainProject): string {
  const { definition } = project.workflowCompilation;
  const lines = [
    "# Agent development flow",
    "",
    "Follow this project development flow when planning, implementing, reviewing, or preparing a completion transition.",
    "",
    `- Preset: \`${project.resolution.preset.name}\``,
    `- Workflow family: \`${project.resolution.workflow.family}\``,
    `- Tracker mode: \`${project.resolution.tracker.mode}\``,
  ];

  if (project.normalizedIntent.workflow.family === "issue-to-reviewed-pull-request") {
    lines.push(
      `- Pull request initial state: \`${project.normalizedIntent.workflow.initialState}\``,
      `- Auxiliary review: \`${project.normalizedIntent.workflow.auxiliaryReview}\``,
      `- Merge method: \`${project.normalizedIntent.workflow.mergeMethod}\``,
    );
  }

  lines.push("", "## Responsibilities", "");
  for (const item of project.resolution.responsibilities) {
    lines.push(
      `- ${item.responsibility[0]?.toUpperCase()}${item.responsibility.slice(1)}: \`${item.provider.id}\` using \`${item.provider.product}\` on the \`${item.provider.surface}\` surface.`,
    );
  }

  lines.push("", "## Capability targets", "");
  for (const target of project.resolution.capabilityTargets) {
    lines.push(`- \`${target.binding}\`: ${targetText(target)}.`);
  }

  lines.push("", "## Workflow", "");
  for (const transition of [...definition.transitions].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    const guard = transition.guard ? ` Guard: \`${transition.guard}\`.` : "";
    lines.push(
      `- \`${transition.id}\`: move from \`${transition.from}\` to \`${transition.to}\` under the \`${transition.role}\` responsibility. Produce: ${codeList(transition.produces)}. Invalidate: ${codeList(transition.invalidates)}. Required capabilities: ${codeList(transition.requiresCapabilities)}.${guard}`,
    );
  }

  lines.push("", "## Safety requirements", "");
  for (const policy of [...definition.policies].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    lines.push(
      `- At \`${policy.at}\`, the workflow ${policyText(policy)}.`,
    );
  }

  const evidence = [...(definition.evidenceRequirements ?? [])].sort(
    (left, right) => compareText(left.id, right.id),
  );
  if (evidence.length > 0) {
    lines.push("", "## Evidence requirements", "");
    for (const requirement of evidence) {
      lines.push(
        `- \`${requirement.id}\`: artifact \`${requirement.artifact}\` must use schema \`${requirement.schema}\`${requirement.referenceArtifact ? ` and reference \`${requirement.referenceArtifact}\`` : ""}.`,
      );
    }
  }

  lines.push(
    "",
    "## Enforcement boundary",
    "",
    "- Project instructions are advisory and do not mechanically authorize transitions, authenticate a producer, or prove semantic truth.",
    "- A transition is ready only when the separately validated policy, capability, and artifact state permits it.",
    "- Pull request readiness is not merge authorization.",
    "- A weaker provider mechanism must not satisfy a stronger configured requirement.",
    "",
  );
  return lines.join("\n");
}

export function materializePrivateDomainProject(
  project: PrivateResolvedDomainProject,
): PrivateRendererSourceMaterialization {
  if (!project.workflowCompilation.policyValidation.safe) {
    throw new Error("Refusing to materialize an unsafe domain project compilation.");
  }
  if (
    project.workflowCompilation.compilationDigest !==
    project.resolution.workflow.compilationDigest
  ) {
    throw new Error(
      "Domain project resolution belongs to a different workflow compilation.",
    );
  }
  return createPrivateRendererSourceMaterialization({
    compilerDigest: project.workflowCompilation.compilationDigest,
    content: materializedDomainContent(project),
    sourceRefs: [
      `domain-project-intent:sha256:${project.resolution.intentDigest}`,
      `domain-project-resolution:sha256:${project.resolutionDigest}`,
      `domain-workflow:${project.resolution.workflow.definitionId}@${project.resolution.workflow.definitionRevision}`,
      `domain-workflow-compilation:sha256:${project.workflowCompilation.compilationDigest}`,
    ],
  });
}
