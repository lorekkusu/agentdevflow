import {
  composePrivateProviderInstructionViews,
  emptyPrivateProjectGuidance,
  type PrivateProjectGuidance,
} from "../guidance/private-project-guidance.js";
import type { PrivateDomainProjectResolutionResult } from "../project/private-domain-project-resolution.js";
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

function projectSourceRefs(
  project: PrivateResolvedDomainProject,
): readonly string[] {
  return [
    `domain-project-intent:sha256:${project.resolution.intentDigest}`,
    `domain-project-resolution:sha256:${project.resolutionDigest}`,
    `domain-workflow:${project.resolution.workflow.definitionId}@${project.resolution.workflow.definitionRevision}`,
    `domain-workflow-compilation:sha256:${project.workflowCompilation.compilationDigest}`,
  ].sort(compareText);
}

export function materializePrivateDomainProject(
  project: PrivateResolvedDomainProject,
  guidance: PrivateProjectGuidance = emptyPrivateProjectGuidance,
): PrivateRendererSourceMaterialization {
  if (!project.workflowCompilation.policyValidation.safe) {
    throw new Error(
      "Refusing to materialize an unsafe domain project compilation.",
    );
  }
  if (
    project.workflowCompilation.compilationDigest !==
    project.resolution.workflow.compilationDigest
  ) {
    throw new Error(
      "Domain project resolution belongs to a different workflow compilation.",
    );
  }

  const composed = composePrivateProviderInstructionViews(project, guidance);
  if (!composed.ok) {
    throw new Error(composed.diagnostics.map((item) => item.message).join("; "));
  }
  const commonSourceRefs = projectSourceRefs(project);
  return createPrivateRendererSourceMaterialization({
    compilerDigest: project.workflowCompilation.compilationDigest,
    files: composed.views.map((view) => ({
      path: `project-instructions/${view.product}.md`,
      provider: view.product,
      content: view.content,
      sourceRefs: [...commonSourceRefs, ...view.sourcePaths].sort(compareText),
    })),
  });
}
