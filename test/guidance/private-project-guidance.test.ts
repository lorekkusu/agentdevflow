import assert from "node:assert/strict";
import test from "node:test";

import {
  composePrivateProviderInstructionViews,
  emptyPrivateProjectGuidance,
  flattenPrivateProjectGuidanceRules,
  privateProjectGuidanceAggregateManualTargets,
  privateProjectGuidanceAggregatePaths,
  privateProjectGuidanceDirectoryMaxEntries,
  privateProjectGuidanceFileMaxBytes,
  privateProjectGuidanceRuleIdMaxLength,
  privateProjectGuidanceRulePath,
  privateProjectGuidanceRulesRoot,
  readPrivateProjectGuidance,
  type PrivateProjectGuidance,
  type PrivateProjectGuidanceRule,
  type PrivateProjectGuidanceScope,
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

function rule(
  scope: PrivateProjectGuidanceScope,
  id: string,
  content: string,
): PrivateProjectGuidanceRule {
  return {
    id,
    scope,
    path: privateProjectGuidanceRulePath(scope, id),
    content,
  };
}

function guidance(
  content: Partial<Record<PrivateProjectGuidanceScope, string>> = {},
): PrivateProjectGuidance {
  return {
    shared:
      content.shared === undefined
        ? []
        : [rule("shared", "shared-rule", content.shared)],
    steward:
      content.steward === undefined
        ? []
        : [rule("steward", "steward-rule", content.steward)],
    developer:
      content.developer === undefined
        ? []
        : [rule("developer", "developer-rule", content.developer)],
    reviewer:
      content.reviewer === undefined
        ? []
        : [rule("reviewer", "reviewer-rule", content.reviewer)],
  };
}

function applicabilityPrefix(product: string, providerId: string): string {
  return [
    "# Agent development flow",
    "",
    "## Projection applicability",
    "",
    `This generated projection declares coding-agent product \`${product}\` and project provider id \`${providerId}\`.`,
    "",
    `Apply this entire projection only when the current coding-agent runtime product is \`${product}\`. If the runtime product does not match, ignore this entire projection: its shared protocol, shared user guidance, responsibilities, operational procedures, and capability targets do not apply.`,
    "",
    "If multiple agentdevflow projections are visible, follow only the projection whose declared coding-agent product matches the current runtime product. Do not combine responsibilities across products.",
    "",
    "Within this applicability boundary, use this project protocol when planning, implementing, reviewing, or preparing an agentdevflow completion transition.",
    "",
    "## Shared protocol",
  ].join("\n");
}

test("reads per-rule Markdown in deterministic id order and ignores unrelated entries", async () => {
  const listCalls: [string, number][] = [];
  const readCalls: [string, number][] = [];
  const content = new Map<string, string>([
    [
      privateProjectGuidanceRulePath("shared", "zeta-rule"),
      "Shared zeta bytes.\r\n",
    ],
    [
      privateProjectGuidanceRulePath("shared", "alpha-rule"),
      "Shared alpha bytes.\n",
    ],
    [
      privateProjectGuidanceRulePath("developer", "developer-rule"),
      "Developer only.\n",
    ],
  ]);
  const result = await readPrivateProjectGuidance({
    async listDirectoryBounded(path, maxEntries) {
      listCalls.push([path, maxEntries]);
      switch (path) {
        case privateProjectGuidanceRulesRoot:
          return [
            { name: "shared", kind: "directory" },
            { name: "developer", kind: "directory" },
            { name: "README.txt", kind: "file" },
          ];
        case `${privateProjectGuidanceRulesRoot}/shared`:
          return [
            { name: "zeta-rule.md", kind: "file" },
            { name: "notes.txt", kind: "file" },
            { name: "archive", kind: "directory" },
            { name: "alpha-rule.md", kind: "file" },
          ];
        case `${privateProjectGuidanceRulesRoot}/developer`:
          return [{ name: "developer-rule.md", kind: "file" }];
        default:
          return null;
      }
    },
    async readBounded(path, maxBytes) {
      readCalls.push([path, maxBytes]);
      return content.get(path) ?? null;
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(listCalls, [
    [privateProjectGuidanceRulesRoot, privateProjectGuidanceDirectoryMaxEntries],
    [
      `${privateProjectGuidanceRulesRoot}/shared`,
      privateProjectGuidanceDirectoryMaxEntries,
    ],
    [
      `${privateProjectGuidanceRulesRoot}/steward`,
      privateProjectGuidanceDirectoryMaxEntries,
    ],
    [
      `${privateProjectGuidanceRulesRoot}/developer`,
      privateProjectGuidanceDirectoryMaxEntries,
    ],
    [
      `${privateProjectGuidanceRulesRoot}/reviewer`,
      privateProjectGuidanceDirectoryMaxEntries,
    ],
  ]);
  assert.deepEqual(readCalls, [
    [
      privateProjectGuidanceRulePath("shared", "alpha-rule"),
      privateProjectGuidanceFileMaxBytes,
    ],
    [
      privateProjectGuidanceRulePath("developer", "developer-rule"),
      privateProjectGuidanceFileMaxBytes,
    ],
    [
      privateProjectGuidanceRulePath("shared", "zeta-rule"),
      privateProjectGuidanceFileMaxBytes,
    ],
  ]);
  assert.deepEqual(
    flattenPrivateProjectGuidanceRules(result.guidance).map((item) => [
      item.id,
      item.scope,
      item.path,
      item.content,
    ]),
    [
      [
        "alpha-rule",
        "shared",
        privateProjectGuidanceRulePath("shared", "alpha-rule"),
        "Shared alpha bytes.\n",
      ],
      [
        "developer-rule",
        "developer",
        privateProjectGuidanceRulePath("developer", "developer-rule"),
        "Developer only.\n",
      ],
      [
        "zeta-rule",
        "shared",
        privateProjectGuidanceRulePath("shared", "zeta-rule"),
        "Shared zeta bytes.\r\n",
      ],
    ],
  );
});

test("composes distinct product views from shared and responsibility guidance", () => {
  const result = composePrivateProviderInstructionViews(
    compile(privateLocalProjectIntent()),
    guidance({
      shared: "Always report the verification result.",
      steward: "Create the accepted plan before delegation.",
      developer: "Keep implementation within the accepted plan.",
      reviewer: "Start review from a clean context.",
    }),
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
    assert.equal(
      view.content.startsWith(
        applicabilityPrefix(view.product, view.providerId),
      ),
      true,
    );
    assert.ok(
      view.content.indexOf("## Projection applicability") <
        view.content.indexOf("## Shared user guidance"),
    );
    assert.match(view.content, /Always report the verification result/u);
    assert.match(view.content, /### Rule `shared-rule`/u);
    assert.match(
      view.content,
      /active project executable using `agentdevflow rule list`/u,
    );
    assert.match(
      view.content,
      /Do not edit generated provider instruction files directly/u,
    );
  }
  assert.match(
    codex.content,
    /This projection assigns exactly one responsibility: Steward\./u,
  );
  assert.match(
    cursor.content,
    /This projection assigns exactly one responsibility: Developer\./u,
  );
  assert.match(
    claude.content,
    /This projection assigns exactly one responsibility: Reviewer\./u,
  );
  assert.match(codex.content, /Create the accepted plan before delegation/u);
  assert.match(codex.content, /##### Rule `steward-rule`/u);
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
  assert.deepEqual(codex.sourcePaths, [
    privateProjectGuidanceRulePath("shared", "shared-rule"),
    privateProjectGuidanceRulePath("steward", "steward-rule"),
  ]);
  assert.deepEqual(cursor.sourcePaths, [
    privateProjectGuidanceRulePath("developer", "developer-rule"),
    privateProjectGuidanceRulePath("shared", "shared-rule"),
  ]);
  assert.deepEqual(claude.sourcePaths, [
    privateProjectGuidanceRulePath("reviewer", "reviewer-rule"),
    privateProjectGuidanceRulePath("shared", "shared-rule"),
  ]);
});

test("orders rule headings by id even when catalog arrays are unsorted", () => {
  const result = composePrivateProviderInstructionViews(
    compile(privateLocalProjectIntent()),
    {
      ...emptyPrivateProjectGuidance,
      shared: [
        rule("shared", "zeta-rule", "Zeta content."),
        rule("shared", "alpha-rule", "Alpha content."),
      ],
    },
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  for (const view of result.views) {
    assert.ok(
      view.content.indexOf("### Rule `alpha-rule`") <
        view.content.indexOf("### Rule `zeta-rule`"),
    );
    assert.deepEqual(view.sourcePaths, [
      privateProjectGuidanceRulePath("shared", "alpha-rule"),
      privateProjectGuidanceRulePath("shared", "zeta-rule"),
    ]);
  }
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
    emptyPrivateProjectGuidance,
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
    emptyPrivateProjectGuidance,
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
  const result = composePrivateProviderInstructionViews(
    compile(intent),
    guidance({
      steward: "Steward guidance.",
      developer: "Developer guidance.",
      reviewer: "Reviewer guidance.",
    }),
  );

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
    /This projection assigns multiple responsibilities: Steward, Developer, Reviewer\. For each applicable agentdevflow workflow task, select exactly one responsibility required by the current task and follow only that responsibility section\./u,
  );
  assert.match(view?.content ?? "", /### Steward/u);
  assert.match(view?.content ?? "", /### Developer/u);
  assert.match(view?.content ?? "", /### Reviewer/u);
});

test("instructs an unassigned provider projection not to perform a workflow transition", () => {
  const intent: PrivateDomainProjectIntent = {
    ...privateLocalProjectIntent(),
    roles: {
      steward: "codex-steward",
      developer: "cursor-developer",
      reviewer: "codex-steward",
    },
  };
  const result = composePrivateProviderInstructionViews(
    compile(intent),
    emptyPrivateProjectGuidance,
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  const claude = result.views.find((view) => view.product === "claude-code");
  assert.ok(claude);
  assert.deepEqual(claude.responsibilities, []);
  assert.match(
    claude.content,
    /This projection assigns no agentdevflow workflow responsibility\. Do not perform an agentdevflow workflow transition from this projection\./u,
  );
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
  const result = composePrivateProviderInstructionViews(
    compile(intent),
    emptyPrivateProjectGuidance,
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => diagnostic.code),
      ["PROVIDER_PRODUCT_TARGET_AMBIGUOUS"],
    );
  }
});

test("rejects every legacy aggregate path with sorted manual targets", async () => {
  let readAttempted = false;
  const result = await readPrivateProjectGuidance({
    async listDirectoryBounded(path) {
      assert.equal(path, privateProjectGuidanceRulesRoot);
      return [
        { name: "reviewer.md", kind: "symbolic-link" },
        { name: "shared.md", kind: "file" },
        { name: "shared", kind: "directory" },
        { name: "developer.md", kind: "directory" },
        { name: "steward.md", kind: "file" },
      ];
    },
    async readBounded() {
      readAttempted = true;
      return null;
    },
  });

  assert.equal(readAttempted, false);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => [
        diagnostic.code,
        diagnostic.path,
        diagnostic.message,
      ]),
      (["developer", "reviewer", "shared", "steward"] as const).map(
        (scope) => [
          "RULE_AGGREGATE_LAYOUT_UNSUPPORTED",
          privateProjectGuidanceAggregatePaths[scope],
          `Aggregate rule guidance is unsupported. Suggested manual target: ${privateProjectGuidanceAggregateManualTargets[scope]}. Move its exact intended content without overwriting an existing rule, remove ${privateProjectGuidanceAggregatePaths[scope]}, and rerun the command.`,
        ],
      ),
    );
  }
});

test("rejects invalid ids, recognized path types, symlinks, and global duplicates", async () => {
  const result = await readPrivateProjectGuidance({
    async listDirectoryBounded(path) {
      switch (path) {
        case privateProjectGuidanceRulesRoot:
          return [];
        case `${privateProjectGuidanceRulesRoot}/shared`:
          return [
            { name: "Bad-Rule.md", kind: "file" },
            {
              name: `${"a".repeat(privateProjectGuidanceRuleIdMaxLength + 1)}.md`,
              kind: "file",
            },
            { name: "con.md", kind: "file" },
            { name: "directory-rule.md", kind: "directory" },
            { name: "linked-rule.md", kind: "symbolic-link" },
            { name: "duplicate-rule.md", kind: "file" },
            { name: "nested", kind: "directory" },
          ];
        case `${privateProjectGuidanceRulesRoot}/reviewer`:
          return [{ name: "duplicate-rule.md", kind: "file" }];
        default:
          return null;
      }
    },
    async readBounded() {
      assert.fail("Invalid catalogs must fail before content is read.");
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(
      result.diagnostics.map((diagnostic) => [
        diagnostic.code,
        diagnostic.path,
      ]),
      [
        [
          "RULE_ID_DUPLICATE",
          privateProjectGuidanceRulePath("reviewer", "duplicate-rule"),
        ],
        [
          "RULE_ID_INVALID",
          `${privateProjectGuidanceRulesRoot}/shared/Bad-Rule.md`,
        ],
        [
          "RULE_ID_INVALID",
          `${privateProjectGuidanceRulesRoot}/shared/${"a".repeat(privateProjectGuidanceRuleIdMaxLength + 1)}.md`,
        ],
        [
          "RULE_ID_INVALID",
          `${privateProjectGuidanceRulesRoot}/shared/con.md`,
        ],
        [
          "PROJECT_GUIDANCE_READ_FAILED",
          privateProjectGuidanceRulePath("shared", "directory-rule"),
        ],
        [
          "RULE_ID_DUPLICATE",
          privateProjectGuidanceRulePath("shared", "duplicate-rule"),
        ],
        [
          "PROJECT_GUIDANCE_READ_FAILED",
          privateProjectGuidanceRulePath("shared", "linked-rule"),
        ],
      ],
    );
  }
});

test("reports bounded-read failures without partial guidance", async () => {
  const reviewerPath = privateProjectGuidanceRulePath(
    "reviewer",
    "reviewer-rule",
  );
  const result = await readPrivateProjectGuidance({
    async listDirectoryBounded(path) {
      if (path === privateProjectGuidanceRulesRoot) {
        return [];
      }
      if (path === `${privateProjectGuidanceRulesRoot}/reviewer`) {
        return [{ name: "reviewer-rule.md", kind: "file" }];
      }
      return null;
    },
    async readBounded(path) {
      assert.equal(path, reviewerPath);
      const error = new Error("oversized");
      Object.assign(error, {
        code: "WORKSPACE_FILE_TOO_LARGE",
        path,
      });
      throw error;
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.diagnostics, [
      {
        stage: "planning",
        code: "PROJECT_GUIDANCE_READ_FAILED",
        path: reviewerPath,
        message:
          "Canonical rule source could not be read (WORKSPACE_FILE_TOO_LARGE).",
      },
    ]);
  }
});
