# Private project document contract

## Status

This contract is a private parser, schema, and pure edit experiment around the bounded domain project intent. It does not select a public configuration filename, discovery rule, schema version, compatibility promise, migration behavior, or arbitrary workflow representation.

The implementation is in `src/interface/private-domain-project-document.ts`. Dependency and security evidence is in [parser and schema dependency security](../evidence/parser-schema-dependency-security.md).

## Dependency boundary

The repository uses exact runtime versions:

- `jsonc-parser` 3.3.1 for JSONC scanning, syntax trees, locations, and edits;
- Zod 4.4.3 for closed runtime schemas and Draft 2020-12 JSON Schema generation.

Only `src/interface/private-domain-project-document.ts` may import `jsonc-parser`. Only `src/interface/private-zod.ts` may import Zod. The repository audit checks these boundaries.

The Zod wrapper sets `jitless: true` before any schema construction. Configuration validation does not need runtime code generation.

## Parse sequence

The private parse boundary performs these checks in order:

1. require a caller-supplied string;
2. reject content above 262,144 UTF-8 bytes by default;
3. scan iteratively and reject nesting beyond 32 object or array levels by default;
4. build a JSONC syntax tree with comments and trailing commas enabled;
5. reject every syntax error instead of accepting a fault-tolerant partial result;
6. reject duplicate property names before object conversion;
7. reject every `__proto__` property before schema validation;
8. convert the bounded syntax tree through `getNodeValue`, which uses null-prototype intermediate objects;
9. validate the complete value through a strict Zod schema;
10. cap returned diagnostics at 64 by default and report omitted diagnostics explicitly.

Limits are private caller options and must be positive safe integers. They are denial-of-service controls, not public compatibility promises.

## Schema boundary

The current schema accepts exactly the fields needed by the private project resolver:

- revision `1`;
- Fast, Balanced, or recognized-but-semantically-unavailable Strict preset selection;
- up to 32 provider instances from the initial validation set;
- exact Steward, Developer, and Reviewer provider references;
- one of GitHub Issues, Linear, local, or no tracker;
- the bounded issue-to-reviewed-pull-request or local reviewed-change workflow family;
- up to 64 logical capability bindings with closed target variants.

Objects are strict. Identifiers and collections have explicit bounds. The schema uses only JSON-Schema-representable constructs. `z.toJSONSchema()` runs with Draft 2020-12, unrepresentable constructs set to throw, cycles set to throw, and reused schemas inlined. The committed private snapshot is `test/fixtures/project/private-domain-project-intent.schema.json`.

Cross-field and workflow semantics remain in the project resolver. A structurally valid document can still fail for an incompatible tracker, unknown provider reference, missing capability binding, insufficient capability observation, or unsafe workflow.

Strict is deliberately present in the structural schema so project resolution can return a precise `PRESET_UNAVAILABLE` diagnostic. Schema acceptance does not imply that a preset is executable.

## Pure edit boundary

The experimental editor accepts one bounded path and a set or array-insert operation. It:

- parses and validates the current content first;
- rejects empty, excessive, unsafe, or invalid path segments;
- computes edits with two-space indentation and LF line endings;
- applies edits only in memory;
- parses and validates the complete resulting document;
- returns before and after content digests with the exact edit list.

An invalid result returns diagnostics and no edited content. This function does not authorize a filesystem write, preserve every possible user formatting choice, or define a public editing API.

## Diagnostics

The current private diagnostic groups cover:

- content size and nesting limits;
- JSONC syntax errors with offsets and lengths;
- duplicate and unsafe property names;
- strict schema failures;
- invalid pure edit requests;
- downstream project-resolution failures;
- bounded diagnostic output.

Diagnostics are deterministic for identical bytes and options. Their codes and wording are not public contracts.

## Security and enforcement non-claims

- Known-vulnerability scans cannot detect unpublished vulnerabilities or malicious-but-unreported releases.
- Package integrity and registry signatures detect mismatched bytes; they do not prove source correctness.
- Local configuration input can still consume resources within the accepted byte, depth, collection, and diagnostic limits.
- Runtime schema validity does not prove provider identity, external capability truth, reviewer independence, or policy satisfaction.
- The parser and editor perform no filesystem, network, process, credential, provider, tracker, or repository mutation.
- Public file-size policy, schema URI, editor behavior, and migrations remain open.

## Application planning consumer

The private application planner consumes these bounded bytes without selecting a public filename. It uses only native local project-instructions capability observations, reads a caller-path canonical lock through a read-only repository interface, and produces an exact private plan snapshot. It does not accept precompiled private values from a user. Workflows requiring unavailable external adapters remain resolution failures rather than silently receiving fixture capabilities.

The private non-interactive init entry emits two-space-indented strict JSON with one final LF from the resolved revision-1 local intent and creates only an absent caller-selected relative path. These generated bytes are accepted by this parser, but their formatting, flag projection, path, and schema revision remain private specimens rather than public compatibility promises.

## Change boundary

Do not import either dependency outside its checked boundary. Any dependency version change requires renewed advisory, integrity, signature, lifecycle-script, package-content, JSON Schema snapshot, focused test, and complete repository review.
