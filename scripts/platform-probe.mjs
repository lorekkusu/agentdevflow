import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  link,
  lstat,
  mkdir,
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

async function syncDirectory(path) {
  const handle = await open(path, constants.O_RDONLY);
  try {
    assert.equal((await handle.stat()).isDirectory(), true);
    await handle.sync();
  } finally {
    await handle.close();
  }
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
  const signal = process.platform === "win32" ? "SIGTERM" : "SIGKILL";
  const exited = new Promise((resolve) => {
    child.once("exit", (code, observedSignal) => {
      resolve({ code, signal: observedSignal });
    });
  });
  assert.equal(child.kill(signal), true);
  const result = await exited;
  if (result.code !== null && result.signal === null) {
    throw new Error(
      `Forced child termination reported an ordinary exit code: ${result.code}`,
    );
  }
  return { requestedSignal: signal, ...result };
}

const expectedPlatform = option("--expected-platform");
const expectedArchitecture = option("--expected-architecture");
const expectedNodeMajor = option("--expected-node-major");
assert.equal(process.platform, expectedPlatform);
assert.equal(process.arch, expectedArchitecture);
assert.equal(process.versions.node.split(".")[0], expectedNodeMajor);

const root = await mkdtemp(join(tmpdir(), "agentdevflow-platform-probe-"));
try {
  await syncDirectory(root);

  const temporaryPath = join(root, "temporary");
  const targetPath = join(root, "target");
  const handle = await open(
    temporaryPath,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
    0o600,
  );
  await handle.writeFile("platform probe\n", "utf8");
  await handle.sync();
  await handle.close();
  await rename(temporaryPath, targetPath);
  await syncDirectory(root);
  assert.equal(await readFile(targetPath, "utf8"), "platform probe\n");

  const exclusivePath = join(root, "exclusive");
  await link(targetPath, exclusivePath);
  await syncDirectory(root);
  assert.equal(await readFile(exclusivePath, "utf8"), "platform probe\n");

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
      directorySync: true,
      atomicRename: true,
      hardLink: true,
      symbolicLink: true,
      caseSensitive,
      forcedTermination,
    }),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
