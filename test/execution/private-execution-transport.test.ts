import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  compilePrivateExecutionManifest,
  createPrivateExecutionEvidenceEnvelope,
  createPrivateExecutionPayloadDigest,
  replayPrivateExecutionTrace,
  type PrivateExecutionEvidenceEnvelope,
  type PrivateExecutionManifestPackage,
  type PrivateExecutionTrace,
} from "../../src/execution/private-execution-contract.js";
import {
  parsePrivateExecutionEvidenceEnvelope,
  parsePrivateExecutionManifestPackage,
  parsePrivateExecutionPayloadPackage,
  parsePrivateExecutionTrace,
  serializePrivateExecutionEvidenceEnvelope,
  serializePrivateExecutionManifestPackage,
  serializePrivateExecutionPayloadPackage,
  serializePrivateExecutionTrace,
  type PrivateExecutionTransportResult,
} from "../../src/execution/private-execution-transport.js";
import {
  createPrivateExecutionPayloadPackage,
  type PrivateExecutionPayloadPackage,
} from "../../src/execution/private-typed-evidence.js";
import {
  createPrivateIssueToReviewedPullRequestDefinition,
  privateIssueToPullRequestCapabilityObservations,
} from "../../src/workflows/private-issue-to-reviewed-pull-request.js";

function expectTransportSuccess<T>(
  result: PrivateExecutionTransportResult<T>,
): asserts result is Extract<PrivateExecutionTransportResult<T>, { ok: true }> {
  assert.equal(result.ok, true);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function compileManifest(): PrivateExecutionManifestPackage {
  const result = compilePrivateExecutionManifest(
    createPrivateIssueToReviewedPullRequestDefinition({
      initialState: "ready",
      auxiliaryReview: "disabled",
      mergeMethod: "squash",
    }),
    { capabilityObservations: privateIssueToPullRequestCapabilityObservations },
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Fixture manifest did not compile.");
  return result.package;
}

function evidenceFor(
  packageValue: PrivateExecutionManifestPackage,
  stepId: string,
  artifact: string,
  subjectDigest: string,
  payloadDigest: string,
): PrivateExecutionEvidenceEnvelope {
  const step = packageValue.manifest.steps.find((item) => item.id === stepId);
  if (step === undefined) throw new Error(`Unknown fixture step ${stepId}.`);
  return createPrivateExecutionEvidenceEnvelope(packageValue, {
    stepId,
    artifact,
    subjectDigest,
    payloadDigest,
    producer: {
      responsibility: step.responsibility,
      binding: step.responsibility,
      principal: `${step.responsibility}-principal`,
      executionContext: `${stepId}-context`,
    },
    enforcement: {
      strength: "advisory",
      mechanism: "fixture-observation",
    },
  });
}

function fixtureValues(): {
  readonly packageValue: PrivateExecutionManifestPackage;
  readonly payloadPackage: PrivateExecutionPayloadPackage;
  readonly planEnvelope: PrivateExecutionEvidenceEnvelope;
  readonly planTrace: PrivateExecutionTrace;
  readonly outOfOrderTypedTrace: PrivateExecutionTrace;
} {
  const packageValue = compileManifest();
  const subjectDigest = createPrivateExecutionPayloadDigest({
    revision: "transport-fixture",
  });
  const planEnvelope = evidenceFor(
    packageValue,
    "01-plan-work-item",
    "Plan",
    subjectDigest,
    createPrivateExecutionPayloadDigest({ plan: "fixture" }),
  );
  const payloadPackage = createPrivateExecutionPayloadPackage({
    schema: "ci-result@2",
    artifact: "CiResult",
    subjectDigest,
    payload: {
      status: "passed",
      requiredChecksDigest: createPrivateExecutionPayloadDigest({
        checks: "required",
      }),
      observationDigest: createPrivateExecutionPayloadDigest({
        observation: "transport-fixture",
      }),
    },
  });
  const ciEnvelope = evidenceFor(
    packageValue,
    "04-ci-passed",
    "CiResult",
    subjectDigest,
    payloadPackage.digest,
  );
  return {
    packageValue,
    payloadPackage,
    planEnvelope,
    planTrace: {
      revision: 2,
      manifestDigest: packageValue.digest,
      events: [
        {
          stepId: "01-plan-work-item",
          subjectDigest,
          evidence: [planEnvelope],
          payloads: [],
        },
      ],
    },
    outOfOrderTypedTrace: {
      revision: 2,
      manifestDigest: packageValue.digest,
      events: [
        {
          stepId: "04-ci-passed",
          subjectDigest,
          evidence: [ciEnvelope],
          payloads: [payloadPackage],
        },
      ],
    },
  };
}

function assertRoundTrip<T>(
  value: T,
  serialize: (value: T) => PrivateExecutionTransportResult<T>,
  parse: (bytes: Uint8Array) => PrivateExecutionTransportResult<T>,
): void {
  const serialized = serialize(value);
  expectTransportSuccess(serialized);
  const repeated = serialize(value);
  expectTransportSuccess(repeated);
  assert.deepEqual(repeated.bytes, serialized.bytes);
  assert.equal(repeated.contentDigest, serialized.contentDigest);
  assert.equal(serialized.byteLength, serialized.bytes.byteLength);
  assert.equal(Buffer.from(serialized.bytes).toString("utf8").endsWith("\n"), false);

  const parsed = parse(serialized.bytes);
  expectTransportSuccess(parsed);
  assert.deepEqual(parsed.value, value);
  assert.equal(parsed.contentDigest, serialized.contentDigest);
}

test("round-trips canonical manifest, payload, envelope, and trace bytes", () => {
  const fixture = fixtureValues();
  assertRoundTrip(
    fixture.packageValue,
    serializePrivateExecutionManifestPackage,
    parsePrivateExecutionManifestPackage,
  );
  assertRoundTrip(
    fixture.payloadPackage,
    serializePrivateExecutionPayloadPackage,
    parsePrivateExecutionPayloadPackage,
  );
  assertRoundTrip(
    fixture.planEnvelope,
    serializePrivateExecutionEvidenceEnvelope,
    parsePrivateExecutionEvidenceEnvelope,
  );
  assertRoundTrip(
    fixture.planTrace,
    serializePrivateExecutionTrace,
    parsePrivateExecutionTrace,
  );
});

test("replays a parsed canonical trace through the existing semantic verifier", () => {
  const fixture = fixtureValues();
  const manifestBytes = serializePrivateExecutionManifestPackage(
    fixture.packageValue,
  );
  const traceBytes = serializePrivateExecutionTrace(fixture.planTrace);
  expectTransportSuccess(manifestBytes);
  expectTransportSuccess(traceBytes);
  const parsedManifest = parsePrivateExecutionManifestPackage(
    manifestBytes.bytes,
  );
  const parsedTrace = parsePrivateExecutionTrace(traceBytes.bytes);
  expectTransportSuccess(parsedManifest);
  expectTransportSuccess(parsedTrace);

  const replay = replayPrivateExecutionTrace(
    parsedManifest.value,
    parsedTrace.value,
  );
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.finalNode, "work-item");
});

test("keeps transport validity separate from trace ordering semantics", () => {
  const fixture = fixtureValues();
  const encoded = serializePrivateExecutionTrace(
    fixture.outOfOrderTypedTrace,
  );
  expectTransportSuccess(encoded);
  const parsed = parsePrivateExecutionTrace(encoded.bytes);
  expectTransportSuccess(parsed);

  const replay = replayPrivateExecutionTrace(fixture.packageValue, parsed.value);
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.diagnostics[0]?.code, "STEP_OUT_OF_ORDER");
});

test("rejects invalid UTF-8 and non-canonical strict JSON", () => {
  assert.deepEqual(parsePrivateExecutionTrace(Uint8Array.from([0xc3, 0x28])), {
    ok: false,
    diagnostics: [
      {
        code: "TRANSPORT_INVALID_UTF8",
        message: "Private execution transport is not valid UTF-8.",
      },
    ],
  });
  const encoder = new TextEncoder();
  for (const content of [
    '{"events":[],"manifestDigest":"' + "0".repeat(64) + '","revision":2} ',
    '{"revision":2,"manifestDigest":"' + "0".repeat(64) + '","events":[]}',
    '{"a":1,"a":2}',
  ]) {
    const result = parsePrivateExecutionTrace(encoder.encode(content));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.diagnostics[0]?.code, "TRANSPORT_NON_CANONICAL");
    }
  }
  const commented = parsePrivateExecutionTrace(
    encoder.encode('{"events":[],/* comment */"manifestDigest":"x","revision":2}'),
  );
  assert.equal(commented.ok, false);
  if (!commented.ok) {
    assert.equal(commented.diagnostics[0]?.code, "TRANSPORT_SYNTAX_INVALID");
  }
});

test("enforces byte, nesting, value-count, and unsafe-property limits", () => {
  const fixture = fixtureValues();
  const serialized = serializePrivateExecutionManifestPackage(
    fixture.packageValue,
  );
  expectTransportSuccess(serialized);
  const tooLarge = parsePrivateExecutionManifestPackage(serialized.bytes, {
    maxBytes: serialized.byteLength - 1,
  });
  assert.equal(tooLarge.ok, false);
  if (!tooLarge.ok) {
    assert.equal(tooLarge.diagnostics[0]?.code, "TRANSPORT_TOO_LARGE");
  }

  const encoder = new TextEncoder();
  const tooDeep = parsePrivateExecutionTrace(encoder.encode("[[[]]]"), {
    maxNestingDepth: 2,
  });
  assert.equal(tooDeep.ok, false);
  if (!tooDeep.ok) {
    assert.equal(
      tooDeep.diagnostics[0]?.code,
      "TRANSPORT_NESTING_LIMIT_EXCEEDED",
    );
  }
  const tooMany = parsePrivateExecutionTrace(encoder.encode("[0]"), {
    maxValues: 1,
  });
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) {
    assert.equal(
      tooMany.diagnostics[0]?.code,
      "TRANSPORT_VALUE_LIMIT_EXCEEDED",
    );
  }
  const unsafe = parsePrivateExecutionTrace(
    encoder.encode('{"__proto__":{}}'),
  );
  assert.equal(unsafe.ok, false);
  if (!unsafe.ok) {
    assert.equal(
      unsafe.diagnostics[0]?.code,
      "TRANSPORT_UNSAFE_PROPERTY_NAME",
    );
  }
});

test("rejects unknown fields, invalid inner digests, and malformed envelopes", () => {
  const fixture = fixtureValues();
  const extended = serializePrivateExecutionManifestPackage({
    ...fixture.packageValue,
    unexpected: true,
  } as unknown as PrivateExecutionManifestPackage);
  assert.equal(extended.ok, false);
  if (!extended.ok) {
    assert.equal(extended.diagnostics[0]?.code, "TRANSPORT_VALUE_INVALID");
  }

  const reversedManifest = {
    ...fixture.packageValue.manifest,
    artifacts: [...fixture.packageValue.manifest.artifacts].reverse(),
  };
  const reversedManifestJson = canonicalJson(reversedManifest);
  const nonNormalized = serializePrivateExecutionManifestPackage({
    manifest: reversedManifest,
    canonicalJson: reversedManifestJson,
    digest: createHash("sha256").update(reversedManifestJson).digest("hex"),
  });
  assert.equal(nonNormalized.ok, false);
  if (!nonNormalized.ok) {
    assert.match(
      nonNormalized.diagnostics[0]?.message ?? "",
      /Execution manifest .*invalid/u,
    );
  }

  const payload = serializePrivateExecutionPayloadPackage(
    fixture.payloadPackage,
  );
  expectTransportSuccess(payload);
  const tamperedContent = Buffer.from(payload.bytes)
    .toString("utf8")
    .replace(fixture.payloadPackage.digest, "0".repeat(64));
  const tampered = parsePrivateExecutionPayloadPackage(
    new TextEncoder().encode(tamperedContent),
  );
  assert.equal(tampered.ok, false);
  if (!tampered.ok) {
    assert.equal(tampered.diagnostics[0]?.code, "TRANSPORT_VALUE_INVALID");
  }

  assert.doesNotThrow(() =>
    parsePrivateExecutionEvidenceEnvelope(new TextEncoder().encode("null")),
  );
  const malformed = parsePrivateExecutionEvidenceEnvelope(
    new TextEncoder().encode("null"),
  );
  assert.equal(malformed.ok, false);
  if (!malformed.ok) {
    assert.equal(malformed.diagnostics[0]?.code, "TRANSPORT_VALUE_INVALID");
  }
});

test("rejects invalid private resource-limit options", () => {
  assert.throws(
    () => parsePrivateExecutionTrace(new Uint8Array(), { maxBytes: 0 }),
    /maxBytes must be a positive safe integer/u,
  );
  assert.throws(
    () =>
      parsePrivateExecutionTrace(new Uint8Array(), {
        maxNestingDepth: Number.NaN,
      }),
    /maxNestingDepth must be a positive safe integer/u,
  );
  assert.throws(
    () => parsePrivateExecutionTrace(new Uint8Array(), { maxValues: -1 }),
    /maxValues must be a positive safe integer/u,
  );
});
