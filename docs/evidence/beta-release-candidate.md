# Initial beta release-candidate evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for local Node.js 24 beta-surface, package-content, dependency-advisory, and clean offline installed-bin qualification.** Publication remains blocked. The accepted Node.js 22/24 hosted matrix must be rerun on the final reviewed commit before publication authority is requested.

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
| Compressed size | 109,302 bytes |
| Unpacked size | 598,790 bytes |
| SHA-1 | `8447186c14d6a5820de5a378cd25f8b12c3c786e` |
| npm integrity | `sha512-OapqiXC915lhKFfQuF7jA74byyonrxXqDmHH4PzgoGpY8a5kBXYZh/OwZVJz+dPEDliEJsW2W+8AHtM3m2vwZg==` |

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

A current registry-backed `npm audit --omit=dev --json` returned zero production vulnerabilities at every severity. Queries for dependency `preinstall`, `install`, and `postinstall` scripts each returned an empty set.

These are point-in-time advisory and installed-tree observations. They do not prove that the package is vulnerability-free, authenticate caller-supplied doctor observations, or replace dependency review and coordinated disclosure.

## External publication status

A read-only unauthenticated registry request for `agentdevflow` returned HTTP 404. No public package record was visible at the observation time. This is not a reservation and can change at any time.

A read-only unauthenticated request to the configured GitHub repository URL also returned HTTP 404. Because the authenticated Git remote exists, this is consistent with the repository not yet being publicly accessible, but the HTTP observation alone does not distinguish private visibility from other access controls. npm provenance requires the source repository and package to be public, so repository disclosure review and separate visibility-change authorization remain publication prerequisites.

## Repository verification

Using Node.js 24.18.0:

- `npm run check` passed strict type checking, build, and 392 tests with zero failures, skips, or todos; the final documentation audit passed over 218 text files;
- `npm run check:v1-qualification` selected 36 test files and passed 292 tests with zero failures, skips, or todos;
- focused CLI tests cover exact-root defaults, no parent discovery, repository-relative reads, installed symlink invocation, stable exit classes, JSON schema version 1, output limiting, foreign-byte non-disclosure, stale approval, interruption convergence, and all five commands.

## Remaining release blockers

- Review and commit the complete working tree in bounded, dependency-ordered changes.
- Run the final accepted qualification on Node.js 22 and 24 across the selected hosted platform cells.
- Repeat package, advisory, lifecycle-script, and clean-install checks after the final release commit if its artifact bytes differ.
- Repeat the npm package-name lookup immediately before publication; the current 404 observation does not reserve the name.
- Complete the public-disclosure review and obtain explicit authorization before changing repository visibility. Confirm public accessibility before relying on npm provenance.
- Confirm trusted-publisher state without mutating it unless separately authorized.
- Obtain explicit authorization before removing `private: true`, configuring external publishing state, tagging, pushing a release, creating a release, or publishing to npm.

## Conclusion

The local beta implementation and Node.js 24 release candidate pass their current gates. The next work is review and cross-platform release qualification, not feature expansion.
