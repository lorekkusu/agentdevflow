# Private domain workflow evidence

Snapshot date: 2026-07-20.

## Verdict

**Pass for the private domain-validation slice.** One provider-neutral compiler seam accepts both an issue-to-reviewed-pull-request workflow family and a local reviewed-change workflow with no tracker, pull request, CI, or merge concepts. Draft and immediately ready pull requests, optional auxiliary review, repair cycles, stale evidence, reviewer-context observations, exact merge authorization, capability strength, deterministic normalization, and an explicit state budget have executable coverage.

This result does not accept a public workflow definition, configuration shape, artifact transport, capability identifier, execution protocol, merge method, or provider adapter contract.

## Reproduction

Implementation:

- `src/compiler/private-domain-workflow.ts`;
- `src/workflows/private-issue-to-reviewed-pull-request.ts`;
- `src/workflows/private-local-reviewed-change.ts`.

Fixtures and tests:

- `test/fixtures/workflows/run.ts`;
- `test/workflows/private-domain-workflows.test.ts`.

Run:

```bash
npm run build
node --test dist/test/workflows/private-domain-workflows.test.js
npm run phase1:domain-workflows
npm run check
```

## Compiler boundary

The private seam accepts:

- finite nodes and role-labeled transitions;
- finite typed artifact identifiers and explicit production or invalidation;
- closed required-artifact and forbidden-artifact policies;
- opaque provider-neutral capability bindings;
- observed enforcement strength and mechanism;
- an explicit abstract-state budget.

It normalizes the internal definition, resolves capability observations, calculates the conservative `node count * 2 ^ artifact type count` bound, invokes the existing guard-blind finite-state validator, and returns a deterministic compilation digest.

Domain-specific artifacts and capabilities remain in `src/workflows/`. The generic compiler imports no issue, tracker, pull-request, CI, review-service, or merge types. Both workflow families use the same compiler function and policy validator.

## Captured specimens

| Specimen | Nodes | Artifacts | Theoretical maximum | Explored states | Capabilities | Compilation digest |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Draft pull request with auxiliary review | 11 | 11 | 22,528 | 12 | 7 | `9f685ecd727364f23cd3b8df6bb704d2456ac120401fdeb45a02d19113f858a3` |
| Ready pull request without auxiliary review | 10 | 11 | 20,480 | 11 | 6 | `6f8302de37aa94c60554766538ccdaa90a6e3ba43851ca702457ae213a1e9bef` |
| Local reviewed change | 4 | 4 | 64 | 4 | 2 | `ff4530c2430c294eda60492c1d8d08f9700c7ed6404bf6f4308a939fd4371415` |

The focused domain suite passed 13 tests. At this evidence snapshot, the complete repository check passed the publication audit over 198 text files, TypeScript type checking, and 355 tests with zero failures or skips.

The issue-to-pull-request definition uses logical bindings such as `tracker`, `developer`, `reviewer`, `ci`, and `pull-request-host`; it contains no Codex, Claude Code, Cursor, Linear, or GitHub topology branch. Replacing a product remains a binding concern.

Transitions now reference declared logical capability requirement ids. This changes the private compilation digests and allows deterministic execution manifests to route capabilities without adding provider-specific topology. See [private execution contract evidence](private-execution-contract.md).

The local definition contains `Plan`, `VerificationEvidence`, `ReviewVerdict`, and `AcceptanceAuthorization`. Its normalized bytes contain no `PullRequest`, `WorkItem`, `CiResult`, or `Merge` identifier. It is not represented by empty pull-request fields or fictitious tracker artifacts.

## Pull-request variation

The private issue-to-pull-request factory takes bounded options for initial state, auxiliary review, and the first merge-method fixture:

- `draft` creates the draft branch;
- `ready` creates the immediately reviewable branch;
- auxiliary review may be enabled or disabled;
- the first fixture uses squash without claiming that squash is universal.

Both initial states converge on the same revision-bound CI, independent-review, and merge-authorization policies. Pull-request ready state remains separate from merge authorization.

Auxiliary review has three explicit outcomes:

1. clear evidence proceeds to independent review;
2. non-mutating blocking findings proceed to repair;
3. autofix produces a new pull-request snapshot and invalidates the prior snapshot, CI result, auxiliary result, blocking findings, review verdict, reviewer-isolation evidence, and merge authorization.

## Safety observations

| Fixture | Result |
| --- | --- |
| Draft path with auxiliary review | Accepted |
| Immediately ready path without auxiliary review | Accepted |
| Unbounded CI repair and review-rework cycles | Accepted |
| Auxiliary autofix followed by fresh observation and CI | Accepted |
| Auxiliary blocking findings routed to repair | Accepted |
| Revision-changing repair followed by stale CI reuse | Rejected with `authorization-requires-ci` counterexample |
| Rework followed by stale review reuse | Rejected with independent-review and verdict counterexamples |
| Direct delegated-to-merged bypass | Rejected with `merge-requires-authorization` counterexample |
| Developer principal and execution context reused as Reviewer | Rejected by deterministic observation diagnostics |
| Advisory merge capability offered to a guarded requirement | Rejected with `CAPABILITY_STRENGTH_INSUFFICIENT` |
| Reordered equivalent definition and observations | Accepted with deeply equal compilation output |
| Theoretical maximum 22,528 with configured limit 22,527 | Rejected before exploration |

Reviewer independence remains an observed consistency check. The experiment checks exact revision, principal separation, execution-context separation, and an asserted fresh-context observation. It does not authenticate a principal or prove session isolation.

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Issue-to-pull-request workflow does not constrain the compiler core | Pass | Domain types remain outside the generic compiler; the local definition compiles through the same seam. |
| Draft pull requests are optional | Pass | Both draft and immediately ready specimens compile safely. |
| Optional auxiliary review does not weaken independent review | Pass | The disabled specimen retains the same review and authorization policies. |
| Revision-changing work invalidates stale evidence | Pass | Autofix and repair transitions invalidate revision-bound artifacts; unsafe reuse fixtures fail. |
| Independent review is more than a provider label | Pass for observed consistency | Principal, context, freshness, and exact revision produce deterministic diagnostics. |
| Capability degradation remains visible | Pass | Advisory merge evidence cannot satisfy a guarded requirement. |
| Cycles do not require a retry bound | Pass | Finite abstract states make repair and review cycles terminate in analysis. |
| Public workflow representation is ready | Fail by design | Project configuration, artifact transport, execution manifest, migration, and adapter contracts remain private or undefined. |

## Limitations

- Capability observations are fixture input, not live provider or hosting-platform evidence.
- Opaque binding names are internal and have no accepted discovery or authentication contract.
- Artifact identifiers are finite presence bits for safety analysis; the TypeScript evidence interfaces are not persisted or discovered.
- Revision and reviewer-independence observations have a pure consistency validator but no trusted producer or attestation.
- The default state budget is private and deliberately conservative.
- The first merge-method fixture is squash; other methods require explicit capability and policy evidence.
- CI and review are sequential in the first issue-to-pull-request definition. Concurrent evidence collection remains an open bounded-workflow question.
- The compiler exports no scheduler, monitor, credential manager, tracker runtime, or merge executor.
- The private domain seam now accepts a bounded private project intent and orthogonal Fast or Balanced preset expansion. The older schema-version-0 candidate converges only with explicit new choices; no public `ProjectConfig` is frozen.

## Recommendation

Keep the compiler core provider-neutral and domain-neutral. Retain issue, pull-request, CI, and merge semantics in versioned built-in workflow definitions. Keep the local no-pull-request fixture as a regression guard against accidental domain coupling.

The follow-on [private execution contract](private-execution-contract.md) exports deterministic manifests and evidence envelopes for both workflow families, [private project-resolution evidence](private-domain-project-resolution.md) binds project intent to those manifests, and [private preset expansion evidence](private-preset-expansion.md) keeps policy profiles separate from workflow selection. These layers remain free of scheduling and external mutation and do not accept a public configuration contract.
