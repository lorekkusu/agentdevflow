# Private GitHub Check Runs evidence adapter

## Status

This is a private, provider-specific observation adapter behind the provider-neutral execution contract. It converts a caller-supplied, complete GitHub Check Runs snapshot into a revision-bound `ci-result@2` payload package and `CiResult` evidence envelope.

The implementation is in `src/adapters/github/private-github-check-runs-evidence.ts`. Reproducible observations and the exact qualification boundary are in [GitHub Check Runs evidence](../evidence/private-github-check-runs-evidence.md).

## Purpose

The adapter answers one bounded question: can exact GitHub required Check Runs for one repository commit be normalized into deterministic provider-neutral CI evidence without moving GitHub concepts into the compiler or workflow topology?

It does not call GitHub, store a token, discover branch-protection rules, select a pull-request revision, wait for checks, retry, schedule work, mutate external state, or merge a pull request.

## Input boundary

The caller supplies:

- an exact execution manifest and CI-producing step;
- repository numeric id and full name;
- a lowercase 40-character head SHA;
- one or more required Check Run names, each pinned to an expected GitHub App id;
- bounded observer identity and execution-context observations;
- a closed Check Runs snapshot produced through a separately trusted read path.

The snapshot must declare GitHub REST API version `2026-03-10`, a complete latest-Check-Runs collection, `filter=latest`, complete pagination, Checks read authorization, verified response origin, and exact repository and requested-SHA bindings. It carries only the Check Run fields used by the adapter: id, name, head SHA, status, conclusion, and App id and slug.

The adapter accepts at most 256 configured required checks and 10,000 captured Check Runs. These are private resource limits, not public GitHub support promises.

## GitHub semantics represented

GitHub's [List check runs for a Git reference](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference) endpoint accepts a ref and requires Checks read permission for fine-grained access. The endpoint supports `latest` or `all` filtering and up to 100 results per page. `latest` is required here because `all` includes historical runs and can make an ordinary rerun look like an ambiguous current requirement. GitHub also documents a 1,000-check-suite limit for the ref endpoint and directs callers that need all possible runs through check suites and their Check Runs. The private snapshot therefore requires an externally established complete latest set and rejects an `all`, single-page, or incomplete acquisition claim.

GitHub required status checks can be either checks or commit statuses, and branch protection can bind a required check to an expected GitHub App. This adapter intentionally accepts only Check Runs with an exact App id. Commit statuses require a separate adapter so source identity and result semantics are not silently conflated. See [About status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks) and [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

For required checks, GitHub treats `success`, `skipped`, and `neutral` as successful conclusions. The adapter requires an exact completed observation and accepts only those conclusions. It rejects pending, incomplete, failing, missing, wrong-source, ambiguous, foreign-repository, and foreign-SHA observations. See [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks).

## Deterministic mapping

The adapter produces:

- a subject digest over repository id and exact head SHA;
- a required-checks digest over the normalized name and App-id requirements;
- an observation digest over the complete normalized snapshot, including non-required captured runs;
- a closed `ci-result@2` payload package with status `passed`;
- a guarded evidence envelope using mechanism `github-check-runs-read-with-pinned-app`;
- a receipt binding all digests and accepted Check Run ids.

Requirement and observation order do not affect the result. Any material captured observation change changes the observation, payload-package, and envelope digests.

## Trust boundary and non-claims

`responseOriginVerified: true` is an assertion from the external acquisition boundary. The pure adapter validates that assertion but does not establish it. Ordinary SHA-256 digests bind normalized content; they do not authenticate GitHub, the observer, or the response.

A future live probe must separately define HTTPS and GitHub API client behavior, token scope and storage, response-origin verification, pagination acquisition, rate limits, retry semantics, redaction, audit logging, merge-queue and test-merge-commit revision selection, and failure recovery. Until that probe is qualified, this adapter is not end-to-end trusted acquisition.

## Change boundary

Keep this module pure, read-only, and GitHub-specific. Do not add network clients, credentials, scheduling, waiting, branch-protection discovery, commit-status fallback, or merge behavior to it. Add another narrow source adapter when a materially different evidence source is required, and preserve `CiResult` as the provider-neutral downstream artifact.
