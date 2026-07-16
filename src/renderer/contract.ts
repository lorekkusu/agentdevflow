export type RendererProvider = "codex" | "claude-code" | "cursor";

export type RendererCapability = "rules" | "commands";

export type DiagnosticSeverity = "warning" | "error";

export interface RendererDiagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
  readonly provider?: RendererProvider;
  readonly capability?: RendererCapability;
}

export interface StagedFile {
  readonly path: string;
  readonly content: string;
  readonly sourceRefs?: readonly string[];
}

export interface StagedRender {
  readonly files: readonly StagedFile[];
  readonly diagnostics: readonly RendererDiagnostic[];
}

export interface RenderRequest {
  readonly inputDigest: string;
  readonly sourceDigest: string;
  readonly providers: readonly RendererProvider[];
  readonly capabilities: readonly RendererCapability[];
  readonly sourceFiles: readonly string[];
  readonly ownership: Readonly<Record<string, OwnershipClaim>>;
  readonly adoptPaths?: readonly string[];
}

export interface OwnershipClaim {
  readonly owner: string;
  readonly digest: string;
}

export interface StagingRenderer {
  readonly name: string;
  readonly version: string;
  readonly ownershipKey: string;
  stage(request: RenderRequest): Promise<StagedRender>;
}

export interface RenderWorkspace {
  read(path: string): Promise<string | null>;
  writeAtomically(path: string, content: string): Promise<void>;
  removeAtomically(path: string): Promise<void>;
}

export type PlannedAction =
  | "create"
  | "update"
  | "delete"
  | "unchanged"
  | "conflict";

export interface PlannedFile {
  readonly path: string;
  readonly action: PlannedAction;
  readonly observedDigest: string | null;
  readonly expectedContent: string | null;
  readonly expectedDigest: string | null;
  readonly sourceRefs: readonly string[];
}

export interface RenderPlan {
  readonly backend: string;
  readonly backendVersion: string;
  readonly ownershipKey: string;
  readonly inputDigest: string;
  readonly sourceDigest: string;
  readonly planDigest: string;
  readonly files: readonly PlannedFile[];
  readonly diagnostics: readonly RendererDiagnostic[];
  readonly safeToApply: boolean;
  readonly previousOwnership: Readonly<Record<string, OwnershipClaim>>;
}

export interface RenderResult {
  readonly planDigest: string;
  readonly written: readonly string[];
  readonly removed: readonly string[];
  readonly ownership: Readonly<Record<string, OwnershipClaim>>;
}

export interface VerifyResult {
  readonly planDigest: string;
  readonly ok: boolean;
  readonly diagnostics: readonly RendererDiagnostic[];
}

export interface RendererBackend {
  plan(request: RenderRequest, workspace: RenderWorkspace): Promise<RenderPlan>;
  render(plan: RenderPlan, workspace: RenderWorkspace): Promise<RenderResult>;
  verify(plan: RenderPlan, workspace: RenderWorkspace): Promise<VerifyResult>;
}
