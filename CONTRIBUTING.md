# Contributing

Thank you for contributing to `agentdevflow`. The project values small, reviewable changes backed by deterministic evidence.

## Before starting

Read:

- [repository guidance](AGENTS.md);
- [product roadmap](ROADMAP.md);
- [product direction](docs/product-direction.md);
- [architecture](docs/architecture.md);
- [current project health](docs/development/project-health.md);
- [public information policy](docs/development/public-information-policy.md).

Confirm that the proposed change fits the current phase and does not expand a deferred product area without an explicit project decision.

## Repository content

Write all repository content in English. Do not commit conversation
transcripts, private development prompts, expanded runtime requests, private
instructions, review chronology, credentials, personal identifiers, local
absolute paths, or temporary handoff material. Reviewed product-owned runtime
instruction templates required by an accepted feature are source code and must
remain visible, bounded, intentionally packaged, and tested.

Preserve technical context in its durable form:

- product outcomes in product documentation;
- architecture boundaries in architecture documentation;
- current sequence and candidates in the roadmap;
- accepted material decisions in an ADR;
- reproducible observations in evidence documents;
- operational contribution steps in this file and the repository templates.

## AI-assisted contributions

Contributors are responsible for every submitted change regardless of the tools used to produce it. Review generated material for correctness, security, licensing, provenance, and confidential information.

Do not attach private development prompts, expanded runtime requests, provider
transcripts, or chat transcripts to issues or pull requests. Explain the
project problem, proposed behavior, implementation, evidence, risks, and
limitations directly.

## Issues and decisions

Use the change proposal issue form for scoped implementation work. Use the decision proposal form when a change could constrain a public format, major dependency, supply chain, ownership model, enforcement claim, or long-term replacement boundary.

An issue is not an accepted decision. Candidate recommendations remain non-binding until the required evidence exists and the project explicitly accepts them.

## Branch names

Name branches for the purpose of the change, not for an author, tool, or execution environment. Branches created directly in this repository must use one of these prefixes:

- `build/`;
- `chore/`;
- `ci/`;
- `dependabot/`;
- `docs/`;
- `feat/`;
- `fix/`;
- `perf/`;
- `refactor/`;
- `release/`;
- `research/`;
- `revert/`;
- `security/`;
- `test/`.

The active GitHub ruleset enforces these prefixes when new branches are created directly in this repository, other than `main` and GitHub-managed merge-queue branches. Branches in external forks are outside the repository ruleset's scope.

## Pull requests

Keep pull requests focused. Include:

- the problem and intended outcome;
- the implemented scope and explicit non-goals;
- verification commands and results;
- risks, limitations, and follow-up work;
- documentation or ADR impact.

Do not claim tests, enforcement, compatibility, or security properties that were not verified.

Update `ROADMAP.md` when the pull request implements, changes, defers,
supersedes, or completes a durable product requirement. If the change has no
roadmap impact, state why in the pull-request description.

## Verification

Run from the repository root:

```bash
npm install
npm run check
```

`npm run check` performs the repository publication audit, TypeScript type checking, build, and automated tests. There is currently no lint or format command.

## Security-sensitive reports

Follow [the security policy](SECURITY.md). Do not open a public issue containing credentials, exploit details, or an unpatched vulnerability. If the private reporting route is unavailable, request a private contact route from a maintainer without including sensitive details.
