# Private compiled-policy consumer

## Status

This is a private decision-support spike and composition boundary. It does not add
or accept a public command, configuration field, workflow language, evidence
format, storage path, or compatibility promise.

The implementation is in
`src/application/private-compiled-policy-consumer.ts`. Reproducible results are
recorded in [compiled-policy consumer evidence](../evidence/private-compiled-policy-consumer.md).

## Candidate outcome

Given exact revision-1 project-document bytes, explicit caller-supplied
capability observations, and an exact caller-supplied canonical trace, the
spike determines whether the reported transition history is structurally
consistent with the resulting workflow compilation. The result is deterministic
and either:

- `trace-valid`, with the bound project, manifest, trace, final node, applied
  steps, and active artifact types; or
- `blocked`, with diagnostics identifying project compilation, trace transport,
  or policy replay as the failing stage.

This candidate is narrower than orchestration. A caller may append a proposed
event and reevaluate the complete trace, but the consumer does not choose the
event, discover evidence, or cause any external action. Creating an acceptable
trace currently requires the same private manifest, envelope, payload-package,
and serializer contracts used by the tests. No bounded route exists for a normal
user to create that input. Therefore this is composability evidence, not yet an
independently useful product outcome.

## Composition

The consumer deliberately contains no new policy algorithm. It composes the
existing boundaries in this order:

1. parse and compile the exact project document;
2. derive the execution manifest from the authoritative workflow compilation;
3. decode the exact trace through the strict canonical transport boundary;
4. replay the trace through the existing typed-evidence verifier.

The caller cannot provide compiler output or a manifest package. This prevents
an input trace from being evaluated against a caller-selected private
compilation while avoiding a second validator.

## Inputs and results

The private function accepts:

- project-document text;
- explicit capability observations used by project compilation;
- canonical trace bytes;
- optional existing project-document and trace resource limits.

On success, the result includes only deterministic identifiers and replay
state. Active artifacts are sorted by identifier. On failure, the result
preserves the underlying diagnostic and adds one of three stages:

- `project`;
- `trace-transport`;
- `policy`.

The current names and revisions are private and may change without migration.

## Alternatives

### Retain no consumer

This has the lowest maintenance cost and avoids exposing evidence concepts, but
leaves the policy compiler visible to users mainly through generated guidance
and configuration checks. It does not demonstrate a path from project intent
to validation of reported workflow progress.

### Add this bounded consumer

This reuses the existing project, transport, and replay boundaries in one pure
function. It demonstrates the missing composition without filesystem, network,
credential, process, scheduler, or provider dependencies. Its maintenance cost
is bounded by those existing contracts, provided it remains a thin composition.

### Add a live integration

A live tracker, pull-request, CI, review, or merge integration would require
authentication, acquisition completeness, revision selection, pagination,
rate-limit handling, retries, and external failure semantics. Those concerns do
not belong in this decision and would not solve local evidence ownership or
migration by themselves.

## Decision recommendation

**Retain and freeze the bounded spike as private decision support. Keep the
product-consumer gate open and reject live integration at this gate. Do not
expose the raw trace contract publicly.**

The technical composition passes because both retained workflow families produce
deterministic allow and block outcomes without new architecture. The product
gate fails because ordinary users do not yet have an
accepted way to create, own, discover, or migrate trace evidence. Publishing a
command now would turn those unresolved details into accidental API.

The current product decision must start from a concrete workflow-status
experience and decide whether evidence is ephemeral caller input, a
project-owned journal, or an external observation. It must also define a bounded
trace-creation path without requiring private compiler or manifest values. It
must not begin by stabilizing the private trace shape.

## Trust and lifecycle non-claims

- The consumer validates structure, digests, declared transitions, evidence
  consistency, and closed safety properties; it does not prove evidence truth.
- Producer principals, execution contexts, freshness, and mechanisms remain
  caller-supplied observations without authentication.
- The consumer owns no files and performs no reads, writes, discovery, locking,
  or cleanup.
- No persistence, concurrency, retention, confidentiality, signing, revocation,
  or corruption-recovery behavior is defined.
- No public migration is required for these private revisions. A future public
  representation must define migration before compatibility is promised.
- A valid prefix means only that all supplied events are valid through the
  returned node. It does not mean the workflow is complete or that a next step
  is available.
- A valid complete trace does not prove that external side effects occurred.

## Stop conditions

Stop or reopen this decision if the consumer would require any of the following:

- a duplicate parser, compiler, manifest builder, or replay algorithm;
- filesystem or network access;
- scheduling, polling, retries, delegation, repair, merge, or release behavior;
- a new provider, tracker, workflow family, evidence schema, or dependency;
- public stabilization of trace bytes, discovery, storage, or output;
- claims that caller assertions are authenticated facts.
