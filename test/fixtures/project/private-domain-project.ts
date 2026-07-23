import assert from "node:assert/strict";

import { compilePrivateDomainProjectDocument } from "../../../src/interface/private-domain-project-document.js";
import type { PrivateDomainProjectIntent } from "../../../src/project/private-domain-project-resolution.js";
import type { RenderRequest } from "../../../src/renderer/contract.js";
import { renderRequestFromPrivateDomainProjectMaterialization } from "../../../src/renderer/from-compilation.js";
import { materializePrivateDomainProject } from "../../../src/renderer/materialize-domain-project.js";
import { privateLocalReviewedChangeCapabilityObservations } from "../../../src/workflows/private-local-reviewed-change.js";

export function privateLocalProjectIntent(
  preset: "fast" | "balanced" = "balanced",
): PrivateDomainProjectIntent {
  return {
    revision: 1,
    preset,
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
    tracker: { mode: "none" },
    workflow: { family: "local-reviewed-change" },
    capabilityBindings: [
      {
        binding: "developer",
        target: { kind: "responsibility", responsibility: "developer" },
      },
      {
        binding: "reviewer",
        target: { kind: "responsibility", responsibility: "reviewer" },
      },
    ],
  };
}

export function createPrivateDomainProjectFixture(
  preset: "fast" | "balanced" = "balanced",
  options: Pick<RenderRequest, "ownership"> = { ownership: {} },
) {
  const result = compilePrivateDomainProjectDocument(
    JSON.stringify(privateLocalProjectIntent(preset)),
    { capabilityObservations: privateLocalReviewedChangeCapabilityObservations },
  );
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected revision-1 project fixture compilation to succeed.");
  }
  const materialization = materializePrivateDomainProject(result.project);
  const request = renderRequestFromPrivateDomainProjectMaterialization(
    result.project,
    materialization,
    options,
  );
  return { project: result.project, materialization, request };
}
