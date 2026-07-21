# Public information policy

## Purpose

This repository is intended to become public. Its durable record must preserve enough technical context for contributors to implement, review, verify, upgrade, and reconsider the project without publishing private deliberation or transient work history.

The publication rule is:

> Preserve information whose absence could cause an incompatible implementation, an unsafe decision, an unverifiable claim, or repeated investigation. Omit information that only explains who said what or how a discussion unfolded.

The repository is the source of truth for public technical state. Conversation history, prompts, private instructions, and temporary analysis are not project records and must not be copied into it.

## Information classes

| Information | Durable public location | Required content | Excluded content |
| --- | --- | --- | --- |
| Product direction | `docs/product-direction.md` | Users, outcomes, product boundary, deferred work | Private priorities and discussion history |
| Architecture | `docs/architecture.md` | Interfaces, invariants, trust boundaries, limitations | Brainstorms and unverified future designs |
| Development sequence | `docs/development/roadmap.md` | Scope, dependencies, exit criteria, non-goals, stop conditions | Personal assignments and invented schedules |
| Current project health | `docs/development/project-health.md` | Sanitized verified findings, disposition, next milestone, stop conditions | Raw reviewer output, recurring chronology, and confidential security findings |
| Health review procedure | `docs/development/project-health-review.md` | Triggers, independent review method, format, disclosure classes, outcome routing | Prompts, reviewer identities, model reasoning, and speculative findings |
| Reversible tooling | `docs/development/tooling.md` | Current choice, rationale, revisit trigger | Chronological debate |
| Material decisions | `docs/decisions/` | Context, decision, consequences, evidence, revisit triggers | Raw deliberation and attribution to assistants |
| Experimental evidence | `docs/evidence/` | Version, fixture, reproduction, observation, limitation, verdict | Unsanitized logs and machine-specific data |
| Bounded maintainer observation | Current project health or a scoped development note | Sanitized scope, observed versions, bounded outcome, limitations, and follow-up gate | Private fixtures, commands, source details, raw output, and compatibility qualification claims |
| Contribution procedure | `CONTRIBUTING.md`, issue forms, and pull-request template | Operational steps and verification | Prompt transcripts and private review chronology |
| Repository-wide agent guidance | `AGENTS.md` | Concise commands, boundaries, and routing | Duplicated design documents |

Do not create ignored or hidden directories inside the repository for private notes, prompts, transcripts, or handoff material. Temporary experiment output belongs in an operating-system temporary directory and must be deleted when the experiment finishes.

## Decision lifecycle

### Open question

Record the question, constraints, evaluation criteria, and blocking evidence. Do not record the complete debate.

### Candidate

Record the current recommendation, required experiment, risks, and decision gate. A candidate is not an accepted project commitment and must be labeled accordingly.

### Accepted

Create an architecture decision record only when the decision materially constrains a public interface, dependency boundary, supply chain, data format, safety property, or long-term maintenance surface.

### Superseded

Retain the accepted record and link it to the replacement. Preserve the technical reason for the change, not the private chronology that led to it.

A rejected alternative belongs in a public record only when future contributors are likely to propose it again and need the technical reason it was rejected.

## Minimum sufficient decision record

A durable decision explains:

1. the technical problem and constraints;
2. the selected behavior or boundary;
3. the important benefits, costs, and failure modes;
4. the viable alternatives and their decisive trade-offs;
5. the reproducible evidence supporting the decision;
6. the conditions that require reconsideration.

It does not include conversation transcripts, prompts, hidden instructions, reviewer identities, assistant attribution, token usage, local machine details, or unsupported estimates.

## Evidence publication

Published evidence must separate observations from assumptions and recommendations. Keep only the smallest artifact set needed to reproduce a conclusion:

- exact relevant versions and integrity data;
- fixture paths and commands;
- deterministic expected results or digests;
- observed failures and limitations;
- an explicit gate verdict and stop conditions;
- links to current primary sources when external claims matter.

Sanitize captured output before committing it. Remove credentials, personal identifiers, absolute user paths, hostnames, temporary paths, volatile timestamps that do not support the result, and unrelated environment data. Prefer a compact fixture and expected diagnostic over a complete terminal transcript.

A private dogfood repository can support a bounded maintainer observation but
cannot become public qualification evidence when its fixture and reproduction
procedure are intentionally withheld. Record only the sanitized outcome and
limitations in development or project-health documentation, and route
independently reproducible claims to `docs/evidence/`.

## AI-assisted work

Tool use does not change contribution accountability. Repository records describe the project problem, technical decision, implementation, and evidence rather than the tool or conversation that produced them.

Contributors must review all submitted material for correctness, licensing, security, provenance, and confidential information. The project does not require prompt disclosure, and prompts or chat transcripts must not be attached to issues or pull requests.

## Security-sensitive information

Public architecture and limitation documentation must remain honest; obscurity is not an enforcement mechanism. Unpatched vulnerability details, credentials, exploit material, and private incident coordination must not be placed in public issues or commits. Publish a sanitized security explanation only when coordinated disclosure permits it.

## Pre-commit publication review

Before a change is committed, verify that:

- every durable claim helps implementation, review, operation, security, or reconsideration;
- candidate decisions are not presented as accepted;
- no conversation, prompt, private instruction, or review chronology is included;
- no secrets, personal identifiers, local absolute paths, or transient environment details are included;
- repository content is English;
- evidence is reproducible and limitations are explicit;
- local documentation links resolve;
- each topic has one authoritative location rather than duplicated narratives.

`npm run check:repository` performs a limited mechanical audit. It does not replace human review or a dedicated secret scanner.
