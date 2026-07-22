# Private compiled-policy consumer evidence

Snapshot date: 2026-07-22.

## Verdict

**Technical pass for a private, pure composition spike. Fail for the current
independently useful product-consumer gate.** Exact project-document bytes plus
explicit caller-supplied capability observations now reach the authoritative
workflow compilation, strict trace decoder, and existing typed-evidence replay
through one application function. The function accepts no caller-supplied
compiler output or manifest.

The candidate validates both retained workflow families and fails closed on
non-canonical, incompatible, incomplete, stale, and invalid inputs. It adds no
policy algorithm, dependency, filesystem access, network access, external
mutation, scheduler, CLI command, or package export.

The result is not independently usable by a normal user and is not sufficient
to accept a public command or evidence format. Creating the trace still requires
private manifest, envelope, payload-package, and serializer contracts. Evidence
creation, ownership, discovery, persistence, migration, and trusted acquisition
remain unresolved product decisions.

## Reproduction

Implementation and focused tests:

- `src/application/private-compiled-policy-consumer.ts`;
- `test/application/private-compiled-policy-consumer.test.ts`.

Run from the repository root:

```bash
npm run build
node --test dist/test/application/private-compiled-policy-consumer.test.js
npm run check
```

## Captured observations

The focused suite passed eight tests with zero failures, skips, or todos.

An `npm pack --dry-run --json` inspection with an isolated writable cache
confirmed that the private consumer is absent from the 119-entry runtime
tarball. The repository audit now requires its explicit package exclusion.

The complete repository check passed the 231-file publication audit, strict
type checking, the build, and 409 automated tests with zero failures, skips, or
todos.

| Specimen | Result |
| --- | --- |
| Local review, rework, fresh verification, and acceptance | `trace-valid`; final node `accepted` |
| Linear issue, ready pull request, CI, independent review, authorization, and merge | `trace-valid`; final node `merged` |
| Identical local project and trace bytes evaluated twice | Deeply equal results |
| Canonical trace with trailing newline | Blocked at `trace-transport` with `TRANSPORT_NON_CANONICAL` |
| Issue-workflow trace evaluated against a local-workflow project | Blocked at `policy` with `TRACE_MANIFEST_MISMATCH` |
| Plan transition without produced `Plan` evidence | Blocked at `policy` with `EVIDENCE_MISSING` |
| Pre-rework review evidence reused for the new subject | Blocked at `policy` with `EVIDENCE_SUBJECT_MISMATCH` |
| Schema-invalid project document with empty trace bytes | Blocked at `project` with `SCHEMA_INVALID` before trace decoding |
| Unknown capability strength and empty mechanism | Blocked at `project`; the compiler reports `CAPABILITY_OBSERVATION_INVALID` |

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Existing-boundary composability | Pass | Exact project, explicit capability observations, and trace input produce deterministic workflow-history validation. |
| Independently useful product outcome | Fail | No normal-user path creates a valid trace without private manifest and evidence constructors. |
| Reuses authoritative compilation | Pass | The manifest is derived internally from project-document compilation. |
| Reuses strict transport and replay | Pass | The application function delegates decoding and policy evaluation to existing boundaries. |
| Both retained workflow families | Pass | Local no-pull-request and issue-to-reviewed-pull-request traces reach their terminal nodes. |
| Missing, stale, or incompatible artifacts fail closed | Pass | Focused tests preserve the existing deterministic diagnostics. |
| Runtime orchestration | Excluded | No transition selection, process, provider, credential, network, waiting, retry, or mutation exists. |
| Public evidence experience | Fail by design | Creation, ownership, persistence, discovery, migration, and trusted acquisition are not accepted. |
| New architecture or dependency | Pass | One pure composition module and one focused test module use existing contracts only. |

## Recommendation

Retain and freeze this module as a narrow private decision-support spike. Keep the existing
execution transport frozen except for defects required by this retained
composition. Keep the current product gate open until a decision defines a
bounded user-facing workflow-status outcome, evidence ownership, and trace
creation without exposing private compiler or manifest values.
