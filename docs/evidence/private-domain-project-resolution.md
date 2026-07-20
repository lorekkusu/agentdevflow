# Private domain project resolution evidence

Snapshot date: 2026-07-20.

## Verdict

**Pass for bounded private project-intent resolution.** One deterministic resolver selects either the issue-to-reviewed-pull-request family or the local reviewed-change family, compiles the exact provider-neutral manifest, resolves responsibilities to provider instances, and binds logical capabilities to responsibilities, a tracker, or opaque external targets.

This result does not accept a public configuration API, filename, serialized syntax, adapter selection protocol, tracker runtime, trusted identity, scheduler, or external mutation. Follow-on parser and preset experiments remain private and do not change that boundary.

## Reproduction

Implementation:

- `src/project/private-domain-project-resolution.ts`;
- `src/project/private-domain-preset.ts`;
- `src/execution/private-execution-contract.ts`;
- `src/workflows/private-issue-to-reviewed-pull-request.ts`;
- `src/workflows/private-local-reviewed-change.ts`.

Fixtures and tests:

- `test/fixtures/project/run.ts`;
- `test/project/private-domain-project-resolution.test.ts`.

Run:

```bash
npm run build
node --test dist/test/project/private-domain-project-resolution.test.js
npm run phase1:project-resolution
npm run check
```

## Captured resolutions

| Specimen | Preset | Workflow | Tracker | Providers | Capability targets | Intent digest | Manifest digest | Resolution digest |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| Codex Steward, Cursor Developer, Codex Reviewer, immediately ready pull request | Balanced | Issue to reviewed pull request | Linear | 3 | 5 | `357ecc241a3425850292b4fc82a35ed58135cfbd71ca9e73aec61c90bec73ec0` | `6aa91b3d335ad702ea295f4d76b74ec220d0b496810177d5d72562e22c9eba4b` | `d2b5fc7fcced4e7b939c5e42d4a014b8a534a64ba14aa39c7326e504fc5247d4` |
| Claude Code Steward, Cursor Developer, Claude Code Reviewer, draft pull request with auxiliary review | Balanced | Issue to reviewed pull request | GitHub Issues | 3 | 6 | `a34015fde0c28aa4216b0dda56425372c3e29337adbe1078e795782842c8d54d` | `fde8b773d6a5092c76e6c48c906fb997e2b2b70808a33701b4fd2c4623605207` | `d08fa3ca4a09c9456a8c871285f0efa854aa4924e0fa598e5ec30018d687d2ed` |
| Local reviewed change | Balanced | Local reviewed change | None | 2 | 2 | `11f003842dd6fea04bd83ebc84e4b816685f814d2a604a6e973b6819018693f4` | `ed49af2f33c46e1952aefd26a78be3f3d17ca004beb4642630ad9af3fbdd6836` | `02673c64a00927fc237221b2ce171d8e253da57865940375abaddf19f2eab9fd` |

Preset-expanded manifests intentionally bind the effective preset definition identity. The Balanced local manifest also adds its declared finding and reviewer-isolation policies. Provider and tracker products remain absent from manifest bytes.

## Observations

| Fixture | Result |
| --- | --- |
| Codex, Cursor, Linear, and immediately ready pull request | Accepted with five exact capability targets and an 11-step manifest |
| Claude Code, Cursor, GitHub Issues, draft pull request, and auxiliary review | Accepted with six exact capability targets and a 14-step manifest |
| Local no-tracker reviewed change | Accepted with only Developer and Reviewer capability targets and a four-step manifest |
| Reordered providers, logical bindings, and capability observations | Produced identical normalized intent, manifest, and project-resolution bytes and digests |
| Reviewer provider binding changed without changing workflow behavior | Project-resolution digest changed; manifest digest remained identical |
| Responsibility references unknown provider | Rejected |
| Duplicate provider or logical binding | Rejected |
| Local tracker used with issue workflow | Rejected |
| Hosted tracker used with local workflow | Rejected |
| Required logical binding missing or unused binding supplied | Rejected |
| Developer capability routed to Reviewer responsibility | Rejected |
| CI capability routed to a responsibility instead of an external target | Rejected |
| Required CI capability observation absent | Downstream workflow compilation failure retained; no resolution returned |
| Strict preset | Rejected with `PRESET_UNAVAILABLE` before manifest compilation |
| Legacy local-only configuration asked to select an issue workflow | Rejected instead of inventing hosted tracker intent |

The focused project-resolution suite passed 13 tests with zero failures or skips. At this evidence snapshot, the complete repository check passed the publication audit over 198 text files, TypeScript type checking, and 355 tests with zero failures or skips.

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Workflow-family selection | Pass | Issue-to-pull-request and local workflows resolve through one project boundary. |
| Draft and ready pull-request selection | Pass | Bounded choice selects different exact workflow definitions and manifests. |
| Optional auxiliary review | Pass | Enabled mode adds only the declared stage and logical target. |
| Provider-neutral compiler | Pass | Provider and tracker products remain outside manifest topology and policy. |
| Exact capability routing | Pass for bounded private bindings | Every declared logical binding has one validated target and one compiler capability observation. |
| Material binding identity | Pass | Intent and project-resolution digests change when a provider binding changes. |
| No-pull-request coverage | Pass | Local workflow requires no issue, pull-request, CI, or merge placeholders. |
| Untrusted input validation | Excluded | The current input is a typed in-memory specimen. |
| Runtime execution | Excluded | Resolution performs no adapter invocation or external mutation. |
| Public compatibility | Fail by design | Revisions, types, diagnostics, syntax, filenames, and migrations are private candidates. |

## Limitations

- The binding-to-target rule is a closed mapping for the two current built-in workflow families, not a plugin contract.
- Provider instances do not yet include versions, credentials, principals, or execution-context selection.
- The same provider instance may fill multiple responsibilities; reviewer independence is validated from execution observations rather than inferred from product names.
- External target identifiers are opaque and are not checked against an adapter registry.
- Capability observations are supplied separately and are not authenticated.
- Fast and Balanced are private executable profiles. Strict remains unavailable, and Custom remains deferred.
- The older Fast and Balanced candidate specimens converge only through an explicit private bridge; this is not a public migration contract.
- Reviewer-isolation payloads are structurally validated and checked for consistency with active change-producer and review envelopes, but the supplied identities and fresh-context observations are not authenticated.

## Recommendation

Retain project resolution as a distinct layer outside the provider-neutral execution manifest. Preserve both workflow families as mandatory regression fixtures.

The follow-on [private project document experiment](../development/private-project-document-contract.md) integrates bounded JSONC parsing and runtime schema validation without selecting a public filename. [ADR 0003](../decisions/0003-private-jsonc-zod-boundary.md) accepts the exact private dependency boundary. [Private preset expansion](private-preset-expansion.md) reconciles Fast and Balanced and rejects Strict honestly, the [private execution contract](private-execution-contract.md) validates closed typed evidence payloads, and [private execution transport](private-execution-transport.md) preserves them across strict canonical bytes. The current [roadmap](../development/roadmap.md) prioritizes connecting this intent to renderer planning and executable local commands before further acquisition, persistence, or versioning work.
