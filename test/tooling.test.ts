import assert from "node:assert/strict";
import test from "node:test";

test("repository tooling compiles and runs ESM TypeScript", () => {
  assert.equal(typeof import.meta.url, "string");
});
