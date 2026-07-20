# Private preset expansion

## Status

This is a private, fixture-only contract. It expands a named policy profile over an explicitly selected built-in workflow family and records the result in project resolution. It does not define public preset compatibility, configuration syntax, defaults, migration behavior, or a custom workflow format.

The implementation is in `src/project/private-domain-preset.ts`. Explicit convergence from the older schema-version-0 specimens is in `src/project/private-legacy-candidate-convergence.ts`. Reproducible observations are in [private preset expansion evidence](../evidence/private-preset-expansion.md).

## Orthogonal choices

A preset is a minimum policy profile, not a workflow-family selector. Project intent still selects one of:

- `issue-to-reviewed-pull-request`;
- `local-reviewed-change`.

The issue workflow still requires explicit `draft` or `ready` pull-request creation, explicit enabled or disabled auxiliary review, and the currently bounded squash merge method. Preset expansion does not supply any of those values. Provider instances, responsibility bindings, tracker selection, and logical capability targets also remain explicit project choices.

A workflow family may already exceed a preset minimum. The issue-to-reviewed-pull-request family always requires current CI, review, reviewer-isolation, and merge-authorization evidence, so selecting Fast does not weaken those family invariants.

## Current profiles

| Preset | Executable private minimum | Status |
| --- | --- | --- |
| Fast | A valid `ReviewVerdict` is required at completion. Workflow-specific stronger gates remain intact. | Available |
| Balanced | A valid `ReviewVerdict` and `ReviewerIsolationEvidence` are required, and a valid `BlockingFinding` is forbidden at completion. | Available |
| Strict | Additional high-risk evidence and stronger completion gates. | Unavailable until those semantics are executable |
| Custom | User composition of validated workflow building blocks. | Outside this private contract and deferred |

For the local workflow, Balanced adds explicit finding production and invalidation, reviewer-isolation evidence production, and two terminal policies. Fast retains the smaller basic-review workflow. For the issue workflow, the existing family already satisfies the Balanced structural minimum; the preset identity is still bound into the effective definition and project resolution.

Every available expansion has a private revision and deterministic digest over the profile and effective workflow definition. The execution manifest compiles the effective definition through the existing generic policy and state-space boundary.

## Strict failure boundary

The parser recognizes `strict` so a structurally valid document can receive a precise semantic diagnostic. Project resolution returns `PRESET_UNAVAILABLE` before manifest compilation. It does not silently downgrade Strict to Balanced or accept unenforced prompt language as high-risk evidence.

Strict may become available only after the project defines and tests the required evidence types, invalidation rules, capability strengths, and completion policies. If those requirements cannot be expressed mechanically, Strict must remain unavailable or the project must reconsider the preset.

## Legacy schema-version-0 convergence

The older candidate configuration is retained as experimental evidence, not treated as a public predecessor schema. Its Fast and Balanced specimens contain provider roles, local or no-tracker modes, and review fields, but omit workflow-family selection, hosted tracker intent, and logical capability targets.

The private convergence boundary therefore:

1. normalizes the complete old specimen;
2. verifies that its review fields match the named Fast or Balanced profile;
3. requires the caller to supply an explicit workflow and all logical capability bindings;
4. carries the old local or no-tracker choice without changing it;
5. refuses to infer an issue workflow or hosted tracker from local-only input;
6. binds the source configuration digest and complete resulting intent into a convergence digest.

This is forward convergence for known fixtures, not an automatic migration or a public compatibility promise. A future migration contract must represent every newly required choice and disclose any information loss.

## Evidence non-claims

`ReviewerIsolationEvidence` now requires a closed typed payload. Replay cross-checks its subject, change-producer observation, Reviewer observation, distinct principal, distinct execution context, and observed-fresh flag. These remain caller-supplied observations: the contract proves internal consistency, not authenticated reviewer independence or semantic truth.

The expansion performs no filesystem, network, tracker, provider, credential, scheduling, waiting, merge, or release operation.

## Change boundary

Keep presets separate from workflow families and explicit project bindings. Do not add Draft PR, auxiliary review, tracker, provider, or external integration defaults to a preset. Do not expose Strict, Custom, the expansion revision, the diagnostic text, or schema-version-0 convergence as public compatibility contracts without separate evidence and approval.
