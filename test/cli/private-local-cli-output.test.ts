import assert from "node:assert/strict";
import test from "node:test";

import {
  privateCliOutputByteLimit,
  writeBoundedOutput,
} from "../../src/cli/private-local-cli-output.js";

test("replaces oversized JSON output with one bounded blocked report", () => {
  let written = "";
  const accepted = writeBoundedOutput(
    { write: (content) => { written += content; } },
    "diff",
    "json",
    "x".repeat(privateCliOutputByteLimit + 1),
  );

  assert.equal(accepted, false);
  assert.ok(Buffer.byteLength(written, "utf8") < privateCliOutputByteLimit);
  const report = JSON.parse(written) as {
    readonly schemaVersion: number;
    readonly exitCode: number;
    readonly diagnostics: readonly { readonly code: string }[];
  };
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.exitCode, 2);
  assert.equal(report.diagnostics[0]?.code, "CLI_OUTPUT_TOO_LARGE");
});
