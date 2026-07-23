import assert from "node:assert/strict";
import test from "node:test";

import {
  composePrivateProviderInstructionViews,
  privateProjectGuidanceFileMaxBytes,
  privateProjectGuidancePaths,
  readPrivateProjectGuidance,
} from "../../src/guidance/private-project-guidance.js";
import { compilePrivateDomainProjectDocument } from "../../src/interface/private-domain-project-document.js";
import type {
  PrivateDomainProjectIntent,
  PrivateDomainProjectResolutionResult,
} from "../../src/project/private-domain-project-resolution.js";
import { privateIssueToPullRequestCapabilityObservations } from "../../src/workflows/private-issue-to-reviewed-pull-request.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../../src/workflows/private-local-reviewed-change.js";
import { privateLocalProjectIntent } from "../fixtures/project/private-domain-project.js";

type ResolvedProject = Extract<
  PrivateDomainProjectResolutionResult,
  { readonly ok: true }
>;

function compile(
  intent: PrivateDomainProjectIntent,
  capabilityObservations = privateLocalReviewedChangeCapabilityObservations,
): ResolvedProject {
  const result = compilePrivateDomainProjectDocument(JSON.stringify(intent), {
    capabilityObservations,
  });
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected private project compilation to succeed.");
  }
  return result.project;
}

test("reads exactly four optional bounded Markdown inputs", async () => {
  const calls: [string, number][] = [];
  const content = new Map<string, string>([
    [privateProjectGuidancePaths.shared, "Shared exact bytes.\r\n"],
    [privateProjectGuidancePaths.developer, "Developer only.\n"],
  ]);
  const result = await readPrivateProjectGuidance({
    async readBounded(path, maxBytes) {
      calls.push([path, maxBytes]);
      return content.get(path) ?? null;
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(calls, [
    [privateProjectGuidancePaths.shared, privateProjectGuidanceFileMaxBytes],
    [privateProjectGuidancePaths.steward, privateProjectGuidanceFileMaxBytes],
    [privateProjectGuidancePaths.developer, privateProjectGuidanceFileMaxBytes],
    [privateProjectGuidancePaths.reviewer, privateProjectGuidanceFileMaxBytes],
  ]);
  assert.deepEqual(result.guidance, {
    shared: "Shared exact bytes.\r\n",
    steward: null,
    developer: "Developer only.\n",
    reviewer: null,
  });
});

test("composes distinct product views from shared and responsibility guidance", () => {
  const result = composePrivateProviderInstructionViews(
    compile(privateLocalProjectIntent()),
    {
      shared: "Always report the verification result.",
      steward: "Create the accepted plan before delegation.",
      developer: "Keep implementation within the accepted plan.",
      reviewer: "Start review from a clean context.",
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.views.map((view) => [
      view.product,
      view.providerId,
      view.responsibilities,
    ]),
    [
      ["claude-code", "claude-reviewer", ["reviewer"]],
      ["codex", "codex-steward", ["steward"]],
      ["cursor", "cursor-developer", ["developer"]],
    ],
  );

  const claude = result.views.find((view) => view.product === "claude-code");
  const codex = result.views.find((view) => view.product === "codex");
  const cursor = result.views.find((view) => view.product === "cursor");
  assert.ok(claude);
  assert.ok(codex);
  assert.ok(cursor);

  for (const view of result.views) {
    assert.match(view.content, /Always report the verification result/u);
  }
  assert.match(codex.content, /Create the accepted plan before delegation/u);
  assert.match(codex.content, /Prepare and communicate an explicit plan/u);
  assert.doesNotMatch(codex.content, /Implement only the accepted plan/u);
  assert.doesNotMatch(codex.content, /Start review from a clean context/u);

  assert.match(cursor.content, /Keep implementation within the accepted plan/u);
  assert.match(cursor.content, /Implement only the accepted plan/u);
  assert.doesNotMatch(cursor.content, /Return actionable findings/u);
  assert.doesNotMatch(cursor.content, /Create the accepted plan before delegation/u);

  assert.match(claude.content, /Start review from a clean context/u);
  assert.match(claude.content, /Return actionable blocking findings/u);
  assert.match(claude.content, /explicit acceptance verdict/u);
  assert.doesNotMatch(claude.content, /Implement only the accepted plan/u);
  assert.doesNotMatch(
    claude.content,
    /Keep implementation within the accepted plan/u,
  );
});

test("explains draft readiness, CI repair, review isolation, and squash directly", () => {
  const intent: PrivateDomainProjectIntent = {
    ...privateLocalProjectIntent(),
    tracker: { mode: "linear" },
    workflow: {
      family: "issue-to-reviewed-pull-request",
      initialState: "draft",
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
  const result = composePrivateProviderInstructionViews(
    compile(intent, privateIssueToPullRequestCapabilityObservations),
    {
      shared: null,
      steward: null,
      developer: null,
      reviewer: null,
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const codex =
    result.views.find((view) => view.product === "codex")?.content ?? "";
  const cursor =
    result.views.find((view) => view.product === "cursor")?.content ?? "";
  const claude =
    result.views.find((view) => view.product === "claude-code")?.content ?? "";
  assert.match(codex, /create the corresponding work item in Linear/u);
  assert.match(codex, /When CI fails/u);
  assert.match(
    codex,
    /ensure the pull request is ready.*mark it ready only if it is still a draft/u,
  );
  assert.match(codex, /Auxiliary review is disabled/u);
  assert.match(codex, /perform a `squash` merge/u);
  assert.match(cursor, /create a `draft` pull request/u);
  assert.match(cursor, /Do not approve, authorize, or merge your own work/u);
  assert.match(claude, /clean execution context/u);
  assert.match(claude, /no blocking finding remains/u);
  assert.match(claude, /Treat a verdict as stale/u);
  assert.match(claude, /Do not invoke or wait for an additional reviewer/u);
  for (const view of result.views) {
    assert.match(view.content, /stop at that step and report the exact missing capability/u);
    assert.doesNotMatch(view.content, /Technical workflow transitions/u);
    assert.doesNotMatch(view.content, /Applicable evidence requirements/u);
    assert.doesNotMatch(view.content, /must use schema/u);
    assert.doesNotMatch(view.content, /separately validated/u);
  }

  const fastResult = composePrivateProviderInstructionViews(
    compile(
      { ...intent, preset: "fast" },
      privateIssueToPullRequestCapabilityObservations,
    ),
    {
      shared: null,
      steward: null,
      developer: null,
      reviewer: null,
    },
  );
  assert.equal(fastResult.ok, true);
  if (!fastResult.ok) return;
  const fastSteward =
    fastResult.views.find((view) => view.product === "codex")?.content ?? "";
  const fastReviewer =
    fastResult.views.find((view) => view.product === "claude-code")?.content ??
    "";
  assert.match(fastSteward, /current review verdict/u);
  assert.doesNotMatch(fastSteward, /reviewer-isolation evidence/u);
  assert.doesNotMatch(fastSteward, /no blocking finding remains/u);
  assert.match(fastReviewer, /Reviewer responsibility/u);
  assert.doesNotMatch(fastReviewer, /clean execution context/u);
  assert.doesNotMatch(fastReviewer, /no blocking finding remains/u);
});

test("separates multiple responsibilities held by one provider id", () => {
  const intent: PrivateDomainProjectIntent = {
    ...privateLocalProjectIntent(),
    providers: [{ id: "codex-primary", product: "codex" }],
    roles: {
      steward: "codex-primary",
      developer: "codex-primary",
      reviewer: "codex-primary",
    },
  };
  const result = composePrivateProviderInstructionViews(compile(intent), {
    shared: null,
    steward: "Steward guidance.",
    developer: "Developer guidance.",
    reviewer: "Reviewer guidance.",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.views.length, 1);
  const view = result.views[0];
  assert.deepEqual(view?.responsibilities, [
    "steward",
    "developer",
    "reviewer",
  ]);
  assert.match(
    view?.content ?? "",
    /Before acting, identify the active responsibility/u,
  );
  assert.match(view?.content ?? "", /### Steward/u);
  assert.match(view?.content ?? "", /### Developer/u);
  assert.match(view?.content ?? "", /### Reviewer/u);
});

test("fails closed when one native product target cannot isolate provider ids", () => {
  const intent: PrivateDomainProjectIntent = {
    ...privateLocalProjectIntent(),
    providers: [
      { id: "codex-steward", product: "codex" },
      { id: "codex-developer", product: "codex" },
      {
        id: "claude-reviewer",
        product: "claude-code",
      },
    ],
    roles: {
      steward: "codex-steward",
      developer: "codex-developer",
      reviewer: "claude-reviewer",
    },
  };
  const result = composePrivateProviderInstructionViews(compile(intent), {
    shared: null,
    steward: null,
    developer: null,
    reviewer: null,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => diagnostic.code),
      ["PROVIDER_PRODUCT_TARGET_AMBIGUOUS"],
    );
  }
});

test("reports bounded-read failures without partial guidance", async () => {
  const result = await readPrivateProjectGuidance({
    async readBounded(path) {
      if (path === privateProjectGuidancePaths.reviewer) {
        const error = new Error("oversized");
        Object.assign(error, { code: "WORKSPACE_FILE_TOO_LARGE" });
        throw error;
      }
      return "observed";
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.diagnostics, [
      {
        stage: "planning",
        code: "PROJECT_GUIDANCE_READ_FAILED",
        path: privateProjectGuidancePaths.reviewer,
        message:
          "User-owned project guidance could not be read (WORKSPACE_FILE_TOO_LARGE).",
      },
    ]);
  }
});
