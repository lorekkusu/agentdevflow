import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["--test", "--test-reporter=tap", "dist/**/*.test.js"],
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
    `Platform test process failed: code=${String(result.code)} signal=${String(result.signal)}`,
  );
}
if (!/^# skipped 0$/mu.test(stdout)) {
  throw new Error(
    `Platform qualification requires zero skipped tests. ${stderr}`,
  );
}
