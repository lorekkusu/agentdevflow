import assert from "node:assert/strict";
import test from "node:test";

import type {
  CandidateConfigNormalizationResult,
  NormalizedCandidateProjectConfig,
} from "../../src/config/candidate.js";
import { normalizeCandidateProjectConfig } from "../../src/config/normalize-candidate.js";
import {
  balancedCandidateConfig,
  fastCandidateConfig,
  reorderedBalancedCandidateConfig,
} from "../fixtures/config/specimens.js";

function expectSuccess(
  result: CandidateConfigNormalizationResult,
): asserts result is Extract<CandidateConfigNormalizationResult, { ok: true }> {
  assert.equal(result.ok, true);
}

function expectFailure(
  result: CandidateConfigNormalizationResult,
): asserts result is Extract<CandidateConfigNormalizationResult, { ok: false }> {
  assert.equal(result.ok, false);
}

test("normalizes the Fast specimen without claiming reviewer separation", () => {
  const result = normalizeCandidateProjectConfig(fastCandidateConfig);
  expectSuccess(result);
  assert.equal(result.config.preset, "fast");
  assert.equal(result.config.providers.length, 1);
  assert.equal(result.config.roles.developer, result.config.roles.reviewer);
  assert.equal(result.config.review.reviewerSeparation, "same-provider-allowed");
  assert.equal(
    result.digest,
    "81a59c0f4e09645c3c80875374017304dc263caac48002d10d20a2aefd46c8fd",
  );
});

test("normalizes the Balanced specimen across the three initial providers", () => {
  const result = normalizeCandidateProjectConfig(balancedCandidateConfig);
  expectSuccess(result);
  assert.deepEqual(
    result.config.providers.map((provider) => provider.product).sort(),
    ["claude-code", "codex", "cursor"],
  );
  assert.notEqual(result.config.roles.developer, result.config.roles.reviewer);
  assert.deepEqual(result.config.review.artifactTypes, [
    "BlockingFinding",
    "ReviewVerdict",
  ]);
  assert.equal(
    result.digest,
    "3e37b935270c34b4e412183203c1a5873b2eeb5a080ee81fa24caebaeb604068",
  );
});

test("produces the same normalized config and digest for reordered input", () => {
  const first = normalizeCandidateProjectConfig(balancedCandidateConfig);
  const second = normalizeCandidateProjectConfig(
    reorderedBalancedCandidateConfig,
  );
  expectSuccess(first);
  expectSuccess(second);
  assert.deepEqual(second.config, first.config);
  assert.equal(second.canonicalJson, first.canonicalJson);
  assert.equal(second.digest, first.digest);
});

test("reports deterministic path-specific structural diagnostics", () => {
  const invalid = {
    schemaVersion: 1,
    preset: "strict",
    providers: [
      { id: "primary", product: "codex", surface: "cli" },
      { id: "primary", product: "cursor", surface: "ide" },
    ],
    roles: {
      developer: "primary",
      steward: "missing",
    },
    tracker: { mode: "remote" },
    review: {
      requiredBeforeMerge: true,
      reviewerSeparation: "distinct-provider-instance",
      artifactTypes: ["BlockingFinding", "BlockingFinding"],
    },
    temporaryDiscussion: true,
  };
  const first = normalizeCandidateProjectConfig(invalid);
  const second = normalizeCandidateProjectConfig(invalid);
  expectFailure(first);
  expectFailure(second);
  assert.deepEqual(second.diagnostics, first.diagnostics);
  assert.deepEqual(
    first.diagnostics.map(({ code, path }) => ({ code, path })),
    [
      { code: "INVALID_VALUE", path: "$.preset" },
      { code: "DUPLICATE_VALUE", path: "$.providers[1].id" },
      {
        code: "REVIEW_VERDICT_REQUIRED",
        path: "$.review.artifactTypes",
      },
      {
        code: "DUPLICATE_VALUE",
        path: "$.review.artifactTypes[1]",
      },
      { code: "MISSING_REQUIRED_FIELD", path: "$.roles.reviewer" },
      { code: "UNSUPPORTED_SCHEMA_VERSION", path: "$.schemaVersion" },
      { code: "UNKNOWN_FIELD", path: "$.temporaryDiscussion" },
      { code: "INVALID_VALUE", path: "$.tracker.mode" },
    ],
  );
});

test("rejects role references to unknown provider instances", () => {
  const input = {
    ...fastCandidateConfig,
    roles: { ...fastCandidateConfig.roles, steward: "missing-provider" },
  };
  const result = normalizeCandidateProjectConfig(input);
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      code: "UNKNOWN_PROVIDER_REFERENCE",
      path: "$.roles.steward",
      message:
        "Role steward references unknown provider instance missing-provider.",
    },
  ]);
});

test("rejects a shared reviewer when distinct provider instances are required", () => {
  const input = {
    ...balancedCandidateConfig,
    roles: {
      ...balancedCandidateConfig.roles,
      reviewer: balancedCandidateConfig.roles.developer,
    },
  };
  const result = normalizeCandidateProjectConfig(input);
  expectFailure(result);
  assert.deepEqual(result.diagnostics, [
    {
      code: "REVIEWER_SEPARATION_REQUIRED",
      path: "$.roles.reviewer",
      message:
        "The reviewer must use a different provider instance from the developer for the selected review separation.",
    },
  ]);
});

test("does not mutate a candidate fixture while normalizing it", () => {
  const before = structuredClone(balancedCandidateConfig);
  const result = normalizeCandidateProjectConfig(balancedCandidateConfig);
  expectSuccess(result);
  assert.deepEqual(balancedCandidateConfig, before);
});

test("keeps the normalized fixture shape private and JSON-compatible", () => {
  const result = normalizeCandidateProjectConfig(balancedCandidateConfig);
  expectSuccess(result);
  const parsed = JSON.parse(result.canonicalJson) as NormalizedCandidateProjectConfig;
  assert.deepEqual(parsed, result.config);
  assert.equal("digest" in parsed, false);
});
