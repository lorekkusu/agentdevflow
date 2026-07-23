import { createHash } from "node:crypto";

import type {
  CandidateProviderInstance,
  CandidateRole,
  CandidateRoleBindings,
} from "../config/candidate.js";
import type {
  PrivateDomainCapabilityObservation,
  PrivateDomainWorkflowCompilation,
  PrivateDomainWorkflowDiagnostic,
} from "../compiler/private-domain-workflow.js";
import {
  compilePrivateDomainWorkflow,
} from "../compiler/private-domain-workflow.js";
import {
  expandPrivateDomainPreset,
  type PrivateDomainPreset,
  type PrivateDomainPresetExpansionDiagnostic,
} from "./private-domain-preset.js";
import {
  createPrivateIssueToReviewedPullRequestDefinition,
  type PrivateIssueToPullRequestOptions,
} from "../workflows/private-issue-to-reviewed-pull-request.js";
import { privateLocalReviewedChangeDefinition } from "../workflows/private-local-reviewed-change.js";

export const privateDomainProjectIntentRevision = 1;
export const privateDomainProjectResolutionRevision = 1;

export type PrivateDomainTrackerMode =
  | "github-issues"
  | "linear"
  | "local"
  | "none";

export type PrivateDomainWorkflowIntent =
  | ({ readonly family: "issue-to-reviewed-pull-request" } &
      PrivateIssueToPullRequestOptions)
  | { readonly family: "local-reviewed-change" };

export type PrivateDomainCapabilityTarget =
  | {
      readonly kind: "responsibility";
      readonly responsibility: CandidateRole;
    }
  | { readonly kind: "tracker" }
  | { readonly kind: "external"; readonly id: string };

export interface PrivateDomainCapabilityBinding {
  readonly binding: string;
  readonly target: PrivateDomainCapabilityTarget;
}

/**
 * Typed internal representation of the revision-1 serialized project document.
 * The JSONC parser and schema remain the public input boundary.
 */
export interface PrivateDomainProjectIntent {
  readonly revision: 1;
  readonly preset: PrivateDomainPreset;
  readonly providers: readonly CandidateProviderInstance[];
  readonly roles: CandidateRoleBindings;
  readonly tracker: { readonly mode: PrivateDomainTrackerMode };
  readonly workflow: PrivateDomainWorkflowIntent;
  readonly capabilityBindings: readonly PrivateDomainCapabilityBinding[];
}

export interface PrivateResolvedResponsibility {
  readonly responsibility: CandidateRole;
  readonly provider: CandidateProviderInstance;
}

export type PrivateResolvedCapabilityTarget =
  | {
      readonly binding: string;
      readonly kind: "responsibility";
      readonly responsibility: CandidateRole;
      readonly provider: CandidateProviderInstance;
    }
  | {
      readonly binding: string;
      readonly kind: "tracker";
      readonly tracker: "github-issues" | "linear";
    }
  | {
      readonly binding: string;
      readonly kind: "external";
      readonly id: string;
    };

export interface PrivateDomainProjectResolution {
  readonly revision: 1;
  readonly intentDigest: string;
  readonly preset: {
    readonly name: "balanced" | "fast";
    readonly expansionRevision: 1;
    readonly expansionDigest: string;
  };
  readonly workflow: {
    readonly family: PrivateDomainWorkflowIntent["family"];
    readonly definitionId: string;
    readonly definitionRevision: number;
    readonly compilationDigest: string;
  };
  readonly tracker: { readonly mode: PrivateDomainTrackerMode };
  readonly responsibilities: readonly PrivateResolvedResponsibility[];
  readonly capabilityTargets: readonly PrivateResolvedCapabilityTarget[];
}

export type PrivateDomainProjectResolutionDiagnostic =
  | PrivateDomainPresetExpansionDiagnostic
  | {
      readonly code:
        | "CAPABILITY_BINDING_DUPLICATED"
        | "CAPABILITY_BINDING_MISSING"
        | "CAPABILITY_BINDING_UNEXPECTED"
        | "CAPABILITY_TARGET_INVALID"
        | "PROVIDER_DUPLICATED"
        | "PROVIDER_IDENTIFIER_INVALID"
        | "PROVIDER_REFERENCE_UNKNOWN"
        | "TRACKER_INCOMPATIBLE";
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly code: "WORKFLOW_COMPILATION_FAILED";
      readonly path: "$.workflow";
      readonly message: string;
      readonly causes: readonly PrivateDomainWorkflowDiagnostic[];
    };

export type PrivateDomainProjectResolutionResult =
  | {
      readonly ok: true;
      readonly normalizedIntent: PrivateDomainProjectIntent;
      readonly intentCanonicalJson: string;
      readonly workflowCompilation: PrivateDomainWorkflowCompilation;
      readonly resolution: PrivateDomainProjectResolution;
      readonly resolutionCanonicalJson: string;
      readonly resolutionDigest: string;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly PrivateDomainProjectResolutionDiagnostic[];
    };

export interface PrivateDomainProjectResolutionOptions {
  readonly capabilityObservations: readonly PrivateDomainCapabilityObservation[];
}

const providerIdentifierPattern = /^[a-z][a-z0-9-]*$/u;
const externalIdentifierPattern = /^[a-z][a-z0-9.-]*$/u;
const responsibilities: readonly CandidateRole[] = [
  "developer",
  "reviewer",
  "steward",
];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.keys(record)
        .sort(compareText)
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function diagnosticOrder(
  left: PrivateDomainProjectResolutionDiagnostic,
  right: PrivateDomainProjectResolutionDiagnostic,
): number {
  return (
    compareText(left.path, right.path) ||
    compareText(left.code, right.code) ||
    compareText(left.message, right.message)
  );
}

function normalizedTarget(
  target: PrivateDomainCapabilityTarget,
): PrivateDomainCapabilityTarget {
  switch (target.kind) {
    case "external":
      return { kind: "external", id: target.id };
    case "responsibility":
      return {
        kind: "responsibility",
        responsibility: target.responsibility,
      };
    case "tracker":
      return { kind: "tracker" };
  }
}

function normalizeIntent(
  intent: PrivateDomainProjectIntent,
): PrivateDomainProjectIntent {
  return {
    revision: privateDomainProjectIntentRevision,
    preset: intent.preset,
    providers: [...intent.providers].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    roles: {
      developer: intent.roles.developer,
      reviewer: intent.roles.reviewer,
      steward: intent.roles.steward,
    },
    tracker: { mode: intent.tracker.mode },
    workflow:
      intent.workflow.family === "issue-to-reviewed-pull-request"
        ? {
            family: intent.workflow.family,
            initialState: intent.workflow.initialState,
            auxiliaryReview: intent.workflow.auxiliaryReview,
            mergeMethod: intent.workflow.mergeMethod,
          }
        : { family: intent.workflow.family },
    capabilityBindings: [...intent.capabilityBindings]
      .map((binding) => ({
        binding: binding.binding,
        target: normalizedTarget(binding.target),
      }))
      .sort((left, right) => compareText(left.binding, right.binding)),
  };
}

function expectedTargetKind(
  binding: string,
):
  | { readonly kind: "responsibility"; readonly responsibility: CandidateRole }
  | { readonly kind: "tracker" }
  | { readonly kind: "external" }
  | undefined {
  switch (binding) {
    case "developer":
      return { kind: "responsibility", responsibility: "developer" };
    case "reviewer":
      return { kind: "responsibility", responsibility: "reviewer" };
    case "tracker":
      return { kind: "tracker" };
    case "ci":
    case "pull-request-host":
      return { kind: "external" };
    default:
      return undefined;
  }
}

export function resolvePrivateDomainProject(
  intent: PrivateDomainProjectIntent,
  options: PrivateDomainProjectResolutionOptions,
): PrivateDomainProjectResolutionResult {
  const diagnostics: PrivateDomainProjectResolutionDiagnostic[] = [];
  const providerById = new Map<string, CandidateProviderInstance>();

  for (const [index, provider] of intent.providers.entries()) {
    if (!providerIdentifierPattern.test(provider.id)) {
      diagnostics.push({
        code: "PROVIDER_IDENTIFIER_INVALID",
        path: `$.providers[${index}].id`,
        message: `Provider id ${provider.id} is not a valid private identifier.`,
      });
    }
    if (providerById.has(provider.id)) {
      diagnostics.push({
        code: "PROVIDER_DUPLICATED",
        path: `$.providers[${index}].id`,
        message: `Provider id ${provider.id} is duplicated.`,
      });
    } else {
      providerById.set(provider.id, provider);
    }
  }

  const resolvedResponsibilities: PrivateResolvedResponsibility[] = [];
  for (const responsibility of responsibilities) {
    const providerId = intent.roles[responsibility];
    const provider = providerById.get(providerId);
    if (provider === undefined) {
      diagnostics.push({
        code: "PROVIDER_REFERENCE_UNKNOWN",
        path: `$.roles.${responsibility}`,
        message: `Responsibility ${responsibility} references unknown provider ${providerId}.`,
      });
    } else {
      resolvedResponsibilities.push({ responsibility, provider });
    }
  }

  const issueWorkflow =
    intent.workflow.family === "issue-to-reviewed-pull-request";
  if (
    (issueWorkflow &&
      intent.tracker.mode !== "github-issues" &&
      intent.tracker.mode !== "linear") ||
    (!issueWorkflow &&
      intent.tracker.mode !== "local" &&
      intent.tracker.mode !== "none")
  ) {
    diagnostics.push({
      code: "TRACKER_INCOMPATIBLE",
      path: "$.tracker.mode",
      message: `Tracker mode ${intent.tracker.mode} is incompatible with workflow family ${intent.workflow.family}.`,
    });
  }

  const baseDefinition = issueWorkflow
    ? createPrivateIssueToReviewedPullRequestDefinition(intent.workflow)
    : privateLocalReviewedChangeDefinition;
  const presetExpansion = expandPrivateDomainPreset(
    intent.preset,
    intent.workflow.family,
    baseDefinition,
  );
  if (!presetExpansion.ok) {
    return {
      ok: false,
      diagnostics: [...diagnostics, ...presetExpansion.diagnostics].sort(
        diagnosticOrder,
      ),
    };
  }
  const { definition } = presetExpansion.expansion;
  const requiredBindings = [
    ...new Set(
      definition.capabilityRequirements.map((requirement) => requirement.binding),
    ),
  ].sort(compareText);
  const requiredBindingSet = new Set(requiredBindings);
  const bindingByName = new Map<string, PrivateDomainCapabilityBinding>();

  for (const [index, binding] of intent.capabilityBindings.entries()) {
    if (bindingByName.has(binding.binding)) {
      diagnostics.push({
        code: "CAPABILITY_BINDING_DUPLICATED",
        path: `$.capabilityBindings[${index}].binding`,
        message: `Capability binding ${binding.binding} is duplicated.`,
      });
      continue;
    }
    bindingByName.set(binding.binding, binding);
    if (!requiredBindingSet.has(binding.binding)) {
      diagnostics.push({
        code: "CAPABILITY_BINDING_UNEXPECTED",
        path: `$.capabilityBindings[${index}].binding`,
        message: `Capability binding ${binding.binding} is not used by workflow ${definition.id}.`,
      });
    }
  }

  for (const binding of requiredBindings) {
    if (!bindingByName.has(binding)) {
      diagnostics.push({
        code: "CAPABILITY_BINDING_MISSING",
        path: "$.capabilityBindings",
        message: `Workflow ${definition.id} requires capability binding ${binding}.`,
      });
    }
  }

  const resolvedTargets: PrivateResolvedCapabilityTarget[] = [];
  for (const bindingName of requiredBindings) {
    const binding = bindingByName.get(bindingName);
    const expected = expectedTargetKind(bindingName);
    if (binding === undefined) {
      continue;
    }
    if (expected === undefined || binding.target.kind !== expected.kind) {
      diagnostics.push({
        code: "CAPABILITY_TARGET_INVALID",
        path: `$.capabilityBindings.${bindingName}`,
        message: `Capability binding ${bindingName} has an invalid target kind.`,
      });
      continue;
    }

    if (binding.target.kind === "responsibility") {
      if (
        expected.kind !== "responsibility" ||
        binding.target.responsibility !== expected.responsibility
      ) {
        diagnostics.push({
          code: "CAPABILITY_TARGET_INVALID",
          path: `$.capabilityBindings.${bindingName}`,
          message: `Capability binding ${bindingName} must target responsibility ${expected.kind === "responsibility" ? expected.responsibility : "unknown"}.`,
        });
        continue;
      }
      const provider = providerById.get(
        intent.roles[binding.target.responsibility],
      );
      if (provider !== undefined) {
        resolvedTargets.push({
          binding: bindingName,
          kind: "responsibility",
          responsibility: binding.target.responsibility,
          provider,
        });
      }
      continue;
    }

    if (binding.target.kind === "tracker") {
      if (
        intent.tracker.mode === "github-issues" ||
        intent.tracker.mode === "linear"
      ) {
        resolvedTargets.push({
          binding: bindingName,
          kind: "tracker",
          tracker: intent.tracker.mode,
        });
      }
      continue;
    }

    if (!externalIdentifierPattern.test(binding.target.id)) {
      diagnostics.push({
        code: "CAPABILITY_TARGET_INVALID",
        path: `$.capabilityBindings.${bindingName}.target.id`,
        message: `External target id ${binding.target.id} is not a valid private identifier.`,
      });
      continue;
    }
    resolvedTargets.push({
      binding: bindingName,
      kind: "external",
      id: binding.target.id,
    });
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: diagnostics.sort(diagnosticOrder) };
  }

  const workflow = compilePrivateDomainWorkflow(definition, {
    capabilityObservations: options.capabilityObservations,
  });
  if (!workflow.ok) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "WORKFLOW_COMPILATION_FAILED",
          path: "$.workflow",
          message: `Workflow ${definition.id} did not compile into the authoritative project workflow.`,
          causes: workflow.diagnostics,
        },
      ],
    };
  }

  const normalizedIntent = normalizeIntent(intent);
  const intentCanonicalJson = canonicalJson(normalizedIntent);
  const intentDigest = digestText(intentCanonicalJson);
  const resolution: PrivateDomainProjectResolution = {
    revision: privateDomainProjectResolutionRevision,
    intentDigest,
    preset: {
      name: presetExpansion.expansion.preset,
      expansionRevision: presetExpansion.expansion.revision,
      expansionDigest: presetExpansion.expansion.expansionDigest,
    },
    workflow: {
      family: intent.workflow.family,
      definitionId: workflow.compilation.definition.id,
      definitionRevision: workflow.compilation.definition.revision,
      compilationDigest: workflow.compilation.compilationDigest,
    },
    tracker: { mode: intent.tracker.mode },
    responsibilities: resolvedResponsibilities.sort((left, right) =>
      compareText(left.responsibility, right.responsibility),
    ),
    capabilityTargets: resolvedTargets.sort((left, right) =>
      compareText(left.binding, right.binding),
    ),
  };
  const resolutionCanonicalJson = canonicalJson(resolution);

  return {
    ok: true,
    normalizedIntent,
    intentCanonicalJson,
    workflowCompilation: workflow.compilation,
    resolution,
    resolutionCanonicalJson,
    resolutionDigest: digestText(resolutionCanonicalJson),
  };
}
