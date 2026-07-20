import { createHash } from "node:crypto";

import type { CandidateCompilation } from "../compiler/private-model.js";
import { analyzePrivateProjectInstructionsImport } from "../import/private-project-instructions-analyzer.js";
import { renderRequestFromMaterialization } from "../renderer/from-compilation.js";
import {
  validatePrivateRendererSourceMaterialization,
  type PrivateRendererSourceMaterialization,
} from "../renderer/materialize-compilation.js";
import type {
  InitializationImportAuthorization,
  RenderPlan,
  RendererBackend,
} from "../renderer/contract.js";
import type { PrivateConvergentWorkspace } from "../workspace/private-filesystem-workspace.js";
import { normalizeCandidateProjectConfig } from "../config/normalize-candidate.js";
import {
  executePrivateRenderCommand,
  type PrivateRenderCommandFaultInjector,
  type PrivateRenderCommandResult,
} from "./private-render-command-service.js";
import {
  createPrivateRenderPlanSnapshot,
  validatePrivateRenderPlanSnapshot,
  type PrivateRenderPlanSnapshot,
} from "./private-render-plan-snapshot.js";
import {
  privateInitProposalRevision,
  privateInitProviderPaths,
  type PrivateInitCommandResult,
  type PrivateInitDisposition,
  type PrivateInitProposalEntry,
} from "./private-init-command-service.js";
import type { PrivateConvergentApplyFaultInjector } from "../renderer/private-convergent-apply.js";

export const privateInitApprovalRevision = 1;
export const privateApprovedInitRenderRevision = 1;

type ApprovedDisposition = Exclude<PrivateInitDisposition, "abort">;

export interface PrivateInitApprovalEntry {
  readonly provider: PrivateInitProposalEntry["provider"];
  readonly path: string;
  readonly disposition: ApprovedDisposition;
  readonly observedDigest: string | null;
  readonly targetDigest: string;
}

export interface PrivateInitApprovalEnvelope {
  readonly revision: number;
  readonly proposalDigest: string;
  readonly entries: readonly PrivateInitApprovalEntry[];
  readonly digest: string;
}

export interface PrivateApprovedInitRenderPlan {
  readonly revision: number;
  readonly proposalDigest: string;
  readonly approvalDigest: string;
  readonly snapshot: PrivateRenderPlanSnapshot;
  readonly digest: string;
}

export type PrivateApprovedInitRenderErrorCode =
  | "PRIVATE_INIT_PROPOSAL_INVALID"
  | "PRIVATE_INIT_APPROVAL_INVALID"
  | "PRIVATE_INIT_APPROVAL_MISMATCH"
  | "PRIVATE_INIT_OBSERVATION_STALE"
  | "PRIVATE_INIT_IMPORT_NOT_LOSSLESS"
  | "PRIVATE_INIT_RENDER_PLAN_INVALID"
  | "PRIVATE_INIT_PREPARED_PLAN_INVALID";

export class PrivateApprovedInitRenderError extends Error {
  override readonly name = "PrivateApprovedInitRenderError";

  constructor(
    readonly code: PrivateApprovedInitRenderErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
  }
}

export interface PreparePrivateApprovedInitRenderOptions {
  readonly proposal: PrivateInitCommandResult;
  readonly approval: PrivateInitApprovalEnvelope;
  readonly compilation: CandidateCompilation;
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly backend: RendererBackend;
  readonly workspace: PrivateConvergentWorkspace;
}

export interface ExecutePrivateApprovedInitRenderOptions {
  readonly proposal: PrivateInitCommandResult;
  readonly approval: PrivateInitApprovalEnvelope;
  readonly prepared: PrivateApprovedInitRenderPlan;
  readonly materialization: PrivateRendererSourceMaterialization;
  readonly lockPath: string;
  readonly workspace: PrivateConvergentWorkspace;
  readonly applyFaultInjector?: PrivateConvergentApplyFaultInjector;
  readonly faultInjector?: PrivateRenderCommandFaultInjector;
}

export interface PrivateApprovedInitRenderResult {
  readonly preparedDigest: string;
  readonly command: PrivateRenderCommandResult;
}

const sha256Pattern = /^[a-f0-9]{64}$/u;
const approvedDispositions = new Set<PrivateInitDisposition>([
  "create",
  "adopt",
  "import",
]);
const observedStates = new Set(["absent", "present"]);

function digestText(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function digestValue(value: unknown): string {
  return digestText(JSON.stringify(value));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: unknown,
  expected: readonly string[],
): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const actual = Object.keys(value).sort(compareText);
  const sortedExpected = [...expected].sort(compareText);
  return sameStrings(actual, sortedExpected);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function proposalFailure(message: string, path?: string): never {
  throw new PrivateApprovedInitRenderError(
    "PRIVATE_INIT_PROPOSAL_INVALID",
    message,
    path,
  );
}

function proposalDigestValue(proposal: PrivateInitCommandResult): unknown {
  return {
    revision: privateInitProposalRevision,
    outcome: proposal.outcome,
    candidateExitCode: proposal.candidateExitCode,
    proposedConfiguration: proposal.proposedConfiguration === null
      ? null
      : {
          revision: proposal.proposedConfiguration.revision,
          canonicalJson: proposal.proposedConfiguration.canonicalJson,
          digest: proposal.proposedConfiguration.digest,
        },
    entries: proposal.entries.map((entry) => ({
      provider: entry.provider,
      path: entry.path,
      disposition: entry.disposition,
      observedState: entry.observedState,
      observedDigest: entry.observedDigest,
      targetDigest: entry.targetDigest,
      targetContent: entry.targetContent,
      sourceRefs: entry.sourceRefs,
      informationLoss: entry.informationLoss,
      requiresExplicitApproval: entry.requiresExplicitApproval,
    })),
    diagnostics: proposal.diagnostics,
  };
}

export function createPrivateInitProposalDigest(
  proposal: PrivateInitCommandResult,
): string {
  if (
    !hasExactKeys(proposal, [
      "outcome",
      "candidateExitCode",
      "proposedConfiguration",
      "entries",
      "diagnostics",
    ])
  ) {
    return proposalFailure(
      "Private init proposal has unexpected or missing fields.",
    );
  }
  if (!Array.isArray(proposal.entries) || !Array.isArray(proposal.diagnostics)) {
    return proposalFailure("Private init proposal arrays are malformed.");
  }
  const configuration = proposal.proposedConfiguration;
  if (configuration === null) {
    return proposalFailure("A blocked private init proposal cannot be approved.");
  }
  if (
    !hasExactKeys(configuration, [
      "revision",
      "value",
      "canonicalJson",
      "digest",
    ])
  ) {
    return proposalFailure(
      "Private init proposal configuration has unexpected or missing fields.",
    );
  }
  const normalized = normalizeCandidateProjectConfig(configuration.value);
  if (
    !normalized.ok ||
    configuration.revision !== privateInitProposalRevision ||
    configuration.canonicalJson !== normalized.canonicalJson ||
    configuration.digest !== normalized.digest
  ) {
    return proposalFailure(
      "The private init proposal configuration is invalid or inconsistent.",
    );
  }
  if (proposal.diagnostics.length !== 0) {
    return proposalFailure(
      "Only a private init proposal without diagnostics can be approved for rendering.",
    );
  }

  const expectedProviders = [
    ...new Set(normalized.config.providers.map((provider) => provider.product)),
  ].sort(compareText);
  const entries: PrivateInitProposalEntry[] = [
    ...(proposal.entries as readonly PrivateInitProposalEntry[]),
  ];
  const sortedPaths = entries.map((entry) => entry.path).sort(compareText);
  if (!sameStrings(entries.map((entry) => entry.path), sortedPaths)) {
    return proposalFailure("Private init proposal entries must be sorted by path.");
  }
  if (new Set(sortedPaths).size !== entries.length) {
    return proposalFailure("Private init proposal paths must be unique.");
  }
  const actualProviders = entries.map((entry) => entry.provider).sort(compareText);
  if (!sameStrings(actualProviders, expectedProviders)) {
    return proposalFailure(
      "Private init proposal entries do not match the configured provider products.",
    );
  }

  let hasImport = false;
  for (const entry of entries) {
    if (
      !hasExactKeys(entry, [
        "provider",
        "path",
        "disposition",
        "observedState",
        "observedDigest",
        "targetDigest",
        "targetContent",
        "sourceRefs",
        "informationLoss",
        "requiresExplicitApproval",
      ]) ||
      !Array.isArray(entry.sourceRefs) ||
      !Array.isArray(entry.informationLoss) ||
      typeof entry.provider !== "string" ||
      !(entry.provider in privateInitProviderPaths) ||
      typeof entry.path !== "string" ||
      typeof entry.targetContent !== "string" ||
      typeof entry.targetDigest !== "string" ||
      !sha256Pattern.test(entry.targetDigest) ||
      typeof entry.disposition !== "string" ||
      !approvedDispositions.has(entry.disposition) ||
      typeof entry.observedState !== "string" ||
      !observedStates.has(entry.observedState) ||
      entry.sourceRefs.some((value) => typeof value !== "string") ||
      entry.informationLoss.some((value) => typeof value !== "string") ||
      typeof entry.requiresExplicitApproval !== "boolean"
    ) {
      return proposalFailure(
        "Private init proposal entry has unexpected, missing, or malformed fields.",
      );
    }
    if (entry.path !== privateInitProviderPaths[entry.provider]) {
      return proposalFailure(
        `Private init proposal path does not match provider ${entry.provider}.`,
        entry.path,
      );
    }
    if (digestText(entry.targetContent) !== entry.targetDigest) {
      return proposalFailure(
        "Private init proposal target digest does not match its content.",
        entry.path,
      );
    }
    if (
      entry.sourceRefs.length === 0 ||
      !sameStrings(
        entry.sourceRefs,
        [...new Set(entry.sourceRefs)].sort(compareText),
      )
    ) {
      return proposalFailure(
        "Private init proposal source references must be non-empty, unique, and sorted.",
        entry.path,
      );
    }
    if (entry.disposition === "abort") {
      return proposalFailure("An abort disposition cannot be approved.", entry.path);
    }
    if (entry.informationLoss.length !== 0) {
      return proposalFailure(
        "Lossy private init imports cannot be approved for rendering.",
        entry.path,
      );
    }
    if (entry.disposition === "create") {
      if (
        entry.observedState !== "absent" ||
        entry.observedDigest !== null ||
        entry.requiresExplicitApproval
      ) {
        return proposalFailure("Create disposition state is inconsistent.", entry.path);
      }
    } else {
      if (
        entry.observedState !== "present" ||
        entry.observedDigest === null ||
        !sha256Pattern.test(entry.observedDigest) ||
        !entry.requiresExplicitApproval
      ) {
        return proposalFailure(
          `${entry.disposition} disposition state is inconsistent.`,
          entry.path,
        );
      }
      if (
        (entry.disposition === "adopt" &&
          entry.observedDigest !== entry.targetDigest) ||
        (entry.disposition === "import" &&
          entry.observedDigest === entry.targetDigest)
      ) {
        return proposalFailure(
          `${entry.disposition} disposition digests are inconsistent.`,
          entry.path,
        );
      }
      hasImport ||= entry.disposition === "import";
    }
  }

  const expectedOutcome = hasImport ? "review-required" : "ready";
  const expectedExitCode = hasImport ? 1 : 0;
  if (
    proposal.outcome !== expectedOutcome ||
    proposal.candidateExitCode !== expectedExitCode
  ) {
    return proposalFailure("Private init proposal outcome is inconsistent.");
  }
  return digestValue(proposalDigestValue(proposal));
}

function approvalEntries(
  proposal: PrivateInitCommandResult,
): PrivateInitApprovalEntry[] {
  return proposal.entries.map((entry) => ({
    provider: entry.provider,
    path: entry.path,
    disposition: entry.disposition as ApprovedDisposition,
    observedDigest: entry.observedDigest,
    targetDigest: entry.targetDigest,
  }));
}

function approvalDigestValue(
  revision: number,
  proposalDigest: string,
  entries: readonly PrivateInitApprovalEntry[],
): unknown {
  return { revision, proposalDigest, entries };
}

export function approvePrivateInitProposal(
  proposal: PrivateInitCommandResult,
): PrivateInitApprovalEnvelope {
  const proposalDigest = createPrivateInitProposalDigest(proposal);
  const entries = approvalEntries(proposal);
  return {
    revision: privateInitApprovalRevision,
    proposalDigest,
    entries,
    digest: digestValue(
      approvalDigestValue(privateInitApprovalRevision, proposalDigest, entries),
    ),
  };
}

function requireApproval(
  proposal: PrivateInitCommandResult,
  approval: PrivateInitApprovalEnvelope,
): void {
  if (
    !hasExactKeys(approval, [
      "revision",
      "proposalDigest",
      "entries",
      "digest",
    ]) ||
    !Array.isArray(approval.entries) ||
    approval.entries.some(
      (entry) =>
        !hasExactKeys(entry, [
          "provider",
          "path",
          "disposition",
          "observedDigest",
          "targetDigest",
        ]),
    ) ||
    approval.revision !== privateInitApprovalRevision ||
    !sha256Pattern.test(approval.proposalDigest) ||
    !sha256Pattern.test(approval.digest)
  ) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_APPROVAL_INVALID",
      "Private init approval metadata is invalid.",
    );
  }
  const proposalDigest = createPrivateInitProposalDigest(proposal);
  const expectedEntries = approvalEntries(proposal);
  const expectedDigest = digestValue(
    approvalDigestValue(approval.revision, approval.proposalDigest, approval.entries),
  );
  if (
    approval.proposalDigest !== proposalDigest ||
    JSON.stringify(approval.entries) !== JSON.stringify(expectedEntries) ||
    approval.digest !== expectedDigest
  ) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_APPROVAL_MISMATCH",
      "Private init approval does not match the complete proposal.",
    );
  }
}

function requirePlanMatchesProposal(
  plan: RenderPlan,
  proposal: PrivateInitCommandResult,
): void {
  if (!plan.safeToApply || Object.keys(plan.previousOwnership).length !== 0) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_RENDER_PLAN_INVALID",
      "Approved initialization requires a safe render plan with no previous ownership.",
    );
  }
  if (plan.files.length !== proposal.entries.length) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_RENDER_PLAN_INVALID",
      "Approved initialization render outputs do not match the proposal.",
    );
  }
  for (const entry of proposal.entries) {
    const file = plan.files.find((candidate) => candidate.path === entry.path);
    const expectedAction = entry.disposition === "create"
      ? "create"
      : entry.disposition === "adopt"
        ? "unchanged"
        : "update";
    if (
      !file ||
      file.action !== expectedAction ||
      file.observedDigest !== entry.observedDigest ||
      file.expectedDigest !== entry.targetDigest ||
      file.expectedContent !== entry.targetContent ||
      !sameStrings(file.sourceRefs, entry.sourceRefs)
    ) {
      throw new PrivateApprovedInitRenderError(
        "PRIVATE_INIT_RENDER_PLAN_INVALID",
        `Render plan does not preserve the approved initialization entry at ${entry.path}.`,
        entry.path,
      );
    }
  }
}

function preparedDigestValue(
  proposalDigest: string,
  approvalDigest: string,
  snapshotDigest: string,
): unknown {
  return {
    revision: privateApprovedInitRenderRevision,
    proposalDigest,
    approvalDigest,
    snapshotDigest,
  };
}

function requirePrepared(
  proposal: PrivateInitCommandResult,
  approval: PrivateInitApprovalEnvelope,
  prepared: PrivateApprovedInitRenderPlan,
): void {
  if (
    !hasExactKeys(prepared, [
      "revision",
      "proposalDigest",
      "approvalDigest",
      "snapshot",
      "digest",
    ])
  ) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_PREPARED_PLAN_INVALID",
      "Prepared initialization render plan has unexpected or missing fields.",
    );
  }
  requireApproval(proposal, approval);
  try {
    validatePrivateRenderPlanSnapshot(prepared.snapshot);
  } catch (error) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_PREPARED_PLAN_INVALID",
      `Prepared render snapshot is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const proposalDigest = createPrivateInitProposalDigest(proposal);
  const expectedDigest = digestValue(
    preparedDigestValue(
      prepared.proposalDigest,
      prepared.approvalDigest,
      prepared.snapshot.digest,
    ),
  );
  if (
    prepared.revision !== privateApprovedInitRenderRevision ||
    prepared.proposalDigest !== proposalDigest ||
    prepared.approvalDigest !== approval.digest ||
    prepared.digest !== expectedDigest
  ) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_PREPARED_PLAN_INVALID",
      "Prepared initialization render plan does not match its proposal and approval.",
    );
  }
  requirePlanMatchesProposal(prepared.snapshot.plan, proposal);
}

export async function preparePrivateApprovedInitRender(
  options: PreparePrivateApprovedInitRenderOptions,
): Promise<PrivateApprovedInitRenderPlan> {
  const { proposal, approval, compilation, materialization, backend, workspace } =
    options;
  requireApproval(proposal, approval);
  const configuration = proposal.proposedConfiguration;
  if (configuration === null || compilation.configDigest !== configuration.digest) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_PROPOSAL_INVALID",
      "Compilation does not belong to the approved candidate configuration.",
    );
  }
  validatePrivateRendererSourceMaterialization(materialization);

  const adoptPaths: string[] = [];
  const initializationImports: InitializationImportAuthorization[] = [];
  for (const entry of proposal.entries) {
    const current = await workspace.read(entry.path);
    const observedDigest = current === null ? null : digestText(current);
    if (observedDigest !== entry.observedDigest) {
      throw new PrivateApprovedInitRenderError(
        "PRIVATE_INIT_OBSERVATION_STALE",
        `Provider path no longer matches the approved observation: ${entry.path}`,
        entry.path,
      );
    }
    if (entry.disposition === "adopt") {
      adoptPaths.push(entry.path);
    } else if (entry.disposition === "import") {
      if (current === null) {
        throw new PrivateApprovedInitRenderError(
          "PRIVATE_INIT_OBSERVATION_STALE",
          `Import source is no longer present: ${entry.path}`,
          entry.path,
        );
      }
      const assessment = analyzePrivateProjectInstructionsImport({
        provider: entry.provider,
        existingContent: current,
        targetContent: entry.targetContent,
        proposedConfigurationDigest: configuration.digest,
      });
      if (
        assessment.classification !== "lossless" ||
        assessment.observedDigest !== entry.observedDigest ||
        assessment.proposedTargetDigest !== entry.targetDigest
      ) {
        throw new PrivateApprovedInitRenderError(
          "PRIVATE_INIT_IMPORT_NOT_LOSSLESS",
          `Import is not currently proven lossless: ${entry.path}`,
          entry.path,
        );
      }
      initializationImports.push({
        path: entry.path,
        observedDigest: entry.observedDigest,
        targetDigest: entry.targetDigest,
      });
    }
  }

  const request = renderRequestFromMaterialization(compilation, materialization, {
    ownership: {},
    adoptPaths,
    initializationImports,
  });
  const plan = await backend.plan(request, workspace);
  if (
    plan.inputDigest !== request.inputDigest ||
    plan.sourceDigest !== request.sourceDigest
  ) {
    throw new PrivateApprovedInitRenderError(
      "PRIVATE_INIT_RENDER_PLAN_INVALID",
      "Approved initialization render plan belongs to different compiler input.",
    );
  }
  requirePlanMatchesProposal(plan, proposal);
  const snapshot = createPrivateRenderPlanSnapshot(plan);
  const proposalDigest = createPrivateInitProposalDigest(proposal);
  const prepared: PrivateApprovedInitRenderPlan = {
    revision: privateApprovedInitRenderRevision,
    proposalDigest,
    approvalDigest: approval.digest,
    snapshot,
    digest: digestValue(
      preparedDigestValue(proposalDigest, approval.digest, snapshot.digest),
    ),
  };
  requirePrepared(proposal, approval, prepared);
  return prepared;
}

export async function executePrivateApprovedInitRender(
  options: ExecutePrivateApprovedInitRenderOptions,
): Promise<PrivateApprovedInitRenderResult> {
  const {
    proposal,
    approval,
    prepared,
    materialization,
    lockPath,
    workspace,
    applyFaultInjector,
    faultInjector,
  } = options;
  requirePrepared(proposal, approval, prepared);
  const command = await executePrivateRenderCommand({
    materialization,
    snapshot: prepared.snapshot,
    baseLock: null,
    lockPath,
    workspace,
    applyFaultInjector,
    faultInjector,
  });
  return { preparedDigest: prepared.digest, command };
}
