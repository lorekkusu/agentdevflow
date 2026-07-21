import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const cliPath = "dist/src/cli/private-local-cli.js";

test("builds an executable package bin on POSIX platforms", async () => {
  const metadata = await stat(cliPath);
  assert.equal(metadata.isFile(), true);

  if (process.platform === "win32") {
    return;
  }

  assert.notEqual(metadata.mode & 0o111, 0);
  const result = spawnSync(cliPath, ["--help"], { encoding: "utf8" });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Usage:/u);
});
