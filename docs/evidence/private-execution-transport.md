# Private execution transport evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for a private deterministic byte-transport boundary.** Manifest packages, typed payload packages, evidence envelopes, and traces serialize to exact canonical UTF-8 JSON, parse back to deeply equal typed values, retain stable byte digests, and remain compatible with the existing semantic replay verifier.

This result does not accept a public format, filename, discovery rule, persistence model, migration promise, trusted producer, signature protocol, provider adapter, scheduler, monitor, or external mutation.

## Reproduction

Implementation and tests:

- `src/execution/private-execution-transport.ts`;
- `test/execution/private-execution-transport.test.ts`;
- `test/fixtures/execution/transport-run.ts`.

Run:

```bash
npm run phase1:execution-transport
node --test dist/test/execution/private-execution-contract.test.js dist/test/execution/private-execution-transport.test.js
npm run check
```

## Captured canonical transports

The ready pull-request specimen produced:

| Value | Bytes | Transport content digest |
| --- | ---: | --- |
| Manifest package | 11,030 | `b1521975fed080e6dfe980614eee7780ae977939709f77816880919f00021e20` |
| Typed CI payload package | 821 | `15098fa6f7eb69d3e4166b48892a6e8beba758bf4efb5f94aa1b60edf72f2e4d` |
| Plan evidence envelope | 704 | `1b88b9757cfa78e80f717707f88d5ca7787db19fac042b66a5d4d18b684b2e61` |
| One-event trace | 955 | `d7e20ef06e6cc1884249342c727c85ecfcb3484e0a23094a66538ee8e2d4edca` |

Parsing the captured manifest and trace and then invoking the existing replay verifier ended at node `work-item`.

## Observations

| Fixture | Result |
| --- | --- |
| Repeated serialization of all four value kinds | Byte-identical output and content digest |
| Canonical bytes parsed and serialized again | Deeply equal typed values and identical content digest |
| Parsed one-event plan trace | Accepted by semantic replay |
| Structurally valid CI event used as the first workflow event | Transport accepted; replay rejected with `STEP_OUT_OF_ORDER` |
| Invalid UTF-8 | Rejected before JSON parsing |
| Strict JSON with whitespace or reordered object keys | Rejected as non-canonical |
| Duplicate object property | Rejected as non-canonical |
| JSON comment | Rejected as invalid strict JSON |
| Byte, nesting, or total-value limit exceeded | Rejected at the configured boundary |
| `__proto__` property | Rejected before canonicalization |
| Unknown manifest-package field | Rejected by the closed value validator |
| Reordered manifest artifact array with a recomputed digest | Rejected as an invalid normalized manifest |
| Typed payload with a changed embedded digest | Rejected by the existing package validator |
| Canonical `null` supplied as an envelope | Rejected deterministically without throwing |
| Invalid limit option | Rejected as a programmer error before parsing |

The focused execution and transport suites passed 27 tests with zero failures or skips. At this evidence snapshot, the complete repository check passed the publication audit over 198 text files, TypeScript type checking, and 355 tests with zero failures or skips.

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Deterministic bytes | Pass | Each explicit serializer emits canonical UTF-8 strict JSON without a terminal newline. |
| Exact round trip | Pass | All four values parse to deeply equal typed structures. |
| Ambiguity rejection | Pass | Whitespace, key-order differences, duplicate properties, comments, and unknown fields fail closed. |
| Resource bounds | Pass for private defaults | Bytes, nesting depth, and total parsed values have configurable positive ceilings. |
| Embedded integrity | Pass | Manifest, payload-package, and envelope canonical bytes and digests are revalidated. |
| Manifest normalization | Pass for the closed private shape | Sorting, uniqueness, schema-to-artifact binding, and internal references are checked. |
| Semantic layering | Pass | Transport accepts a structurally sound out-of-order trace that replay then rejects. |
| Provenance or authenticity | Fail by design | A caller can recompute ordinary hashes; no signature or trusted compiler identity exists. |
| Public compatibility | Fail by design | Formats, revisions, diagnostics, limits, paths, and migrations remain private. |

## Limitations

- Each codec is selected by the caller; no self-describing transport envelope exists.
- Exact canonical input is intentionally strict and is unsuitable as an editable user configuration format.
- Duplicate properties receive a non-canonical diagnostic rather than a property-specific source location.
- The parser validates the closed manifest representation but cannot reproduce policy compilation from the omitted source definition.
- Trace parsing validates nested structures and digests but does not apply manifest bindings, workflow order, evidence invalidation, or safety policies.
- The default limits are conservative private values and have not been calibrated against production repositories.
- Digests do not authenticate evidence, compiler output, principals, contexts, or external systems.

## Recommendation

Retain the strict path-free codecs as the only private byte boundary for execution values. Keep editable JSONC configuration separate, reject rather than normalize incoming transport bytes, and require semantic replay after parsing.

The follow-on GitHub Check Runs mapper tested one bounded caller-attested provider observation. The later [compiled-policy consumer](private-compiled-policy-consumer.md) now uses canonical trace decoding in one pure project-to-replay composition. The current [roadmap](../development/roadmap.md) still freezes transport generalization and live acquisition until a separately accepted user outcome requires them. Preserve the current payload, envelope, subject, principal, execution-context, and enforcement bindings without adding a scheduler, credentials store, broad provider matrix, or automatic external mutation.
