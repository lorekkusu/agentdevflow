import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve("dist/test");
const excluded = new Set([
  "transaction/private-transaction-executor.test.js",
  "transaction/private-transaction-store-lifecycle.test.js",
  "transaction/private-transaction-store.test.js",
  "transaction/private-transaction-subprocess.test.js",
  "workspace/private-filesystem-workspace.test.js",
]);
const required = new Set([
  "renderer/private-convergent-apply.test.js",
  "renderer/private-convergent-subprocess.test.js",
]);

async function collect(directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collect(path)));
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(relative(root, path).replaceAll("\\", "/"));
    }
  }
  return files.sort();
}

const discovered = await collect();
for (const path of excluded) {
  if (!discovered.includes(path)) {
    throw new Error(`V1 qualification exclusion does not exist: ${path}`);
  }
}
for (const path of required) {
  if (!discovered.includes(path) || excluded.has(path)) {
    throw new Error(`Required V1 qualification test is unavailable: ${path}`);
  }
}
const selected = discovered.filter((path) => !excluded.has(path));
if (selected.length === 0) {
  throw new Error("V1 qualification selected no tests.");
}

console.log(
  JSON.stringify({
    selectedTestFiles: selected.length,
    excludedExperimentalTestFiles: [...excluded].sort(),
  }),
);

const child = spawn(
  process.execPath,
  ["--test", "--test-reporter=tap", ...selected.map((path) => join(root, path))],
  { stdio: ["ignore", "pipe", "pipe"] },
);
child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");

let stdout = "";
let stderr = "";
child.stdout.on("data", (content) => {
  stdout += content;
  process.stdout.write(content);
});
child.stderr.on("data", (content) => {
  stderr += content;
  process.stderr.write(content);
});

const result = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => resolve({ code, signal }));
});
if (result.code !== 0 || result.signal !== null) {
  throw new Error(
    `V1 platform test process failed: code=${String(result.code)} signal=${String(result.signal)}`,
  );
}
if (!/^# skipped 0$/mu.test(stdout)) {
  throw new Error(`V1 platform qualification requires zero skipped tests. ${stderr}`);
}
