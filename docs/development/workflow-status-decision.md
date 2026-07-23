# Workflow status decision

## Decision

Defer a public workflow-status command, trace format, evidence transport, and
live provider adapter.

The repository previously proved that compiled policies, typed evidence,
canonical trace bytes, replay, and one caller-attested GitHub Check Runs mapping
could be composed. That executable research had no normal-user trace producer,
authenticated evidence owner, or caller-facing workflow-status record. It was
removed under the [engineering boundary](engineering-boundary.md); Git history
retains the detailed experiment.

The finite-state policy compiler remains part of the product core. This
decision removes an unused consumer and transport, not policy compilation.

## Why deferral is correct

A useful status result must answer all of these questions:

- Who requests the status and what decision will it support?
- Which operation or change is the subject?
- Who creates each observation?
- Which bytes and external revision does the observation bind?
- Which system authenticates the producer?
- Which evidence is advisory and which is mechanically enforced?
- How does stale or incomplete evidence appear to the user?

Digest consistency alone cannot answer them. A digest detects byte changes; it
does not authenticate a producer or prove that CI, review, or merge state is
true.

## Reopen criteria

Reopen this area only when one concrete normal-user workflow provides:

1. a named caller and user decision;
2. a bounded caller-facing status record;
3. an explicit trace or observation producer;
4. ownership and freshness rules for every observation;
5. a narrow acquisition permission model;
6. evidence that policy compilation adds value beyond generated instructions;
7. a comparison against direct provider integration and no status feature.

## Reopen constraints

Any future implementation must remain outside the generic compiler and start
with one provider and one evidence type. It must not introduce, by implication:

- an orchestration runtime;
- credentials in compiler code;
- polling or retry infrastructure;
- automatic merge or release;
- opaque caller-supplied compiler results;
- a broad provider matrix;
- signing, identity, or distributed coordination without a reproduced need.

Until the reopen criteria are met, workflow status is a documented deferred
outcome rather than a frozen executable subsystem.
