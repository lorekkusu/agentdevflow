# Private check command contract

## Status

This contract defines the internal read-only service behind the current beta
`check` command. Its TypeScript API and intermediate inputs remain private;
public paths, exit classes, and output behavior belong in the
[beta CLI contract](beta-cli-contract.md).

## Required inputs

The caller supplies:

- a private source materialization;
- an exact private render-plan snapshot;
- the expected base private render lock, or explicit absence;
- a private lock path;
- a workspace exposing only read access.

The service does not discover, parse, compile, plan, repair, or persist these inputs. Keeping those responsibilities outside the service prevents early command work from freezing configuration and storage decisions.

The application planner prepares these inputs from revision-1 configuration,
canonical guidance, lock, and repository bytes for either built-in workflow.
When the lock is absent, the planner also classifies exact adoption and proven
equivalent-content import and validates any explicit existing-target
replacement before producing the retained plan. This command service remains
independently testable and does not acquire the planner's parsing, staging,
import-analysis, or replacement-authorization responsibilities.

The CLI composes that planner with this service from explicit repository,
configuration, and lock paths. It opens the repository through the read-only
filesystem boundary. The beta CLI contract, not this service interface,
defines its public path and exit behavior.

## Outcomes

The private result has three mutually exclusive outcomes:

| Outcome | Beta exit code | Meaning |
| --- | ---: | --- |
| `clean` | `0` | Managed outputs and the target lock already match the retained plan. |
| `changes-required` | `1` | Every observed managed state is recognized, but one or more planned output or lock changes remain. |
| `blocked` | `2` | At least one error prevents the retained plan from describing a safe convergence path. |

Warnings do not change an otherwise clean outcome. Errors take precedence over
changes when both are present. The beta CLI contract defines these public exit
classes; this service result remains private.

## Diagnostic model

Each diagnostic records:

- its `check` or `renderer` source;
- a stable code;
- `change`, `warning`, or `error` level;
- an English message;
- optional path, provider, and capability context.

Diagnostics are sorted deterministically by code and contextual fields. Renderer diagnostics retain their original code and context so unsupported capabilities and ownership conflicts remain visible.

The service distinguishes recognized changes from foreign drift:

- a path at its plan-bound before digest is `changes-required`;
- a path at its target digest is clean;
- a path at neither digest is blocked drift;
- a conflict action is blocked;
- exact base lock bytes may require target publication;
- exact target lock bytes are accepted only when every managed output is at target;
- any other lock bytes are blocked drift.

Malformed snapshots, materializations, and base locks return structured blocked results rather than authorizing mutation.

## Read-only boundary

The service depends on an interface containing only `read(path)`. It cannot request write, remove, temporary-file, Git, or process operations through that interface. End-to-end tests compare repository bytes before and after repeated checks.

This is a code boundary and automated regression property, not a claim that arbitrary caller code or another process cannot mutate the repository concurrently.

## Explicit non-claims

The private service does not define:

- configuration or lock discovery;
- parsing or schema diagnostics;
- compilation or render planning;
- the public JSON result schema or compatibility policy, which belongs to the
  beta CLI contract;
- stable diagnostic wording or codes;
- a CLI parser or output formatter;
- Git status policy;
- automatic repair, render, reset, clean, stash, commit, or branch behavior;
- protection against concurrent repository mutation;
- semantic truth of workflow evidence.

The current beta CLI composes this service with the exact-byte diff service and
the application planner. All provider mutation remains routed through the
separate private render command service.
