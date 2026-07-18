# Private init command service evidence

Snapshot date: 2026-07-18.

## Verdict

**Pass for the read-only private proposal core.** The service deterministically observes the three initial provider instruction paths and assigns every configured path one explicit `create`, byte-exact `adopt`, assessed `import`, or `abort` disposition.

This validates the initialization decision boundary without selecting a public configuration file, implementing a wizard, trusting Git cleanliness, or granting mutation authority. Provider-specific import analyzers are not implemented; their assessment contract remains an explicit dependency.

## Reproduction

Implementation:

- `src/commands/private-init-command-service.ts`;
- `src/config/normalize-candidate.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/commands/private-init-command-service.test.ts`.

Run:

```bash
npm run build
node --test dist/test/commands/private-init-command-service.test.js
npm run check
```

## Observed behavior

Focused automated tests demonstrate:

- deterministic absent-file proposals for Codex, Claude Code, and Cursor;
- byte-exact adoption and rejection of merely similar foreign content;
- lossless import bound to observed-file, candidate-configuration, and exact target-content digests;
- lossy import retaining complete asserted information-loss diagnostics;
- unsupported, stale, configuration-mismatched, target-mismatched, and missing import analysis aborting;
- malformed candidate configuration, duplicate or incomplete targets, and contradictory assessment shapes failing closed;
- unreadable provider paths producing explicit abort entries;
- reordered inputs producing identical results;
- foreign existing content never appearing in result data;
- a real temporary repository remaining byte-for-byte unchanged through the hardened filesystem workspace.

The focused suite passes 9 tests with zero failures and zero skips. The selected V1 qualification suite passes 141 tests across 20 selected test files with zero failures and zero skips. The complete stronger suite passes 240 tests with zero failures and zero skips. The repository audit checks 140 text files successfully.

## Complexity and limitations

Normalization is linear in candidate configuration size. Proposal evaluation is linear in configured provider products and import assessments, excluding deterministic sorting. Revision 1 is intentionally bounded to three project-level instruction paths.

Import assessments in these fixtures are asserted inputs. The semantic core verifies their structure and digest binding but does not parse provider content, prove semantic equivalence, or prove that an information-loss list is complete. This prevents the orchestration layer from silently pretending to have importer capabilities that do not yet exist.

The proposal is not an atomic filesystem snapshot. Another process may change a path after observation. Future apply logic must bind and revalidate the exact observed and target digests through the existing plan and convergent-render boundaries.

## Recommendation

Keep this service as the private non-interactive initialization core. Implement narrow provider-specific project-instruction analyzers before offering import as an end-user feature. Start with exact, explainable content forms; abort on constructs that cannot be represented without a complete diagnostic. Do not build an interactive wizard until every choice maps to a reproducible file or flag representation.
