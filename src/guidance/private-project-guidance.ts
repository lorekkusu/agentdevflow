import type {
  CandidateProviderProduct,
  CandidateRole,
} from "../config/candidate.js";
import type { PrivateResolvedCapabilityTarget } from "../project/private-domain-project-resolution.js";
import type { PrivateResolvedDomainProject } from "../renderer/materialize-domain-project.js";
import type { PrivateFilesystemReadWorkspace } from "../workspace/private-filesystem-workspace.js";

export const privateProjectGuidancePaths = {
  shared: ".agentdevflow/rules/shared.md",
  steward: ".agentdevflow/rules/steward.md",
  developer: ".agentdevflow/rules/developer.md",
  reviewer: ".agentdevflow/rules/reviewer.md",
} as const satisfies Readonly<Record<"shared" | CandidateRole, string>>;

export const privateProjectGuidanceFileMaxBytes = 65_536;

export interface PrivateProjectGuidance {
  readonly shared: string | null;
  readonly steward: string | null;
  readonly developer: string | null;
  readonly reviewer: string | null;
}

export interface PrivateProviderInstructionView {
  readonly product: CandidateProviderProduct;
  readonly providerId: string;
  readonly responsibilities: readonly CandidateRole[];
  readonly content: string;
  readonly sourcePaths: readonly string[];
}

export interface PrivateProjectGuidanceDiagnostic {
  readonly stage: "planning";
  readonly code:
    | "PROJECT_GUIDANCE_READ_FAILED"
    | "PROVIDER_PRODUCT_TARGET_AMBIGUOUS";
  readonly path: string;
  readonly message: string;
}

export type PrivateProjectGuidanceReadResult =
  | {
      readonly ok: true;
      readonly guidance: PrivateProjectGuidance;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateProjectGuidanceDiagnostic[];
    };

export type PrivateProviderInstructionCompositionResult =
  | {
      readonly ok: true;
      readonly views: readonly PrivateProviderInstructionView[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateProjectGuidanceDiagnostic[];
    };

export const emptyPrivateProjectGuidance: PrivateProjectGuidance = {
  shared: null,
  steward: null,
  developer: null,
  reviewer: null,
};

const roleOrder: readonly CandidateRole[] = [
  "steward",
  "developer",
  "reviewer",
];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function title(value: string): string {
  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function errorCode(error: unknown): string {
  return error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "UNKNOWN";
}

export async function readPrivateProjectGuidance(
  workspace: Pick<PrivateFilesystemReadWorkspace, "readBounded">,
): Promise<PrivateProjectGuidanceReadResult> {
  const entries = Object.entries(privateProjectGuidancePaths) as readonly [
    keyof PrivateProjectGuidance,
    string,
  ][];
  const observed = await Promise.all(
    entries.map(async ([name, path]) => {
      try {
        return {
          ok: true as const,
          name,
          content: await workspace.readBounded(
            path,
            privateProjectGuidanceFileMaxBytes,
          ),
        };
      } catch (error) {
        return {
          ok: false as const,
          diagnostic: {
            stage: "planning" as const,
            code: "PROJECT_GUIDANCE_READ_FAILED" as const,
            path,
            message: `User-owned project guidance could not be read (${errorCode(error)}).`,
          },
        };
      }
    }),
  );
  const diagnostics = observed
    .filter((entry) => !entry.ok)
    .map((entry) => entry.diagnostic)
    .sort(
      (left, right) =>
        compareText(left.path, right.path) ||
        compareText(left.code, right.code),
    );
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }

  const values = Object.fromEntries(
    observed
      .filter((entry) => entry.ok)
      .map((entry) => [entry.name, entry.content]),
  ) as unknown as PrivateProjectGuidance;
  return { ok: true, guidance: values };
}

function targetText(target: PrivateResolvedCapabilityTarget): string {
  switch (target.kind) {
    case "responsibility":
      return `responsibility \`${target.responsibility}\` through this provider`;
    case "tracker":
      return `tracker \`${target.tracker}\``;
    case "external":
      return `external integration \`${target.id}\``;
  }
}

function activeTargets(
  project: PrivateResolvedDomainProject,
  activeRoles: ReadonlySet<CandidateRole>,
): readonly PrivateResolvedCapabilityTarget[] {
  const definition = project.workflowCompilation.definition;
  const activeCapabilities = new Set(
    definition.transitions
      .filter((transition) => activeRoles.has(transition.role))
      .flatMap((transition) => transition.requiresCapabilities ?? []),
  );
  const activeBindings = new Set(
    definition.capabilityRequirements
      .filter((requirement) => activeCapabilities.has(requirement.id))
      .map((requirement) => requirement.binding),
  );
  return project.resolution.capabilityTargets.filter(
    (target) =>
      (target.kind === "responsibility" &&
        activeRoles.has(target.responsibility)) ||
      (target.kind !== "responsibility" && activeBindings.has(target.binding)),
  );
}

function appendGuidance(
  lines: string[],
  heading: string,
  content: string | null,
): void {
  if (content === null) {
    return;
  }
  lines.push("", heading, "", content);
}

function providerForRole(
  project: PrivateResolvedDomainProject,
  role: CandidateRole,
): string {
  const providerId = project.normalizedIntent.roles[role];
  const provider = project.normalizedIntent.providers.find(
    (candidate) => candidate.id === providerId,
  );
  return provider
    ? `\`${provider.id}\` using \`${provider.product}\``
    : `\`${providerId}\``;
}

function trackerName(
  mode: PrivateResolvedDomainProject["resolution"]["tracker"]["mode"],
): string {
  switch (mode) {
    case "linear":
      return "Linear";
    case "github-issues":
      return "GitHub Issues";
    case "local":
      return "the local tracker";
    case "none":
      return "no tracker";
  }
}

function hasArtifactPolicy(
  project: PrivateResolvedDomainProject,
  kind: "forbids-valid-artifact" | "requires-valid-artifact",
  artifact: string,
): boolean {
  return project.workflowCompilation.definition.policies.some(
    (policy) => policy.kind === kind && policy.artifact === artifact,
  );
}

function appendOperationalProcedure(
  lines: string[],
  project: PrivateResolvedDomainProject,
  role: CandidateRole,
): void {
  const reviewerIsolationRequired = hasArtifactPolicy(
    project,
    "requires-valid-artifact",
    "ReviewerIsolationEvidence",
  );
  const blockingFindingsForbidden = hasArtifactPolicy(
    project,
    "forbids-valid-artifact",
    "BlockingFinding",
  );
  lines.push("", "#### Operational procedure", "");
  if (
    project.normalizedIntent.workflow.family ===
    "issue-to-reviewed-pull-request"
  ) {
    const workflow = project.normalizedIntent.workflow;
    switch (role) {
      case "steward":
        lines.push(
          `1. Prepare an explicit implementation plan and create the corresponding work item in ${trackerName(project.resolution.tracker.mode)} before delegation.`,
          `2. Delegate the accepted plan and work-item identity to the Developer, ${providerForRole(project, "developer")}.`,
          `3. Monitor creation of the \`${workflow.initialState}\` pull request and the required CI result for its current revision.`,
          "4. When CI fails, send the exact failing evidence back to the Developer for repair, then observe the new pull-request revision and CI again.",
        );
        if (workflow.initialState === "draft") {
          lines.push(
            "5. After required CI passes, mark the draft pull request ready for review.",
          );
        } else {
          lines.push(
            "5. The pull request starts ready; do not add a draft-to-ready step.",
          );
        }
        lines.push(
          "6. Auxiliary review is disabled. Do not start or wait for an additional reviewer service.",
        );
        lines.push(
          reviewerIsolationRequired
            ? `7. Ask the Reviewer, ${providerForRole(project, "reviewer")}, to review the current revision from a clean execution context.`
            : `7. Ask the Reviewer, ${providerForRole(project, "reviewer")}, to review the current revision.`,
          reviewerIsolationRequired && blockingFindingsForbidden
            ? `8. Authorize and perform a \`${workflow.mergeMethod}\` merge only after current-revision CI, the current review verdict, and reviewer-isolation evidence are valid and no blocking finding remains.`
            : `8. Authorize and perform a \`${workflow.mergeMethod}\` merge only after current-revision CI and the current review verdict are valid.`,
        );
        break;
      case "developer":
        lines.push(
          "1. Accept the delegated plan and work-item identity; do not silently expand their scope.",
          `2. Implement and verify the change, then create a \`${workflow.initialState}\` pull request for the resulting revision.`,
          "3. Report the pull-request identity and current revision to the Steward.",
          "4. When CI or review requests repair, address the reported findings, rerun relevant verification, and publish the new revision for observation.",
          "5. Do not approve, authorize, or merge your own work.",
        );
        break;
      case "reviewer":
        lines.push(
          reviewerIsolationRequired
            ? "1. Begin review from a clean execution context distinct from the Developer's implementation context."
            : "1. Review the current pull-request revision in the Reviewer responsibility.",
          "2. Review only the current pull-request revision and verify that required CI evidence belongs to that revision.",
        );
        lines.push(
          "3. Auxiliary review is disabled. Do not invoke or wait for an additional reviewer service.",
        );
        lines.push(
          blockingFindingsForbidden
            ? "4. Report actionable blocking findings or issue an approval verdict only when no blocking finding remains. Never repair the implementation while acting as the Reviewer."
            : "4. Report actionable findings or issue an approval verdict. Never repair the implementation while acting as the Reviewer.",
          reviewerIsolationRequired
            ? "5. Treat a verdict as stale after any repair or revision change; review the new revision again from a clean context."
            : "5. Treat a verdict as stale after any repair or revision change; review the new revision again.",
        );
        break;
    }
    return;
  }

  switch (role) {
    case "steward":
      lines.push(
        "1. Prepare and communicate an explicit plan before implementation starts.",
        `2. Hand the accepted plan to the Developer, ${providerForRole(project, "developer")}.`,
        reviewerIsolationRequired && blockingFindingsForbidden
          ? "3. Treat the change as accepted only when current verification, the current review verdict, and reviewer-isolation evidence are valid and no blocking finding remains."
          : "3. Do not treat implementation completion as acceptance; require current verification and a current review verdict.",
      );
      break;
    case "developer":
      lines.push(
        "1. Implement only the accepted plan.",
        "2. Run the relevant repository verification and report the result before review.",
        "3. Return requested changes to review after re-verification; do not approve your own work.",
      );
      break;
    case "reviewer":
      lines.push(
        reviewerIsolationRequired
          ? "1. Begin review from a clean execution context distinct from the Developer's implementation context."
          : "1. Review the implementation in the Reviewer responsibility.",
        "2. Review the implementation and its current verification evidence.",
        blockingFindingsForbidden
          ? "3. Return actionable blocking findings for rework or issue an explicit acceptance verdict only when no blocking finding remains."
          : "3. Return actionable findings for rework or issue an explicit acceptance verdict.",
        "4. Treat prior review evidence as stale after implementation changes.",
      );
      break;
  }
}

function providerContent(
  project: PrivateResolvedDomainProject,
  product: CandidateProviderProduct,
  providerId: string,
  roles: readonly CandidateRole[],
  guidance: PrivateProjectGuidance,
): { readonly content: string; readonly sourcePaths: readonly string[] } {
  const activeRoles = new Set(roles);
  const lines = [
    "# Agent development flow",
    "",
    "Use this project protocol when planning, implementing, reviewing, or preparing a completion transition.",
    "",
    "## Shared protocol",
    "",
    `- Preset: \`${project.resolution.preset.name}\``,
    `- Workflow family: \`${project.resolution.workflow.family}\``,
    `- Tracker mode: \`${project.resolution.tracker.mode}\``,
  ];

  if (
    project.normalizedIntent.workflow.family ===
    "issue-to-reviewed-pull-request"
  ) {
    lines.push(
      `- Pull request initial state: \`${project.normalizedIntent.workflow.initialState}\``,
      `- Auxiliary review: \`${project.normalizedIntent.workflow.auxiliaryReview}\``,
      `- Merge method: \`${project.normalizedIntent.workflow.mergeMethod}\``,
    );
  }

  lines.push(
    "",
    "- Generated instructions are advisory and do not authorize transitions, authenticate evidence producers, or prove semantic truth.",
    "- Before advancing the workflow, verify the concrete prerequisite stated in the active responsibility procedure for the current revision.",
    "- Do not perform transitions assigned to a responsibility that is not active for the current task.",
    "- If a required tool, integration, permission, or configured capability is unavailable, stop at that step and report the exact missing capability. Do not simulate success.",
    "- Pull request readiness is not merge authorization.",
    "- Do not silently substitute a weaker provider mechanism for a configured requirement.",
  );
  appendGuidance(lines, "## Shared user guidance", guidance.shared);

  lines.push("", "## Active responsibilities", "");
  if (roles.length === 0) {
    lines.push(
      `Provider \`${providerId}\` using \`${product}\` has no assigned workflow responsibility. Do not perform a workflow transition until the project configuration assigns one.`,
    );
  } else if (roles.length === 1) {
    lines.push(
      `Act as the ${title(roles[0] ?? "")} through provider \`${providerId}\` using \`${product}\`. Follow only this responsibility for the current action.`,
    );
  } else {
    lines.push(
      `Provider \`${providerId}\` using \`${product}\` holds multiple responsibilities. Before acting, identify the active responsibility required by the current task and follow only that responsibility section.`,
    );
  }

  for (const role of roles) {
    lines.push("", `### ${title(role)}`, "");
    appendOperationalProcedure(lines, project, role);
    appendGuidance(
      lines,
      `#### ${title(role)} user guidance`,
      guidance[role],
    );
  }

  const targets = activeTargets(project, activeRoles);
  if (targets.length > 0) {
    lines.push("", "## Applicable capability targets", "");
    for (const target of targets) {
      lines.push(`- \`${target.binding}\`: ${targetText(target)}.`);
    }
  }

  lines.push("");
  const sourcePaths = [
    ...(guidance.shared === null ? [] : [privateProjectGuidancePaths.shared]),
    ...roles.flatMap((role) =>
      guidance[role] === null ? [] : [privateProjectGuidancePaths[role]],
    ),
  ].sort(compareText);
  return { content: lines.join("\n"), sourcePaths };
}

export function composePrivateProviderInstructionViews(
  project: PrivateResolvedDomainProject,
  guidance: PrivateProjectGuidance,
): PrivateProviderInstructionCompositionResult {
  const providersByProduct = new Map<
    CandidateProviderProduct,
    Map<string, (typeof project.normalizedIntent.providers)[number]>
  >();
  for (const provider of project.normalizedIntent.providers) {
    const providers =
      providersByProduct.get(provider.product) ??
      new Map<string, typeof provider>();
    providers.set(provider.id, provider);
    providersByProduct.set(provider.product, providers);
  }

  const diagnostics: PrivateProjectGuidanceDiagnostic[] = [];
  for (const [product, providers] of providersByProduct) {
    if (providers.size > 1) {
      diagnostics.push({
        stage: "planning",
        code: "PROVIDER_PRODUCT_TARGET_AMBIGUOUS",
        path: "$.providers",
        message: `Provider product ${product} has multiple configured ids (${[...providers.keys()].sort(compareText).join(", ")}), but its native instruction target cannot isolate them.`,
      });
    }
  }
  if (diagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: diagnostics.sort((left, right) =>
        compareText(left.message, right.message),
      ),
    };
  }

  const views: PrivateProviderInstructionView[] = [];
  for (const [product, providers] of providersByProduct) {
    const provider = [...providers.values()][0];
    if (!provider) {
      continue;
    }
    const roles = roleOrder.filter(
      (role) => project.normalizedIntent.roles[role] === provider.id,
    );
    const composed = providerContent(
      project,
      product,
      provider.id,
      roles,
      guidance,
    );
    views.push({
      product,
      providerId: provider.id,
      responsibilities: roles,
      content: composed.content,
      sourcePaths: composed.sourcePaths,
    });
  }
  return {
    ok: true,
    views: views.sort((left, right) =>
      compareText(left.product, right.product),
    ),
  };
}
