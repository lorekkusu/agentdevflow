# Architecture decision records

## Purpose

Architecture decision records preserve material public technical decisions without publishing private deliberation. They explain enough context for a future contributor to implement, verify, and reconsider a decision.

Use an ADR when a decision materially constrains:

- a public interface or serialized format;
- a dependency or supply-chain boundary;
- generated-file ownership, provenance, or transactional behavior;
- an enforcement or security claim;
- a replacement boundary with significant maintenance consequences.

Do not create an ADR for a local refactor, an easily reversible tool preference, an unresolved brainstorm, or a temporary experiment. Keep reversible current choices in `docs/development/tooling.md`, accepted sequence and candidates in the root `ROADMAP.md`, and observations in `docs/evidence/`.

## Lifecycle

- **Proposed**: the decision is public for technical review but is not binding.
- **Accepted**: required evidence exists and the project has explicitly adopted the decision.
- **Superseded**: a later ADR replaces the decision; both records link to each other.

Rejected alternatives are recorded only when their decisive trade-off is likely to matter again.

## Process

1. Start with an open question or candidate in the roadmap or a public issue.
2. Gather reproducible evidence and identify the decision authority.
3. Copy `template.md` to the next four-digit sequence number and a concise slug.
4. Replace every template instruction with public technical content.
5. Link the evidence and state the revisit triggers.
6. Verify that no private development prompt, expanded runtime request,
   provider transcript, private instruction, identity, local path, credential,
   or unsupported estimate is present.
7. Mark the ADR Accepted only after explicit approval.

ADR filenames use `NNNN-short-title.md`. Sequence numbers identify records; they do not imply priority.

See the [public information policy](../development/public-information-policy.md) for publication rules and [template.md](template.md) for the required structure.

## Records

- [0001: Native project-instructions renderer](0001-native-project-instructions-renderer.md) — Accepted.
- [0002: V1 forward-convergent render apply](0002-v1-forward-convergent-render-apply.md) — Accepted.
- [0003: Private JSONC and runtime-schema boundary](0003-private-jsonc-zod-boundary.md) — Accepted.
- [0004: Initial beta public surface](0004-initial-beta-public-surface.md) — Accepted.
- [0005: External agents operate onboarding through the CLI](0005-external-agent-operated-onboarding.md) — Accepted.
