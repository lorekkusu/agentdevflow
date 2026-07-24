# 0006: Manual existing-project onboarding uses exact whole-file disposition

Status: Accepted

Date: 2026-07-24

## Context

Projects commonly contain useful instructions in `AGENTS.md`, `CLAUDE.md`, or
the supported project-wide Cursor target before adopting `agentdevflow`. The
existing equivalent-content analyzer accepts only content already preserved by
the proposed generated target. Different natural-language instructions remain
an ownership conflict.

Manual onboarding must work without a model. It must let the operator inspect
the exact existing bytes, represent retained guidance in canonical rules, and
authorize replacement without adding a semantic parser, proposal database,
second writer, or second approval model.

## Decision

`agentdevflow onboard` is a read-only inventory of exactly:

- `AGENTS.md`;
- `CLAUDE.md`; and
- `.cursor/rules/agentdevflow.mdc`.

Each complete file is one content unit. The command reports provider, path,
byte count, SHA-256 digest, ownership disposition, classification state, and
exact bounded content in human or JSON output. It does not scan parents,
nested instruction files, other Cursor rules, or the repository generally.

An unmanaged existing file is `unclassified`. The operator expresses retained,
combined, duplicated, or provider- and responsibility-specific guidance
through the existing canonical `rule` commands. No per-paragraph
classification record is created.

After reviewing the complete unmanaged file, the operator may supply this
repeatable input to both `diff` and `render`:

```text
--replace-existing <repository-relative-path>=<observed-sha256>
```

The input states that retained content is represented in the current canonical
rules and that any remainder absent from the proposed generated target is
intentionally omitted. `diff` then shows the complete before and after bytes.
`render` requires the same replacement inputs plus the normal exact plan
approval.

The planner accepts replacement only for a currently configured native target
whose unmanaged bytes match the supplied digest. Canonical source bytes,
observed target bytes, generated target bytes, and file actions remain bound
into the normal plan digest. Duplicate, unsupported, unused, unnecessary,
managed, or stale inputs fail closed.

When unsupported existing provider content is present, `init` may create only
an absent valid configuration and return `review-required`. It does not write
provider targets or the ownership lock. This permits the operator to proceed
through inventory, rule commands, exact replacement diff, render, and check.

## Consequences

- Manual onboarding is deterministic and does not require an external model.
- Existing files remain unchanged until the normal render step.
- Content classification remains the operator's judgment; the product does
  not claim mechanically lossless natural-language transformation.
- An explicit replacement makes intentionally omitted content reviewable in
  the complete diff without retaining a proposal or authorization store.
- The normal forward-convergent writer and lock-last publication remain the
  only provider mutation path.
- A cooperative interruption after provider replacement but before lock
  publication can resume from the same exact approved replacement plan.
- Existing exact-adopt and equivalent-content import behavior remains
  available and does not require replacement input.

## Alternatives considered

- **Persist per-section classifications.** Rejected because it creates a
  second source model that can drift from canonical rules and current target
  bytes.
- **Store a proposal or approval file.** Rejected because the existing plan
  digest and repeated planner inputs already provide reproducibility and
  staleness binding.
- **Infer replacement from Git state or clean worktree.** Rejected because Git
  is outside render authorization and does not express semantic disposition.
- **Automatically merge or summarize instructions.** Rejected because the
  product cannot prove semantic preservation and the manual path must remain
  model-free.
- **Scan every provider instruction surface.** Rejected because the initial
  renderer owns only three fixed project-wide targets.

## Security and disclosure considerations

Inventory reads only bounded regular UTF-8 files below the selected root.
Symlinks, unreadable files, invalid UTF-8, oversized files, non-regular files,
invalid locks, and ambiguous ownership fail without a partial inventory.

Foreign bytes remain undisclosed by ordinary blocked `diff`. Exact existing
content is emitted only by the explicit `onboard` inventory or by a `diff`
whose matching replacement input names the exact observed digest.

Digests bind bytes and freshness. They do not authenticate the operator or
prove semantic correctness.

## Revisit triggers

- A qualified provider renderer owns another project instruction target.
- Normal-user dogfood cannot classify complete files without a smaller bounded
  content unit.
- The one MiB CLI output boundary prevents representative onboarding.
- A reproduced supported-operation failure cannot resume through the existing
  convergent writer and lock publication path.
