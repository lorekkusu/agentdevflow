# Parser and schema dependency security evidence

Snapshot date: 2026-07-20.

## Verdict

**Accept with bounded use and exact pins.** `jsonc-parser` 3.3.1 and Zod 4.4.3 have no known vulnerability affecting the selected versions in the queried OSV and npm advisory data. The complete installed dependency audit reported zero known vulnerabilities at every severity. Both packages have zero runtime dependencies and no install lifecycle script.

This is not a claim that either package is vulnerability-free. The accepted boundary adds input-size, nesting, collection, diagnostic, duplicate-key, unsafe-property, strict-schema, and Zod code-generation controls because unknown implementation flaws and resource-exhaustion behavior remain possible.

## Selected packages

| Package | Version | License | Runtime dependencies | Lockfile integrity |
| --- | --- | --- | ---: | --- |
| `jsonc-parser` | 3.3.1 | MIT | 0 | `sha512-HUgH65KyejrUFPvHFPbqOY0rsFip3Bo5wb4ngvdi1EpCYWUQDC5V+Y7mZws+DLkr4M//zQJoanu1SP+87Dv1oQ==` |
| `zod` | 4.4.3 | MIT | 0 | `sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==` |

Both versions are exact in `package.json` and content-addressed in `package-lock.json`. Installation used `--ignore-scripts`. Package manifests contain development or publication scripts but no `preinstall`, `install`, or `postinstall` entry.

## Known-vulnerability checks

The following exact OSV queries returned an empty JSON object:

```bash
curl -sS -X POST https://api.osv.dev/v1/query \
  -H 'Content-Type: application/json' \
  -d '{"package":{"name":"jsonc-parser","ecosystem":"npm"},"version":"3.3.1"}'

curl -sS -X POST https://api.osv.dev/v1/query \
  -H 'Content-Type: application/json' \
  -d '{"package":{"name":"zod","ecosystem":"npm"},"version":"4.4.3"}'
```

OSV documents package-and-version queries through `POST /v1/query` and aggregates multiple vulnerability databases, including GitHub advisories. See the [OSV API documentation](https://google.github.io/osv.dev/api/) and [OSV data sources](https://google.github.io/osv.dev/data/).

GitHub Advisory Database contains `CVE-2023-4316` / `GHSA-m95q-7qp3-xv42` for Zod email validation. It is a moderate-severity regular-expression denial of service affecting Zod versions through 3.22.2 and patched in 3.22.3. Selected Zod 4.4.3 is outside the affected range. See the [GitHub reviewed advisory](https://github.com/advisories/GHSA-m95q-7qp3-xv42).

The complete lockfile audit reported:

| Severity | Count |
| --- | ---: |
| Info | 0 |
| Low | 0 |
| Moderate | 0 |
| High | 0 |
| Critical | 0 |

The audit covered 25 installed root, production, development, and optional dependency records. npm documents that audit submits the lockfile dependency description to the registry and returns known advisories; a zero result does not cover undisclosed flaws. See the [official npm audit documentation](https://docs.npmjs.com/cli/audit/).

## Integrity and provenance observations

`npm audit signatures` verified registry signatures for all six installed non-root package records. Zod 4.4.3 additionally supplied a verified npm publication attestation and SLSA provenance referring to its upstream release workflow and source commit. No invalid or missing registry signature was reported. `jsonc-parser` did not supply a provenance attestation in the observed result, so its assurance is limited to the verified registry signature, exact lock integrity, package review, and upstream ownership.

npm documents that signature audit verifies registry signatures and available provenance attestations. These establish registry-byte and stated-build provenance properties; they do not prove that source behavior is safe. See [npm audit signatures](https://docs.npmjs.com/cli/audit/#audit-signatures) and [package provenance](https://docs.npmjs.com/viewing-package-provenance/).

## Risk assessment

| Risk | Uncontrolled danger | Current judgment | Control |
| --- | --- | --- | --- |
| Known published CVE in selected versions | Dependency compromise or denial of service | Low at snapshot date | Exact OSV queries plus complete npm audit returned none. |
| Unbounded parser resource use | Local denial of service from very large or deeply nested input | Material without limits; low for the current local boundary | 256 KiB default byte cap, iterative 32-level depth preflight, bounded arrays, and 64-diagnostic cap. |
| Fault-tolerant partial parsing | Malformed input could be interpreted differently from displayed intent | High for policy configuration | Every syntax error fails; partial parse output is never accepted. |
| Duplicate keys | Different consumers may select different values | High for policy configuration | Syntax tree retains occurrences; every duplicate fails before object conversion. |
| Prototype-key handling | Naive object construction can change prototypes or silently drop intent | Moderate | Use null-prototype tree conversion, reject every `__proto__` property, and require strict schemas. |
| Zod runtime code generation | Dynamic `Function` use is unnecessary and complicates containment policy | Low but avoidable | Single checked wrapper sets `jitless: true` before schema creation. |
| Supply-chain publication compromise | A signed registry release could still contain malicious source | Residual low-to-moderate | Exact pins, lock integrity, registry signatures, Zod provenance, no install scripts, zero transitive runtime dependencies, and manual version-change review. |
| Schema-only trust | Structurally valid configuration could still be unsafe | High if treated as authorization | Existing project resolution and finite policy compilation remain mandatory after schema success. |

The highest-severity risks are ambiguity and semantic misuse rather than a currently published CVE. The implementation therefore fails closed before resolution and keeps schema validity separate from policy validity.

## Reproduction

```bash
npm install --ignore-scripts
npm audit --json
npm audit signatures
npm run build
node --test dist/test/interface/private-domain-project-document.test.js
node dist/test/fixtures/project/document-run.js
npm run check
```

Relevant implementation and fixtures:

- `src/interface/private-zod.ts`;
- `src/interface/private-domain-project-document.ts`;
- `test/interface/private-domain-project-document.test.ts`;
- `test/fixtures/project/private-domain-project-intent.schema.json`;
- `test/fixtures/project/document-run.ts`.

The focused parser, schema, and resolution suite covers bounded JSONC parsing,
closed-schema rejection including the removed provider surface field, explicit
auxiliary-review rejection, and Strict semantic rejection after structural
schema acceptance. The current private Draft 2020-12 schema digest is
`6d4af95d209c34a3e4626f0e1aae2234b51d161b68cc1c48fa75335b6a203ca6`.
Complete working-tree qualification is recorded separately in
[private package qualification](private-package-qualification.md).

## Limitations

- Advisory and signature results are time-sensitive snapshots.
- No fuzzing, coverage-guided testing, independent source audit, or formal complexity proof was performed.
- The byte and depth limits are conservative private defaults, not measured public service-level guarantees.
- The parser runs in the main process; it is not isolated by a worker, timeout, or operating-system sandbox.
- This local-first CLI does not currently accept configuration over a network, reducing but not eliminating denial-of-service relevance.
- JSON Schema emission proves representability, not compatibility or migration behavior.

## Recommendation

Retain both exact dependencies behind the current mechanically checked boundaries. Treat any version update as a security-sensitive change and repeat the advisory, audit, signature, lifecycle, package-content, schema-snapshot, and complete test review.

Do not expose the parser as a network service or remove the resource limits. If real repositories demonstrate legitimate configurations approaching a limit, adjust it through evidence rather than silently accepting unbounded input.
