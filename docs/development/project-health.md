# Project health

Assessment date: 2026-07-24.

This is the current sanitized health assessment. The root `ROADMAP.md` alone
controls sequence, status, open decisions, and acceptance criteria.

## Basis

The review began from clean merged `main` at
`dc9ee9b19f7b860809d40458b9c25acadd582a7e`. It covered every accepted ADR,
completed roadmap outcome, executable command, production module, public
journey, test boundary, package entry, and retained dependency.

Three independent read-only perspectives examined product and roadmap
alignment, implementation cost, and zero-context installed-package delivery.
The zero-context perspective invoked the packed bin directly and completed both
an empty project and a project with an unmanaged `AGENTS.md` before reading
implementation or test sources. The coordinating review verified material
claims against the repository and retained only sanitized conclusions.

This was a product and maintainability review, not a security audit,
normal-user adoption study, or external-agent qualification.

## Current product outcome

The current unreleased candidate supports one fixed non-interactive journey:

```text
init -> onboard -> rule as needed -> diff -> render -> check
```

A user can configure either bounded built-in workflow, assign provider-neutral
Steward, Developer, and Reviewer responsibilities, inventory the three native
provider targets, represent retained guidance as canonical per-rule Markdown,
review a complete deterministic plan, render through one owned convergent
writer, and verify a clean managed state.

The smallest valid setup uses one provider id for all three responsibilities.
Codex, Claude Code, and Cursor remain optional renderer targets rather than
required workflow roles. Tracker, pull-request, CI, review, and merge behavior
is advisory compiled procedure text; the CLI does not operate those systems.

## Roadmap alignment

- Items 1 and 2 are complete and match executable behavior.
- The repository-wide health gate is complete.
- Item 3 retains its accepted user outcome and architecture boundary but is
  `Decision required`: its exact invocation, first public support tier, and
  version qualification policy remain open.
- The wizard follows item 3 and must wrap the same fixed journey.
- Strict remains committed but requires its exact finite safety properties.
- Exact-candidate dogfood and the next beta remain later gates.

No executable work was found for a later milestone that bypasses this order.
The published `0.1.0-beta.2` remains a historical product and is not evidence
for the current candidate.

## Measured observations

- Production: 40 TypeScript modules and 12,017 physical lines.
- Tests and fixtures: 33 files after removal of one no-value tooling test.
- Scripts: 6 files and 1,951 physical lines.
- Runtime dependencies: exact `jsonc-parser` 3.3.1 and Zod 4.4.3 behind their
  required private boundaries.
- Every production module has a current production caller. No duplicate
  provider writer, journal, transaction store, approval store, Git manager,
  credential client, provider SDK, or agent runtime was found.
- The CLI runner, argument parser, and formatter total 3,101 lines across
  `src/cli/private-local-cli.ts`,
  `src/interface/private-cli-arguments.ts`, and
  `src/cli/private-local-cli-output.ts`.
- The installed-package verifier is a real release boundary but is 1,021 lines
  and invokes the installed bin approximately 40 times.
- The health-gate candidate passed 245 automated tests with no failure, skip,
  or todo; V1 recovery retained 33 passing tests.
- The packed CLI contains 45 entries, is 75,598 compressed bytes and 371,069
  unpacked bytes, and excludes tests, fixtures, declarations, source maps,
  experiments, provider clients, and research evidence.
- Pull request 15 qualified the exact Git tree later merged as
  `dc9ee9b19f7b860809d40458b9c25acadd582a7e` on Ubuntu, macOS, and Windows
  with Node.js 22 and 24.

Exact local package measurements and hosted tree bindings are recorded in
`docs/evidence/private-package-qualification.md` and
`docs/evidence/v1-platform-qualification.md`.

## Findings

### Core architecture remains coherent

Severity: none. Confidence: high.

The finite policy compiler, two built-in workflows, responsibility-filtered
composition, canonical rule model, native renderer, complete planning,
ownership lock, and forward-convergent writer all have current callers and fit
the engineering boundary. The review found no production subsystem that should
be removed.

Disposition: **Keep**.

### Accepted decision and evidence records had drifted

Severity: moderate. Confidence: high.

ADR 0001 still described one pre-composition source and cited fixtures that no
longer existed. It also called the implemented lock and workspace safety
responsibilities future work. ADR 0006 lacked required evidence and supersedes
sections. Package evidence still described 231 tests and 122 entries from an
earlier candidate, while platform evidence did not identify the exact tree
merged by pull request 15.

The health-gate change aligned those records with current implementation
without changing their accepted outcomes.

Disposition: **Invest**, repaired in the health-gate change.

### The CLI-only package carried unsupported compiler artifacts

Severity: moderate. Confidence: high.

TypeScript declarations and source maps represented 46.96 percent of the
previous unpacked tarball, although the package exposes no `main`, `types`,
`exports`, or other programmatic entrypoint. They had no accepted normal-user
caller. The health-gate change disabled both outputs, reduced the package from
125 to 45 entries and from 699,146 to 371,069 unpacked bytes, and added a
repository audit that prevents their accidental return while the package
remains CLI-only.

Disposition: **Removal candidate**, removed.

### Public guidance did not foreground the smallest journey

Severity: low. Confidence: high.

The fixed order was stated correctly, but the README placed rule guidance
before the onboarding section and all opening examples used several providers.
The packed README also linked to repository-only authority files without
package-safe destinations. The health-gate change orders the guidance by the
journey, adds a one-provider example, distinguishes source-clone and installed
tarball evaluation, and uses durable repository links for contributor-only
material.

Disposition: **Invest**, repaired in the health-gate change.

### CLI surface concentration is the next maintenance risk

Severity: moderate. Confidence: high.

Eleven current operations concentrate parsing, dispatch, and output behavior in
three files totaling 3,101 lines. This is not dead or duplicated production
code, but adding launcher and wizard branches directly to those files would
increase review and regression cost.

Disposition: **Invest**. Item 3 should introduce only bounded internal command
specification and handler seams required by its approved first adapter. This
does not justify a CLI framework, plugin system, or broad adapter abstraction.

### Two public output details need a separate decision

Severity: low. Confidence: high.

Planning output exposes `renderer-plan-digest` even though only
`exact-plan-digest` is a render approval input. Existing-file `init` can also
report several related diagnostics for one ownership conflict. Both are
deterministic and fail safe, and current next-action text remains correct, but
they add avoidable cognitive load.

Disposition: **Removal candidate** for the public renderer digest and
**Invest** for diagnostic hierarchy. They remain unchanged because altering
public human or JSON output requires an explicit bounded decision. Neither
blocks the item 3 decision proposal.

## Disposition summary

- **Keep:** current product boundary, fixed journey, two workflows, rule
  sources, three native targets, policy compiler, planner, one renderer writer,
  lock-last publication, exact dependencies, and deterministic qualification.
- **Invest:** bounded CLI internal seams, installed-package scenario helpers,
  package-facing clarity, and one qualified external-agent adapter after public
  decisions are accepted.
- **Freeze:** historical beta evidence, ADR 0004, unsupported Strict
  recognition, provider target set, and current mutation model.
- **Defer:** additional launchers, wizard, executable Strict behavior,
  exact-candidate dogfood expansion, and release work according to roadmap
  order.
- **Removal candidate:** public `renderer-plan-digest` and redundant conflict
  presentation, pending explicit public-output decisions.

## Next milestone

The next work is a bounded item 3 decision proposal, not implementation. It
must start from the fixed `init -> onboard` prerequisite and select one
Codex-first vertical slice rather than a generic launcher framework.

Before implementation, explicit approval is required for the public invocation
and mode selection, Codex support tier, installed-version policy, fixed process
contract, output limits, timeout behavior, diagnostics, exact current
`agentdevflow` entrypoint transfer, and independent final `check`.

## Stop conditions

- Do not implement or finalize item 3 public syntax before those decisions are
  approved.
- Do not add launcher or wizard branches directly to the current CLI
  concentration without bounded internal seams.
- Do not start the wizard, Strict, dogfood expansion, or release work ahead of
  the roadmap.
- Do not add a CLI framework, general command runner, broad provider adapter
  matrix, provider SDK, credential subsystem, background process, retries,
  agent chain, second writer, approval store, transaction, Git manager, or
  onboarding state model.
- Do not describe a launcher as supported before installed-version
  qualification and authenticated end-to-end dogfood.

## Decision requests

The next proposal must obtain the item 3 decisions already listed in the
roadmap. Separately, a later public-output cleanup should decide whether to
remove `renderer-plan-digest` from human and JSON output and how to collapse
related ownership-conflict diagnostics without hiding actionable causes.

## Limitations

The review did not test hostile local writers, power-loss durability, provider
authentication, external-agent execution, live trackers, normal-user
adoption, or published-registry installation of the current candidate. The
local environment observation does not replace the supported hosted matrix.
Historical evidence remains historical, and provider behavior remains
point-in-time advisory evidence rather than enforcement.
