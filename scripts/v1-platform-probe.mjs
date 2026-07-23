import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  link,
  lstat,
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error(`Missing required option: ${name}`);
  }
  return process.argv[index + 1];
}

async function forceTerminateChild() {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      "process.stdout.write('ready\\n'); setInterval(() => undefined, 1000);",
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  child.stdout.setEncoding("utf8");
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for child readiness.")),
      10_000,
    );
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdout.once("data", (content) => {
      clearTimeout(timer);
      if (content !== "ready\n") {
        reject(new Error(`Unexpected child readiness output: ${content}`));
      } else {
        resolve();
      }
    });
  });
  const requestedSignal = process.platform === "win32" ? "SIGTERM" : "SIGKILL";
  const exited = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  assert.equal(child.kill(requestedSignal), true);
  const result = await exited;
  if (result.code !== null && result.signal === null) {
    throw new Error(
      `Forced child termination reported an ordinary exit code: ${result.code}`,
    );
  }
  return { requestedSignal, ...result };
}

const expectedPlatform = option("--expected-platform");
const expectedArchitecture = option("--expected-architecture");
const expectedNodeMajor = option("--expected-node-major");
assert.equal(process.platform, expectedPlatform);
assert.equal(process.arch, expectedArchitecture);
assert.equal(process.versions.node.split(".")[0], expectedNodeMajor);

const root = await mkdtemp(join(tmpdir(), "agentdevflow-v1-platform-probe-"));
try {
  const targetPath = join(root, "target");
  const temporaryPath = join(root, "temporary");
  await writeFile(targetPath, "before\n", "utf8");
  const handle = await open(
    temporaryPath,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  await handle.writeFile("after\n", "utf8");
  await handle.sync();
  await handle.close();
  await rename(temporaryPath, targetPath);
  assert.equal(await readFile(targetPath, "utf8"), "after\n");

  const hardLinkSourcePath = join(root, "hard-link-source");
  const hardLinkTargetPath = join(root, "hard-link-target");
  await writeFile(hardLinkSourcePath, "linked\n", "utf8");
  await link(hardLinkSourcePath, hardLinkTargetPath);
  assert.equal(await readFile(hardLinkTargetPath, "utf8"), "linked\n");

  const symlinkPath = join(root, "linked-target");
  await symlink(targetPath, symlinkPath, "file");
  assert.equal((await lstat(symlinkPath)).isSymbolicLink(), true);

  const casePath = join(root, "CaseProbe");
  await writeFile(casePath, "case\n", "utf8");
  let caseSensitive = false;
  try {
    await lstat(join(root, "caseprobe"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      caseSensitive = true;
    } else {
      throw error;
    }
  }

  const forcedTermination = await forceTerminateChild();
  console.log(
    JSON.stringify({
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.versions.node,
      fileSync: true,
      renameReplacement: true,
      symbolicLink: true,
      caseSensitive,
      forcedTermination,
      directorySyncRequired: false,
      hardLinkRequired: true,
    }),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
