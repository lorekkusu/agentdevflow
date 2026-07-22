# Private execution transport contract

## Status

This is a private, pure transport experiment for the existing execution manifest package, typed payload package, evidence envelope, and execution trace. It does not define public filenames, discovery, persistence, compatibility, migration, authentication, signing, encryption, provider adapters, or runtime orchestration.

The implementation is in `src/execution/private-execution-transport.ts`. Reproducible results are in [private execution transport evidence](../evidence/private-execution-transport.md). The [private compiled-policy consumer](private-compiled-policy-consumer.md) is its one retained application composition.

## Purpose

The contract asks whether caller-supplied bytes can cross the execution boundary without losing deterministic bindings or exposing the verifier to ambiguous, unbounded, or malformed JSON.

The caller selects one of four explicit codecs:

- manifest package;
- typed payload package;
- evidence envelope;
- execution trace.

There is no generic tagged union and no new wrapper revision. Each parsed value retains the private revision already defined by its existing contract.

## Canonical byte contract

Transport bytes are UTF-8 encoded strict JSON with no byte-order mark, comments, trailing comma, insignificant whitespace, or terminal newline. Object keys use lexical ordering. Array order remains semantically significant and is not reordered by the transport layer.

Serialization validates the typed value, emits exact canonical bytes, reparses them through the same boundary, and returns:

- a copied `Uint8Array`;
- exact byte length;
- SHA-256 content digest over the transport bytes;
- the validated typed value.

Parsing does not normalize accepted input. Valid but non-canonical JSON is rejected with `TRANSPORT_NON_CANONICAL`. This also rejects duplicate object properties because the post-parse canonical value cannot reproduce the original duplicate bytes. Editable project configuration remains JSONC; this strict transport serves a different purpose.

## Validation order and limits

Parsing performs the following checks in order:

1. require a `Uint8Array` input;
2. enforce the configured byte ceiling;
3. decode UTF-8 in fatal mode;
4. parse strict JSON;
5. inspect the parsed value iteratively for nesting depth, total value count, and the unsafe `__proto__` property;
6. require exact canonical byte equality;
7. validate the selected closed value structure;
8. verify embedded canonical bytes and SHA-256 digests where the value contract defines them.

The private defaults are:

| Limit | Default |
| --- | ---: |
| UTF-8 bytes per transport value | 2,097,152 |
| Nesting depth | 32 |
| Total JSON values | 32,768 |

Callers may select lower positive safe-integer limits. These values are conservative experiment boundaries, not public service-level guarantees.

## Closed value validation

The manifest package validator requires:

- the exact revision-2 manifest shape;
- the exact canonical manifest bytes and digest;
- sorted unique artifacts, steps, policies, and evidence requirements;
- sorted unique per-step artifact and capability references;
- unique capability and evidence bindings;
- only declared artifact, node, capability, and reference-artifact links;
- the unique artifact associated with each closed evidence schema.

The payload-package validator reuses the existing closed schema and digest validator. The envelope validator verifies its exact nested shape and digest. The trace validator verifies the exact revision-2 trace and event shapes and validates every embedded envelope and payload package.

## Semantic separation

Transport validity is not execution validity. A parsed trace can still be out of order, refer to another manifest, omit required event evidence, violate reviewer isolation, or violate a workflow policy. The caller must pass parsed manifest and trace values to `replayPrivateExecutionTrace` for those checks.

Likewise, a structurally valid manifest with recomputed digests is not proof that the trusted compiler produced it. The transport retains the manifest compilation digest but cannot reproduce the omitted compiler input or authenticate the producer.

## Diagnostics

The current closed diagnostic codes cover invalid UTF-8, strict JSON syntax failure, byte and structure limits, unsafe property names, non-canonical bytes, invalid closed values, and inconsistent embedded digests.

Parsing returns one deterministic fail-first diagnostic. These codes are private candidates and are not CLI exit codes or public compatibility promises.

## Complexity and non-claims

Parsing and structural inspection are linear in input size and value count. Canonicalization sorts object keys, so its upper bound includes the per-object key sorting cost. Memory use is linear in the accepted input size and parsed value graph.

The transport layer performs no filesystem, network, process, credential, tracker, provider, scheduler, retry, waiting, or mutation work. Its digests provide integrity identifiers, not signatures, identity, authority, confidentiality, freshness, or revocation.

## Change boundary

Keep the codecs private and path-free. Do not accept non-canonical input by silently rewriting it, and do not treat successful parsing as compiler provenance or evidence truth. The private compiled-policy consumer does not authorize format generalization, persistence, or trusted acquisition. Any such work requires a separately accepted concrete user outcome before adding adapters or runtime monitoring.
