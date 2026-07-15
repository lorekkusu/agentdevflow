# Phase 1: private compiler evidence

Snapshot date: 2026-07-16.

## Verdict

**Pass for roadmap step 2.** The candidate Fast and Balanced intent now resolves to versioned built-in definitions, private workflow IR, provider-neutral capability requirements, closed safety policies, an explicit pre-exploration state-space budget, deterministic compiler digests, and executable safety results.

The compiler rejects a direct merge bypass, stale review evidence, missing capability observations, capability strength degradation, undeclared workflow artifact requirements, and a theoretical state space above the configured limit.

No public workflow DSL, `ProjectConfig`, configuration syntax, provider adapter type, runtime scheduler, or arbitrary predicate is introduced.

## Reproduction

The implementation is in:

- `src/compiler/private-model.ts`;
- `src/compiler/built-in-definitions.ts`;
- `src/compiler/compile-candidate.ts`.

Fixtures and tests are in:

- `test/fixtures/compiler/capabilities.ts`;
- `test/fixtures/compiler/definitions.ts`;
- `test/fixtures/compiler/run.ts`;
- `test/compiler/compile-candidate.test.ts`.

Run:

```bash
npm install
npm run check
npm run phase1:compiler
```

## Compiler boundary

The executable path is:

```text
unknown fixture input
-> candidate configuration normalization
-> built-in preset resolution
-> private workflow IR
-> provider-neutral capability resolution
-> closed safety-policy compilation
-> theoretical state-space budget
-> finite-state safety validation
-> deterministic compiler digest
```

The built-in definition id and positive integer revision are part of the compiled semantics. The initial definitions are `builtin/fast@1` and `builtin/balanced@1`.

Private transitions retain the responsible Steward, Developer, or Reviewer role. Policy validation receives only finite nodes, transitions, and artifact effects; it does not import provider, renderer, tracker, or role-binding types.

## Built-in definitions

### Fast

Fast contains `plan`, `implement`, `review`, and `merge`. The workflow has one linear review path. The Developer transition produces `ReviewVerdict`, and merge requires a currently valid verdict.

All three responsibilities may bind to the same provider instance because the candidate Fast intent does not require provider-instance separation. This is basic review intent, not a claim of independent review.

### Balanced

Balanced adds a `reconcile` node and a review/rework cycle. The review-to-reconcile transition produces `BlockingFinding`; the reconcile-to-implement transition invalidates both `BlockingFinding` and `ReviewVerdict`; a later implementation-to-review transition produces a fresh verdict.

Merge requires a valid `ReviewVerdict` and forbids a valid `BlockingFinding`. The cycle is safe without a retry bound.

## Capability boundary

Both definitions compile a private requirement for advisory-strength `project-instructions` on every configured provider instance. The requirement is provider-neutral and does not use the renderer `rules` type.

Capability availability is resolution input, not candidate user intent. Each observation records provider instance, capability, observed strength, and mechanism. The fixture observations use the honest `instruction-file` and `advisory` classification.

The compiler:

- fails when required capability availability is absent;
- fails when observed strength is lower than required strength;
- records successful per-provider resolutions deterministically;
- rejects duplicate observations instead of accepting last-wins behavior;
- never lets a weaker mechanism satisfy a stronger requirement.

The compiler does not discover live capability availability. A later adapter or `doctor` service must supply observed, versioned evidence.

## State-space budget

The compiler collects safety-relevant artifact types from the private definition, transition effects, and compiled policies. Before exploration, it calculates the exact theoretical upper bound:

```text
node count * 2 ^ artifact type count
```

The calculation uses arbitrary-precision integers and compares the result with an internal positive safe-integer budget. The default fixture budget is 128 abstract states.

A budget is an analysis limit, not compiled semantics. Changing a passing limit does not change the compiler digest. The theoretical bound is intentionally conservative and may reject a workflow whose reachable state set would be smaller.

## Captured results

| Specimen | Definition | Nodes | Artifacts | Policies | Theoretical maximum | Explored | Compiler digest |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Fast | `builtin/fast@1` | 4 | 1 | 1 | 8 | 4 | `7913dab8ba60662d9a3454aaddea13214a7604ba97053de790014d97598e096d` |
| Balanced | `builtin/balanced@1` | 5 | 2 | 2 | 20 | 5 | `a21739ab84e45d878e1a47aaf476243e4c5d3a2b48ce89ec1d88141883a4fdca` |

The Balanced result contains three successful advisory `project-instructions` resolutions, one for each configured provider instance. Fast contains one.

Reordered candidate provider and artifact input produced deeply equal compilation output and the same compiler digest.

## Failure fixtures

| Fixture | Expected result | Observed result |
| --- | --- | --- |
| Direct implementation-to-merge transition | Reject | `UNSAFE_WORKFLOW`; shortest trace is `01-plan-implement`, `02-implement-merge-bypass`. |
| Verdict invalidated before reimplementation merge | Reject | `UNSAFE_WORKFLOW`; four-step trace shows `ReviewVerdict` invalidation before merge. |
| Balanced theoretical maximum 20 with limit 19 | Reject before exploration | `STATE_SPACE_BUDGET_EXCEEDED` with the exact bound and configured limit. |
| Balanced definition selected for Fast intent | Reject | `PRESET_DEFINITION_MISMATCH`. |
| Definition requires undeclared `BlockingFinding` | Reject | `MISSING_ARTIFACT_TYPE`. |
| Definition contains a duplicate node or undeclared artifact effect | Reject | `INVALID_WORKFLOW_DEFINITION`; malformed private definitions are not normalized away. |
| Missing capability observation | Reject | `CAPABILITY_UNAVAILABLE`. |
| Guarded strength required but only advisory observed | Reject | `CAPABILITY_STRENGTH_INSUFFICIENT`; no silent degradation. |

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Versioned Fast and Balanced resolution | Pass | Fixed built-in ids and revision 1 are captured in IR and digests. |
| Materially distinct private workflows | Pass | Linear Fast and cyclic Balanced topology, artifact effects, and policies differ. |
| Closed policy compilation | Pass | Candidate review intent produces only required-artifact and forbidden-artifact policies. |
| Capability requirements and degradation diagnostics | Pass | Provider-neutral requirements resolve per instance; missing or weaker evidence fails visibly. |
| Explicit state-space limit | Pass | Exact theoretical bound is checked before finite-state exploration. |
| Direct and stale-evidence bypass rejection | Pass | Compiler fixtures retain deterministic policy counterexamples. |
| Stable compiler output | Pass | Canonical hashing, stable ordering, reorder tests, and exact digest snapshots. |
| Renderer and provider independence in policy core | Pass | The policy module remains unchanged and imports no compiler, provider, or renderer types. |

## Limitations

- Built-in definitions are private implementation evidence, not a user-defined workflow format.
- Definition revision 1 is not a public compatibility promise.
- Role labels on transitions do not authenticate a producer, create a session, or enforce execution.
- The capability availability fixtures are asserted observations, not live provider inspection.
- `instruction-file` is advisory and does not establish mechanical enforcement.
- Only `project-instructions` is modeled; procedures, skills, hooks, permissions, and tracker capabilities remain uncompiled.
- The state budget uses a conservative theoretical bound without reduction.
- The compiler accepts only the closed finite artifact-presence model from Phase 0.
- There is no render request, source mapping, ownership, lock state, filesystem apply, CLI, or runtime.

## Next recommendation

Proceed to renderer integration hardening. Translate private compiler output into backend-neutral render requests, preserve the provider-neutral capability requirement until the adapter boundary, add exact source references, and prove deterministic staged output from the compiler slice.

The Rulesync runtime distribution remains a Candidate decision. Before adding it as a production dependency, run the documented offline installation, package-content, dependency, and isolated-worker experiment and obtain explicit approval for the dependency change.
