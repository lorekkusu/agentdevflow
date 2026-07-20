# Public representation candidate evidence

Snapshot date: 2026-07-20.

## Follow-on status

The dependency decision and repository-integrated parser, schema, edit, bounded project-resolution, and private preset-reconciliation work requested by this earlier candidate are now complete. See [ADR 0003](../decisions/0003-private-jsonc-zod-boundary.md), the [private project document contract](../development/private-project-document-contract.md), [private preset expansion evidence](private-preset-expansion.md), and [dependency security evidence](parser-schema-dependency-security.md). Public filenames, discovery, compatibility, and migrations remain deferred.

The schema-version-0 file and flag specimens are no longer a complete representation of current private project intent: they cannot express workflow family, hosted tracker intent, pull-request initial state, auxiliary review, or logical capability targets. They remain useful historical evidence for argument parsing and deterministic normalization, but must not become the public schema or be auto-promoted without an explicit migration contract.

## Verdict

**Pass for the historical schema-version-0 representation boundary.** That bounded candidate can be expressed through explicit flags, normalized into its existing digest, and emitted as deterministic strict JSON that is also valid JSONC. All five candidate V1 command names fit a strict Node.js `util.parseArgs` option matrix without a CLI framework or filesystem access. This does not establish complete representation of the newer private project intent.

This result does not accept a public configuration schema, filename, parser dependency, CLI syntax, help text, exit code, output format, discovery rule, or approval format.

## Reproduction

Implementation:

- `src/interface/private-cli-arguments.ts`;
- `src/interface/private-project-config-document.ts`.

Specimens and tests:

- `test/fixtures/interface/specimens.ts`;
- `test/fixtures/interface/run.ts`;
- `test/interface/private-cli-arguments.test.ts`;
- `test/interface/private-project-config-document.test.ts`.

Run:

```bash
npm run build
node --test dist/test/interface/private-cli-arguments.test.js dist/test/interface/private-project-config-document.test.js
npm run phase1:representation
npm run check
```

The fixture command prints only the command name, specimen path, syntax label, and deterministic configuration and content digests. It does not read or write a project file.

Observed local results:

| Check | Result |
| --- | --- |
| Focused representation tests | 10 passed, 0 failed, 0 skipped |
| Selected V1 qualification | 24 test files; 164 passed, 0 failed, 0 skipped |
| Complete stronger suite | 264 passed, 0 failed, 0 skipped |
| Repository publication audit | 156 text files passed |

The Balanced flag specimen produced configuration digest `3e37b935270c34b4e412183203c1a5873b2eeb5a080ee81fa24caebaeb604068`, matching the existing Balanced object fixture. Its generated document content digest is `08295129f0f57d8c0b55c6204d0e4c25e1261929adcc1b4ed736fab494596a5f`.

## Candidate command matrix

| Command | Candidate explicit inputs | Observation |
| --- | --- | --- |
| `check` | `--config <path>` | Representable without discovery or mutation. |
| `diff` | `--config <path>` | Representable without discovery or mutation. Public diff formatting remains open. |
| `doctor` | `--config <path> --observations <path>` | Reproducible evidence can be supplied without authorizing live probes. |
| `render` | `--config <path> --approve-plan <sha256>` | A non-interactive mutation request can name an exact plan digest; this is not an authentication mechanism. |
| `init` | `--config`, preset, repeated provider tuples, role bindings, tracker, review requirement, reviewer separation, repeated artifacts, and optional `--approval` | Every field in the current schema-version-0 specimen has an explicit flag representation. Existing-file disposition approval storage remains undefined. |

The specimen provider tuple uses `id,product,surface` only to exercise repeated structured input. The tuple syntax and specimen path are not public contracts.

The parser rejects unknown options, unexpected positionals, empty required values, invalid closed values, malformed provider tuples, invalid approval digests, and repeated singleton options. Repeated providers and review artifacts are normalized through the existing candidate configuration boundary. Reordering flags, providers, and artifact declarations produces the same canonical configuration and digest.

Node.js documents `util.parseArgs` as stable and provides strict parsing, positional control, repeatable options, and token details that retain repeated-option occurrences. These capabilities are sufficient for the current thin argument experiment without a third-party CLI framework. See the [official Node.js `util.parseArgs` documentation](https://nodejs.org/api/util.html#utilparseargsconfig).

## Configuration document specimen

The document generator accepts `unknown`, calls the existing candidate normalizer, and emits two-space-indented UTF-8-compatible JSON text with LF line endings and one final newline. The content contains only the normalized configuration; its digest is returned outside the document.

The generated bytes are strict JSON and therefore a valid JSONC subset. Parsing the generated bytes and normalizing the result reproduces the same configuration and digest. This proves a lossless initial document projection without choosing how user comments, formatting, duplicate properties, or syntax errors are handled.

Strict JSON alone is insufficient for safe editable input when duplicate object names are not rejected. [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259#section-4) says object names should be unique and describes inconsistent receiver behavior for duplicates. Any accepted parser boundary must detect duplicates before conversion to an ordinary JavaScript object.

## Isolated JSONC parser observation

The current stable `jsonc-parser` release, version 3.3.1, was downloaded from the official npm registry into an operating-system temporary directory and was not added to the repository. The observed package metadata was:

| Property | Observation |
| --- | --- |
| Version | `3.3.1` |
| License | MIT |
| Runtime dependencies | None |
| SHA-512 integrity | `sha512-HUgH65KyejrUFPvHFPbqOY0rsFip3Bo5wb4ngvdi1EpCYWUQDC5V+Y7mZws+DLkr4M//zQJoanu1SP+87Dv1oQ==` |

The isolated experiment demonstrated:

- comments and a trailing comma parse when explicitly allowed;
- syntax errors include deterministic numeric offset and length fields;
- the syntax tree retains duplicate property occurrences so the application can reject them;
- a scalar `modify` plus `applyEdits` operation retained an adjacent comment;
- repeating the same edit produced identical bytes.

The canonical repository documents scanner, syntax-tree, location, formatting, modification, and edit APIs. See the [`node-jsonc-parser` repository](https://github.com/microsoft/node-jsonc-parser). Its [release record](https://github.com/microsoft/node-jsonc-parser/releases) currently lists 3.3.1 as stable and 4.0.0 prereleases that include `modify()` fixes. Consequently, the isolated result qualifies the capability direction but does not justify adding the stable package without repository-integrated regression fixtures and an explicit dependency decision.

## Schema candidate observation

Zod 4 remains a plausible runtime-schema candidate, but it was not installed or tested in this slice. Official Zod documentation states that Zod 4 is stable and provides `z.toJSONSchema()`, while also identifying constructs that cannot be represented faithfully in JSON Schema. If selected, the project schema must stay within the representable subset and snapshot the emitted JSON Schema. See the [official Zod JSON Schema documentation](https://zod.dev/json-schema).

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Every current configuration choice has a file or flag representation | Pass for schema-version-0 specimens | Complete Balanced flags normalize to the existing digest; generated JSON contains the complete normalized model. |
| All five candidate commands fit a thin parser | Pass for syntax representation | Automated pure argument tests cover `init`, `render`, `diff`, `check`, and `doctor`. |
| Reordered equivalent input is deterministic | Pass | Reordered flags, providers, and artifacts produce identical canonical configuration and digest. |
| Hidden defaults do not freeze discovery or filenames | Pass | Every specimen uses an explicit path; no default path or filesystem lookup exists. |
| Repeated singleton options cannot silently become last-wins | Pass | Token inspection rejects repeated singleton options. |
| Generated configuration bytes round-trip without intent loss | Pass | Strict JSON parse plus existing normalization reproduces the exact configuration digest. |
| Editable JSONC behavior is technically plausible | Pass for an isolated pinned experiment | Comments, diagnostics, duplicate detection, and scalar edit preservation were observed with 3.3.1. |
| A production parser and schema stack is ready | Failed in this historical slice; private follow-on now passes | The later bounded parser and schema experiment installed exact dependencies, emitted a schema snapshot, and retained public compatibility as open. |

## Recommendation

This historical recommendation is superseded by the follow-on status above. It is retained to explain the evidence dependency, not as current work direction.

Use Node.js `util.parseArgs` for the next private thin-CLI integration slice. Keep command handlers as adapters over the existing semantic services and retain token-level duplicate rejection.

Keep JSONC as the leading editable configuration candidate and generate new files as deterministic strict JSON within that syntax. Do not accept a public filename or add `jsonc-parser` until a pinned repository test covers comments, duplicate properties, syntax locations, formatting preservation, array edits, and malformed input across Node.js 22 and 24.

Defer Zod adoption until the parser experiment is integrated. Then compare the existing manual validator against a JSON-Schema-representable Zod 4 schema, including diagnostics, emitted-schema snapshots, bundle cost, and migration boundaries. Do not maintain two independent production validators.

## Limitations

- The argument parser is a pure experiment, not an executable CLI.
- The option matrix has no help, version, completion, environment-variable, standard-input, output-format, color, or verbosity behavior.
- The parser does not read configuration, observation, approval, plan, or lock files.
- The generated document has no accepted filename, discovery precedence, schema URI, comments, or migration behavior.
- A plan digest is integrity binding, not proof of identity, authority, or informed approval.
- Existing-file disposition approval, public error rendering, and exit codes remain unresolved.
- The new interface tests require hosted Node.js 22 and 24 qualification before this candidate can constrain a release surface.
