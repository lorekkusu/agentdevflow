# Beta release checklist

## Purpose

This checklist controls a public prerelease without expanding product scope. It is a review procedure, not release authorization or an automated release system.

## Candidate

- Version: `0.1.0-beta.1`
- npm distribution tag: `next`
- License: Apache-2.0
- Supported Node.js release lines: 22 and 24
- Intended repository: `https://github.com/lorekkusu/agentdevflow`

Changing any candidate value requires an accepted decision and synchronized manifest, lockfile, documentation, tests, and repository checks.

## 1. Source-state review

- Start from a clean worktree on the intended release commit.
- Confirm the branch and release commit match the reviewed remote state.
- Review the complete diff and public-disclosure classification before committing.
- Before changing repository visibility, complete a separate public-disclosure review of the full reachable repository history and current settings, not only the candidate diff.
- Confirm no bootstrap material, prompt, transcript, local absolute path, credential, private key, embargoed vulnerability detail, or raw review chronology is tracked.
- Do not use reset, clean, stash, commit, tag, push, or branch mutation automatically to manufacture a clean state.

Run:

```bash
git status --short --branch
git diff --check
npm run check
```

## 2. Supported-runtime qualification

- Run `npm run check:v1-qualification` on the selected Ubuntu, macOS, and Windows cells with Node.js 22 and 24.
- Fail if any selected test is skipped, failed, or absent.
- Treat the selected cells as evidence for the accepted Node.js majors, not as a claim for every architecture, filesystem, runner, or operating-system version.

## 3. Dependency and supply-chain review

- Review exact production and development dependency changes.
- Run the production advisory check against the npm registry.
- Inspect package signatures, integrity metadata, lifecycle scripts, maintainers, and package contents for changed runtime dependencies.
- Repeat the focused parser and schema tests when `jsonc-parser` or Zod changes.
- Record only disclosure-safe conclusions; coordinate a material unpatched vulnerability privately before publishing details.

Run:

```bash
npm audit --omit=dev
npm query ':attr(scripts, [preinstall])'
npm query ':attr(scripts, [install])'
npm query ':attr(scripts, [postinstall])'
```

## 4. Package qualification

- Build and inspect `npm pack --dry-run --json` output.
- Confirm the manifest remains `private: true` during review.
- Confirm the tarball includes `LICENSE`, `README.md`, `package.json`, and only the allowlisted runtime graph.
- Confirm tests, fixtures, experiments, frozen transaction code, private evidence, local caches, and credentials are absent.
- Install the packed candidate into a clean temporary directory from exact local tarballs and exercise all five command names offline.
- Verify exact-root defaults, JSON schema version 1, exit codes 0/1/2, foreign-byte non-disclosure, and repeated render convergence from the installed bin.
- Record the final file count, compressed and unpacked sizes, SHA-1, and npm integrity value as release evidence.

## 5. Publication authorization gate

Stop and obtain explicit authorization before any of these actions:

- removing `private: true`;
- reserving or publishing the package name;
- changing repository visibility or another repository access setting;
- configuring an npm trusted publisher or repository environment;
- creating or pushing a release tag;
- creating a GitHub release;
- publishing to npm, including a prerelease;
- changing an external package, repository, or account setting.

Authorization for one action does not imply authority for the others.

## 6. Authorized publication

After authorization, confirm the reviewed source repository is publicly accessible, then use npm trusted publishing when available. Confirm provenance is attached and publish with the non-default `next` tag. Never publish the beta as `latest`.

The final publish command must name the tag explicitly:

```bash
npm publish --access public --tag next --provenance
```

The package version cannot be reused after publication. If publication partially succeeds, inspect registry state before retrying; do not assume rollback or overwrite is possible.

## 7. Post-publication verification

- Verify the registry version, `next` distribution tag, license, repository link, engines, provenance, integrity, and tarball contents.
- Install by exact version in a clean project and repeat the bounded offline command smoke test.
- Publish the changelog entry and GitHub release only for the exact verified artifact.
- Record known limitations without claiming live orchestration, authenticated observations, broad provider support, or 1.0 compatibility.
- If verification fails, report the exact observed state and use a new version for any corrected artifact.

## References

- [Initial beta public-surface decision](../decisions/0004-initial-beta-public-surface.md)
- [Initial beta CLI contract](beta-cli-contract.md)
- [Private package qualification](../evidence/private-package-qualification.md)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements/)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm distribution tags](https://docs.npmjs.com/adding-dist-tags-to-packages/)
