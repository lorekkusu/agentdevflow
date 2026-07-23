import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { readPrivateRuleInputStream } from "../../src/cli/private-rule-input.js";

test("reads bounded UTF-8 rule content from standard input", async () => {
  const result = await readPrivateRuleInputStream(
    Readable.from([Buffer.from("first "), Buffer.from("rule\n")]),
    11,
  );

  assert.deepEqual(result, { ok: true, content: "first rule\n" });
});

test("accepts empty rule content and string chunks", async () => {
  assert.deepEqual(
    await readPrivateRuleInputStream(Readable.from([]), 0),
    { ok: true, content: "" },
  );
  assert.deepEqual(
    await readPrivateRuleInputStream(Readable.from(["content"]), 7),
    { ok: true, content: "content" },
  );
});

test("rejects oversized and invalid UTF-8 standard input", async () => {
  const oversized = await readPrivateRuleInputStream(
    Readable.from([Buffer.from("four")]),
    3,
  );
  assert.equal(oversized.ok, false);
  if (!oversized.ok) {
    assert.equal(oversized.code, "RULE_INPUT_TOO_LARGE");
  }

  const invalid = await readPrivateRuleInputStream(
    Readable.from([Buffer.from([0xc3, 0x28])]),
    2,
  );
  assert.equal(invalid.ok, false);
  if (!invalid.ok) {
    assert.equal(invalid.code, "RULE_INPUT_INVALID_UTF8");
  }
});

test("reports standard-input stream failures", async () => {
  const stream = Readable.from(
    (async function* () {
      yield Buffer.from("partial");
      throw new Error("stream failed");
    })(),
  );
  const result = await readPrivateRuleInputStream(stream, 64);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "RULE_INPUT_READ_FAILED");
    assert.match(result.message, /stream failed/u);
  }
});
