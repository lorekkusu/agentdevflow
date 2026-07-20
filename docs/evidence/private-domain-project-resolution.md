# Private domain project resolution evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for bounded private project-intent resolution, renderer convergence, and local exact planning.** One deterministic resolver selects either workflow family and produces the authoritative provider-neutral compilation. The local application path now combines revision-1 bytes, native project-instructions capabilities, canonical lock bytes, and repository observations into an exact plan without an execution manifest or caller-supplied private intermediate values.

This result does not accept a public configuration API, filename, serialized syntax, adapter selection protocol, tracker runtime, trusted identity, scheduler, or external mutation. Follow-on parser and preset experiments remain private and do not change that boundary.

## Reproduction

Implementation:

- `src/project/private-domain-project-resolution.ts`;
- `src/project/private-domain-preset.ts`;
- `src/application/private-domain-project-plan.ts`;
- `src/renderer/materialize-domain-project.ts`;
- `src/renderer/from-compilation.ts`;
- `src/execution/private-execution-contract.ts`;
- `src/workflows/private-issue-to-reviewed-pull-request.ts`;
- `src/workflows/private-local-reviewed-change.ts`.

Fixtures and tests:

- `test/fixtures/project/run.ts`;
- `test/project/private-domain-project-resolution.test.ts`;
- `test/application/private-domain-project-plan.test.ts`;
- `test/renderer/materialize-domain-project.test.ts`.

Run:

```bash
npm run build
node --test dist/test/project/private-domain-project-resolution.test.js
node --test dist/test/renderer/materialize-domain-project.test.js
node --test dist/test/application/private-domain-project-plan.test.js
npm run phase1:project-resolution
npm run check
```

## Captured resolutions

| Specimen | Preset | Workflow | Tracker | Providers | Capability targets | Intent digest | Workflow compilation digest | Resolution digest |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| Codex Steward, Cursor Developer, Codex Reviewer, immediately ready pull request | Balanced | Issue to reviewed pull request | Linear | 3 | 5 | `357ecc241a3425850292b4fc82a35ed58135cfbd71ca9e73aec61c90bec73ec0` | `9e1269ca0ff5b9f94c6c280bbcab252022481b5b3316608f3a83a0c56583100e` | `d813821ead25477482bb14d9c3d0a3f83a788ae152be1081cf0e67cff982d517` |
| Claude Code Steward, Cursor Developer, Claude Code Reviewer, draft pull request with auxiliary review | Balanced | Issue to reviewed pull request | GitHub Issues | 3 | 6 | `a34015fde0c28aa4216b0dda56425372c3e29337adbe1078e795782842c8d54d` | `13214973ead76d272372e814ce54b2282f6d9c92c41fe76b9ac910c9f32b9619` | `5e0a1eb3e642808a120f572cff222d543bd1b34624727b3f8fbb094ddbb27ee6` |
| Local reviewed change | Balanced | Local reviewed change | None | 2 | 2 | `11f003842dd6fea04bd83ebc84e4b816685f814d2a604a6e973b6819018693f4` | `2644d491a0708919931bd66bf97385119c5512355f280752f78d08f9126bdaeb` | `832e72b9afa3617d5d55be7c4863d30a09dd593ec84afe1c11904850bedef217` |

Preset-expanded workflow compilations bind the effective preset definition identity. Provider and tracker products remain outside compilation bytes. The renderer consumes project bindings and the same compilation, while optional manifest export consumes only the compilation.

## Observations

| Fixture | Result |
| --- | --- |
| Codex, Cursor, Linear, and immediately ready pull request | Accepted with five exact capability targets and an 11-transition compilation |
| Claude Code, Cursor, GitHub Issues, draft pull request, and auxiliary review | Accepted with six exact capability targets and a 14-transition compilation |
| Local no-tracker reviewed change | Accepted with only Developer and Reviewer capability targets and a four-transition compilation |
| Reordered providers, logical bindings, and capability observations | Produced identical normalized intent, workflow compilation, project resolution, and renderer materialization |
| Reviewer provider binding changed without changing workflow behavior | Project-resolution digest changed; workflow-compilation digest remained identical |
| Revision-1 document through renderer staging | Produced deterministic Codex, Claude Code, and Cursor project-instructions requests without a manifest |
| Local revision-1 bytes, absent lock, and empty repository | Produced an identical safe three-file create plan on repeated read-only preparation |
| Local exact plan through existing command services | Check and diff reported changes, render converged, and repeated planning, check, and diff reported clean |
| Foreign `AGENTS.md` | Retained exact foreign bytes and produced a blocked ownership conflict |
| Canonical lock at the caller path | Parsed internally and produced an exact no-op plan without a caller-supplied lock object |
| Issue-to-reviewed-pull-request application planning | Failed with unavailable-capability diagnostics rather than treating fixture observations as installed adapters |
| Responsibility references unknown provider | Rejected |
| Duplicate provider or logical binding | Rejected |
| Local tracker used with issue workflow | Rejected |
| Hosted tracker used with local workflow | Rejected |
| Required logical binding missing or unused binding supplied | Rejected |
| Developer capability routed to Reviewer responsibility | Rejected |
| CI capability routed to a responsibility instead of an external target | Rejected |
| Required CI capability observation absent | Downstream workflow compilation failure retained; no resolution returned |
| Strict preset | Rejected with `PRESET_UNAVAILABLE` before workflow compilation |
| Legacy local-only configuration asked to select an issue workflow | Rejected instead of inventing hosted tracker intent |

The focused project-resolution suite passed 13 tests, the revision-1 renderer-convergence suite passed four tests, and the local exact-planning suite passed six tests, all with zero failures or skips. At this evidence snapshot, the complete repository check passed the publication audit over 205 text files, TypeScript type checking, the build, and 368 tests with zero failures, skips, or todos.

## Criteria

| Criterion | Result | Basis |
| --- | --- | --- |
| Workflow-family selection | Pass | Issue-to-pull-request and local workflows resolve through one project boundary. |
| Draft and ready pull-request selection | Pass | Bounded choice selects different exact workflow definitions and compilations. |
| Optional auxiliary review | Pass | Enabled mode adds only the declared stage and logical target. |
| Provider-neutral compiler | Pass | Provider and tracker products remain outside workflow topology and policy. |
| Optional manifest export | Pass | Project resolution has no execution dependency; export consumes the accepted workflow compilation. |
| Renderer convergence | Pass as a private bridge | Configuration bytes reach exact project-instructions materialization and the native staging boundary without caller-supplied compiler or manifest values. |
| Exact local planning | Pass as a private bridge | Configuration, canonical lock, and repository bytes determine one exact snapshot through a read-only workspace. |
| Caller private-value removal | Pass for planning | The caller supplies bytes, lock path, and workspace rather than compiler output, materialization, manifest, lock object, request, plan, or snapshot. |
| Exact capability routing | Pass for bounded private bindings | Every declared logical binding has one validated target and one compiler capability observation. |
| Material binding identity | Pass | Intent and project-resolution digests change when a provider binding changes. |
| No-pull-request coverage | Pass | Local workflow requires no issue, pull-request, CI, or merge placeholders. |
| Untrusted input validation | Pass for the private bridge | Bounded JSONC parsing, strict runtime schema validation, semantic resolution, and canonical bounded lock parsing precede planning. |
| Runtime execution | Excluded | Resolution performs no adapter invocation or external mutation. |
| Public compatibility | Fail by design | Revisions, types, diagnostics, syntax, filenames, and migrations are private candidates. |

## Limitations

- The binding-to-target rule is a closed mapping for the two current built-in workflow families, not a plugin contract.
- Provider instances do not yet include versions, credentials, principals, or execution-context selection.
- The same provider instance may fill multiple responsibilities; reviewer independence is validated from execution observations rather than inferred from product names.
- External target identifiers are opaque and are not checked against an adapter registry.
- Standalone resolver fixtures accept separate unauthenticated capability observations. The application planner derives only local native project-instructions observations and rejects workflows needing unavailable external adapters.
- Fast and Balanced are private executable profiles. Strict remains unavailable, and Custom remains deferred.
- The older Fast and Balanced candidate specimens converge only through an explicit private bridge; this is not a public migration contract.
- Reviewer-isolation payloads are structurally validated and checked for consistency with active change-producer and review envelopes, but the supplied identities and fresh-context observations are not authenticated.

## Recommendation

Retain revision-1 resolution, compilation, and local exact planning as the active private forward model. Preserve both workflow families as regression fixtures, but do not promote fixture capability observations into application availability. Keep execution manifest export optional and downstream.

The [private project document experiment](../development/private-project-document-contract.md) supplies bounded JSONC and runtime schema validation without selecting a public filename. [ADR 0003](../decisions/0003-private-jsonc-zod-boundary.md) accepts the dependency boundary. The current [roadmap](../development/roadmap.md) now prioritizes a user-level read-only `check` and `diff` entry point over further acquisition, persistence, or versioning work.
