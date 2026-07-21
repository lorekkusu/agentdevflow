import assert from "node:assert/strict";
import test from "node:test";

import {
  createPrivateTemporaryIntentRegistry,
  createPrivateTemporaryMutationIntent,
  createPrivateWriterClearance,
  createPrivateWriterClearanceRegistry,
  parsePrivateTemporaryIntentRegistry,
  parsePrivateWriterClearanceRegistry,
  serializePrivateTemporaryIntentRegistry,
  serializePrivateWriterClearanceRegistry,
  validatePrivateTemporaryMutationIntent,
} from "../../src/workspace/private-temporary-intent.js";

const transactionDigest = "1".repeat(64);
const writerFingerprint = "2".repeat(64);
const targetDigest = "3".repeat(64);

function intent(options: {
  readonly writerFingerprint?: string;
  readonly targetPath?: string;
  readonly targetDigest?: string;
} = {}) {
  return createPrivateTemporaryMutationIntent({
    transactionDigest,
    writerFingerprint: options.writerFingerprint ?? writerFingerprint,
    targetPath: options.targetPath ?? "nested/AGENTS.md",
    targetDigest: options.targetDigest ?? targetDigest,
  });
}

test("derives deterministic temporary paths from complete ownership inputs", () => {
  const first = intent();
  const second = intent();

  assert.deepEqual(first, second);
  assert.match(
    first.temporaryPath,
    /^nested\/\.AGENTS\.md\.agentdevflow-[a-f0-9]{64}\.tmp$/u,
  );
  assert.notEqual(
    intent({ writerFingerprint: "4".repeat(64) }).temporaryPath,
    first.temporaryPath,
  );
  assert.notEqual(
    intent({ targetPath: "nested/CLAUDE.md" }).temporaryPath,
    first.temporaryPath,
  );
  assert.notEqual(
    intent({ targetDigest: "5".repeat(64) }).temporaryPath,
    first.temporaryPath,
  );
});

test("serializes temporary intent registries canonically", () => {
  const first = intent({ targetPath: "AGENTS.md" });
  const second = intent({ targetPath: "CLAUDE.md" });
  const registry = createPrivateTemporaryIntentRegistry(transactionDigest, [
    second,
    first,
  ]);
  const content = serializePrivateTemporaryIntentRegistry(registry);

  assert.deepEqual(parsePrivateTemporaryIntentRegistry(content), registry);
  assert.deepEqual(
    registry.intents.map((entry) => entry.digest),
    [first.digest, second.digest].sort(),
  );
  assert.throws(
    () => createPrivateTemporaryIntentRegistry(transactionDigest, [first, first]),
    /duplicate intent/u,
  );
  assert.throws(
    () => parsePrivateTemporaryIntentRegistry(`${content} `),
    /not canonical/u,
  );
});

test("serializes writer clearance registries canonically", () => {
  const first = createPrivateWriterClearance(
    transactionDigest,
    writerFingerprint,
  );
  const second = createPrivateWriterClearance(
    transactionDigest,
    "4".repeat(64),
  );
  const registry = createPrivateWriterClearanceRegistry(transactionDigest, [
    first,
    second,
  ]);
  const content = serializePrivateWriterClearanceRegistry(registry);

  assert.deepEqual(parsePrivateWriterClearanceRegistry(content), registry);
  assert.deepEqual(
    registry.clearances.map((entry) => entry.writerFingerprint),
    [writerFingerprint, "4".repeat(64)].sort(),
  );
  assert.throws(
    () => createPrivateWriterClearanceRegistry(transactionDigest, [first, first]),
    /duplicate/u,
  );
  assert.throws(
    () => parsePrivateWriterClearanceRegistry(`${content} `),
    /not canonical/u,
  );
});

test("rejects unsafe, extended, and tampered temporary intents", () => {
  assert.throws(
    () => intent({ targetPath: "../outside" }),
    /unsafe/u,
  );
  assert.throws(
    () => intent({ targetPath: "nested\\AGENTS.md" }),
    /unsafe/u,
  );
  assert.throws(
    () => intent({ targetDigest: "invalid" }),
    /SHA-256/u,
  );

  const valid = intent();
  assert.throws(
    () => validatePrivateTemporaryMutationIntent({ ...valid, extra: true }),
    /unexpected or missing fields/u,
  );
  assert.throws(
    () =>
      validatePrivateTemporaryMutationIntent({
        ...valid,
        temporaryPath: ".foreign.tmp",
      }),
    /does not match its inputs/u,
  );
  assert.throws(
    () => validatePrivateTemporaryMutationIntent({ ...valid, digest: "0".repeat(64) }),
    /digest does not match/u,
  );
});
