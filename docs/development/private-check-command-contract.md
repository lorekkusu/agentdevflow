# Private check command contract

## Status

This contract defines the first internal read-only command service. It is a candidate for later public command behavior, not a stable CLI, API, discovery rule, exit-code contract, configuration filename, or lock filename.

## Required inputs

The caller supplies:

- a private source materialization;
- an exact private render-plan snapshot;
- the expected base private render lock, or explicit absence;
- a private lock path;
- a workspace exposing only read access.

The service does not discover, parse, compile, plan, repair, or persist these inputs. Keeping those responsibilities outside the service prevents early command work from freezing configuration and storage decisions.

The separate private application planner now prepares these inputs from local revision-1 configuration, canonical lock, and repository bytes. When the lock is absent, the planner also classifies exact adoption and proven lossless import before producing the retained plan. This command service remains independently testable and does not acquire the planner's parsing, staging, or import-analysis responsibilities.

The private local CLI composes that planner with this service from explicit repository, configuration, and lock paths. It opens the repository through the read-only filesystem boundary and returns the service's private candidate exit behavior. This composition does not establish path discovery, a public configuration filename, a public lock filename, or an npm executable contract.

## Outcomes

The private result has three mutually exclusive outcomes:

| Outcome | Candidate exit code | Meaning |
| --- | ---: | --- |
| `clean` | `0` | Managed outputs and the target lock already match the retained plan. |
| `changes-required` | `1` | Every observed managed state is recognized, but one or more planned output or lock changes remain. |
| `blocked` | `2` | At least one error prevents the retained plan from describing a safe convergence path. |

Warnings do not change an otherwise clean outcome. Errors take precedence over changes when both are present. These codes are private candidates until CLI behavior is tested end to end and explicitly accepted.

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
- a public JSON result schema;
- stable public diagnostic or exit-code compatibility;
- a CLI parser or output formatter;
- Git status policy;
- automatic repair, render, reset, clean, stash, commit, or branch behavior;
- protection against concurrent repository mutation;
- semantic truth of workflow evidence.

The private local CLI now exercises this service and the exact-byte diff service through one experimental development entry point. The same entry exposes exact approved render, but all provider mutation remains routed through the separate private render command service.
