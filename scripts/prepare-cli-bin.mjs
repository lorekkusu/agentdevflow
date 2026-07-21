import { chmod, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(
  new URL("../dist/src/cli/private-local-cli.js", import.meta.url),
);

await chmod(cliPath, 0o755);

if (process.platform !== "win32") {
  const mode = (await stat(cliPath)).mode;
  if ((mode & 0o111) === 0) {
    throw new Error("The built agentdevflow CLI is not executable.");
  }
}
