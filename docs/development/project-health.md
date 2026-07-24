# Project health

Assessment date: 2026-07-24.

This is the current sanitized health assessment. The root `ROADMAP.md` alone
controls sequence, status, open decisions, and acceptance criteria.

## Basis

The review used base commit
`58f7a3d385c51d914d973ca085bc8fc527818409` and the complete dirty
`codex/external-agent-onboarding` working tree. It covered every accepted ADR,
completed roadmap outcome, executable command, production module, public
journey, test boundary, package entry, retained dependency, and the complete
item 3 candidate.

Three isolated read-only perspectives examined product and roadmap alignment,
implementation cost, and zero-context installed-package delivery. The
zero-context perspective installed the exact candidate tarball offline,
invoked its bin directly, and completed the documented manual first-use
journey before reading implementation. The coordinating review verified
material claims against the repository and retained only sanitized
conclusions.

After that review, the initial item 3 implementation passed an isolated
complete-change review, merged through
[PR #17](https://github.com/lorekkusu/agentdevflow/pull/17), and passed the
hosted Node.js 22/24 matrix on Ubuntu, macOS, and Windows. A subsequent
installed-artifact interactive Codex dogfood completed proposal,
natural-language correction, confirmation, exact replacement, render, and the
parent-run final check. The resulting prompt and documentation follow-up passed
an isolated complete-change review and the hosted matrix through
[PR #18](https://github.com/lorekkusu/agentdevflow/pull/18). The original
review measurements remain identified as measurements of its pre-merge review
target.

This was a product and maintainability review, not a security audit,
normal-user adoption study, or hostile-process assessment.

## Current product outcome

The unreleased candidate keeps one fixed first-use journey:

```text
init -> onboard -> rule as needed -> diff -> render -> check
```

A user can configure either bounded workflow, assign provider-neutral Steward,
Developer, and Reviewer responsibilities, inventory the three native targets,
represent retained guidance as canonical per-rule Markdown, review a complete
deterministic plan, render through one owned convergent writer, and verify a
clean managed state.

For onboarding, Manual remains a local read-only exact inventory. The qualified
item 3 outcome also offers one bounded Codex operator: bare `onboard` presents
the current Manual/Codex choices in a terminal, `--agent codex` keeps analysis,
natural-language correction, confirmation, and accepted execution in one
interactive Codex session, and `--agent codex --yes` authorizes one
non-interactive operation. The parent process independently runs the existing
final `check`.

Tracker, pull-request, CI, review, and merge behavior remains advisory compiled
procedure text. The CLI does not operate those systems or execute configured
workflow roles.

## Roadmap alignment

- Items 1 through 3 are complete and match executable behavior.
- Item 3 passed local deterministic verification, installed-package exercise,
  authenticated non-interactive and interactive Codex dogfood,
  complete-change review, the triggered health review, and hosted
  qualification.
- Item 4 is the next product milestone. The bounded Manual/Codex onboarding
  picker is part of completed item 3 and is not the broader initialization
  wizard.
- Strict remains committed but requires its exact finite safety properties.
- Exact-candidate dogfood expansion and the next beta remain later gates.

No executable work was found for a later milestone that bypasses this order.
The published `0.1.0-beta.2` remains historical and is not evidence for the
current candidate.

## Measured observations

Measurements describe the repaired review target before the independent
complete-change review:

- Change: 18 modified tracked files plus 5 relevant untracked files,
  `1,645` additions and `388` deletions, counting `git diff --numstat` plus
  physical lines in untracked files.
- Production: 43 TypeScript modules and 12,441 physical lines.
- Tests and fixtures: 35 files and 10,538 physical lines.
- Scripts: 6 files and 2,110 physical lines.
- Runtime dependencies: exact `jsonc-parser` 3.3.1 and Zod 4.4.3 behind their
  required private boundaries; item 3 adds no dependency.
- The CLI runner, parser, and formatter total 3,232 lines. The new operator,
  prompt, and process lifecycle remain separate direct-caller modules rather
  than a generic adapter framework.
- The installed-package verifier is 1,180 lines after adding one real
  installed Codex-operation fixture.
- `npm run check` passed 258 tests with no failure, skip, or todo.
  `npm run test:v1-recovery` retained 33 passing recovery tests.
- `npm run check:v1-qualification`,
  `npm run check:package-entrypoint`, and
  `npm pack --dry-run --json` passed.
- The packed CLI contains 48 entries, is 80,544 compressed bytes and 389,103
  unpacked bytes, and includes the reviewed Codex prompt and process modules
  while excluding tests, fixtures, provider output, transcripts, credentials,
  declarations, source maps, and provider SDKs.

## Findings

### Core architecture and earlier decisions remain coherent

Severity: none. Confidence: high.

The finite policy compiler, two built-in workflows, responsibility-filtered
composition, canonical rule model, native renderer, complete planning,
ownership lock, and forward-convergent writer all retain current production
callers and fit the engineering boundary. The complete review found no
retained executable subsystem outside the product direction.

Disposition: **Keep**.

### The Codex adapter is bounded to the accepted item 3 caller

Severity: none. Confidence: high.

The implementation adds one Manual/Codex selection, one product-owned prompt,
and one process adapter fixed to `codex`, foreground I/O, fixed argv/stdin,
working directory, timeout, signal forwarding, and bounded process results.
It passes the exact current Node executable and agentdevflow entrypoint, uses
the existing rule, diff, render, and check path, and leaves provider outputs
and the lock with the existing writer.

No general runner, adapter registry, version catalog, provider SDK,
credential or authentication detector, permission classifier, provider-output
schema, retry engine, background worker, proposal store, Git manager,
transaction, rollback system, or second writer was added.

Disposition: **Keep**.

### Authority and recovery documentation had drifted

Severity: moderate. Confidence: high.

Independent review found older current-slice and non-contract text that still
described item 3 as undecided or absent, while new public guidance called the
candidate supported before its remaining gates. It also found that a provider
failure after completed rule commands preserves those canonical mutations
without an explicit recovery explanation.

The coordinating change aligns product direction and the beta contract with
the accepted item 3 authority, labels Codex operation as a candidate until
qualification completes, moves content and cost disclosure before the first
bare onboarding choice, and documents recovery through `rule list`, manual
inventory, `diff`, and `check`. It does not add rollback or a second
progress model.

Disposition: **Invest**, repaired in this change.

### Installed qualification initially missed the defining existing-file path

Severity: moderate. Confidence: high.

The first packed Codex fixture launched the exact installed entrypoint and
proved the independent final check, but started with no unmanaged instruction
file. It therefore did not prove the installed path from exact inventory
through canonical rule creation and digest-bound replacement.

The fixture now begins with unmanaged `AGENTS.md`, requires `init` to return
`review-required`, creates one canonical rule through the installed bin,
reuses the observed digest in `diff` and `render`, and requires the parent
final check to be clean. Cancellation and forced timeout escalation also have
deterministic process tests.

Disposition: **Invest**, repaired in this change.

### CLI and package-verifier concentration remains the maintenance risk

Severity: moderate. Confidence: high.

The current operations remain concentrated in the CLI runner, parser, and
formatter, while the installed verifier is a large release boundary. The item
3 code uses bounded direct-caller seams, but adding the item 4 wizard or more
launchers by continuing to grow the same branches and scenario body would
raise review cost.

Disposition: **Invest**. Item 4 must first derive its own bounded interface
from the accepted full initialization journey. This does not justify a CLI
framework, plugin system, provider matrix, or speculative test framework.

### Two public output details still require a separate decision

Severity: low. Confidence: high.

Planning output exposes `renderer-plan-digest` even though only
`exact-plan-digest` is a render approval input. Existing-file `init` can also
report several related diagnostics for one ownership conflict. Both behaviors
are deterministic and fail safe, but add cognitive load.

Disposition: **Removal candidate** for the public renderer digest and
**Invest** for diagnostic hierarchy. They remain unchanged because altering
public human or JSON output requires a separate accepted decision.

## Disposition summary

- **Keep:** product boundary, fixed journey, two workflows, rule sources,
  three native targets, policy compiler, planner, one renderer writer,
  lock-last publication, manual onboarding, and the bounded Codex item 3
  adapter.
- **Invest:** keep CLI and package scenarios reviewable, and derive the item 4
  interface from its full user journey.
- **Freeze:** historical beta evidence, ADR 0004, unavailable Strict
  recognition, provider target set, and current mutation model.
- **Defer:** additional launchers, executable Strict behavior, item 6 dogfood
  expansion, and release work. Item 4 is next but remains behind its own
  public-interface decision gate.
- **Removal candidate:** public `renderer-plan-digest` and redundant ownership
  conflict presentation, pending explicit public-output decisions.

## Next milestone

Item 4 is next. Its proposal must begin from the full initialization and
onboarding journey rather than treating the current onboarding-method picker
as a general wizard design. The exact public invocation, question sequence,
confirmation boundary, cancellation behavior, and equivalence with
non-interactive configuration remain decision-gated before implementation.

## Stop conditions

- Do not implement the item 4 public interface before its bounded journey and
  unresolved contract choices receive explicit approval.
- Do not start Strict, item 6 dogfood expansion, or release work ahead of the
  roadmap.
- Do not add another launcher, general command runner, broad provider adapter
  framework, provider SDK, credential subsystem, background process, retries,
  agent chain, second writer, approval store, transaction, rollback system,
  Git manager, or onboarding state model.
- Do not claim Codex compatibility beyond the installed macOS dogfood and
  deterministic hosted process and package evidence actually obtained.

## Decision requests

No item 3 public-contract decision remains open. A later public-output cleanup
should decide whether to remove `renderer-plan-digest` from human and JSON
output and how to collapse related ownership-conflict diagnostics without
hiding actionable causes.

Item 4 requires its own bounded public-interface proposal and approval before
implementation.

## Limitations

The review did not test hostile local writers, power-loss durability, live
trackers, normal-user adoption, or the published registry package.
Authenticated dogfood covered both the non-interactive `--yes` path and the
interactive proposal, correction, confirmation, and execution path with Codex
CLI 0.145.0 on macOS and discarded raw provider material. It does not qualify
every Codex version, installation method, permission configuration, hook, or
MCP server. Hosted tests qualify deterministic process and package behavior
across the supported Node.js and operating-system matrix; they do not run real
authenticated Codex sessions on every platform. PR #18 supplies the protected
final-tree CI gate for the milestone state before merge.
