# Initial beta release-candidate evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for local Node.js 24 beta-surface, package-content, dependency-advisory, clean offline installed-bin, and hosted Node.js 22/24 platform qualification.** Publication remains blocked by external authorization and first-publication setup, not by a missing product feature.

## Candidate boundary

- Package: `agentdevflow@0.1.0-beta.1`
- Publication guard: `private: true`
- License: Apache-2.0 with canonical root `LICENSE`
- Intended tag: `next`
- Intended provenance: enabled
- Node.js engine range: `^22.0.0 || ^24.0.0`
- Default configuration: `agentdevflow.config.jsonc` at the exact selected root
- Default lock: `.agentdevflow/lock.json` at the exact selected root
- Machine output: bounded JSON schema version 1

The repository audit mechanically checks these candidate metadata values and the publication guard. Changing them requires a new accepted decision or explicit publication step.

## Package observation

`npm pack --dry-run --json` and a real local pack produced the same candidate summary:

| Property | Observation |
| --- | --- |
| Entry count | 118 |
| Compressed size | 109,338 bytes |
| Unpacked size | 598,863 bytes |
| SHA-1 | `3d792c34dad42a337aae8287e69f0dd0d83d0296` |
| npm integrity | `sha512-elQ0aDisEQPhO25SyKgLG3+UWhZvjl2k5+rP8UfoW0DMre2HJo7sROcsjg5irI6lnrISqkM/dkOljISOPBtl4Q==` |

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

An authenticated read-only repository query confirmed that the GitHub repository remains private. npm automatic provenance through trusted publishing requires a public source repository and public package, so separate disclosure review and visibility-change authorization remain publication prerequisites.

No npm publishing secret, publishing environment, release tag, or release workflow was configured during qualification. The npm package must already exist before its trusted publisher can be configured, so the first publication requires a separately reviewed bootstrap credential or another explicitly approved publication plan. No such choice is accepted by this evidence.

## Public-disclosure audit

A bounded read-only audit covered all 41 commits reachable from `main`, 221 distinct historical paths, current tracked content, commit metadata, and the repository's local Codex tree references. It found:

- no historical path named for bootstrap material, session state, startup prompts, raw reviews, conversations, or secrets;
- no credential-shaped token, private-key marker, local user absolute path, Chinese repository text, or raw prompt marker in the scanned commit and tree blobs;
- no binary blob or blob larger than 1 MiB;
- only GitHub-provided no-reply author addresses in reachable commit metadata;
- intentional references to transcript exclusion only in the public repository policy and contribution guidance.

This is a pattern-, path-, and metadata-based publication review. It does not prove that no secret or sensitive inference exists, replace human review, or constitute a dedicated secret scan. No repository visibility or external setting changed during the audit.

## Repository verification

Using Node.js 24.18.0:

- `npm run check` passed strict type checking, build, and 393 tests with zero failures, skips, or todos; the repository audit passed over 219 text files;
- `npm run check:v1-qualification` selected 36 test files and passed 293 tests with zero failures, skips, or todos;
- focused CLI tests cover exact-root defaults, no parent discovery, repository-relative reads, installed symlink invocation, stable exit classes, JSON schema version 1, output limiting, foreign-byte non-disclosure, stale approval, interruption convergence, and all five commands.

The final hosted qualification on commit `365aecd49ccedbbbea30d42869436400663a44a3` passed all six selected GitHub Actions cells: Ubuntu, macOS, and Windows on Node.js 22 and 24. The run is recorded as [GitHub Actions run 29801237945](https://github.com/lorekkusu/agentdevflow/actions/runs/29801237945).

## Remaining publication gates

- Review and commit this disclosure-safe release-closure change, then require the normal repository and hosted checks on that exact commit.
- Repeat package, advisory, lifecycle-script, and clean-install checks if the final release commit changes packaged artifact bytes or dependency state.
- Repeat the npm package-name lookup immediately before publication; the current 404 observation does not reserve the name.
- Obtain explicit authorization before changing repository visibility, and confirm public accessibility before relying on automatic npm provenance.
- Select and authorize the first-publication credential bootstrap. After the package exists, configure trusted publishing and remove or revoke the bootstrap credential before future releases.
- Enable GitHub private vulnerability reporting after the repository becomes public, then verify the route documented in `SECURITY.md`.
- Obtain explicit authorization before removing `private: true`, configuring external publishing state, tagging, pushing a release, creating a release, or publishing to npm.

## Conclusion

The beta implementation passes its local package, security-observation, installed-bin, and selected cross-platform gates. Product development is at a release-candidate boundary. The next work is review of this closure and separately authorized publication preparation, not feature expansion.
