# Private preset expansion evidence

Snapshot date: 2026-07-20.

## Verdict

**Pass for Fast and Balanced; fail closed for Strict.** Fast and Balanced expand deterministically over the local reviewed-change workflow and compile through the existing generic project-resolution, policy, and execution-manifest seams. Preset selection remains orthogonal to workflow family, pull-request readiness, auxiliary review, providers, trackers, and capability targets.

Strict is intentionally unavailable because high-risk evidence and stronger completion gates do not yet have executable semantics. Custom remains deferred.

## Reproduction

Implementation:

- `src/project/private-domain-preset.ts`;
- `src/project/private-legacy-candidate-convergence.ts`;
- `src/project/private-domain-project-resolution.ts`.

Fixtures and tests:

- `test/fixtures/project/preset-run.ts`;
- `test/project/private-domain-preset.test.ts`;
- `test/project/private-domain-project-resolution.test.ts`;
- `test/interface/private-domain-project-document.test.ts`.

Run:

```bash
npm run build
node --test dist/test/project/private-domain-preset.test.js
npm run phase1:preset
npm run check
```

## Captured local expansions

| Preset | Legacy source digest | Convergence digest | Expansion digest | Effective definition | Manifest digest | Resolution digest |
| --- | --- | --- | --- | --- | --- | --- |
| Fast | `81a59c0f4e09645c3c80875374017304dc263caac48002d10d20a2aefd46c8fd` | `40e8528c72a5499fd6d9dbe65515095cbb0d097ff6cde99f02192fb85c212100` | `a8f1076d9087f770d9b35ddeba67ccb6a3b80ab25f482eb023d0990462fdeff9` | `candidate/local-reviewed-change/preset-fast@1` | `7f4d223ebaba0e480bf5f2aed7dc7c397228c361f6be6b72f2d320edf3fe1c3c` | `185c99d5009e57810d999c734adb8e9b1057499994386ced4b4f9c12ff7a38f8` |
| Balanced | `3e37b935270c34b4e412183203c1a5873b2eeb5a080ee81fa24caebaeb604068` | `cfbfb3f9f109cdb8a7f8a95f90f8630596dba6aa5b3a94ab69e1a6f937883456` | `fddd9b8e27cc99befa13e61f693435017d7c1afe2a7df4799680d908f84219b4` | `candidate/local-reviewed-change/preset-balanced@1` | `ed49af2f33c46e1952aefd26a78be3f3d17ca004beb4642630ad9af3fbdd6836` | `6b2e09cadc1dee086a7b46c60eb4d3c0c4b53a4f43dd177a7a3dfbfa9e50bb65` |

The Balanced local manifest adds `BlockingFinding` and `ReviewerIsolationEvidence`, invalidates findings after implementation, forbids a current blocking finding at acceptance, and requires reviewer-isolation evidence. Fast retains the three existing local completion policies.

The focused preset suite passed 11 tests, including a complete Balanced local rework trace. The combined parser, preset, and project-resolution selection passed 41 tests. At this evidence snapshot, the complete repository check passed 355 tests with zero failures or skips and audited 198 text files.

## Observations

| Fixture | Result |
| --- | --- |
| Repeated Fast expansion | Byte-identical expansion object and digest |
| Balanced local workflow | Adds only the declared artifacts, transition effects, and policies; generic safety compilation passes |
| Balanced ready pull request without auxiliary review | Retains explicit ready creation and does not add an auxiliary-review node |
| Strict project document | Passes the closed structural schema, then fails semantic resolution with `PRESET_UNAVAILABLE` |
| Workflow without a review-verdict policy | Fails preset expansion with `PRESET_WORKFLOW_INCOMPATIBLE` |
| Canonical legacy Fast and Balanced specimens | Converge only when the caller explicitly supplies local workflow and capability bindings |
| Legacy local tracker with issue workflow selection | Rejected instead of inferring GitHub Issues or Linear |
| Legacy preset label contradicting review fields | Rejected instead of trusting the label |

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Presets are independent of workflow family | Pass | Expansion accepts an explicit family and never chooses one. |
| Draft and ready pull requests remain explicit | Pass | The preset does not contain or derive `initialState`. |
| Auxiliary review remains explicit | Pass | The preset does not contain or derive `auxiliaryReview`. |
| Fast and Balanced have executable differences | Pass for local workflow | Balanced adds finite artifact effects and closed policies that change the manifest. |
| Stronger family invariants are not weakened | Pass | Fast leaves the issue workflow's CI, isolation, review, and authorization gates intact. |
| Strict is honest | Pass by fail-closed behavior | Recognition produces a semantic diagnostic; no weaker expansion is returned. |
| Legacy convergence avoids hidden inference | Pass | Hosted tracker and workflow choices absent from schema version 0 are never invented. |
| Public compatibility | Fail by design | Names, revisions, diagnostics, schema, and convergence are private candidates. |

## Limitations

- Reviewer-isolation payload fields are now structurally and consistently validated against active change-producer and review envelopes, but their external truth and identity remain unauthenticated.
- Preset profiles currently express finite artifact-presence safety properties, not risk classification, liveness, fairness, or arbitrary predicates.
- Fast and Balanced have the same effective issue-workflow topology because that family already carries the stronger review gates; their definition identities and project resolutions still bind the selected profile.
- The legacy convergence boundary covers only the canonical schema-version-0 Fast and Balanced profiles and local or no-tracker modes.
- No public default, configuration filename, migration, CLI behavior, adapter selection, or runtime execution is established.

## Recommendation

Retain the orthogonal preset overlay and explicit failure for Strict. Do not add more preset labels or hidden family defaults.

The typed evidence and GitHub mapping follow-ons validate reviewer isolation, subject consistency, canonical bytes, and one caller-attested provider observation. The current [roadmap](../development/roadmap.md) freezes further acquisition, persistence, and provider-adapter work until the local vertical CLI milestone requires a real consumer.
