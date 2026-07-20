import { createHash } from "node:crypto";

import type {
  CandidateConfigDiagnostic,
  NormalizedCandidateProjectConfig,
} from "../config/candidate.js";
import { normalizeCandidateProjectConfig } from "../config/normalize-candidate.js";

export interface PrivateProjectConfigDocument {
  readonly revision: 1;
  readonly syntax: "strict-json-subset-of-jsonc";
  readonly configuration: NormalizedCandidateProjectConfig;
  readonly configurationDigest: string;
  readonly content: string;
  readonly contentDigest: string;
}

export type PrivateProjectConfigDocumentResult =
  | {
      readonly ok: true;
      readonly document: PrivateProjectConfigDocument;
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly CandidateConfigDiagnostic[];
    };

/**
 * Produces an experimental text specimen without selecting a public filename,
 * parser, schema library, or compatibility contract.
 */
export function createPrivateProjectConfigDocument(
  input: unknown,
): PrivateProjectConfigDocumentResult {
  const normalized = normalizeCandidateProjectConfig(input);
  if (!normalized.ok) {
    return normalized;
  }

  const content = `${JSON.stringify(normalized.config, null, 2)}\n`;
  return {
    ok: true,
    document: {
      revision: 1,
      syntax: "strict-json-subset-of-jsonc",
      configuration: normalized.config,
      configurationDigest: normalized.digest,
      content,
      contentDigest: createHash("sha256").update(content).digest("hex"),
    },
  };
}
