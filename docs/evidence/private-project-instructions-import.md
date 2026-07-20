# Private project-instructions import evidence

Snapshot date: 2026-07-18.

## Verdict

**Pass for narrow logical-equivalence analysis.** The analyzer produces real digest-bound import assessments for the three initial native project-instructions formats when existing logical content is preserved exactly by the proposed target.

The analyzer deliberately returns unsupported for content differences and unknown Cursor frontmatter. It does not implement a merge or claim that arbitrary provider configuration can be imported.

## Reproduction

Implementation:

- `src/import/private-assessment.ts`;
- `src/import/private-project-instructions-analyzer.ts`;
- `src/renderer/native/common.ts`;
- `src/renderer/native/cursor.ts`.

Automated coverage:

- `test/import/private-project-instructions-analyzer.test.ts`;
- `test/commands/private-init-command-service.test.ts`.

Run:

```bash
npm run build
node --test dist/test/import/private-project-instructions-analyzer.test.js dist/test/commands/private-init-command-service.test.js
npm run check
```

## Observed behavior

Focused tests demonstrate:

- plain Codex Markdown producing a lossless assessment accepted by private init;
- plain and previously generated Claude Code content remaining equivalent across CRLF normalization;
- plain and previously generated Cursor content remaining equivalent under the exact validated frontmatter;
- changed Cursor scope failing as unsupported;
- differing logical bodies failing as unsupported rather than being merged;
- malformed agentdevflow notices failing as unsupported rather than becoming user content;
- invalid candidate-configuration digests and non-native targets failing closed;
- repeated analysis returning an identical result without input mutation;
- the existing private init regression suite continuing to pass.

The focused combined suite passes 16 tests with zero failures and zero skips. The selected V1 qualification suite passes 148 tests across 21 selected test files with zero failures and zero skips. The complete stronger suite passes 247 tests with zero failures and zero skips. The repository audit checks 145 text files successfully.

## Complexity and limitations

The analyzer compares normalized text and computes SHA-256 digests, so runtime and memory are linear in the content size. It does not parse Markdown semantics. Logical equivalence means exact normalized body equality, not natural-language equivalence.

Line-ending and terminal-whitespace normalization follows the current native emitter. Cursor support intentionally matches one exact frontmatter form rather than accepting YAML variants with potentially different semantics.

No test claims that a provider interprets two natural-language documents identically. The evidence proves deterministic transformation compatibility with the repository's current native output only.

## Recommendation

Use this analyzer to replace asserted lossless assessments for the currently supported project-instructions form. Keep content differences and unknown scope blocked until a separately designed merge representation can show complete retained and discarded intent.

The follow-on [approved init-to-render bridge](private-approved-init-render.md) now binds the proposal's observed, configuration, and target digests to the normal exact render plan without adding a general overwrite escape hatch. The current [roadmap](../development/roadmap.md) places its next work in the unified local vertical CLI path.
