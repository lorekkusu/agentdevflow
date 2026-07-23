export const candidateProviderProducts = [
  "claude-code",
  "codex",
  "cursor",
] as const;
export type CandidateProviderProduct =
  (typeof candidateProviderProducts)[number];

export const candidateRoles = ["developer", "reviewer", "steward"] as const;
export type CandidateRole = (typeof candidateRoles)[number];

export interface CandidateProviderInstance {
  readonly id: string;
  readonly product: CandidateProviderProduct;
}

export interface CandidateRoleBindings {
  readonly developer: string;
  readonly reviewer: string;
  readonly steward: string;
}
