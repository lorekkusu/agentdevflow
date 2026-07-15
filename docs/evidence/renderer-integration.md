# Phase 1: renderer integration evidence

Snapshot date: 2026-07-16.

## Verdict

**Pass for the first roadmap step 3 slice; renderer integration hardening remains in progress.** Private compiler output now retains normalized provider instances and converts into the existing backend-neutral render request without reopening candidate input or importing renderer types into the compiler and policy modules.

The bridge requires a digest of the materialized renderer input. It does not claim that compiler semantics alone identify generated source content. Incomplete capability evidence, malformed digests, unsafe source paths, and duplicate normalized source paths fail before a backend starts.

No Rulesync runtime dependency, public configuration contract, public workflow DSL, lock format, or production CLI is introduced.

## Reproduction

The implementation is in:

- `src/compiler/private-model.ts`;
- `src/compiler/compile-candidate.ts`;
- `src/renderer/from-compilation.ts`.

Automated coverage is in `test/renderer/from-compilation.test.ts`.

Run:

```bash
npm install
npm run check
```

## Boundary

The private workflow IR now carries the normalized provider instances that were part of candidate intent. This avoids passing the original candidate object beside the compilation or resolving provider products from role names.

The renderer bridge performs these deterministic operations:

1. verify that every workflow capability requirement has one resolution for every provider instance;
2. map private `project-instructions` capability evidence to the renderer contract's `rules` capability at the boundary;
3. deduplicate and sort provider products, so multiple instances of one product remain one render target;
4. normalize and sort materialized source paths;
5. combine compiler digest, materialized-input digest, and normalized source paths into the render input digest;
6. carry ownership and explicit adoption paths without granting write authority.

The materialized-input digest must be lowercase SHA-256. It represents the content supplied to the staging backend. Source path names alone are not treated as content provenance.

## Captured results

The Balanced specimen produces these renderer targets:

```text
claude-code
codex
cursor
```

Its resolved private `project-instructions` requirement maps to the renderer `rules` capability. With materialized source paths `rules/review.md` and `rules/workflow.md`, the deterministic render input digest is:

```text
8602d77a95295d20e9d4f43e8c13d4991b02165cd02a68766528306f039f78ee
```

Reordered candidate providers, candidate artifacts, materialized source paths, ownership entries, and adoption paths produce a deeply equal request.

A replaceable fixture staging backend receives the request and creates a safe deterministic plan for `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/agentdevflow.mdc`. Each planned output retains the two supplied source paths.

## Failure results

| Condition | Result |
| --- | --- |
| Missing per-provider capability resolution | Reject before backend invocation |
| Non-SHA-256 materialized-input digest | Reject before backend invocation |
| Empty materialized source set | Reject before backend invocation |
| Absolute or parent-traversing source path | Reject before backend invocation |
| Duplicate source path after separator normalization | Reject before backend invocation |

## Limitations

- The bridge is private and is not a stable user API.
- The compiler does not yet materialize renderer source content. The caller must supply its digest and paths.
- The current renderer contract uses `rules` as its instruction capability. Only the renderer boundary maps the compiler's provider-neutral name to it.
- The fixture staging backend proves replaceability and request propagation, not Rulesync output compatibility.
- The existing Rulesync staging process still reports missing source mapping unless the backend can establish it.
- There is no offline production dependency, isolated worker, lock state, transactional filesystem, or public ownership format.

## Next experiment

Define a deterministic private materialization from compiled workflow and policy intent to renderer source content. Then evaluate pinned Rulesync as an exact offline runtime dependency in an isolated process, capture package and dependency observations, and compare golden output for the initial three providers.

Adding Rulesync as a production dependency remains a material dependency decision and requires explicit approval after the experiment evidence is available.
