# Gate 6: finite-state policy safety evidence

Snapshot date: 2026-07-13.

## Verdict

**Pass. Keep policy compilation as the project core.** The executable validator detects direct review bypass and stale review evidence, accepts a safe unbounded review/rework cycle, emits deterministic counterexamples, and identifies guard-related false positives without a runtime or executable predicates.

This capability provides independent value beyond provider rendering. Phase 0 therefore ends with a **Go** recommendation, subject to the staging-only renderer boundary from Gate 1.

## Reproduction

The private model is in `src/policy/model.ts`, the validator is in `src/policy/validator.ts`, fixtures are in `test/fixtures/policy/workflows.ts`, and automated tests are in `test/policy/validator.test.ts`.

Run:

```bash
npm install
npm run build
node --test dist/test/policy/validator.test.js
```

The focused suite covers the five required fixtures. `npm run check` provides
the complete current repository result.

## Formal boundary

The validator operates on a static finite transition system:

- a finite set of named nodes;
- a finite set of explicit transitions;
- an initial node and finite set of initially valid artifact types;
- transition labels that invalidate artifact types and then produce artifact types;
- cycles permitted;
- guard strings retained as diagnostic metadata but never evaluated;
- two closed safety-policy patterns: require a valid artifact at a node, and forbid a valid artifact at a node.

An abstract state is:

```text
(current node, set of currently valid artifact types)
```

Invalidation is applied before production. A transition can therefore replace a stale artifact with a fresh artifact of the same type.

The validator explores reachable abstract states with breadth-first search. Transitions are sorted by stable ID, artifact sets are sorted in keys and output, policies are sorted by ID, and only the first shortest counterexample per policy is retained. These rules make results deterministic.

## Captured fixture results

| Fixture | Expected | Observed | Result |
| --- | --- | --- | --- |
| Safe `plan -> implement -> review -> merge` | Accept | Safe; 4 abstract states; no violations. | Pass |
| Direct `implement -> merge` | Reject | `MISSING_REQUIRED_ARTIFACT`; trace `01-plan-implement`, `02-implement-merge`. | Pass |
| Stale `ReviewVerdict` after implementation resumes | Reject | Verdict produced at review, invalidated at reimplementation, then missing at merge; 4-step trace. | Pass |
| Safe review/rework cycle | Accept without retry bound | Safe; 4 reachable abstract states. The repeated abstract implementation state is visited once. | Pass |
| Guard-related false positive | Reject with limitation | Counterexample includes `guard: risk == low`, sets `guardBlind: true`, and explains that mutually exclusive guards can cause a false positive. | Pass |

The stale counterexample is:

```text
plan
--01-plan-implement--> implement                 valid: []
--02-implement-review--> review                  valid: [ReviewVerdict]
--03-review-reimplement--> reimplement           valid: []
--04-reimplement-merge--> merge                  valid: []
```

The third transition explicitly invalidates `ReviewVerdict`; prior production is not treated as permanent precedence evidence.

The guard-blind counterexample is:

```text
plan
--01-plan-implement [guard: risk != low]--> implement
--02-implement-merge-fast [guard: risk == low]--> merge
```

The two guards are mutually exclusive for a persistent `risk` value. The validator does not attempt to prove that incompatibility. The diagnostic therefore reports the accepted V1 false-positive limitation directly.

## Additional executable checks

- The absence pattern rejects merge while `BlockingFinding` is valid.
- A transition that both invalidates and produces `ReviewVerdict` leaves a fresh valid verdict because effects have defined ordering.
- Duplicate or undeclared finite-model identifiers fail before exploration.
- Repeated validation of the direct bypass returns deeply equal results.

The complete repository suite contained 15 passing tests when this evidence was recorded.

## Complexity

Let:

- `N` be the number of workflow nodes;
- `T` be the number of transitions;
- `A` be the number of artifact types represented in effects or initial state;
- `P` be the number of safety policies.

There are at most `N * 2^A` abstract states. Each transition can be considered for each artifact valuation at its source, so the exploration bound is `O((N + T) * 2^A)`, plus policy checks bounded by `O(P * N * 2^A)`. Predecessor storage and visited-state storage are `O(N * 2^A)`; a reconstructed counterexample is at most the number of visited abstract states.

The exponential artifact factor is explicit. It was not material in the required fixtures, which use one safety-relevant artifact type and explore at most five states. A future compiler must keep the artifact type set small, reject excessive models, or introduce safe reductions before accepting larger workflows.

## Limitations

- Guards are ignored. The analysis is a safety over-approximation and may reject guard-infeasible paths.
- Artifact types are finite presence bits. The validator does not reason about values, revisions, digests, identities, or arbitrary data predicates.
- Producer identity, semantic truth, and evidence quality are outside this model. Declared transition effects are trusted compiler input.
- The closed policy set covers required-artifact precedence and artifact absence only. It does not expose a public policy language.
- Dynamic topology, arbitrary executable predicates, unbounded data state, general response properties, liveness, fairness, and termination are excluded.
- The validator returns one deterministic shortest counterexample per violated policy, not every violating trace.
- The validator is a compile-time check. It does not schedule work or enforce a transition at runtime; generated checks, CI, hooks, or external controls must provide any execution-time mechanism.

These are intentional Phase 0 boundaries, not hidden guarantees.

## Gate criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Reject direct and stale-artifact bypasses | Pass | Automated fixtures produce path-specific missing-artifact counterexamples. |
| Accept safe cyclic workflows | Pass | The review/rework cycle terminates through visited abstract states and has no violation. |
| Deterministic useful counterexamples | Pass | Sorted BFS and canonical artifact sets produce repeatable structured traces. |
| Explicit guard-blind false positives | Pass | Guarded traces set `guardBlind` and include a limitation message. |
| Independent of runtime and provider adapters | Pass | The policy module imports neither renderer nor scheduler code. |

No fail or pivot criterion is triggered. The useful policies do not require arbitrary predicates, the minimal state space remains small, diagnostics explain the path and artifact state, and the result is executable rather than prompt-only.

## Working-tree recommendation

Policy compilation remains the core of `agentdevflow`.

Continue with `ProjectConfig` as the candidate stable user input, a private finite `WorkflowIR`, and a closed safety-policy compiler. Do not turn the Phase 0 TypeScript interfaces into a public workflow DSL. Before a public V1, validate additional distinct workflows, define artifact revision consistency, bound or reduce artifact state growth, and compile policy requirements into honest enforcement mechanisms where available.
