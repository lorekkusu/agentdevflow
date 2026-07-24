import assert from "node:assert/strict";
import test from "node:test";

import { createPrivateCodexOnboardingPrompt } from "../../src/onboarding/private-codex-onboarding-prompt.js";

const baseOptions = {
  agentdevflowEntrypoint: "/installed/agentdevflow/dist/src/cli/private-local-cli.js",
  nodeExecutable: "/runtime/node",
  projectConfigPath: "project.jsonc",
  repositoryPath: "/project",
  renderLockPath: ".agentdevflow/lock.json",
} as const;

test("builds a reviewed interactive Codex onboarding request", () => {
  const prompt = createPrivateCodexOnboardingPrompt({
    ...baseOptions,
    acceptWithoutConfirmation: false,
  });

  assert.match(
    prompt,
    /\["\/runtime\/node","\/installed\/agentdevflow\/dist\/src\/cli\/private-local-cli\.js"\]/u,
  );
  assert.match(prompt, /onboard --agent manual/u);
  assert.match(prompt, /same Codex session/u);
  assert.match(prompt, /Do not mutate canonical rules/u);
  assert.match(
    prompt,
    /matching \[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*/u,
  );
  assert.match(
    prompt,
    /rule add <rule-id> --scope <shared\|steward\|developer\|reviewer> --stdin/u,
  );
  assert.match(prompt, /rule show <rule-id>/u);
  assert.match(prompt, /rule show for every existing id/u);
  assert.match(prompt, /rule update <rule-id> --stdin/u);
  assert.match(prompt, /Provide Markdown content.*through stdin/u);
  assert.match(prompt, /Run agentdevflow diff/u);
  assert.match(prompt, /Run agentdevflow render/u);
  assert.match(prompt, /Run agentdevflow check/u);
  assert.match(prompt, /Do not edit generated provider files/u);
  assert.match(prompt, /Report success only when.*check is clean/u);
  assert.match(prompt, /Do not use npx, npm installation, PATH lookup/u);
  assert.match(
    prompt,
    /Pass the stated repository and config to every agentdevflow command/u,
  );
  assert.match(prompt, /Do not fall back to default project paths/u);
  assert.match(
    prompt,
    /tell the user to exit this Codex session.*independent final check/u,
  );
  assert.doesNotMatch(prompt, /propose mode|apply mode|version allowlist/iu);
});

test("turns --yes into one-operation authorization without a second mode", () => {
  const prompt = createPrivateCodexOnboardingPrompt({
    ...baseOptions,
    acceptWithoutConfirmation: true,
  });

  assert.match(prompt, /invoked agentdevflow with --yes/u);
  assert.match(prompt, /proceed without asking/u);
  assert.doesNotMatch(prompt, /Ask whether to proceed/u);
  assert.doesNotMatch(prompt, /exit this Codex session/u);
});
