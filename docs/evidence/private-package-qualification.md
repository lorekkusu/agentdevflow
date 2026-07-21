# Private package qualification

Snapshot date: 2026-07-21.

## Verdict

**Pass for one private local npm-package candidate on the tested Darwin and Node.js 24.18.0 environment.** The allowlisted tarball installs from local exact-version tarballs with npm offline resolution, exposes the `agentdevflow` bin through npm's symbolic-link layout, and completes the local `init`, `diff`, approved `render`, clean `check`, and explicit-observation `doctor` path.

This is not publication authorization, a stable CLI contract, an `npx` registry test, a public support promise, a license decision, or release provenance evidence. The package remains `private: true`.

Follow-on decision: ADR 0004 accepts Apache-2.0, Node.js 22 and 24, exact-root project defaults, stable exit classes, bounded JSON schema version 1, and the `0.1.0-beta.1` release candidate. Those decisions do not alter this snapshot's tarball measurements or authorize publication; beta release hardening must produce a new final package observation.

## Package boundary

The package manifest includes:

- one experimental `agentdevflow` bin at `dist/src/cli/private-local-cli.js`;
- emitted runtime directories selected through the `files` allowlist;
- the root README and package manifest;
- exact runtime dependencies on `jsonc-parser` 3.3.1 and Zod 4.4.3.

The final inspected tarball contains 116 entries, is 102,403 compressed bytes and 569,311 unpacked bytes, and has:

- SHA-1: `bf75e47491f6776bb60fe8287f6148ac970d78a6`;
- npm integrity: `sha512-ig3KJt9XDIKM/p1WqlbwCdUzp2FPhWzoB+O03D2rQLKOBvxA8/GGDep2khT6qT2iXzVv80b/qyUq8/lfFKuAkw==`.

The allowlist excludes repository tests, fixtures, development scripts, documentation evidence, experiments, the frozen transaction subsystem, execution transport, GitHub mapping, and Rulesync process integration. Static import traversal from the installed entry reaches no `src/transaction/`, `src/experiments/`, or provider-network adapter module.

A current `npm audit --omit=dev --json` request to the npm registry reported zero production vulnerabilities at every severity. This is point-in-time advisory matching, not proof that the dependencies or package are vulnerability-free.

## Reproduction

Build and inspect the candidate without publishing:

```bash
npm pack --dry-run --json
npm pack --pack-destination <temporary-directory> --json
```

For a network-independent installation exercise, package the already installed exact dependencies locally, then install all three tarballs into a new prefix:

```bash
npm pack ./node_modules/jsonc-parser --ignore-scripts --pack-destination <temporary-directory>
npm pack ./node_modules/zod --ignore-scripts --pack-destination <temporary-directory>
npm install --prefix <clean-install-directory> --offline --ignore-scripts \
  <agentdevflow-tarball> <jsonc-parser-tarball> <zod-tarball>
```

The qualification then invokes `<clean-install-directory>/node_modules/.bin/agentdevflow` through these outcomes:

| Command | Expected private candidate exit | Observed result |
| --- | ---: | --- |
| `init` | 0 | Created the absent revision-1 configuration only |
| `diff` | 1 | Returned the complete exact target and approval digest |
| `render` | 0 | Applied the approved target and published the lock |
| `check` | 0 | Reported the rendered repository clean |
| `doctor` | 0 | Reported explicit current local observations healthy |

The exact plan digest passed from diff to render was `503e9bde22b1cb5edabc43081c2cdb4c7ab849e18bbbaff8f2e1fd40aa6f3407`.

## Defect found and retained coverage

The first clean installation exposed a real entry-point defect: npm's bin path was a symbolic link, while the direct-invocation guard compared the unresolved `process.argv[1]` URL with the resolved module URL. Every installed command therefore exited successfully without running.

The entry now compares filesystem real paths and falls back to URL equality only if resolution fails. `test/cli/private-local-cli.test.ts` retains an npm-style symbolic-link regression test, and the final tarball was reinstalled and rerun after the fix.

## Limitations and release blockers

- The clean tarball installation was exercised on Darwin with Node.js 24.18.0. Separate selected source-level qualification covers Node.js 22 and 24 on Ubuntu, macOS, and Windows; no public platform promise follows automatically.
- Doctor observations are caller assertions. The command performs no live provider, credential, process, filesystem-capability, or network probe and does not authenticate evidence.
- The package has no accepted public configuration filename, discovery precedence, lock location, migration contract, output schema, exit-code contract, or support policy.
- The repository has no accepted open-source license file. Publication must remain blocked until the owner selects a license and its compatibility and notice obligations are reviewed.
- Registry installation, npm provenance, signatures, release automation, default-tag behavior, name availability, package reservation, and rollback were not tested.
- The recorded tarball digest binds this exact working-tree specimen. Reproducible builds across machines and release environments are not claimed.

## Recommendation

Treat this private package qualification as complete historical evidence. ADR 0004 resolves its public-surface recommendations. Repeat the package and security checks against the final beta candidate, then stop for separate publication authorization.
