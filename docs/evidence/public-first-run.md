# Public first-run qualification

Snapshot date: 2026-07-21.

## Verdict

**Fail for the published `0.1.0-beta.1` `npx` entrypoint; pass locally for the `0.1.0-beta.2` repair candidate, pending selected-platform CI and registry verification.** The immutable first package remains unusable through its advertised shell entrypoint. The repair candidate corrects the package mode and public onboarding without claiming that the registry artifact has already changed.

## Published entrypoint observation

The public package declares:

```json
{
  "bin": {
    "agentdevflow": "dist/src/cli/private-local-cli.js"
  }
}
```

The exact registry tarball for `0.1.0-beta.1` contains that JavaScript file with mode `0644`. Commands equivalent to these returned exit status `127` and `agentdevflow: command not found`:

```bash
npx --yes agentdevflow@0.1.0-beta.1 --help
npm exec --yes --package=agentdevflow@0.1.0-beta.1 -- agentdevflow --help
```

The file contains a valid Node.js shebang, but the TypeScript build created it without execute bits. Earlier installed-command qualification used Node-compatible test paths and proved command behavior without proving the shell-visible executable mode.

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

## Local repair-candidate observation

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

This local pass is not publication evidence. Until the protected workflow completes, npm `next` still resolves to the failed immutable version. Selected-platform CI, exact-commit publication of `0.1.0-beta.2`, and exact-version, `next`, and `npm exec` registry verification remain required.

## Disclosure boundary

This document retains reproducible commands, observed output class, durable product gaps, and acceptance criteria. It does not retain prompts, raw reviewer output, reviewer identities, private repository details, credentials, or discussion chronology.
