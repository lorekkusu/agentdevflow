# Initial beta release-candidate evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for local Node.js 24 beta-surface, package-content, dependency-advisory, clean offline installed-bin, and hosted Node.js 22/24 platform qualification.** Publication remains blocked by external authorization and first-publication setup, not by a missing product feature.

## Candidate boundary

- Package: `agentdevflow@0.1.0-beta.1`
- Publication boundary: manually triggered exact-version and exact-commit workflow; no external environment or credential configured
- License: Apache-2.0 with canonical root `LICENSE`
- Intended tag: `next`
- Intended provenance: enabled
- Node.js engine range: `^22.0.0 || ^24.0.0`
- Default configuration: `agentdevflow.config.jsonc` at the exact selected root
- Default lock: `.agentdevflow/lock.json` at the exact selected root
- Machine output: bounded JSON schema version 1

The repository audit mechanically checks these candidate metadata values, omission of the manifest `private` field, and the narrow manual workflow boundary. External environment, credential, visibility, tag, release, and publication changes remain separately gated.

## Package observation

The release-preparation `npm pack --dry-run --json` and a real local pack produced the same candidate summary:

| Property | Observation |
| --- | --- |
| Entry count | 118 |
| Compressed size | 109,380 bytes |
| Unpacked size | 598,950 bytes |
| SHA-1 | `b840722a3fc99a422fda15a33dff33bff2650849` |
| npm integrity | `sha512-j27i7MTvTa/5nYIGTXj64r5Pzhh4ESo/le/HboZeNoaOE7dp1GDnWC0+wAbKc20bN7mLVONrHtyZiMO+jUpFog==` |

The tarball contains `LICENSE`, `README.md`, `CHANGELOG.md`, `package.json`, and the allowlisted emitted runtime. It excludes repository tests, fixtures, development scripts, public evidence, experiments, the frozen transaction subsystem, execution transport, GitHub mapping, and Rulesync process integration.

## Clean offline installation

The candidate and the already installed exact `jsonc-parser` 3.3.1 and Zod 4.4.3 dependencies were packed into local tarballs. A clean npm prefix installed only those tarballs using offline resolution and disabled lifecycle scripts.

The installed npm bin then used only exact-root defaults and JSON schema version 1:

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

GitHub private vulnerability reporting, Dependabot security updates, secret scanning, push protection, and full-SHA Actions pinning are enabled. The active `Protect main` ruleset has no bypass actor; it requires pull requests, resolved review conversations, squash-only linear history, all six exact GitHub Actions checks on the latest base, and prevents deletion and force pushes. The initial secret-scanning alert query returned zero results, which is a point-in-time observation rather than proof that later scanning cannot find an alert.

No npm publishing secret, publishing environment, release tag, GitHub release, or npm package was configured or created during public-repository hardening. The committed manual release workflow binds `main`, a complete commit digest, an exact version, the `npm-publish` environment, the `next` tag, and provenance. The npm package must already exist before its trusted publisher can be configured, so the accepted first-publication plan uses a separately authorized short-lived bootstrap credential and requires its immediate revocation.

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

The release-preparation commit `96c253ca24b2eda636705ae4e94e100ba8ddf18e` passed all six selected GitHub Actions cells: Ubuntu, macOS, and Windows on Node.js 22 and 24. The run is recorded as [GitHub Actions run 29807660977](https://github.com/lorekkusu/agentdevflow/actions/runs/29807660977). The disclosure-preflight commit `e6461f4552704cc3b549cbacca867775005e0a2d` then passed the same six cells in [GitHub Actions run 29808741036](https://github.com/lorekkusu/agentdevflow/actions/runs/29808741036). The repository was clean and matched `origin/main` after both runs.

## Remaining publication gates

- Keep the release source clean and require the normal repository and hosted checks on any later source commit.
- Merge this public-hardening closure only through the active `main` ruleset after its required checks pass.
- Repeat package, advisory, lifecycle-script, and clean-install checks if the final release commit changes packaged artifact bytes or dependency state.
- Repeat the npm package-name lookup immediately before publication; the current 404 observation does not reserve the name.
- Separately authorize and configure the protected `npm-publish` environment and one-time first-publication credential without placing the credential in repository content.
- Dispatch only the exact reviewed final `main` commit and version, verify the public `next` artifact and provenance, then immediately remove the GitHub secret and revoke the bootstrap credential.
- After the package exists, configure trusted publishing before a later release and remove token-based publication from the workflow.
- Obtain explicit authorization before configuring external publishing state, tagging, creating a release, or publishing to npm.

## Conclusion

The beta implementation passes its local package, security-observation, installed-bin, disclosure, public-repository hardening, and selected cross-platform gates. Product development is at a release-candidate boundary. The next gate after this documentation-only closure is separately authorized first-publication setup, not feature expansion.
