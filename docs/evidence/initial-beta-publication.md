# Initial beta publication evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for exact-commit publication, registry artifact identity, provenance, and installed command behavior; fail for the shell-visible `npx` entrypoint discovered after publication.** `agentdevflow@0.1.0-beta.1` is publicly available from npm and matches the qualified candidate and source commit. Its packed JavaScript bin has mode `0644`, so direct npm executable invocation fails before the command starts. See [public first-run qualification](public-first-run.md).

This evidence does not make a 1.0 compatibility claim, authenticate caller-supplied doctor observations, establish broad provider or workflow support, or authorize a Git tag, GitHub Release, later npm version, or automatic release process.

## Publication identity

| Property | Observation |
| --- | --- |
| Package | [`agentdevflow@0.1.0-beta.1`](https://www.npmjs.com/package/agentdevflow/v/0.1.0-beta.1) |
| Source commit | `e4b30144d784905980b0bdf6342e7b1ffb80ea4e` |
| Workflow run | [GitHub Actions run 29814280179](https://github.com/lorekkusu/agentdevflow/actions/runs/29814280179) |
| Publication time | `2026-07-21T08:29:08.561Z` |
| Node.js | `24.18.0` |
| npm | `11.16.0` |
| Requested tag | `next` |

The protected manual workflow validated the exact version, full commit digest, `main` ref, package manifest, and `next` publication configuration before installing locked dependencies without lifecycle scripts. It then passed the complete repository check, production advisory audit, registry signature audit, lifecycle-script queries, package dry run, and clean tracked-file check before publishing.

## Artifact identity

The public registry and a downloaded exact-version tarball reported:

| Property | Observation |
| --- | --- |
| Entry count | 118 |
| Compressed size | 109,398 bytes |
| Unpacked size | 598,964 bytes |
| SHA-1 | `8470ad016311cca09df5e1888016587d06fcfb36` |
| npm integrity | `sha512-fmpw5jXrokuNtj6marjkdFkvrypHfajRTMEpoOD1aWESw6yXKMTDQ+xw1012QkMG/X8x3SRB9xRACvApajKdGQ==` |
| Registry `gitHead` | `e4b30144d784905980b0bdf6342e7b1ffb80ea4e` |

These values exactly match the final pre-publication candidate. The registry metadata includes a registry signature and an npm attestation endpoint whose provenance predicate type is SLSA provenance version 1. Provenance links the public artifact to the GitHub-hosted publication workflow; it does not prove that the source behavior is safe.

## Registry installation and correction

The exact public version was installed into a clean temporary prefix with dependency lifecycle scripts disabled. A Node-compatible invocation of the installed command implementation completed:

| Command | Outcome |
| --- | --- |
| `init --json` | `ready` |
| `diff --json` | `changes-required` with four exact changes |
| approved `render --json` | `applied` |
| `check --json` | `clean` |
| repeated `diff --json` | `clean` with no changes |
| explicit-observation `doctor --json` | `healthy` |

The exact plan digest remained `9c88f27c7ccd30ede0861455a555a324599b6397c61b05da9f5e87f7d118baae`.

That exercise did not directly execute the shell-visible package bin. A later public first-run audit showed that both `npx` and `npm exec` return exit `127` because the packed JavaScript target is not executable. Command behavior and artifact identity remain valid observations, but the earlier installation exercise was insufficient evidence for public executable usability.

## Distribution-tag constraint

The workflow explicitly published with `--tag next`, and `next` resolves to `0.1.0-beta.1`. For this brand-new package, the registry also established `latest` at the only published version. An authenticated `npm dist-tag rm agentdevflow latest` attempt was rejected with HTTP 400.

The canonical npm registry package format requires `dist-tags` to contain at least `latest`. This is a first-version registry constraint, not evidence that the workflow omitted the explicit non-default tag. A bare `npm install agentdevflow` therefore resolves the beta until a stable version exists. Documentation must direct beta users to the explicit `next` tag, and the project must not publish a fabricated stable version merely to move `latest`. Later prereleases must preserve an existing stable `latest` value.

## Publication credentials

The first publication used a separately authorized granular bootstrap token stored only as the protected `npm-publish` Environment secret. The GitHub secret was deleted immediately after the successful publish. The named npm bootstrap token was then revoked through npm proof-of-presence, and a subsequent token-list query returned no tokens. The package is now bound to the GitHub Actions trusted publisher for repository `lorekkusu/agentdevflow`, workflow `publish.yml`, environment `npm-publish`, and `npm publish` permission. The repository workflow no longer supplies `NODE_AUTH_TOKEN` and retains `id-token: write` solely for OIDC publication.

## Remaining external actions

- Keep future publication behind the protected Environment, exact version and commit inputs, complete release checks, and explicit authorization.
- Publish no later beta until the packed installed entrypoint and documented first-use path pass directly.
- Create a Git tag or GitHub Release only under separate authorization and only for this verified artifact.
- Collect normal-user beta feedback before expanding provider, workflow, integration, or runtime scope.

## References

- [npm package](https://www.npmjs.com/package/agentdevflow)
- [npm provenance](https://docs.npmjs.com/generating-provenance-statements/)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm distribution tags](https://docs.npmjs.com/cli/dist-tag/)
- [canonical npm registry package format](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)
