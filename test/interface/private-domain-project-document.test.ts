import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compilePrivateDomainProjectDocument,
  parsePrivateDomainProjectDocument,
  privateDomainProjectIntentJsonSchemaCanonicalJson,
  privateDomainProjectIntentJsonSchemaDigest,
  type PrivateDomainProjectDocumentCompilationResult,
  type PrivateDomainProjectDocumentParseResult,
} from "../../src/interface/private-domain-project-document.js";
import { privateZod } from "../../src/interface/private-zod.js";
import type { PrivateDomainProjectIntent } from "../../src/project/private-domain-project-resolution.js";
import { privateIssueToPullRequestCapabilityObservations } from "../../src/workflows/private-issue-to-reviewed-pull-request.js";

function readyLinearIntent(): PrivateDomainProjectIntent {
  return {
    revision: 1,
    preset: "balanced",
    providers: [
      { id: "codex-steward", product: "codex" },
      { id: "cursor-developer", product: "cursor" },
      { id: "codex-reviewer", product: "codex" },
    ],
    roles: {
      steward: "codex-steward",
      developer: "cursor-developer",
      reviewer: "codex-reviewer",
    },
    tracker: { mode: "linear" },
    workflow: {
      family: "issue-to-reviewed-pull-request",
      initialState: "ready",
      auxiliaryReview: "disabled",
      mergeMethod: "squash",
    },
    capabilityBindings: [
      { binding: "tracker", target: { kind: "tracker" } },
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "pull-request-host",
        target: { kind: "external", id: "github" },
      },
      {
        binding: "ci",
        target: { kind: "external", id: "github-actions" },
      },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
    ],
  };
}

function jsoncDocument(intent = readyLinearIntent()): string {
  return JSON.stringify(intent, null, 2)
    .replace("{\n", "{\n  // Private fixture; no public filename is selected.\n")
    .replace(/\n\}$/u, ",\n}\n");
}

function expectParseSuccess(
  result: PrivateDomainProjectDocumentParseResult,
): asserts result is Extract<PrivateDomainProjectDocumentParseResult, { ok: true }> {
  assert.equal(result.ok, true);
}

function expectParseFailure(
  result: PrivateDomainProjectDocumentParseResult,
): asserts result is Extract<PrivateDomainProjectDocumentParseResult, { ok: false }> {
  assert.equal(result.ok, false);
}

function expectCompilationSuccess(
  result: PrivateDomainProjectDocumentCompilationResult,
): asserts result is Extract<
  PrivateDomainProjectDocumentCompilationResult,
  { ok: true }
> {
  assert.equal(result.ok, true);
}

function expectCompilationFailure(
  result: PrivateDomainProjectDocumentCompilationResult,
): asserts result is Extract<
  PrivateDomainProjectDocumentCompilationResult,
  { ok: false }
> {
  assert.equal(result.ok, false);
}

test("parses comments and a trailing comma into the bounded typed intent", () => {
  const content = jsoncDocument();
  const result = parsePrivateDomainProjectDocument(content);

  expectParseSuccess(result);
  assert.deepEqual(result.document.intent, readyLinearIntent());
  assert.equal(result.document.syntax, "jsonc");
  assert.match(result.document.contentDigest, /^[a-f0-9]{64}$/u);
  assert.equal(
    result.document.schemaDigest,
    "6d4af95d209c34a3e4626f0e1aae2234b51d161b68cc1c48fa75335b6a203ca6",
  );
  assert.equal(Object.getPrototypeOf(result.document.intent), Object.prototype);
});

test("compiles parsed intent into the previously captured exact project resolution", () => {
  const result = compilePrivateDomainProjectDocument(jsoncDocument(), {
    capabilityObservations: privateIssueToPullRequestCapabilityObservations,
  });

  expectCompilationSuccess(result);
  assert.equal(
    result.project.resolution.workflow.compilationDigest,
    result.project.workflowCompilation.compilationDigest,
  );
  assert.equal(
    result.project.resolutionDigest,
    "e6340950ccf2ea01343bef163265ab5be7ae818a5ccabf8e251981eeb7b56f86",
  );
});

test("rejects duplicate properties before conversion to a JavaScript object", () => {
  const content = jsoncDocument().replace(
    '"mode": "linear"',
    '"mode": "linear", "mode": "github-issues"',
  );
  const first = parsePrivateDomainProjectDocument(content);
  const second = parsePrivateDomainProjectDocument(content);

  expectParseFailure(first);
  expectParseFailure(second);
  assert.deepEqual(second.diagnostics, first.diagnostics);
  assert.deepEqual(
    first.diagnostics.map(({ code, path }) => ({ code, path })),
    [{ code: "DUPLICATE_PROPERTY", path: "$.tracker.mode" }],
  );
  assert.equal(typeof first.diagnostics[0]?.offset, "number");
});

test("rejects prototype mutation keys before Zod can ignore them", () => {
  const content = jsoncDocument().replace(
    '"revision": 1,',
    '"revision": 1, "__proto__": { "polluted": true },',
  );
  const result = parsePrivateDomainProjectDocument(content);

  expectParseFailure(result);
  assert.equal(result.diagnostics[0]?.code, "UNSAFE_PROPERTY_NAME");
  assert.equal(result.diagnostics[0]?.path, "$.__proto__");
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test("rejects malformed JSONC with deterministic offsets", () => {
  const content = '{ "revision": 1,, }';
  const first = parsePrivateDomainProjectDocument(content);
  const second = parsePrivateDomainProjectDocument(content);

  expectParseFailure(first);
  expectParseFailure(second);
  assert.deepEqual(second.diagnostics, first.diagnostics);
  assert.equal(first.diagnostics[0]?.code, "SYNTAX_INVALID");
  assert.equal(typeof first.diagnostics[0]?.offset, "number");
  assert.equal(typeof first.diagnostics[0]?.length, "number");
});

test("rejects documents beyond the configured UTF-8 byte limit before parsing", () => {
  const result = parsePrivateDomainProjectDocument(jsoncDocument(), {
    maxBytes: 32,
  });

  expectParseFailure(result);
  assert.equal(result.diagnostics[0]?.code, "DOCUMENT_TOO_LARGE");
});

test("rejects deeply nested input in the iterative scanner preflight", () => {
  const result = parsePrivateDomainProjectDocument("[[[[]]]]", {
    maxNestingDepth: 3,
  });

  expectParseFailure(result);
  assert.equal(result.diagnostics[0]?.code, "NESTING_LIMIT_EXCEEDED");
  assert.equal(result.diagnostics[0]?.offset, 3);
});

test("keeps schema validation closed and deterministic", () => {
  const invalid = {
    ...readyLinearIntent(),
    extra: true,
    tracker: { mode: "remote" },
  };
  const first = parsePrivateDomainProjectDocument(JSON.stringify(invalid));
  const second = parsePrivateDomainProjectDocument(JSON.stringify(invalid));

  expectParseFailure(first);
  expectParseFailure(second);
  assert.deepEqual(second.diagnostics, first.diagnostics);
  assert.equal(first.diagnostics.every(({ stage }) => stage === "schema"), true);
  assert.equal(
    first.diagnostics.some(({ path }) => path === "$.tracker.mode"),
    true,
  );
  assert.equal(
    first.diagnostics.some(({ message }) => message.includes("extra")),
    true,
  );
});

test("rejects the removed provider surface field", () => {
  const intent = readyLinearIntent();
  const result = parsePrivateDomainProjectDocument(
    JSON.stringify({
      ...intent,
      providers: intent.providers.map((provider, index) =>
        index === 0 ? { ...provider, surface: "cli" } : provider,
      ),
    }),
  );

  expectParseFailure(result);
  assert.equal(result.diagnostics[0]?.stage, "schema");
  assert.equal(
    result.diagnostics.some(({ message }) => message.includes("surface")),
    true,
  );
});

test("rejects auxiliary review outside the bounded beta surface", () => {
  const intent = readyLinearIntent();
  const result = parsePrivateDomainProjectDocument(
    JSON.stringify({
      ...intent,
      workflow: {
        ...intent.workflow,
        auxiliaryReview: "enabled",
      },
    }),
  );

  expectParseFailure(result);
  assert.equal(result.diagnostics[0]?.stage, "schema");
  assert.equal(result.diagnostics[0]?.path, "$.workflow.auxiliaryReview");
});

test("bounds diagnostic output without silently accepting duplicate input", () => {
  const duplicates = Array.from(
    { length: 6 },
    (_, index) => `"value": ${index}`,
  ).join(",");
  const result = parsePrivateDomainProjectDocument(`{${duplicates}}`, {
    maxDiagnostics: 2,
  });

  expectParseFailure(result);
  assert.equal(result.diagnostics.length, 3);
  assert.equal(
    result.diagnostics.at(-1)?.code,
    "DIAGNOSTIC_LIMIT_EXCEEDED",
  );
});

test("retains semantic resolution failures after syntax and schema success", () => {
  const intent = readyLinearIntent();
  const withoutCi: PrivateDomainProjectIntent = {
    ...intent,
    capabilityBindings: intent.capabilityBindings.filter(
      (binding) => binding.binding !== "ci",
    ),
  };
  const result = compilePrivateDomainProjectDocument(
    JSON.stringify(withoutCi),
    { capabilityObservations: privateIssueToPullRequestCapabilityObservations },
  );

  expectCompilationFailure(result);
  assert.equal(result.diagnostics[0]?.stage, "resolution");
  assert.equal(result.diagnostics[0]?.code, "WORKFLOW_RESOLUTION_FAILED");
  assert.equal(
    result.diagnostics[0]?.cause?.code,
    "CAPABILITY_BINDING_MISSING",
  );
});

test("parses Strict but fails resolution until stronger gates are executable", () => {
  const result = compilePrivateDomainProjectDocument(
    JSON.stringify({ ...readyLinearIntent(), preset: "strict" }),
    { capabilityObservations: privateIssueToPullRequestCapabilityObservations },
  );

  expectCompilationFailure(result);
  assert.equal(result.diagnostics[0]?.stage, "resolution");
  assert.equal(result.diagnostics[0]?.cause?.code, "PRESET_UNAVAILABLE");
});

test("keeps Zod code generation disabled before schema construction", () => {
  assert.equal(privateZod.config().jitless, true);
});

test("matches the committed deterministic Draft 2020-12 schema snapshot", async () => {
  const snapshot = await readFile(
    "test/fixtures/project/private-domain-project-intent.schema.json",
    "utf8",
  );

  assert.equal(
    JSON.stringify(JSON.parse(snapshot)),
    privateDomainProjectIntentJsonSchemaCanonicalJson,
  );
  assert.equal(
    privateDomainProjectIntentJsonSchemaDigest,
    "6d4af95d209c34a3e4626f0e1aae2234b51d161b68cc1c48fa75335b6a203ca6",
  );
});

test("rejects invalid internal resource limits", () => {
  assert.throws(
    () => parsePrivateDomainProjectDocument("{}", { maxBytes: 0 }),
    /maxBytes must be a positive safe integer\./u,
  );
  assert.throws(
    () => parsePrivateDomainProjectDocument("{}", { maxNestingDepth: -1 }),
    /maxNestingDepth must be a positive safe integer\./u,
  );
  assert.throws(
    () => parsePrivateDomainProjectDocument("{}", { maxDiagnostics: 1.5 }),
    /maxDiagnostics must be a positive safe integer\./u,
  );
});
