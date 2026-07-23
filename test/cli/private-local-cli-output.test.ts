import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDiff,
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

test("renders complete human diff content as reviewable numbered lines", () => {
  const formatted = formatDiff({
    outcome: "changes-required",
    candidateExitCode: 1,
    snapshotDigest: "a".repeat(64),
    planDigest: "b".repeat(64),
    diagnostics: [],
    changes: [
      {
        kind: "managed-output",
        path: "AGENTS.md",
        action: "create",
        beforeDigest: null,
        afterDigest: "c".repeat(64),
        beforeContent: null,
        afterContent: "# Agent instructions\nRun tests.\n",
      },
    ],
  });

  assert.match(formatted, /before-content: <absent>/u);
  assert.match(
    formatted,
    /after-content:\n    1 \| # Agent instructions\n    2 \| Run tests\.\n  after-final-newline: yes/u,
  );
  assert.doesNotMatch(formatted, /content-json/u);
});
