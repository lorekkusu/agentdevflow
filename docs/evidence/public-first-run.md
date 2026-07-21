# Public first-run qualification

Snapshot date: 2026-07-21.

## Verdict

**Pass for published `0.1.0-beta.2`; retained historical failure for the recorded `0.1.0-beta.1` direct-entrypoint environment.** The repaired package passes direct installed-bin qualification, the selected hosted matrix, exact-version and `next` registry invocation, and the documented first-use path. A later npm 11.16 recheck normalized the first package's installed bin to `0755` and executed it successfully; this does not change its defective `0644` tarball mode or make it the recommended beta.

## Published entrypoint observation

The public package declares:

```json
{
  "bin": {
    "agentdevflow": "dist/src/cli/private-local-cli.js"
  }
}
```

The exact registry tarball for `0.1.0-beta.1` contains that JavaScript file with mode `0644`. During the recorded post-publication audit, commands equivalent to these returned exit status `127` and `agentdevflow: command not found`:

```bash
npx --yes agentdevflow@0.1.0-beta.1 --help
npm exec --yes --package=agentdevflow@0.1.0-beta.1 -- agentdevflow --help
```

The file contains a valid Node.js shebang, but the TypeScript build created it without execute bits. Earlier installed-command qualification used Node-compatible test paths and proved command behavior without proving the shell-visible executable mode.

After the beta.2 publication, a separate clean-cache recheck with Node.js
24.18.0 and npm 11.16.0 installed exact beta.1, normalized its installed target
to mode `0755`, and successfully ran both `npx` and `npm exec`. The historical
failure and immutable tarball bytes remain valid observations, but they do not
support a universal claim that every current npm client fails. Beta.2 removes
that installer-dependent ambiguity by publishing the target itself as `0755`.

## Onboarding observation

The pre-repair README explained the product direction, Phase 0 and Phase 1 evidence, contributor commands, and release state, but did not provide:

- one valid `init` command;
- the closed provider, role, preset, tracker, and workflow choices;
- the `diff` exit-status and exact-plan approval sequence;
- the generated target paths and existing-file outcomes;
- a caller-supplied `doctor` observation example;
- a direct separation between executable beta features and future integrations.

These omissions required a visitor to reconstruct normal use from source code, tests, and historical evidence. That is a public product defect rather than acceptable beta instability.

## Repair acceptance

The repair passes only when:

1. the build gives the packed POSIX CLI executable mode;
2. an exact local tarball installs into a clean prefix and its `.bin/agentdevflow --help` succeeds directly;
3. global and command-specific help describe the closed current values and safety boundary;
4. the README provides a copy-pastable `init -> diff -> render -> check` path;
5. a public guide covers multi-provider choices, generated paths, ownership behavior, exit statuses, JSON output, doctor observations, and current non-features;
6. complete repository and selected platform qualification remain green;
7. a fresh zero-context review can explain the product and complete the first-use path without reading source or test files.

## Repair-candidate observation

The 2026-07-21 local candidate produced these bounded observations:

| Observation | Result |
| --- | --- |
| Packed CLI mode | `0755` |
| Packed files | 119 |
| Compressed size | 114,409 bytes |
| Unpacked size | 617,191 bytes |
| SHA-1 | `95e6c4a4f12070c444744b4c5cec3a3ff3c5fad9` |
| npm integrity | `sha512-jKYtr0exdsaMuuPTICxew+/9N9qEyC3Ja4EC/MngPGiPAplFyyBgT4SrCPqeGswO5eXoZP7B+tL+m6zUUwL/fw==` |
| Repository audit | 226 text files passed |
| Automated tests | 398 passed; 0 failed, skipped, or todo |

`npm run check:package-entrypoint` packed the allowlisted candidate and its exact installed runtime dependencies into local tarballs, installed them offline into a clean prefix with lifecycle scripts disabled, and directly invoked the installed `.bin/agentdevflow`. The check covered global and five command-specific help paths; `init`, changing `diff`, exact approved `render`, clean `check`, and clean `diff`; a second no-op render using the newly observed converged digest; schema-version-1 JSON; documented exit statuses 0, 1, and 2; degraded manual doctor observations; an exact managed-file deletion plus foreign-drift refusal; foreign-byte non-disclosure; and a symbolic-link failure that retained the bounded JSON contract.

Independent zero-context reviews then evaluated the public entry points without receiving the prior health conclusion. The post-repair comprehension review could identify the product, current scope, first-use path, closed options, generated targets, and non-features from the README and getting-started guide. Follow-up adversarial review found and drove explicit corrections for the unpublished-package status, advisory-versus-runtime boundary, whole-file ownership, deletion behavior, and caller-asserted doctor evidence. Raw review material and reviewer metadata are not retained.

## Hosted and registry observation

Pull request 6 passed all six selected GitHub Actions cells: Ubuntu 24.04,
macOS 15 arm64, and Windows 2025 x64 on Node.js 22 and 24. Every cell ran the
installed-package entrypoint verifier, including the Windows command shim. The
protected path squash-merged the change as commit
`13bb07c0aea48df8dfd4bb8fbed7201ef30d4962`.

The manually dispatched `npm-publish` Environment workflow required explicit
approval, checked that exact `main` commit and version, repeated repository,
supply-chain, package-content, and installed-entrypoint verification, and then
published with npm OIDC provenance. [GitHub Actions run 29827373023](https://github.com/lorekkusu/agentdevflow/actions/runs/29827373023)
completed successfully.

The public registry reports:

| Observation | Result |
| --- | --- |
| Exact version | `0.1.0-beta.2` |
| npm `next` | `0.1.0-beta.2` |
| npm `latest` | `0.1.0-beta.2` |
| License | `Apache-2.0` |
| Node.js engines | `^22.0.0 || ^24.0.0` |
| Repository | `https://github.com/lorekkusu/agentdevflow.git` |
| SHA-1 | `95e6c4a4f12070c444744b4c5cec3a3ff3c5fad9` |
| npm integrity | `sha512-jKYtr0exdsaMuuPTICxew+/9N9qEyC3Ja4EC/MngPGiPAplFyyBgT4SrCPqeGswO5eXoZP7B+tL+m6zUUwL/fw==` |
| Provenance predicate | SLSA provenance version 1 |
| Deprecated release | `0.1.0-beta.1` with beta.2/`next` upgrade guidance |

Direct `npx` invocation without a version, by exact version, and by `next`, plus
direct `npm exec` by exact version, each reached the beta.2 package help
entrypoint. A new empty temporary
project then followed the README path using only the public exact version:
`init` created only `agentdevflow.config.jsonc`; `diff` returned the documented
changes-required status and complete plan; exact-digest `render` created
`AGENTS.md` and `.agentdevflow/lock.json`; and the final `check` and `diff`
reported clean state.

The local registry check used macOS 26.5.2 on Darwin 25.5.0 arm64, Node.js
24.18.0, and npm 11.16.0. It is reproducible with a fresh temporary directory
and npm cache using these command forms:

```bash
npm view agentdevflow@0.1.0-beta.2 version dist.integrity --json
npm view agentdevflow dist-tags --json
npx --yes agentdevflow --help
npx --yes agentdevflow@0.1.0-beta.2 --help
npx --yes agentdevflow@next --help
npm exec --yes --package=agentdevflow@0.1.0-beta.2 -- agentdevflow --help

npx --yes agentdevflow@0.1.0-beta.2 init \
  --workflow local-reviewed-change \
  --preset fast \
  --tracker none \
  --provider codex-main,codex,cli \
  --steward codex-main \
  --developer codex-main \
  --reviewer codex-main
npx --yes agentdevflow@0.1.0-beta.2 diff
npx --yes agentdevflow@0.1.0-beta.2 render \
  --approve-plan <exact-plan-digest-from-diff>
npx --yes agentdevflow@0.1.0-beta.2 check
npx --yes agentdevflow@0.1.0-beta.2 diff
```

The observed exit sequence after the help and registry queries was
`0, 1, 0, 0, 0` for `init`, changing `diff`, approved `render`, clean `check`,
and clean `diff`. The plan digest is intentionally repository-state-specific
and must be copied from the immediately preceding `diff`; it is not a fixture
constant.

Because npm requires a `latest` tag and initially assigned it to the only
published version, unqualified installs previously selected beta.1. After
beta.2 passed publication and first-run verification, an explicitly authorized
registry correction moved `latest` to beta.2 and deprecated beta.1 with direct
upgrade guidance. This does not establish a policy of moving an existing stable
`latest` tag to future prereleases.

## Immutable package-document boundary

The beta.2 tarball contains the reviewed README and changelog bytes from release
commit `13bb07c0aea48df8dfd4bb8fbed7201ef30d4962`. That README describes registry
readiness conditionally on the exact npm version page resolving and describes
OIDC publication as the next publication path. The condition is now satisfied
and its exact-version commands are valid, but the wording predates the completed
publication. The GitHub source documents the completed status; it does not claim
that post-publication documentation edits changed the immutable beta.2 tarball.
A later separately authorized version should include the current wording. This
known tense difference does not change the beta.2 command path, package identity,
or safety boundary.

These observations prove the documented local first-run boundary on the tested
registry, platform, Node.js, and npm environment. They do not prove every shell,
filesystem, architecture, or agent-product version, nor do they turn advisory
project instructions into runtime orchestration.

## Disclosure boundary

This document retains reproducible commands, observed output class, durable product gaps, and acceptance criteria. It does not retain prompts, raw reviewer output, reviewer identities, private repository details, credentials, or discussion chronology.
