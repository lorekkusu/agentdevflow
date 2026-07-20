import type { RendererProvider } from "../renderer/contract.js";

export type PrivateInitImportClassification =
  | "lossless"
  | "lossy"
  | "unsupported";

export interface PrivateInitImportAssessment {
  readonly provider: RendererProvider;
  readonly observedDigest: string;
  readonly classification: PrivateInitImportClassification;
  readonly proposedConfigurationDigest: string | null;
  readonly proposedTargetDigest: string | null;
  readonly informationLoss: readonly string[];
}
