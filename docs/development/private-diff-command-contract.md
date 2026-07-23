# Private diff command contract

## Status

This contract defines the internal read-only exact-byte service behind the
current beta `diff` command. Its TypeScript API and intermediate values remain
private; public paths, output, and exit classes belong in the
[beta CLI contract](beta-cli-contract.md).

## Required inputs

The service accepts the same caller-supplied private materialization, exact plan snapshot, expected base lock, lock path, and read-only workspace as the private check service.

It does not discover, parse, compile, plan, render, or persist state. It calls the private check service first and produces no change entries when check is blocked.

The application planner supplies an exact plan and responsibility-specific
materialization for either built-in workflow. With no lock, that plan can
include exact adoption or analyzer-proven lossless import. Diff remains a
read-only consumer and does not duplicate configuration, guidance reading,
lock parsing, staging, or import analysis.

The private local CLI composes that planner with this service from explicit repository, configuration, and lock paths. It does not accept a caller-supplied compiler result, materialization, plan, snapshot, or lock object.

## Change entries

Each deterministic change entry contains:

- `managed-output` or `render-lock` kind;
- caller-supplied relative path;
- `create`, `update`, or `delete` action;
- exact before and after content, with `null` for absence;
- SHA-256 before and after digests, with `null` for absence.

Entries are sorted by path and kind. Managed outputs already at target are omitted. A base lock different from the derived target is included as a lock change. A clean result contains no entries.

The result reuses the private check outcomes and candidate exit codes:

| Outcome | Beta exit code | Diff behavior |
| --- | ---: | --- |
| `clean` | `0` | No exact changes remain. |
| `changes-required` | `1` | One or more exact, recognized changes are returned. |
| `blocked` | `2` | No change entries are returned. Diagnostics explain why. |

The beta CLI contract defines these public exit classes. This internal result
shape remains private.

## Observation protocol

The service performs the following sequence:

1. execute the private read-only check;
2. stop with no entries when check is blocked;
3. revalidate the caller-supplied private inputs;
4. reread every planned managed path;
5. omit a path already at target;
6. emit a change only when the reread bytes match the plan-bound before digest;
7. derive exact target lock bytes;
8. reread the caller-supplied lock path;
9. emit a lock change only from exact base bytes;
10. reject target lock bytes while output changes remain;
11. sort and return the complete result.

If any reread path is neither at its retained before nor target state, the service discards every accumulated entry and returns blocked. This prevents a partial or stale diff from appearing actionable.

The service still does not provide a multi-file atomic snapshot. Another process may change files immediately after the final read. Apply must independently revalidate the exact plan and state.

## Read and disclosure boundary

The workspace interface contains only `read(path)`. The service reads only plan-declared managed paths and the caller-supplied lock path. It does not scan the repository, inspect Git status, or return foreign content when a digest does not match the retained plan.

Exact before and after content is retained only for recognized managed state.
The current beta formatter emits the complete snapshot digest as
`exact-plan-digest`, the lower-level renderer digest separately, and complete
recognized before and after text as numbered human-readable lines. It marks
absence and final-newline state explicitly. JSON output retains exact string
values. A blocked result emits no change entries, and end-to-end fixtures
verify that foreign bytes are absent from output. The render entry requires
`--approve-plan` to equal that exact snapshot digest. Human and JSON output use
the bounded behavior defined by the beta CLI contract; changing disclosure or
truncation behavior requires an explicit compatibility decision.

## Explicit non-claims

The private service does not define:

- a unified-diff or line-diff representation;
- binary-file behavior;
- terminal coloring, paging, redaction, or truncation;
- the public JSON schema or compatibility policy, which belongs to the beta
  CLI contract;
- configuration, snapshot, or lock discovery;
- filesystem-wide or Git-wide change reporting;
- an atomic repository snapshot;
- mutation, repair, adoption, import, or render authorization;
- semantic truth of generated instructions or workflow evidence.

Mutating behavior remains exclusively routed through the private render command service.
