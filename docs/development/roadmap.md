# Development roadmap

## Status

Phase 0 is complete with a Go recommendation. Candidate configuration specimens and deterministic normalization are also complete. The next objective is the private compiler slice that turns those specimens into versioned private workflows and closed safety policies.

This roadmap records outcomes, dependencies, scope, and exit criteria. It is not a release promise, staffing plan, or transcript of planning discussions.

## Development sequence

### 1. Candidate configuration specimens

Status: **Complete.** See [candidate configuration evidence](../evidence/candidate-configuration.md).

Scope:

- fixture-only candidate `ProjectConfig` objects;
- Fast and Balanced presets;
- provider-neutral Steward, Developer, and Reviewer bindings;
- Codex, Claude Code, and Cursor provider instances;
- local or no-tracker mode;
- finite typed artifacts and review requirements.

Exit criteria:

- identical input produces an identical normalized digest;
- invalid input produces deterministic path-specific diagnostics;
- no public filename, serialized format, or API is claimed as stable.

### 2. Private compiler slice

Status: **Next.**

Scope:

- preset resolution and versioning;
- private `WorkflowIR` construction;
- closed safety-policy compilation;
- capability requirements and degradation diagnostics;
- explicit state-space limits;
- deterministic compiler output.

Exit criteria:

- Fast and Balanced compile into materially distinct workflows;
- direct review bypass and stale evidence mutations fail;
- renderer and provider-specific types do not enter the policy core;
- the compiler plan is stable across repeated runs.

### 3. Renderer integration hardening

Scope:

- convert compiler output into backend-neutral render requests;
- retain Rulesync as an isolated staging backend candidate;
- validate rules for the initial three providers;
- establish an offline runtime dependency experiment;
- derive or report output-to-source traceability honestly;
- add upgrade and golden-output fixtures.

Exit criteria:

- no render requires a nested package download at runtime;
- unsupported required capabilities fail before the backend starts;
- staged output is byte-deterministic for all three providers;
- the backend remains replaceable without changing candidate user intent.

### 4. Lock, provenance, and transactional workspace

Scope:

- an internal, experimental lock model;
- ownership, content digests, source references, and resolved versions;
- artifact revision-consistency checks;
- a real filesystem workspace with path and symlink safety;
- transactional multi-file apply and failure recovery.

Exit criteria:

- a repeated render is a no-op;
- drift, ownership conflicts, deletions, and adoption are explicit;
- interruption cannot leave a partially updated artifact set and lock;
- volatile machine data and secrets never enter the lock.

### 5. Command services and thin CLI

Development order:

1. `check`;
2. `diff`;
3. `render`;
4. `doctor`;
5. `init`.

Command handlers must remain thin wrappers around testable services. Read-only commands precede mutating commands, and safe ownership behavior precedes existing-file initialization.

Exit criteria:

- stable structured diagnostics and candidate exit-code behavior;
- end-to-end tests in temporary repositories;
- `check` and `diff` never modify project state;
- `render` accepts only a verified, conflict-free plan.

### 6. Adoption and initialization

Scope:

- deterministic discovery of the initial provider files;
- explicit exact adoption, import proposal, or abort outcomes;
- complete information-loss diagnostics;
- reproducible non-interactive initialization before an interactive wizard.

Exit criteria:

- every existing path has one explicit outcome;
- no existing file is silently overwritten;
- the proposed configuration and all file changes are visible before apply;
- every interactive choice has a file or flag representation.

### 7. Procedures, trackers, and enforcement evidence

Scope:

- `plan-task`, `implement-task`, `review-change`, and `record-progress`;
- provider capability validation for each materialization;
- GitHub Issues, Linear, and local tracker descriptions without tracker runtimes;
- Fast and Balanced first; Strict only with sufficient enforcement evidence.

Exit criteria:

- provider capability differences remain visible;
- no prompt-only mechanism satisfies a stronger policy requirement;
- a second clean repository can reproduce the selected development flow.

### 8. V1 stabilization and release readiness

Scope:

- public `ProjectConfig` schema and configuration discovery;
- stable lock and migration contracts;
- a synthetic pre-V1 to V1 migration fixture;
- package contents, offline behavior, supported Node.js lines, and cross-platform tests;
- prerelease and trusted publication procedures.

Exit criteria:

- public inputs can be migrated without silent intent loss;
- package installation and core operation are reproducible;
- published artifacts include only intended runtime files;
- package publication is separately authorized.

## Candidate decisions

The following recommendations are candidates, not accepted public contracts:

| Decision | Current recommendation | Required evidence before acceptance |
| --- | --- | --- |
| Runtime schema | Zod 4 restricted to JSON-Schema-representable constructs | Candidate config fixtures, diagnostic quality, emitted schema snapshot, dependency review |
| Configuration parser | `jsonc-parser` | Comment-preserving edits, precise syntax locations, deterministic normalization |
| CLI parser | Node.js `parseArgs` without a third-party framework | Complete option matrix for the five candidate commands |
| Configuration format | JSONC with `agentdevflow.config.jsonc` as the candidate root filename | Discovery, migration, editor, and non-interactive round-trip fixtures |
| Lock format | Strict deterministic JSON with `agentdevflow.lock.json` as the candidate filename | Ownership, provenance, transaction, and migration fixtures |
| Rulesync distribution | Exact vetted runtime dependency used through an isolated worker | Offline package installation, dependency audit, package-size observation, golden renders |
| First release | Prerelease on a non-default npm tag before a stable `0.1.0` | Package tarball, clean-install, provenance, and release authorization |

Accepting a major dependency, public filename, schema, lock contract, or publication flow requires an explicit decision and the relevant evidence.

## Stop and pivot conditions

Stop or reconsider the plan when:

- the adapter wrapper begins to reproduce most of the renderer backend;
- provider-specific fields dominate candidate user configuration;
- output provenance cannot be made honest enough for safe review;
- realistic workflows exceed an explicit policy state budget;
- Strict policies can only be represented as prompt claims;
- transactional application cannot prevent partial repository updates;
- the policy compiler loses independent value beyond file generation.

## Roadmap maintenance

Update this file when an outcome, dependency, scope boundary, or exit criterion changes. Put accepted architecture decisions in `docs/decisions/`, current reversible tooling in `docs/development/tooling.md`, and reproducible observations in `docs/evidence/`. Do not append discussion minutes or private planning history.
