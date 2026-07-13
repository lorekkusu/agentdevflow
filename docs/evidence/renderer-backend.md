# Gate 1: renderer backend evidence

Snapshot date: 2026-07-13.

## Verdict

**Pass with a staging-only integration.** Use pinned Rulesync 9.6.3 as a replaceable transformation backend, never as the direct writer for a user repository. `agentdevflow` must own planning, capability validation, provenance, ownership, atomic application, and verification around a temporary Rulesync output root.

Direct Rulesync adoption fails the ownership and honest-diagnostic requirements. A fork and a custom renderer are not justified by the current evidence.

## Reproduction

The repository contains:

- a neutral rule and Cursor-specific extension under `test/fixtures/renderer/minimal/`;
- hand-written and modified provider-file fixtures under `test/fixtures/renderer/`;
- a backend-neutral contract in `src/renderer/contract.ts`;
- a staged ownership adapter in `src/renderer/staged-adapter.ts`;
- a pinned Rulesync process boundary in `src/renderer/rulesync-process.ts`;
- an executable harness in `src/experiments/rulesync-gate1.ts`;
- automated adapter tests in `test/renderer/staged-adapter.test.ts`.

Run:

```bash
npm install
npm test
npm run gate:renderer
```

The harness defaults to `npx --yes rulesync@9.6.3`. A pnpm runner can be selected without changing the repository package manager:

```bash
RULESYNC_RUNNER=pnpm PNPM_BIN="$(command -v pnpm)" npm run gate:renderer
```

The direct CLI observations used the same fixture with commands equivalent to:

```bash
npx --yes rulesync@9.6.3 --json generate \
  --config test/fixtures/renderer/minimal/rulesync.jsonc \
  --input-root test/fixtures/renderer/minimal \
  --output-roots "$OUTPUT_ROOT" \
  --targets codexcli,claudecode,cursor \
  --features rules
```

Add `--dry-run` or `--check` for the corresponding observation. The unsupported fixture uses `--targets codexcli --features commands`. The import fixture runs `import --targets claudecode --features rules` from a directory containing the hand-written `CLAUDE.md`.

## Version and source evidence

- Release: [Rulesync 9.6.3](https://github.com/dyoshikawa/rulesync/releases/tag/v9.6.3), released 2026-07-11.
- npm integrity: `sha512-KVSFksiQ5gR05veZLCpccVPI//4RbBGmef9DQfS9lZV+Uq3knnvZDQ4RRmi26gBkMXwuEpiQWfJipVXXtk99ww==`.
- Engine requirement: Node.js 22 or newer.
- License: [MIT](https://github.com/dyoshikawa/rulesync/blob/v9.6.3/LICENSE).
- Public interfaces: the [CLI reference](https://rulesync.dyoshikawa.com/reference/cli-commands.html) and [programmatic API](https://rulesync.dyoshikawa.com/api/programmatic-api.html).
- Source formats and provider-specific fields: [file-format reference](https://rulesync.dyoshikawa.com/reference/file-formats.html).
- Provider coverage: [project support table](https://github.com/dyoshikawa/rulesync#supported-tools-and-features).

The release page listed versions 9.3.0 through 9.6.3 between July 8 and July 11. This is evidence of very active maintenance and rapid adapter change, not a basis for an invented monthly effort estimate. The local `pnpm dlx` resolution installed 237 packages and reported one deprecated transitive dependency, `koa-router@14.0.0`; the npm package remains an experiment-time tool rather than a production dependency.

## Public and programmatic API

The released package documents named `generate`, `importFromTool`, and `convertFromTool` exports. `generate` accepts targets, features, input and output roots, config path, dry-run, check, delete, global, and simulation options. The CLI exposes the same important operations and a machine-readable JSON mode.

The public surface is sufficient to isolate Rulesync behind a process boundary. It is not sufficient to delegate artifact policy to Rulesync:

- dry-run JSON reports feature counts, paths, `hasDiff`, version, and a volatile timestamp;
- check reports whether any output differs but does not identify the path in JSON failure output;
- neither surface returns content digests, ownership claims, source mappings, adoption state, or conflict categories;
- unsupported project commands for Codex are visible in verbose text but disappear from JSON and still exit successfully.

The prototype therefore consumes only staged files and a pinned version. No Rulesync type crosses the backend-neutral contract.

## Captured observations

| Area | Direct Rulesync 9.6.3 observation | Result |
| --- | --- | --- |
| Provider coverage | The neutral rule produced `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/overview.mdc`; the Cursor-only extension produced `.cursor/rules/cursor-typescript.mdc`. | Pass |
| Determinism | Two clean output roots were byte-identical. The adapter harness repeated the same input digest, plan digest, paths, and content digests. | Pass |
| Dry run | `--dry-run` wrote no files and listed four intended paths, but did not classify create, update, ownership conflict, or adoption. | Partial |
| Verify | `--check` returned exit 0 for current output and exit 1 for missing or modified output. JSON failure was only `GENERATION_FAILED: Files are not up to date`. | Partial |
| Existing file | A hand-written `CLAUDE.md` produced no conflict in dry-run and was overwritten during render with exit 0. | Fail |
| Modified generated file | Check detected drift; the next render silently replaced the modification. | Fail |
| Ownership | Generated root files contained no owner marker, input digest, merge base, or provenance record. | Fail |
| Source mapping | Generated files contained content and provider frontmatter only; no output-to-source mapping was emitted. | Fail |
| Import | Claude content was retained in `.rulesync/rules/CLAUDE.md`, but the imported rule used `targets: ["*"]` and recorded no origin or information-loss diagnostic. | Partial |
| Unsupported capability | Verbose output warned that Codex does not support project commands, skipped the capability, and exited 0. JSON returned `success: true`, zero files, and no warning. | Fail |
| License and pinning | MIT license, immutable 9.6.3 release, npm integrity, and versioned schema URL are available. | Pass |

## Adapter prototype result

The staging adapter makes the backend safe enough for further validation:

- Rulesync writes only to a temporary directory.
- The adapter creates deterministic per-file actions and content digests.
- A path with no ownership claim becomes a conflict unless an explicit, byte-exact adoption is requested.
- A managed file whose digest no longer matches its ownership claim becomes a conflict.
- Unsupported capabilities are error diagnostics before Rulesync starts.
- Writes and removals go through an atomic workspace boundary.
- Verify reports deterministic, path-specific drift.
- Missing source mapping remains an explicit warning rather than invented provenance.

The harness produced four deterministic create actions with input digest `ef17003427a67f76e6538215743d70579f92307c356c7b5586c9bfac870b3493` and plan digest `3f72abd1b5a7ae2dc0c550cf74ff2dc995df6220385a2c7a58b772feed5c5f99` on two runs.

The prototype does not establish a public ownership format, implement import merging, or claim atomic filesystem semantics for a future production CLI. It validates the replacement boundary only.

## Strategy comparison

| Strategy | Implementation and maintenance surface | Upstream coupling | Replacement and failure profile | Recommendation |
| --- | --- | --- | --- | --- |
| Adopt as released behind a staging adapter | Small-to-moderate wrapper: staging, capability matrix, file inventory, digests, ownership, apply, verify, and provenance. Rulesync retains provider rendering. | Coupled to released CLI/API behavior and provider path changes, isolated behind one process boundary. Rapid releases require deliberate upgrade fixtures. | Backend can be replaced by another staged-file producer. Main risks are stale capability metadata, output-path drift, lossy import, and missing source maps. | **Use, conditionally.** Pin and stage; never grant direct write authority. |
| Patch or fork Rulesync | Requires upstream-quality changes for structured plans, conflicts, provenance, and diagnostics, plus ongoing merge and release work across a large provider matrix. | Highest coupling to a fast-moving codebase and its internal writer architecture. | Could improve behavior at the source but makes `agentdevflow` responsible for a broad fork. Failure includes long-lived divergence and delayed provider fixes. | Do not fork now. Reconsider only if the public staging surface becomes unusable and upstream rejects a narrowly scoped fix. |
| Build the smallest three-provider renderer | Moderate initial surface for rules only; ownership and provenance are straightforward because they are designed together. Cost grows quickly with commands, skills, hooks, permissions, and provider evolution. | No Rulesync coupling, but direct coupling to three provider specifications. | Cleanest control and replacement semantics, with the highest chance that adapter maintenance eclipses policy value. | Do not build now. Keep as the replacement path if Rulesync cannot remain isolated or if the required surface stays deliberately small. |

## Gate criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| At least one deterministic plan, render, and verify strategy for Codex, Claude Code, and Cursor | Pass | Rulesync deterministic staging plus the adapter contract and digest verification. |
| Ownership conflicts and unsupported capabilities fail visibly | Pass for the selected adapter; fail for direct Rulesync | Automated tests reject both before apply. |
| Backend replacement behind a narrow contract | Pass | The contract accepts staged files and diagnostics without Rulesync types. |
| Patch, fork, and replacement cost documented and compatible with expected capacity | Conditional pass | The wrapper is bounded; fork and custom renderer are explicitly deferred. No precise maintenance estimate is claimed. |

No fail or pivot condition is currently triggered. The intermediary layer adds concrete ownership, policy, and diagnostic behavior that Rulesync does not provide.

## Recommendation and stop conditions

Proceed to Gate 6 with a **Use** recommendation under these constraints:

1. Pin Rulesync by version and integrity.
2. Render to an isolated staging directory only.
3. Keep ownership, provenance, plan, apply, verify, and capability requirements in `agentdevflow`.
4. Treat import as a lossy proposal requiring a complete diff and explicit approval.
5. Fail unsupported required capabilities before invoking the backend.
6. Keep source traceability visibly incomplete until the adapter derives or receives exact mappings.

Pivot to a minimal renderer if Rulesync output cannot remain reproducible behind the contract, if the required wrapper expands into a second Rulesync implementation, or if provider-path maintenance dominates the policy compiler. Re-evaluate the product boundary if Rulesync or providers release the same policy, provenance, ownership, and typed-transition layer.
