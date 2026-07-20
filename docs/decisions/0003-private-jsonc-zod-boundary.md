# 0003: Private JSONC and runtime-schema boundary

Status: Accepted

Date: 2026-07-20

## Context

The bounded project-intent experiment proved the fields needed to select both issue-to-reviewed-pull-request and local reviewed-change workflows. The next boundary must accept editable configuration bytes, reject ambiguous or malformed input, produce deterministic source-aware diagnostics, validate a closed runtime shape, and emit a machine-readable schema without freezing a public filename or `ProjectConfig v1`.

Node.js `JSON.parse` cannot accept comments and does not expose duplicate property occurrences or syntax-tree locations. The existing manual candidate validator duplicates shape logic and is not intended as a production schema implementation. A parser and runtime schema are material dependency and supply-chain decisions.

Repository-integrated tests and dependency review evaluated exact `jsonc-parser` 3.3.1 and Zod 4.4.3 packages. Both have zero runtime dependencies and no install lifecycle script. Exact OSV queries and the complete npm audit found no known vulnerability affecting the selected versions. Zod has an older moderate email-validation denial-of-service advisory affecting versions through 3.22.2, not 4.4.3.

## Decision

Adopt exact `jsonc-parser` 3.3.1 and Zod 4.4.3 runtime dependencies for the private project-document experiment.

Route JSONC use only through `src/interface/private-domain-project-document.ts`. Parse with an explicit UTF-8 byte limit and iterative nesting preflight, retain a syntax tree, reject every parse error and duplicate property, reject `__proto__`, then convert through the parser's null-prototype tree conversion.

Route Zod use only through `src/interface/private-zod.ts`. Set `jitless: true` before schema construction. Use strict bounded objects, arrays, identifiers, and discriminated unions that can be emitted as Draft 2020-12 JSON Schema. Configure JSON Schema generation to throw for unrepresentable constructs and cycles, and retain a deterministic snapshot.

Keep cross-field workflow semantics in the existing project resolver. Schema success is required but is not authorization or proof of policy safety.

Keep versions exact in `package.json` and integrity-bound in `package-lock.json`. Any upgrade requires renewed security and behavior evidence.

This decision accepts a private dependency boundary, not JSONC as the final public syntax, any public filename, schema version, compatibility contract, or migration behavior.

## Consequences

Editable comments, trailing commas, precise syntax offsets, duplicate visibility, and comment-preserving edits are available without building a parser. Runtime types and emitted JSON Schema derive from one schema definition instead of separate production validators.

The project assumes maintenance and supply-chain responsibility for two runtime packages. Zod adds approximately 6.3 MiB to the local installed development tree and `jsonc-parser` approximately 252 KiB; published package impact must be measured separately before release.

The parser boundary rejects some inputs that the underlying fault-tolerant parser could partially interpret. This is intentional because ambiguous policy configuration is unsafe. Resource limits may reject unusually large legitimate future configurations and require evidence-backed adjustment.

Zod's global `jitless` setting is process-wide for the installed module. All repository Zod imports therefore pass through one wrapper, enforced by the repository audit.

## Alternatives considered

- **Continue with Node.js `JSON.parse` and manual validation.** Avoids runtime dependencies but loses comments, duplicate visibility, source locations, edit preservation, and a single runtime-schema source.
- **Use `jsonc-parser` with a permanent manual validator.** Retains editable JSONC but creates two independent shape definitions once JSON Schema and editor integration are required.
- **Use Zod with strict JSON only.** Provides runtime validation but discards the leading editable JSONC direction and duplicate-preserving syntax layer.
- **Build a JSONC parser or schema library.** Rejected because parser correctness and schema tooling are not the product core and the selected narrow dependencies have replaceable boundaries.
- **Adopt dependency version ranges.** Rejected for the current experiment because unreviewed releases would change runtime and supply-chain behavior without changing repository source.

## Evidence

- [Parser and schema dependency security](../evidence/parser-schema-dependency-security.md)
- [Private project document contract](../development/private-project-document-contract.md)
- [Private project-resolution evidence](../evidence/private-domain-project-resolution.md)
- Automated coverage in `test/interface/private-domain-project-document.test.ts`
- JSON Schema snapshot in `test/fixtures/project/private-domain-project-intent.schema.json`
- [OSV API documentation](https://google.github.io/osv.dev/api/)
- [Zod CVE-2023-4316 advisory](https://github.com/advisories/GHSA-m95q-7qp3-xv42)
- [npm audit and signature documentation](https://docs.npmjs.com/cli/audit/)

## Security and disclosure considerations

Known-vulnerability, signature, and provenance checks are snapshot evidence rather than permanent guarantees. Exact integrity and signatures do not prove source correctness or exclude malicious-but-valid publication.

The accepted boundary limits denial-of-service exposure, rejects ambiguity, avoids naive prototype mutation, disables unnecessary runtime code generation, and runs semantic resolution after structural validation. It does not isolate parsing into another process or prove a worst-case time bound.

No configuration content, local path, credential, prompt, transcript, or private discussion is retained in dependency evidence.

## Revisit triggers

- A relevant CVE, GHSA, malicious publication, invalid signature, or upstream ownership incident appears.
- Either dependency adds runtime dependencies or install lifecycle scripts.
- A selected version loses registry availability or license compatibility.
- Real configuration requires unsupported JSONC semantics or exceeds the private resource limits.
- JSON Schema output cannot represent an accepted project configuration without custom or transforming schema behavior.
- Published package measurements show unacceptable size or startup cost.
- A smaller maintained alternative provides materially stronger security or diagnostics.

## Supersedes

None.
