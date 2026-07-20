# Private execution manifest and evidence contract

## Status

This is a private experimental contract. It validates deterministic workflow export, closed typed payload packages, and externally supplied execution evidence without defining a public workflow API, configuration syntax, artifact path, parser, scheduler, provider adapter, or authentication protocol.

The implementation is in `src/execution/private-execution-contract.ts`. Reproducible results are in [private execution contract evidence](../evidence/private-execution-contract.md). The separate [private execution transport contract](private-execution-transport.md) validates caller-supplied canonical bytes before replay.

## Purpose

The contract answers two narrow questions:

1. Can a compiled provider-neutral workflow be exported as deterministic execution data for different external executors?
2. Can a pure verifier reject malformed, stale, foreign, incomplete, duplicate, or out-of-order execution evidence without running the workflow?

The contract does not choose a next step, wait for an event, invoke an agent or API, retry work, hold credentials, or mutate external state.

## Manifest package

A successful private domain-workflow compilation produces a manifest package with:

- manifest revision;
- exact domain compilation digest;
- workflow definition id and revision;
- initial node;
- sorted artifact identifiers;
- sorted transition steps;
- closed safety policies;
- resolved provider-neutral capability requirements;
- artifact-to-payload-schema requirements with an optional active reference artifact;
- canonical strict JSON bytes;
- SHA-256 manifest digest.

Each transition step retains:

- stable step id;
- source and destination node;
- Steward, Developer, or Reviewer responsibility;
- produced and invalidated artifact identifiers;
- capability requirement ids used by that step;
- optional guard description.

Capability references are validated against the compiled definition. A missing or weaker observation prevents manifest creation. The manifest records logical bindings and observed mechanisms, not credentials or executable provider clients.

The manifest digest binds its canonical bytes. It is an integrity identifier, not a signature, authority grant, or authenticity claim.

Manifest revision `2` adds the typed evidence requirements. Each artifact may have at most one requirement. The current closed schemas are `ci-result@2`, `merge-authorization@1`, `review-verdict@1`, and `reviewer-isolation@1`. Unknown schemas, undeclared artifacts, duplicate requirement ids, and duplicate requirement artifacts prevent compilation.

## Evidence envelope

One envelope represents one artifact produced by one declared transition. Revision 1 binds:

- exact manifest digest;
- workflow definition id and revision;
- transition step id;
- artifact identifier;
- caller-supplied subject digest;
- payload digest;
- producer responsibility, logical binding, principal observation, and execution-context observation;
- observed enforcement strength and mechanism;
- envelope digest.

The subject digest is an opaque exact identity selected by the workflow domain. An issue-to-pull-request workflow may use a source revision digest; a local workflow may use a repository-state digest. The core does not interpret the subject or infer equivalence.

Envelope creation rejects undeclared steps or artifacts, non-canonical digests, empty producer observations, and a producer responsibility that differs from the transition responsibility. The envelope digest binds the fields but does not authenticate them. A trusted producer or attestation protocol remains separate work.

## Typed payload package

Trace revision `2` requires every event to carry a closed list of payload packages in addition to evidence envelopes. Payload package revision `1` binds:

- one supported schema and its exact artifact;
- the exact event subject digest;
- a closed typed payload;
- canonical strict JSON bytes;
- a SHA-256 payload-package digest used as the envelope's payload digest.

The current schemas validate:

| Schema | Closed payload |
| --- | --- |
| `ci-result@2` | Passed or failed status, required-checks digest, and complete observation-snapshot digest |
| `merge-authorization@1` | Evidence digest and bounded squash method |
| `review-verdict@1` | Verdict plus Reviewer principal and execution-context observations |
| `reviewer-isolation@1` | Change-producer and Reviewer principal and execution-context observations plus an observed-fresh literal |

Payload objects reject unknown fields. Digest fields must be lowercase SHA-256 values, and observation strings are non-empty and bounded. Creation validates the shallow closed payload before canonicalization.

The reviewer-isolation requirement names one active reference artifact in the manifest. The issue workflow references `PullRequestSnapshot`; Balanced local review references `VerificationEvidence`. Replay requires the reference envelope to be active for the same subject, requires the payload's change-producer fields to match that envelope, requires the Reviewer fields to match the current review envelope, and rejects a shared principal or execution context. These are consistency checks over supplied observations, not authentication.

## Trace replay

A trace contains a manifest digest and an ordered list of externally supplied events. Each event names one transition, one subject digest, and the evidence envelopes produced by that transition.

Replay starts at the manifest initial node and performs these checks in order:

1. verify the manifest package bytes and digest;
2. verify trace revision and manifest binding;
3. require the transition to exist and start at the current node;
4. require exactly one valid envelope for every produced artifact;
5. reject duplicate or unexpected artifacts and payload packages;
6. verify envelope digest, manifest, definition, step, subject, and producer responsibility bindings;
7. require the exact manifest-declared payload schema where applicable;
8. verify payload bytes, digest, artifact, subject, producer observations, and reviewer isolation against active reference evidence;
9. reject unreferenced payload packages;
10. invalidate active artifacts before installing newly produced evidence;
11. advance to the destination node;
12. evaluate closed required-artifact and forbidden-artifact policies at that node.

Replay stops at the first invalid event and returns no partial success state. Diagnostics are deterministic within that event. A successful result returns the final node, applied step ids, and active evidence sorted by artifact identifier.

The trace is evidence about an externally selected path. Replay does not select or recommend transitions and does not establish liveness, fairness, termination, or successful external side effects.

## Revision-changing work

Domain workflow definitions must explicitly invalidate revision-bound artifacts. The issue-to-pull-request definition invalidates the prior pull-request snapshot, CI result, auxiliary-review result, blocking findings, review verdict, reviewer-isolation evidence, and merge authorization after repair or autofix, then produces a fresh pull-request snapshot.

An envelope from an earlier revision cannot satisfy a produced-artifact event for a new subject digest. Reusing it produces `EVIDENCE_SUBJECT_MISMATCH`. A typed payload package bound to another subject produces `EVIDENCE_PAYLOAD_SUBJECT_MISMATCH`. Omitting required fresh envelope or payload evidence produces `EVIDENCE_MISSING` or `EVIDENCE_PAYLOAD_MISSING`.

The generic execution core does not guess which artifacts are revision-bound. The local no-pull-request definition remains an executable regression guard against adding pull-request assumptions to this contract.

## Diagnostics

The current closed diagnostic groups cover:

- invalid manifest packages;
- unsupported or foreign traces;
- unknown or out-of-order steps;
- malformed, duplicate, missing, unexpected, foreign, stale, or step-mismatched evidence;
- producer-responsibility mismatch;
- malformed, missing, duplicate, unexpected, schema-mismatched, subject-mismatched, or producer-mismatched typed payloads;
- reviewer-isolation inconsistency with active change-producer evidence;
- missing required artifacts and forbidden active artifacts.

These codes are private candidates. They are not CLI exit codes or a public compatibility promise.

## Security and enforcement non-claims

- SHA-256 digests provide deterministic integrity binding, not identity or authorization.
- Producer principals, contexts, freshness, and enforcement mechanisms are structurally cross-checked observations until a trusted adapter or attestation proves them.
- Replay does not confirm that an external API call occurred or that its reported result is truthful.
- Advisory evidence remains advisory. A weaker mechanism cannot satisfy a stronger capability requirement during manifest compilation.
- The contract contains no secrets, credentials, network access, filesystem access, process execution, or external mutation.
- Persistence, discovery, concurrent update, trusted acquisition, confidentiality, signing, and revocation remain undefined. The private transport codec validates canonical bytes but does not provide authenticity.

## Change boundary

Keep this contract private. The path-free serialized transport boundary now preserves and validates manifest, payload-package, envelope, and trace bindings. Before public stabilization, trusted acquisition, persistence, discovery, and migrations must preserve every binding without silent intent loss.
