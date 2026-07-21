# Initial beta release-candidate evidence

Snapshot date: 2026-07-21.

This document records the final pre-publication candidate. The completed external outcome is recorded separately in [initial beta publication evidence](initial-beta-publication.md).

Follow-on correction: the qualification exercised command behavior from the installed module but did not directly execute the shell-visible packed bin. The later [public first-run qualification](public-first-run.md) found that the JavaScript bin had mode `0644`; public `npx` invocation therefore failed. References to installed-bin success below are narrowed by this correction.

## Verdict

**Pass for local Node.js 24 beta-surface, package-content, dependency-advisory, clean offline installed command behavior, and hosted Node.js 22/24 platform qualification at the pre-publication snapshot; later failed for direct package-bin execution.** Publication was blocked by external authorization and first-publication setup, while the executable-mode gap remained undetected.

## Candidate boundary

- Package: `agentdevflow@0.1.0-beta.1`
- Publication boundary: manually triggered exact-version and exact-commit workflow; protected environment configured without a credential
- License: Apache-2.0 with canonical root `LICENSE`
- Intended tag: `next`
- Intended provenance: enabled
- Node.js engine range: `^22.0.0 || ^24.0.0`
- Default configuration: `agentdevflow.config.jsonc` at the exact selected root
- Default lock: `.agentdevflow/lock.json` at the exact selected root
- Machine output: bounded JSON schema version 1

The repository audit mechanically checks these candidate metadata values, omission of the manifest `private` field, and the narrow manual workflow boundary. Credential, tag, release, and publication changes remain separately gated.

## Package observation

After the first-publication-readiness closure, `npm pack --dry-run --json` and a real local pack produced the same final candidate summary:

| Property | Observation |
| --- | --- |
| Entry count | 118 |
| Compressed size | 109,398 bytes |
| Unpacked size | 598,964 bytes |
| SHA-1 | `8470ad016311cca09df5e1888016587d06fcfb36` |
| npm integrity | `sha512-fmpw5jXrokuNtj6marjkdFkvrypHfajRTMEpoOD1aWESw6yXKMTDQ+xw1012QkMG/X8x3SRB9xRACvApajKdGQ==` |

The tarball contains `LICENSE`, `README.md`, `CHANGELOG.md`, `package.json`, and the allowlisted emitted runtime. It excludes repository tests, fixtures, development scripts, public evidence, experiments, the frozen transaction subsystem, execution transport, GitHub mapping, and Rulesync process integration. Between release-preparation commit `96c253c` and first-publication-readiness commit `e75572f`, only `README.md` changed among the packaged source and metadata paths; runtime source, dependencies, manifest, license, and changelog remained unchanged.

## Clean offline installed command behavior

The candidate and the already installed exact `jsonc-parser` 3.3.1 and Zod 4.4.3 dependencies were packed into local tarballs. A clean npm prefix installed only those tarballs using offline resolution and disabled lifecycle scripts.

The installed command implementation then used only exact-root defaults and JSON schema version 1:

| Command | Process exit | Reported outcome | Observation |
| --- | ---: | --- | --- |
| `init --json` | 0 | `ready` | Created only `agentdevflow.config.jsonc`; provider files and lock remained planned |
| `diff --json` | 1 | `changes-required` | Returned four exact changes and approval digest `9c88f27c7ccd30ede0861455a555a324599b6397c61b05da9f5e87f7d118baae` |
| `render --json` | 0 | `applied` | Wrote the three native provider instruction targets and published the default lock |
| `check --json` | 0 | `clean` | Verified the rendered repository and lock |
| repeated `diff --json` | 0 | `clean` | Returned an empty change list |
| `doctor --json` | 0 | `healthy` | Validated three provider and two environment observations without live probes |

No registry, provider, tracker, CI, review-service, or merge network call was required by the installed command path.

## Security observations

A current registry-backed `npm audit --omit=dev --json` returned zero production vulnerabilities at every severity. `npm audit signatures` verified six registry signatures and one attestation. Queries for dependency `preinstall`, `install`, and `postinstall` scripts each returned an empty set. Exact-version OSV queries for `jsonc-parser` 3.3.1 and Zod 4.4.3 returned no advisory record.

These are point-in-time advisory and installed-tree observations. They do not prove that the package is vulnerability-free, authenticate caller-supplied doctor observations, or replace dependency review and coordinated disclosure.

## External publication status

A read-only unauthenticated registry request for `agentdevflow` returned HTTP 404. No public package record was visible at the observation time. This is not a reservation and can change at any time.

Authenticated API and unauthenticated HTTP checks confirmed that the GitHub repository, README, license, security policy, and latest qualification run are publicly accessible. The repository publishes the accepted description and topics without claiming a separate project website.

GitHub private vulnerability reporting, Dependabot security updates, secret scanning, push protection, and full-SHA Actions pinning are enabled. The active `Protect main` ruleset has no bypass actor; it requires pull requests, resolved review conversations, squash-only linear history, all six exact GitHub Actions checks on the latest base, and prevents deletion and force pushes. The active purpose-based branch-name ruleset rejects remote branches with the configured identity-based prefixes. The initial secret-scanning alert query returned zero results, which is a point-in-time observation rather than proof that later scanning cannot find an alert.

The public-hardening and purpose-based branch-name changes passed the protected pull-request path and their source branches were removed. The `npm-publish` environment now accepts only `main`, requires approval from `lorekkusu`, and contains no publishing secret. Because self-approval and administrator bypass are possible, this protection records explicit owner intent but does not provide independent approval or an unbypassable control. No release tag, GitHub release, or npm package has been created. The committed manual release workflow binds `main`, a complete commit digest, an exact version, the `npm-publish` environment, the `next` tag, and provenance. The npm package must already exist before its trusted publisher can be configured, so the accepted first-publication plan uses a separately authorized short-lived bootstrap credential and requires its immediate revocation.

## Public-disclosure audit

At release-preparation commit `96c253ca24b2eda636705ae4e94e100ba8ddf18e`, a bounded read-only audit covered all 43 commits then reachable from `main`, 223 distinct historical paths, 488 distinct blobs, current tracked content, commit metadata, and the repository's local Codex tree references. It found:

- no historical path named for bootstrap material, session state, startup prompts, raw reviews, conversations, or secrets;
- no credential-shaped token, private-key marker, local user absolute path, Chinese repository text, or raw prompt marker in the scanned commit and tree blobs;
- no binary blob or blob larger than 1 MiB;
- only GitHub-provided no-reply author addresses in reachable commit metadata;
- intentional references to transcript exclusion only in the public repository policy and contribution guidance;
- only `main` on the remote, with no tags, issues, pull requests, releases, repository secrets, environments, or Actions artifacts.

This is a pattern-, path-, and metadata-based publication review. It does not prove that no secret or sensitive inference exists, replace human review, or constitute a dedicated secret scan. No repository visibility or external setting changed during the audit.

## Repository verification

Using Node.js 24.18.0:

- `npm run check` passed strict type checking, build, and 394 tests with zero failures, skips, or todos; the repository audit passed over 220 text files;
- `npm run check:v1-qualification` selected 36 test files and passed 294 tests with zero failures, skips, or todos;
- focused CLI tests cover exact-root defaults, no parent discovery, repository-relative reads, installed symlink invocation, stable exit classes, JSON schema version 1, output limiting, foreign-byte non-disclosure, stale approval, interruption convergence, and all five commands.

The release-preparation commit `96c253ca24b2eda636705ae4e94e100ba8ddf18e` passed all six selected GitHub Actions cells: Ubuntu, macOS, and Windows on Node.js 22 and 24. The run is recorded as [GitHub Actions run 29807660977](https://github.com/lorekkusu/agentdevflow/actions/runs/29807660977). The disclosure-preflight commit `e6461f4552704cc3b549cbacca867775005e0a2d` then passed the same six cells in [GitHub Actions run 29808741036](https://github.com/lorekkusu/agentdevflow/actions/runs/29808741036). First-publication-readiness commit `e75572fc7467566ce8227c2e950061bd93b2236a` passed the same six cells in [GitHub Actions run 29813134916](https://github.com/lorekkusu/agentdevflow/actions/runs/29813134916).

The final candidate was packed again, installed into a clean temporary prefix from exact local tarballs with offline resolution and lifecycle scripts disabled, and exercised through `init`, changing `diff`, approved `render`, clean `check`, repeated clean `diff`, and healthy explicit-observation `doctor`. The exact plan digest remained `9c88f27c7ccd30ede0861455a555a324599b6397c61b05da9f5e87f7d118baae`. The repeated production audit reported zero known vulnerabilities, all lifecycle-script queries were empty, npm verified six registry signatures plus one attestation, and exact-version OSV queries for `jsonc-parser` 3.3.1 and Zod 4.4.3 returned no vulnerability records. These are point-in-time observations with the limitations stated above.

## Publication gates at this snapshot

- Keep the release source clean and require the normal repository and hosted checks on any later source commit.
- Repeat package, advisory, lifecycle-script, and clean-install checks if the final release commit changes packaged artifact bytes or dependency state.
- Repeat the npm package-name lookup immediately before publication; the current 404 observation does not reserve the name.
- Create a one-day, least-privilege bootstrap credential outside repository and conversation content, and store it directly as the protected environment's `NPM_TOKEN`.
- Dispatch only the exact reviewed final `main` commit and version, verify the public `next` artifact and provenance, then immediately remove the GitHub secret and revoke the bootstrap credential.
- After the package exists, configure trusted publishing before a later release and remove token-based publication from the workflow.
- Obtain explicit authorization before configuring external publishing state, tagging, creating a release, or publishing to npm.

## Conclusion

At this snapshot, the beta implementation was considered to have passed its local package, security-observation, installed-command, disclosure, public-repository hardening, and selected cross-platform gates. The later public entrypoint failure narrows that historical verdict and requires a new packed-bin qualification before another release.
