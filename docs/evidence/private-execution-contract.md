# Private execution contract evidence

Snapshot date: 2026-07-20.

## Verdict

**Pass for a private, pure execution-export and typed-payload boundary.** The same revisioned manifest, payload-package, and evidence-envelope contract represents both issue-to-reviewed-pull-request and local no-pull-request workflows. Deterministic trace replay accepts valid draft, ready, auxiliary-review, and local rework paths and rejects out-of-order, duplicate, missing, stale, foreign, tampered, subject-mismatched, producer-mismatched, reviewer-isolation, and unsafe inputs.

This result does not accept public manifest or evidence formats, artifact paths, a parser, configuration integration, trusted producer identity, provider execution, scheduling, monitoring, persistence, or external mutation.

## Reproduction

Implementation:

- `src/execution/private-execution-contract.ts`;
- `src/execution/private-typed-evidence.ts`;
- `src/compiler/private-domain-workflow.ts`;
- `src/workflows/private-issue-to-reviewed-pull-request.ts`;
- `src/workflows/private-local-reviewed-change.ts`.

Fixtures and tests:

- `test/fixtures/execution/run.ts`;
- `test/execution/private-execution-contract.test.ts`;
- `test/workflows/private-domain-workflows.test.ts`.

Run:

```bash
npm run build
node --test dist/test/execution/private-execution-contract.test.js
npm run phase1:execution-contract
npm run check
```

## Captured manifests

| Specimen | Steps | Artifacts | Capabilities | Typed requirements | Manifest bytes | Workflow compilation digest | Manifest digest |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Draft pull request with auxiliary review | 14 | 11 | 7 | 4 | 6,103 | `9f685ecd727364f23cd3b8df6bb704d2456ac120401fdeb45a02d19113f858a3` | `c1ef647f9978ed61d70bd3babfabf8d61d8c1dd20a25e3d86abfadd66b744832` |
| Ready pull request without auxiliary review | 11 | 11 | 6 | 4 | 5,142 | `6f8302de37aa94c60554766538ccdaa90a6e3ba43851ca702457ae213a1e9bef` | `e0647974853c447c8357a6e6120ecc8f2fc3ca66d28286743e2f96cf664110f8` |
| Local reviewed change | 4 | 4 | 2 | 1 | 1,943 | `ff4530c2430c294eda60492c1d8d08f9700c7ed6404bf6f4308a939fd4371415` | `e287d72e4026860eda13b97eb0ab667fdd01d223553cc2137780aea7204cdaf9` |

The first deterministic evidence-envelope digests were:

- draft with auxiliary review: `274b18c9fcab0507c44f1dbfa87a3094613a451e6e98ea191052a6ce7aa3a40a`;
- ready without auxiliary review: `12e968160818cc00971f3731623d07438fcbfae1a396a3806e8e8733d35caaf1`;
- local reviewed change: `419bc938e97ec54eaa07371c1173caa915dad3149ef5ce02cf59753e725ee440`.

The first deterministic typed payload-package digests were:

- draft with auxiliary review: `7c364f11b528d4f4d700da71826c2f84d26806e4ac6c8ece677742e5e769079b`;
- ready without auxiliary review: `0b52ea7f38bd7d4c842e2daee9add5c866498f41b6a9eab3990175f343ab9684`;
- local reviewed change: `c87a1f10166d04f0151e37831dd895b63a63d809f13ffef08401d9a6b017719f`.

Equivalent reordered domain definitions and capability observations produced deeply equal manifests, canonical bytes, and digests.

Manifest and trace revision `2` bind artifact-to-schema requirements and per-event payload packages. `ci-result@2` additionally binds the complete normalized provider observation snapshot so a required-checks summary cannot be replayed independently of its source observations. Evidence envelopes and payload packages each retain private revision `1`; the envelope continues to carry only the exact payload-package digest.

The focused execution-contract suite passed 20 tests. At this evidence snapshot, the complete repository check passed the publication audit over 198 text files, TypeScript type checking, and 355 tests with zero failures or skips.

## Capability routing

Domain transitions now reference declared capability requirement ids. The manifest retains those references and the resolved logical bindings, required strength, observed strength, and mechanism.

Examples include:

- work-item creation and delegation on the issue workflow's delegation step;
- pull-request creation on the configured draft or ready creation step;
- CI observation on pass and failure transitions;
- auxiliary-review capability only when that bounded stage is enabled;
- independent-review capability on approved and changes-requested outcomes;
- external merge capability only on the merge transition;
- project-instruction guidance on local implementation and review transitions.

An undeclared capability reference prevents manifest creation. Capability routing remains provider-neutral and contains no vendor-specific workflow branch.

## Trace observations

| Fixture | Result |
| --- | --- |
| Complete draft path with auxiliary review | Accepted; final node `merged` |
| Complete immediately ready path without auxiliary review | Accepted; final node `merged` |
| Local review, rework, fresh verification, and acceptance | Accepted; final node `accepted` |
| First event starts at a later node | Rejected with `STEP_OUT_OF_ORDER` |
| Produced artifact duplicated while another is missing | Rejected with deterministic duplicate and missing diagnostics |
| CI envelope reused after autofix changes the subject | Rejected with `EVIDENCE_SUBJECT_MISMATCH` |
| Evidence created for another draft or ready manifest | Rejected with `EVIDENCE_MANIFEST_MISMATCH` |
| Payload digest changed after envelope creation | Rejected with `EVIDENCE_ENVELOPE_INVALID` |
| Manifest-required CI payload omitted | Rejected with `EVIDENCE_PAYLOAD_MISSING` |
| CI payload package bound to another subject | Rejected with `EVIDENCE_PAYLOAD_SUBJECT_MISMATCH` |
| Review-verdict payload principal or context differs from envelope | Rejected with `EVIDENCE_PAYLOAD_PRODUCER_MISMATCH` |
| Reviewer shares the active change producer principal and context | Rejected with deterministic `REVIEWER_ISOLATION_FAILED` diagnostics |
| Typed payload contains unknown fields | Rejected by the closed package validator |
| Caller supplies a null evidence-envelope entry | Rejected deterministically without throwing |
| Developer responsibility supplied for a Steward step | Rejected before envelope creation |
| Manifest bytes changed without updating the package | Rejected with `MANIFEST_PACKAGE_INVALID` |
| Direct delegated-to-merged workflow supplied for export | Rejected by policy compilation; no manifest produced |
| Transition references an undeclared capability requirement | Rejected as an invalid workflow definition |

Replay retains active evidence by artifact type, applies invalidation before production, and evaluates closed policies after each transition. It verifies a caller-supplied trace and does not choose that trace.

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Deterministic manifest export | Pass | Canonical strict JSON and SHA-256 digests are stable for reorder-equivalent input. |
| Domain-neutral representation | Pass | Issue-to-pull-request and local no-pull-request workflows use the same manifest and replay implementation. |
| Capability-to-step routing | Pass for private logical bindings | Every reference resolves to a declared, successfully observed capability requirement. |
| Exact evidence binding | Pass for structural consistency | Envelopes bind manifest, definition, step, artifact, subject, payload, producer observations, and enforcement observations. |
| Typed payload binding | Pass for closed private schemas | Canonical payload packages bind artifact, schema, subject, payload bytes, and envelope digest. |
| Reviewer-isolation consistency | Pass for supplied observations | Reviewer fields match the review envelope, change-producer fields match active reference evidence, and principal and context must differ. |
| Revision-changing invalidation | Pass | Autofix removes prior revision-bound evidence; stale CI reuse fails. |
| Out-of-order and partial evidence rejection | Pass | Replay fails at the first invalid event without returning partial success state. |
| Trusted identity or semantic truth | Fail by design | Digests and asserted observations do not authenticate a producer or prove a claim. |
| Runtime orchestration | Excluded | No scheduler, monitor, retry loop, credentials, network, filesystem, process, or mutation exists. |
| Public transport contract | Fail by design | A private strict parser exists; public formats, paths, storage, discovery, concurrency, migrations, and signing remain open. |

## Limitations

- Manifest and evidence revisions are private experiment identifiers.
- The manifest package validator still assumes compiler provenance. The private transport parser now validates its closed serialized shape and normalization, but cannot prove that a trusted compiler produced a recomputed package.
- Capability requirements are linked to steps, but evidence producer bindings are not yet authenticated against provider or platform identities.
- Subject digests remain opaque to the generic core. Typed packages require exact agreement but each workflow domain still defines the represented bytes or external identity.
- Active evidence is one envelope per artifact type. Multiple simultaneous findings or check results require an aggregate payload or a future bounded representation.
- The trace does not contain timing, retries, waiting state, concurrency, or compensation semantics.
- Policy replay covers only the current required-artifact and forbidden-artifact patterns.
- Envelope and payload-package digests are integrity identifiers, not signatures.
- Strict serialized parsing and bounded complete-trace transport now exist privately. Paths, storage, discovery, trusted acquisition, and migration remain open.

## Recommendation

Retain the private execution contract as the export boundary and keep runtime orchestration outside the compiler core. Keep both workflow families in every regression suite.

The follow-on project-resolution, parser, preset, [execution transport](private-execution-transport.md), and GitHub Check Runs mapping experiments now resolve bounded intent and preserve typed execution values across canonical bytes. The current [roadmap](../development/roadmap.md) freezes further acquisition and transport expansion until an executable local product path has a real external consumer.
