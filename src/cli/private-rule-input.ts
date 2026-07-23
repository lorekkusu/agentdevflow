export interface PrivateRuleInputStream {
  [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>;
}

export type PrivateRuleInputReadResult =
  | { readonly ok: true; readonly content: string }
  | {
      readonly ok: false;
      readonly code:
        | "RULE_INPUT_INVALID_UTF8"
        | "RULE_INPUT_READ_FAILED"
        | "RULE_INPUT_TOO_LARGE";
      readonly message: string;
    };

export async function readPrivateRuleInputStream(
  stream: PrivateRuleInputStream,
  maxBytes: number,
): Promise<PrivateRuleInputReadResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("maxBytes must be a non-negative safe integer.");
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    for await (const chunk of stream) {
      const bytes =
        typeof chunk === "string"
          ? Buffer.from(chunk, "utf8")
          : Buffer.from(chunk);
      totalBytes += bytes.byteLength;
      if (totalBytes > maxBytes) {
        return {
          ok: false,
          code: "RULE_INPUT_TOO_LARGE",
          message: `Rule content from standard input exceeds ${maxBytes} UTF-8 bytes.`,
        };
      }
      chunks.push(bytes);
    }
  } catch (error) {
    return {
      ok: false,
      code: "RULE_INPUT_READ_FAILED",
      message: `Rule content could not be read from standard input: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    return {
      ok: true,
      content: new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.concat(chunks, totalBytes),
      ),
    };
  } catch {
    return {
      ok: false,
      code: "RULE_INPUT_INVALID_UTF8",
      message: "Rule content from standard input is not valid UTF-8.",
    };
  }
}
