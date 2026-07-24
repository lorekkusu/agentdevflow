# Maintainer dogfood observation

Snapshot period: 2026-07-23 to 2026-07-24.

## Verdict

**Pass for an earlier pre-closure working-tree candidate as one bounded
maintainer observation.** An exact local tarball from that snapshot configured
a synthetic private repository, produced byte-different
responsibility-filtered targets, and converged through:

```text
init -> changing diff -> exact approved render -> clean check
```

Fresh headless Codex, Claude Code, and Cursor Agent invocations returned
responses consistent with the responsibility sections supplied to them and
named the expected handoffs. This was a point-in-time behavioral observation,
not proof of understanding, identity, authority, clean context, or role
isolation. Maintainers then followed the representative tracker-backed
procedure through a real issue, ready pull request, CI repair, fresh review,
squash merge, issue closure, and branch cleanup.

This is maintainer evidence, not public compatibility qualification. Later
closure changes altered configuration bytes, policy projection, and mutation
checks, so this observation is not evidence for the final tarball digest. The
current candidate is not the published beta.

## Environment

| Component | Observed version |
| --- | --- |
| Candidate package | Exact locally packed pre-closure working-tree tarball |
| Node.js | `24.18.0` |
| Codex CLI | `0.145.0` |
| Claude Code | `2.1.217` |
| Cursor Agent | `2026.07.20` |

Versions record the observed invocation environment. They do not establish a
support matrix.

## Configuration and rendering exercise

The private repository contained only synthetic content. Canonical guidance
came from the optional user-owned files under `.agentdevflow/rules/`.

The renderer exercise covered Codex, Claude Code, and Cursor with different
Steward, Developer, and Reviewer assignments. The generated targets were
byte-different where assignments differed. In bounded one-shot checks, provider
responses restated the expected duties, handoffs, stop conditions, and
prohibited actions. The checks did not authenticate the provider context or
establish persistent compliance.

The final representative configuration used:

| Choice | Value |
| --- | --- |
| Workflow | `issue-to-reviewed-pull-request` |
| Tracker | Linear |
| Steward | Codex |
| Developer | Cursor |
| Reviewer | Fresh Codex context |
| Pull request | GitHub, ready at creation |
| CI | GitHub Actions |
| Auxiliary review | Disabled |
| Merge method | Squash |

One Codex provider assignment contained both Steward and Reviewer sections in
the same generated target. Separate invocations were prompted to follow the
section relevant to the current step, and their observed responses did so.
Because both sections were visible in the same `AGENTS.md`, the target did not
isolate responsibilities, identity, permissions, or authority. The Developer
target omitted Steward and Reviewer procedure sections; that was content
filtering, not an authorization boundary.

The exact tarball completed initialization, a reviewed diff, exact-approved
rendering, and a clean check. The resulting lock and provider outputs remained
under the existing single-writer ownership model.

## Tracker-backed workflow exercise

The following bounded sequence exercised the generated procedures:

1. A real issue was created in the configured tracker with deterministic
   acceptance criteria.
2. The Developer implemented the change, ran repository verification,
   committed and pushed the revision, and created a ready pull request.
3. A controlled CI failure was observed. The exact failing result was returned
   to the Developer, which repaired the implementation and produced a new
   revision with green push and pull-request checks.
4. A fresh read-only Reviewer found one missing README update and withheld
   approval.
5. The Developer repaired the omission. A second fresh read-only Reviewer
   approved the exact replacement revision.
6. The pull request was squash-merged, the issue was closed, and the local and
   remote working branches were deleted.

In this maintainer-run sequence, participants followed the compiled procedures
through failure, repair, invalidated review evidence, and fresh approval. The
observation does not establish general provider compliance or mechanical role
separation.

## Tracker-native delegation follow-up

A second bounded exercise used the tracker's native Cursor delegation rather
than invoking the Developer directly. A repository child label following the
existing `owner/repository` convention under the workspace `repo` label group
provided the repository binding required by the integration.

The delegated issue moved into progress and produced a ready pull request in
about one minute. The change stayed within its three-file scope, added no
runtime dependency, passed its local tests, and passed GitHub Actions. A fresh
read-only Reviewer approved the exact revision. The Steward then squash-merged
the pull request, deleted the remote work branch, and moved the issue through
review to completion.

The tracker did not automatically move the issue from implementation through
review and completion. In this observation, delegation started and returned
Developer work, while maintainers continued to follow the Steward procedure
for CI observation, review, merge, branch cleanup, and tracker-state closure.
`agentdevflow` did not enforce ownership of those steps.

## Provider cross-loading follow-up

On 2026-07-24, a direct synthetic marker probe with Cursor Agent
`2026.07.20-8cc9c0b` exposed content from root `AGENTS.md`, root `CLAUDE.md`,
and `.cursor/rules/agentdevflow.mdc` in one invocation. This behavior is
consistent with the current
[Cursor CLI context documentation](https://cursor.com/docs/cli/using).

A second probe used exact provider files generated by the pre-correction
working-tree CLI. Cursor selected the Developer procedure based on product and
provider labels, but reported that the three visible projections were facially
conflicting and contained no explicit product-applicability rule. This
identified an instruction-contract defect rather than a need for a new
renderer, launcher, provider configuration, or runtime detector.

The corrected candidate makes every projection declare its target product and
provider id, makes the entire projection inapplicable to a nonmatching runtime,
and forbids combining responsibilities across products. Automated tests verify
those bytes and native target mappings. In a clean rerun against the exact
corrected output, the same Cursor Agent version selected `cursor-developer` and
the Developer responsibility, marked the other products' responsibilities
inapplicable, refused to combine them, and reported no unresolved ambiguity.
This remains point-in-time comprehension evidence; the text does not
mechanically prevent a product from loading or disregarding another file.

## External-system boundary

`agentdevflow` did not connect to Linear or GitHub, execute providers, poll CI,
manage credentials, mutate a pull request, merge, close an issue, or delete a
branch. Agents and maintainers used capabilities already available in their
authorized environment while following the advisory compiled procedures.

Missing external capability must therefore remain a stop-and-report condition,
not a claim that the CLI can supply or verify the capability.

## Limits

- The private repository prevents independent reproduction of its external
  issue, pull request, and review history.
- Headless comprehension is a point-in-time observation of the listed provider
  versions, not a deterministic provider guarantee.
- A fresh process invocation was observed but not authenticated as a distinct
  identity, principal, permission set, or clean context.
- A provider target assigned multiple responsibilities exposed every assigned
  section to the same invocation; role selection remained advisory.
- Raw provider transcripts were intentionally not retained, so response
  observations are not independently reproducible public compatibility
  evidence.
- The external exercise covered the representative ready-pull-request path.
  It did not repeat the same remote lifecycle with a draft pull request.
- The native delegation observation depends on the tracker's current repository
  label convention and provider integration; it is not an agentdevflow API or
  compatibility guarantee.
- The repository started from controlled synthetic content. Arbitrary legacy
  instruction adoption and import remain bounded separately.
- The observation proves advisory workflow usefulness, not live adapters,
  runtime orchestration, authenticated evidence, automatic authorization, or
  automatic merge.
- The observation was not rerun against the later closure tarball. Current
  repository, package, and review evidence is recorded separately.

## Disclosure boundary

This document retains the configuration shape, observed tool versions, bounded
sequence, outcomes, non-claims, and remaining gates. It excludes the private
repository name and URL, issue identifier, commit hashes, prompts, raw provider
output, reviewer and session identities, credentials, local absolute paths,
and private discussion chronology.
