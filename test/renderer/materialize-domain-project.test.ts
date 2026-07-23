import assert from "node:assert/strict";
import test from "node:test";

import { compilePrivateDomainProjectDocument } from "../../src/interface/private-domain-project-document.js";
import type {
  PrivateDomainProjectIntent,
  PrivateDomainProjectResolutionResult,
} from "../../src/project/private-domain-project-resolution.js";
import { renderRequestFromPrivateDomainProjectMaterialization } from "../../src/renderer/from-compilation.js";
import { materializePrivateDomainProject } from "../../src/renderer/materialize-domain-project.js";
import { NativeProjectInstructionsRenderer } from "../../src/renderer/native/staging-renderer.js";
import { privateIssueToPullRequestCapabilityObservations } from "../../src/workflows/private-issue-to-reviewed-pull-request.js";

type ResolvedProject = Extract<
  PrivateDomainProjectResolutionResult,
  { readonly ok: true }
>;

function issueIntent(): PrivateDomainProjectIntent {
  return {
    revision: 1,
    preset: "balanced",
    providers: [
      { id: "codex-steward", product: "codex" },
      { id: "cursor-developer", product: "cursor" },
      { id: "claude-reviewer", product: "claude-code" },
    ],
    roles: {
      steward: "codex-steward",
      developer: "cursor-developer",
      reviewer: "claude-reviewer",
    },
    tracker: { mode: "linear" },
    workflow: {
      family: "issue-to-reviewed-pull-request",
      initialState: "ready",
      auxiliaryReview: "disabled",
      mergeMethod: "squash",
    },
    capabilityBindings: [
      { binding: "tracker", target: { kind: "tracker" } },
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "pull-request-host",
        target: { kind: "external", id: "github" },
      },
      { binding: "ci", target: { kind: "external", id: "github-actions" } },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
    ],
  };
}

function compile(
  intent: PrivateDomainProjectIntent,
  observations: Parameters<typeof compilePrivateDomainProjectDocument>[1]["capabilityObservations"],
): ResolvedProject {
  const result = compilePrivateDomainProjectDocument(
    JSON.stringify(intent),
    { capabilityObservations: observations },
  );
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected private domain project compilation to succeed.");
  }
  return result.project;
}

test("materializes revision-1 intent without an execution manifest", async () => {
  const project = compile(
    issueIntent(),
    privateIssueToPullRequestCapabilityObservations,
  );
  const materialization = materializePrivateDomainProject(project);
  const request = renderRequestFromPrivateDomainProjectMaterialization(
    project,
    materialization,
  );
  const staged = await new NativeProjectInstructionsRenderer(
    materialization,
  ).stage(request);

  assert.equal("manifestPackage" in project, false);
  assert.equal(
    materialization.compilerDigest,
    project.workflowCompilation.compilationDigest,
  );
  assert.deepEqual(request.providers, ["claude-code", "codex", "cursor"]);
  assert.deepEqual(request.capabilities, ["rules"]);
  assert.deepEqual(
    staged.files.map((file) => file.path),
    ["CLAUDE.md", "AGENTS.md", ".cursor/rules/agentdevflow.mdc"],
  );
  const claude = materialization.files.find(
    (file) => file.provider === "claude-code",
  )?.content ?? "";
  const codex = materialization.files.find(
    (file) => file.provider === "codex",
  )?.content ?? "";
  const cursor = materialization.files.find(
    (file) => file.provider === "cursor",
  )?.content ?? "";
  for (const content of [claude, codex, cursor]) {
    assert.match(content, /Workflow family: `issue-to-reviewed-pull-request`/u);
    assert.match(content, /Pull request initial state: `ready`/u);
    assert.match(content, /Auxiliary review: `disabled`/u);
    assert.match(content, /Pull request readiness is not merge authorization/u);
  }
  assert.match(codex, /`ci`: external integration `github-actions`/u);
  assert.match(codex, /create the corresponding work item in Linear/u);
  assert.match(cursor, /create a `ready` pull request/u);
  assert.match(claude, /clean execution context/u);
  assert.notEqual(claude, codex);
  assert.notEqual(codex, cursor);
  assert.deepEqual(staged.diagnostics, []);
});

test("keeps revision-1 materialization deterministic for reordered intent", () => {
  const intent = issueIntent();
  const reordered: PrivateDomainProjectIntent = {
    ...intent,
    providers: [...intent.providers].reverse(),
    capabilityBindings: [...intent.capabilityBindings].reverse(),
  };
  const first = materializePrivateDomainProject(
    compile(intent, privateIssueToPullRequestCapabilityObservations),
  );
  const second = materializePrivateDomainProject(
    compile(
      reordered,
      [...privateIssueToPullRequestCapabilityObservations].reverse(),
    ),
  );

  assert.deepEqual(second, first);
});

test("rejects a materialization paired with different project bindings", () => {
  const intent = issueIntent();
  const first = compile(
    intent,
    privateIssueToPullRequestCapabilityObservations,
  );
  const second = compile(
    {
      ...intent,
      providers: intent.providers.map((provider) =>
        provider.id === "claude-reviewer"
          ? { ...provider, id: "claude-auditor" }
          : provider,
      ),
      roles: { ...intent.roles, reviewer: "claude-auditor" },
    },
    privateIssueToPullRequestCapabilityObservations,
  );
  const materialization = materializePrivateDomainProject(first);

  assert.equal(
    first.workflowCompilation.compilationDigest,
    second.workflowCompilation.compilationDigest,
  );
  assert.notEqual(first.resolutionDigest, second.resolutionDigest);

  assert.throws(
    () =>
      renderRequestFromPrivateDomainProjectMaterialization(
        second,
        materialization,
      ),
    /different domain project compilation/u,
  );
});
