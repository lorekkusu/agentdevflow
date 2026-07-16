import { createHash } from "node:crypto";

export interface RenderInputDigestParts {
  readonly compilerDigest: string;
  readonly sourceDigest: string;
  readonly sourceFiles: readonly string[];
}

export function createRenderInputDigest(
  parts: RenderInputDigestParts,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        compilerDigest: parts.compilerDigest,
        materializedInputDigest: parts.sourceDigest,
        sourceFiles: parts.sourceFiles,
      }),
    )
    .digest("hex");
}
