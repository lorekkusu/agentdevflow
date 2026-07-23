# Project health review

## Purpose

A project health review is a bounded, read-only check that compares the current repository with the product direction, architecture, [engineering boundary](engineering-boundary.md), roadmap, and smallest usable delivery path. It is intended to detect priority drift, unnecessary complexity, stale documentation, unreviewable change size, and unsupported progress claims before they become product commitments.

The review is not a substitute for ordinary code review, threat modeling, dependency review, or a security audit. It must not create another stream of chronological engineering notes.

The current sanitized outcome is maintained in [project health](project-health.md). Update that document in place; use Git history rather than creating one permanent report for every review.

## Triggers

Run a health review when one or more of these conditions applies:

- a roadmap milestone is about to start or has just reached its exit criteria;
- a major dependency, public contract, provider adapter, runtime capability, or architecture boundary is proposed;
- the working tree or proposed pull request is no longer reasonably reviewable as one unit;
- repository entry-point documentation and actual behavior appear inconsistent;
- implementation work advances a later roadmap area while an earlier dependency remains incomplete;
- a prerelease, public onboarding change, major refactor, or security-sensitive integration is approaching;
- a maintainer requests an independent scope and complexity check.

Do not run reviews merely on a high-frequency calendar. A review that cannot change a decision, milestone, or stop condition is unnecessary process.

## Independent review procedure

Use at least three bounded perspectives when the change is material:

1. product direction and roadmap alignment;
2. implementation complexity and maintenance cost;
3. smallest usable delivery path and milestone ordering.

Every perspective must apply the engineering-boundary keep, freeze, defer, and
remove criteria to both old and new work. Prior investment, accepted historical
evidence, and downstream adaptation are not reasons to retain executable
complexity without a current product caller.

For every public version or onboarding change, one perspective must instead act as a zero-context user. It begins with only the README and installed package help, attempts the documented first-use path through the real package entrypoint, and records unanswered product, option, safety, and limitation questions before reading implementation or test files. Source inspection may verify the findings afterward.

Initial reviewers must use clean conversation contexts. Give each reviewer only:

- the repository root;
- the base commit and whether the working tree is clean or contains the review target;
- this review procedure;
- one bounded review question;
- a read-only instruction and explicit prohibition on repository edits;
- the public source-of-truth documents to compare.

Do not provide another reviewer's conclusions or the current `project-health.md` conclusions during the initial pass. Context isolation does not require a clean Git working tree: reviewers may inspect a declared dirty working tree when it is the review target. They must identify which state they reviewed.

The coordinating reviewer compares independent findings, verifies material claims directly against the repository, resolves counting-method differences, and publishes only the minimum durable conclusions. Agreement among reviewers increases confidence but does not replace evidence.

## Disclosure classes

Classify information before recording it:

| Class | Durable handling |
| --- | --- |
| Public technical health | Record verified product, architecture, maintainability, documentation, and delivery findings in `project-health.md`. |
| Embargoed security | Keep unpatched vulnerability details, exploit conditions, credentials, and private incident coordination outside the public repository and public issue tracker. Use a private maintainer security route. |
| Transient review material | Do not retain prompts, conversation transcripts, model reasoning, reviewer identities, raw agent output, speculative findings, or local machine details. |

Do not disclose that a confidential vulnerability exists when even that fact would increase risk. After coordinated remediation, route a sanitized durable security conclusion to the appropriate advisory, ADR, evidence, or release record.

## Review format

A material review should answer these fields in order:

1. **Basis**: date, base commit, working-tree state, scope, and exclusions.
2. **Current product outcome**: the smallest operation a user can complete today.
3. **Roadmap alignment**: completed, partial, blocked, and prematurely advanced areas.
4. **Measured observations**: relevant file, line, dependency, test, documentation, or change-size measurements with the counting method where ambiguity matters.
5. **Findings**: severity, confidence, evidence paths, impact, and whether the finding is product, architecture, maintainability, documentation, or delivery related.
6. **Disposition**: `Invest`, `Keep`, `Freeze`, `Defer`, or `Removal candidate`.
7. **Next milestone**: one user-visible or integration outcome with explicit exit criteria.
8. **Stop conditions**: work that must not begin before the next milestone is complete.
9. **Decision requests**: only choices that materially change product direction, public contracts, dependencies, or retained scope.
10. **Limitations**: unreviewed areas, unresolved assumptions, and security non-claims.

Use evidence paths and concise measurements rather than copying source, terminal transcripts, or complete reviewer reports.

## Outcome routing

- Update `project-health.md` with the current accepted health assessment and disposition.
- Update `roadmap.md` only with the accepted current, next, later, frozen, and stop-condition changes.
- Use an ADR only for an accepted material constraint.
- Use `docs/evidence/` only for compact reproducible technical observations.
- Use public issues for sanitized actionable work when external tracking is useful.
- Keep embargoed security material out of all public routes.

One conclusion must have one authoritative location. Do not duplicate the full health assessment in the roadmap, architecture, evidence, and contribution documentation.

## Review completion criteria

A review is complete when:

- material findings have repository evidence or are labeled as unresolved assumptions;
- conflicting reviewer claims have been checked;
- the current project outcome and next milestone are explicit;
- retained experiments have a clear default, frozen, or deferred status;
- stop conditions prevent immediate repetition of the detected drift;
- public content passes disclosure review;
- a public-version review directly invokes the packed installed bin and completes the documented first-use path without prefixing the entry with its runtime;
- a zero-context reviewer can explain the current executable product, valid choices, generated paths, approval sequence, and non-features from public user material;
- no repository mutation was performed by independent reviewers.
