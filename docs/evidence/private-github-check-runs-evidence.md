# Private GitHub Check Runs evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for deterministic mapping after a caller-attested acquisition boundary; fail for end-to-end trusted acquisition.** A complete, exact-SHA GitHub Check Runs snapshot with pinned App identities produces deterministic provider-neutral `ci-result@2` evidence and replays through the existing workflow manifest. Malformed, incomplete, stale, missing, failing, ambiguous, wrong-source, wrong-repository, and wrong-revision observations fail without partial evidence.

The experiment contains no network access or credentials and therefore does not prove that the snapshot came from GitHub. It does not discover branch protection, monitor checks, select merge-queue revisions, or mutate a pull request.

## Reproduction

Implementation and tests:

- `src/adapters/github/private-github-check-runs-evidence.ts`;
- `test/adapters/private-github-check-runs-evidence.test.ts`;
- `test/fixtures/adapters/github-check-runs-run.ts`.

Run:

```bash
npm run phase1:github-ci-evidence
node --test dist/test/adapters/private-github-check-runs-evidence.test.js
npm run check
```

## Captured deterministic result

The fixture represents GitHub Actions Check Runs `build` and `test`, both produced by App id `15368`, for one exact repository commit.

| Value | Digest or ids |
| --- | --- |
| Subject | `f25c86be2d47e69c818283b8e26c8b2ff8e8b381f297488b7bfbc1b6d2df189b` |
| Required checks | `f8fbc5b1cbcacf823b93a787b3b6b1512047ac58a6fae6923b54a9618741f897` |
| Complete observation snapshot | `10c592de24a5421e02931f40095a5ec64f126139afe4583c43a97207e1d5b713` |
| Payload package | `52aac8c2a96ee2c3194e71adc7b1e27fb1370a899fce65b0ee3069be1126c042` |
| Evidence envelope | `c37d919ebecd7461a6abb0b22d89fad32aa80acb6002028a77732da20d189e62` |
| Accepted Check Runs | `101`, `102` |
| Payload transport | `ac9e58d72027a9a90193981e7d342bc10ad852c61929b9b0fe2cc535538c335e` |
| Envelope transport | `d573465579a67e33f74e0ea0e80e7d368d8f9830e3812e9f5efd1e839f94569a` |

## Observations

| Fixture | Result |
| --- | --- |
| Pinned completed Check Runs with successful conclusions | Accepted and replayed to `ci-passed` |
| `success`, `neutral`, or `skipped` conclusion | Accepted |
| Reordered requirements and Check Runs | Deeply equal result and digests |
| Failed or incomplete required check | Rejected |
| Missing required name | Rejected |
| Expected name produced by another App | Rejected |
| More than one matching name and App | Rejected as ambiguous |
| Repository, requested SHA, or per-run SHA differs | Rejected |
| Incomplete pagination, `filter=all`, single-ref-page method, or unverified origin assertion | Rejected as an invalid snapshot |
| Commit-status requirement | Rejected as an unsupported evidence source |
| Duplicate or unpinned requirement | Rejected |
| Any captured Check Run field changes | Observation, payload, and envelope digests change |
| Manifest step cannot produce `CiResult` | Rejected before evidence creation |

The focused adapter suite passed 10 tests with zero failures or skips.

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Provider-neutral downstream evidence | Pass | GitHub fields terminate at the adapter; downstream code receives `CiResult`. |
| Exact revision binding | Pass for supplied observations | Repository id and full head SHA bind the subject, snapshot, runs, payload, and envelope. |
| Required source identity | Pass for supplied App ids | Each configured name must have exactly one Check Run from the pinned App id. |
| Complete observation binding | Pass | `ci-result@2` binds the normalized full captured snapshot, not only the passing summary. |
| Determinism | Pass | Reorder-equivalent input produces deeply equal output; material observation changes alter digests. |
| Failure behavior | Pass | Missing, incomplete, failed, ambiguous, stale, foreign, or unsupported state returns diagnostics and no evidence. |
| Live trusted acquisition | Fail by design | No GitHub client, token, HTTPS verification, or independently authenticated response exists. |
| Runtime orchestration | Excluded | No polling, waiting, retries, scheduling, remediation, pull-request mutation, or merge exists. |
| Broad GitHub compatibility | Excluded | Commit statuses, merge queues, test merge commits, branch-protection discovery, and rulesets are not represented. |

## Maintenance and coupling

The adapter depends on a small closed subset of the GitHub Check Runs response rather than a GitHub SDK. This limits dependency and release coupling, but GitHub API semantics, version retirement, required-check configuration behavior, and merge-queue revision selection still require periodic qualification against official documentation and reproducible live fixtures.

The 1,000-check-suite endpoint limit is handled as an acquisition precondition, not hidden inside this pure mapper. The future probe must establish a complete globally latest result set, traversing check suites when the ref endpoint cannot cover all possible runs, or fail closed. It must not silently accept the first ref page or substitute historical `filter=all` results.

## Recommendation

Retain the narrow adapter boundary and `ci-result@2` observation binding. Do not add a scheduler or GitHub SDK to the compiler core.

Retain this mapper as frozen private evidence. The current [roadmap](../development/roadmap.md) defers a live GitHub probe until the local vertical CLI path has a real authenticated external consumer. If that later probe cannot make token scope, response origin, complete pagination, rate-limit behavior, redaction, and exact revision selection auditable and replaceable without substantial runtime coupling, keep acquisition external and treat the snapshot as an integration contract rather than expanding the product into an orchestrator.
