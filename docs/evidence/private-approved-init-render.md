# Private approved-init render evidence

Snapshot date: 2026-07-20.

## Verdict

**Pass for the internal exact approval bridge.** A complete private init proposal can be bound to an explicit caller approval, revalidated against current bytes, converted into the existing renderer plan, retained before mutation, and executed through the existing private render command without a general overwrite path.

This result does not qualify a public initialization command, approval file, configuration file, lock location, or interactive workflow.

## Reproduction

Implementation:

- `src/commands/private-approved-init-render-service.ts`;
- `src/renderer/contract.ts`;
- `src/renderer/from-compilation.ts`;
- `src/renderer/staged-adapter.ts`.

Automated coverage:

- `test/commands/private-approved-init-render-service.test.ts`;
- `test/renderer/staged-adapter.test.ts`;
- `test/renderer/from-compilation.test.ts`.

Run:

```bash
npm run build
node --test dist/test/commands/private-approved-init-render-service.test.js dist/test/renderer/staged-adapter.test.js dist/test/renderer/from-compilation.test.js
npm run check
npm run check:v1-qualification
```

## Observed behavior

Focused tests demonstrate:

- one approved plan containing a missing Cursor target, exact Claude Code adoption, and lossless Codex import;
- exact proposal, approval, observed, target, source-reference, and plan binding;
- stale observation rejection before planning;
- changed approval rejection before planning;
- independent analyzer re-execution rejecting an asserted but false lossless assessment;
- exact observed-to-target renderer authorization and stale-authorization diagnostics;
- prepared-package tamper rejection before mutation;
- resumption from the retained prepared snapshot after outputs change but before lock publication;
- target lock publication through the existing private render command.

The focused bridge and renderer suite passes 18 tests with zero failures and zero skips. The selected V1 qualification suite passes 154 tests across 22 selected test files with zero failures and zero skips. The complete stronger suite passes 253 tests with zero failures and zero skips. The repository audit checks 149 text files successfully.

## Limitations

The approval helper records a caller assertion; it is not an identity or authorization system. The bridge accepts only the current project-instructions capability and only lossless imports recognized by the narrow analyzer.

Preparation and execution are separate so the exact snapshot can be retained before mutation. The prepared package remains a private in-memory candidate; no storage path, serialization compatibility, or migration promise is made.

## Recommendation

Use this bridge as the only initialization route into the private render command. Next qualify the added path in the hosted OS and Node.js matrix, then evaluate the public configuration and CLI representation with the existing private semantics as constraints rather than freezing the current internal shapes.
