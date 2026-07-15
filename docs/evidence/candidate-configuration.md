# Phase 1: candidate configuration evidence

Snapshot date: 2026-07-16.

## Verdict

**Pass for roadmap step 1.** Fixture-only Fast and Balanced candidate configurations normalize deterministically, reject unknown or invalid intent with stable path-specific diagnostics, and cover the initial provider products, provider-neutral roles, local or no-tracker operation, review separation requirements, and finite review artifact types.

This result does not accept a public `ProjectConfig`, serialized syntax, filename, schema library, CLI framework, or lock format. The specimens exist to discover those contracts before any of them are frozen.

## Reproduction

The candidate model is in `src/config/candidate.ts`, normalization is in `src/config/normalize-candidate.ts`, specimens are in `test/fixtures/config/specimens.ts`, and automated tests are in `test/config/normalize-candidate.test.ts`.

Run:

```bash
npm install
npm run check
npm run phase1:config
```

The harness prints the normalized specimen and digest without reading or writing a project configuration file.

## Specimens

| Specimen | Roles and providers | Tracker | Review intent |
| --- | --- | --- | --- |
| Fast | Steward, Developer, and Reviewer share one Codex CLI provider instance. | None | Review is required before merge, but the reviewer may share the Developer provider instance. |
| Balanced | Developer uses Codex CLI, Reviewer uses Claude Code CLI, and Steward uses Cursor IDE. | Local | Review is required before merge and Reviewer must use a distinct provider instance from Developer. |

Distinct provider instances are only a structural separation check. They do not prove independent identity, credentials, execution context, judgment, or producer authenticity.

## Candidate normalization boundary

The experimental input contains:

- fixture schema version `0`;
- Fast or Balanced preset intent;
- named provider instances with product and surface;
- provider-neutral role bindings;
- local or no-tracker mode;
- whether review is required before merge;
- whether Reviewer and Developer must use distinct provider instances;
- the finite `ReviewVerdict` and `BlockingFinding` artifact types.

Normalization:

- accepts `unknown` rather than trusting TypeScript types;
- rejects unknown fields;
- validates required fields, primitive types, closed values, and provider identifiers;
- rejects duplicate provider ids and artifact types;
- rejects role references to undeclared provider instances;
- enforces the selected provider-instance separation;
- requires `ReviewVerdict` when review is required before merge;
- sorts provider instances and artifact types;
- serializes object keys canonically;
- calculates a SHA-256 digest over only the normalized candidate model;
- returns diagnostics sorted by explicit code-unit comparison rather than locale-dependent comparison.

The normalized result contains no timestamp, host data, absolute path, backend type, rendered path, ownership claim, or digest field inside the digested model.

## Captured results

| Specimen | SHA-256 normalized digest |
| --- | --- |
| Balanced | `3e37b935270c34b4e412183203c1a5873b2eeb5a080ee81fa24caebaeb604068` |
| Fast | `81a59c0f4e09645c3c80875374017304dc263caac48002d10d20a2aefd46c8fd` |

Reversing the Balanced provider and artifact arrays produced the same normalized model, canonical JSON, and digest.

The executable checks cover:

- both valid specimens;
- the three initial provider products;
- input reordering;
- exact digest snapshots;
- unknown fields and unsupported fixture schema versions;
- duplicate provider ids and artifact types;
- missing role bindings;
- invalid tracker and preset values;
- unknown provider references;
- missing `ReviewVerdict` intent;
- required provider-instance separation;
- input non-mutation;
- JSON-compatible canonical output.

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Identical or reorder-equivalent input has an identical normalized digest | Pass | Automated normalization, reorder, and digest-snapshot tests. |
| Invalid input has deterministic path-specific diagnostics | Pass | Diagnostics use stable paths, codes, messages, and code-unit ordering. |
| Fast and Balanced intent is materially distinct | Pass for candidate specimens | Provider bindings, tracker mode, review separation, and artifact declarations differ. Preset workflow expansion is not yet implemented. |
| Initial provider and role set is represented without binding a role to a product | Pass | Role references target named provider instances, not hard-coded provider brands. |
| Public API and syntax remain unfrozen | Pass | The input is TypeScript fixture data, schema version `0`, and the package remains private with no exports or discovery behavior. |

## Limitations

- The manual validator is experiment scaffolding, not a recommended production schema implementation.
- The fixture shape is not a public API and has no compatibility promise.
- There is no parser, configuration filename, filesystem discovery, CLI, or migration behavior.
- Presets are labels only; they do not yet expand into versioned private workflow definitions.
- Provider version, execution context, principal, supported capabilities, and enforcement availability belong to later resolution work and are not represented here.
- Review artifact types are finite names. Their schemas, revisions, digests, producers, validity rules, and semantic truth are not established by this model.
- Distinct provider instances do not establish Reviewer independence.
- No policy workflow, render request, lock state, ownership state, or provider file is produced.

## Next recommendation

Proceed to the private compiler slice. Define versioned built-in Fast and Balanced workflow definitions, compile them into private finite `WorkflowIR`, translate candidate review intent into the closed safety policies, and enforce an explicit state-space budget.

Do not accept Zod, JSONC, public filenames, or a stable `ProjectConfig` until the compiler slice shows which diagnostics, defaults, versioning behavior, and source locations are actually required.
