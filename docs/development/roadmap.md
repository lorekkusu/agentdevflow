# Development roadmap

This roadmap records the current sequence and acceptance criteria. It does not
preserve private implementation chronology. The
[engineering boundary](engineering-boundary.md) applies to every step.

## Current objective

Turn the research-heavy beta into one usable end-to-end product slice:

```text
explicit project choices
  + user-owned shared and role guidance
  -> distinct Codex, Claude Code, and Cursor instructions
  -> reviewed diff
  -> exact-approved render
  -> clean check
  -> private-repository role-comprehension and workflow dogfood
  -> final qualification and independent review
```

The implementation currently targets:

- `local-reviewed-change`;
- `issue-to-reviewed-pull-request`;
- Linear or GitHub Issues for the issue workflow;
- draft or ready pull requests;
- auxiliary review disabled;
- squash merge;
- Fast and Balanced;
- Codex, Claude Code, and Cursor;
- `.agentdevflow/rules/{shared,steward,developer,reviewer}.md`;
- `init`, `diff`, `render`, and `check`.

The issue workflow compiles advisory procedures. It has no live external
adapter.

## Step 1: finish the active CLI slice

Status: **Implemented and passed the current local final-tree verification.**

### Required outcome

An installed candidate must:

1. initialize either built-in workflow from documented flags;
2. read the four optional canonical rule files;
3. generate materially responsibility-specific provider outputs;
4. show every provider and lock change before mutation;
5. reject stale approval and direct generated-file drift;
6. converge through approved render to clean check and clean repeated diff.

### Required failures

- incompatible tracker and workflow;
- missing issue-workflow host, CI, or initial state;
- two ids for one provider product;
- unreadable or oversized guidance;
- unsupported existing provider content;
- changed source or target after approval.

### Non-goals

- rule CRUD;
- automatic provider-file replacement;
- a second writer, transaction, approval store, or Git manager;
- provider process execution;
- tracker, pull-request, CI, review, or merge network clients;
- a public arbitrary workflow language.

## Step 2: qualify the installed package

Status: **Passed locally and for the exact committed implementation in the
six-cell hosted matrix. Every subsequent pull-request commit remains gated by
the same qualification.**

Run:

```bash
npm run check
npm run check:v1-qualification
npm run check:package-entrypoint
npm pack --dry-run --json
```

Package-entrypoint qualification must exercise both workflows and the canonical
guidance path through the installed bin. Tests and source-only imports are not
sufficient.

The package review must confirm that the guidance runtime is included and
tests, fixtures, experiments, and external-provider clients are excluded.

The current local snapshot passed all 205 discovered tests, installed-package
entrypoint qualification, package-content review, and the dependency advisory
check.

## Step 3: dogfood in a private repository

Status: **Passed for the representative ready-pull-request flow.**

Create or reuse a synthetic private repository with no production secrets or
private customer data.

### Observed rendering and comprehension

- the pre-closure candidate tarball completed
  `init -> diff -> render -> check`;
- shared and role guidance produced materially different Codex, Claude Code,
  and Cursor outputs;
- fresh headless contexts identified their responsibility, handoff, stop
  conditions, and prohibited actions.

### Observed tracker-backed flow

- the representative configuration used Codex Steward and fresh Reviewer,
  Cursor Developer, Linear, a ready pull request, GitHub Actions, auxiliary
  review disabled, and squash merge;
- the bounded sequence completed issue creation, implementation, a controlled
  CI failure, exact-failure repair, fresh review, one review-requested repair,
  second fresh approval, squash merge, issue closure, and branch cleanup;
- a separate tracker-native Cursor delegation used the existing repository
  label-group convention, produced a scoped ready pull request with green CI,
  and still required Steward-owned review, merge, cleanup, and issue closure;
- only sanitized outcomes and reproducible boundaries are retained in the
  [maintainer observation](maintainer-dogfood.md).

The draft-state idempotent ensure-ready branch remains deterministic workflow
and automated test coverage. It marks the pull request ready only when it is
still a draft, so review-repair cycles may safely traverse it again. Repeating
the complete remote lifecycle solely to change the initial pull-request state
is not required unless qualification or user evidence exposes a distinct
failure.

`agentdevflow` did not invoke Linear, GitHub, or any provider. Existing
authorized tools performed those actions under advisory compiled procedures.

## Step 4: product-value decision

Status: **Current evidence supports Continue. Local final qualification and
focused independent closure review passed. The exact committed implementation
also passed the six-cell hosted matrix; final PR delivery remains.**

Continue only if dogfood proves all of the following:

- the generated files are materially different by role;
- users can maintain policy in canonical source rather than three provider
  files;
- local and tracker-backed procedures are understandable without reading
  internal design documents;
- the compiler catches or explains at least one meaningful handoff or stale
  evidence problem that a shared template would not;
- ordinary rule edits do not require infrastructure beyond source, generated
  outputs, the existing diff/render/check path, and the ownership lock.

If the intermediary compiler adds no independent user value, recommend Pivot
or No-Go. Do not add more infrastructure to defend the existing design.

The bounded dogfood result supports the current recommendation because role
outputs were materially different, canonical guidance remained user-owned, and
the procedure required exact CI repair and fresh review after revision. The
current compiler also projects Fast and Balanced policy differences into the
agent-facing procedures. This is evidence for one usable slice, not permission
to expand the product surface.

## Step 5: decide the next release

Only after Steps 1 through 4 pass:

- select the next beta version;
- write migration and release notes for removal of the retired command and
  expansion from local-only to two workflows;
- rerun supported-platform and dependency checks;
- authorize publication separately through the protected workflow;
- verify the public installed artifact.

No roadmap item authorizes staging, committing, pushing, publishing, package
settings, credentials, tags, or releases.

## Deferred work

Reopen only with concrete user evidence:

- interactive wizard;
- Strict or Custom;
- rule-management commands;
- a fourth provider;
- live external adapters;
- workflow-status evidence transport;
- stronger durability than forward convergence;
- scheduler, runtime, GUI, marketplace, or SaaS.
