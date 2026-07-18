# Development roadmap

## Status

Phase 0, candidate configuration specimens, the private compiler slice, renderer integration hardening, the private lock and workspace slice, and the private `check`, `diff`, `render`, `doctor`, and non-interactive `init` proposal semantic services are complete. The next objective is a narrow project-instructions import analyzer that can produce real digest-bound assessments for the initial provider paths without freezing public configuration syntax.

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

Status: **Complete.** See [private compiler evidence](../evidence/private-compiler.md).

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

Status: **Complete.** See [renderer integration evidence](../evidence/renderer-integration.md) and [ADR 0001](../decisions/0001-native-project-instructions-renderer.md).

Scope:

- convert compiler output into backend-neutral render requests;
- retain Rulesync only as an external experimental oracle;
- validate rules for the initial three providers;
- evaluate the Rulesync runtime and dependency surface without adopting it;
- derive or report output-to-source traceability honestly;
- add upgrade and golden-output fixtures.

Completed:

- retain normalized provider instances in private compiler output;
- map provider-neutral compiler capability resolutions at the renderer boundary;
- bind the compiler digest to a caller-supplied materialized-input digest and normalized source paths;
- reject incomplete capability evidence and unsafe or duplicate source paths;
- prove that the resulting request crosses a replaceable staging backend without backend types entering compiler or policy modules.
- define the private compiler-output materialization that produces renderer source content;
- separate agent-facing instructions from machine provenance;
- evaluate pinned Rulesync 9.6.3 and 11.0.0 distributions and cross-version output;
- implement a minimal native renderer for Codex, Claude Code, and Cursor;
- capture six native Fast and Balanced golden outputs;
- reject unsupported capabilities and mismatched materializations before staging;
- carry exact source references into ownership-aware plans.

Exit criteria:

- no render requires a nested package download at runtime;
- unsupported required capabilities fail before the backend starts;
- staged output is byte-deterministic for all three providers;
- the backend remains replaceable without changing candidate user intent.

### 4. Lock, provenance, and transactional workspace

Status: **Complete.** [ADR 0002](../decisions/0002-v1-forward-convergent-render-apply.md) accepts staged digest-aware forward convergence as the V1 default. The private command service binds an exact plan snapshot, base-lock ownership, convergent apply, verification, and lock publication. The stronger write-ahead transaction remains non-default experimental evidence. See [private render command evidence](../evidence/private-render-command-service.md), [forward-convergent apply evidence](../evidence/private-convergent-apply.md), [recovery-strategy comparison](../evidence/workspace-recovery-strategy-comparison.md), and [private transaction evidence](../evidence/private-render-transaction.md).

Scope:

- an internal, experimental lock model;
- ownership, content digests, source references, and resolved versions;
- artifact revision-consistency checks;
- a real filesystem workspace with path and symlink safety;
- recoverable multi-file apply and failure recovery.

Completed in the first slice:

- define a private versioned lock without selecting a public filename or serialized format;
- bind compiler, source materialization, renderer, ownership, content digests, and source references;
- require matching applied-result and verification plan digests before lock creation;
- keep the lock stable across reordered intent and no-op rendering;
- reject volatile fields, unsafe paths, corrupted digests, and unexpected ownership claims;
- clear stale ownership for already-absent obsolete output.

Completed in the second slice:

- bind each planned path to its observed before digest and intended after digest;
- revalidate plan integrity, base ownership, target materialization, and target lock intent before transaction preparation;
- define deterministic `write`, `remove`, and `retain` operations without public storage paths;
- define a strict `prepared` to `committed` write-ahead sequence with a terminal `rolled-back` recovery branch;
- use the base and target lock digests as deterministic rollback and roll-forward anchors;
- fail closed on foreign locks, unrecognized path states, contradictory journals, and post-commit drift;
- exercise recovery decisions through fault injection without claiming filesystem durability.

Completed in the third slice:

- canonicalize an existing non-symlink repository root;
- reject unsafe, non-normalized, escaping, and control-character project paths;
- reject existing symbolic-link traversal, non-directory parents, and non-file leaves;
- open reads with final-leaf no-follow behavior;
- use exclusive same-directory temporary files, content synchronization, rename replacement, and failure cleanup for single-file writes;
- exercise the native renderer against a temporary real repository;
- document path-based API race limits and untested platform behavior.

Completed in the fourth slice:

- accept a caller-supplied private store root without selecting a public project path;
- persist content-addressed before-and-after output and lock blobs;
- bind required blobs through a deterministic recovery manifest;
- acquire an exclusive opaque writer lease and verify it before every mutation;
- publish the `prepared` journal only after canonical records and every required blob revalidate;
- prevent journal advancement when recovery content is missing or corrupt;
- leave stale-lease takeover, orphan cleanup, and store retention explicitly undefined.

Completed in the fifth slice:

- accept a caller-supplied repository lock path and reject output-path overlap;
- verify the actual base lock and every before digest before mutation;
- compare each path again immediately before single-file mutation;
- avoid rewriting `retain` operations whose before and after digests match;
- apply all changed outputs before publishing the target lock;
- verify target outputs and lock before persisting `committed`;
- add a terminal `rolled-back` journal branch for completed base-state recovery;
- recover every instrumented forward boundary to exactly `rolled-back` or `committed`;
- fail closed when interrupted state contains foreign drift.

Completed in the sixth slice:

- terminate a real child process with `SIGKILL` at every forward execution boundary on Darwin;
- confirm that an ordinary recovery attempt refuses the stale writer record;
- require external process-death confirmation plus unchanged writer evidence and the expected transaction digest before explicit writer-record removal;
- verify the writer lease immediately before every project mutation;
- recover all pre-lock termination boundaries to exact base bytes and `rolled-back`;
- recover all post-lock termination boundaries to exact target bytes and `committed`;
- synchronize affected directory entries after directory creation, rename, hard-link publication, temporary-file cleanup, and unlink;
- fail workspace opening when the current filesystem cannot perform the directory synchronization probe.

Completed in the seventh slice:

- require exact terminal repository and lock state before writing a retirement marker;
- make retirement an immutable barrier that prevents writer acquisition and in-place store reuse;
- keep each prepared store single-use and caller-owned without selecting a public parent or transaction path;
- atomically rename a retired store to a deterministic tombstone and synchronize the parent directory;
- publish a canonical cleanup receipt with the authorized file inventory before tombstone removal so absence is distinguishable from an unknown store;
- audit required recovery records, valid content-addressed orphan blobs, recognized private temporary files, and symbolic-link absence before recursive removal;
- refuse unknown entries, corrupt orphan blobs, symbolic links, and active or stale writer records;
- resume cleanup idempotently after cooperative faults and Darwin `SIGKILL` at retirement, tombstone, receipt, and removal boundaries;
- resume a partially removed tombstone only when every remaining path and byte digest matches the receipt inventory.

Completed in the eighth slice:

- construct deterministic base-anchor rollback and target-anchor roll-forward recovery fixtures;
- keep the target-anchor partial fixture explicit as a valid recovery input rather than normal execution output;
- interrupt all three rollback output mutations, base verification, and `rolled-back` journal persistence;
- interrupt all three roll-forward output mutations, `lock-written` persistence, target verification, and `committed` persistence;
- repeat all eleven recovery mutation boundaries with cooperative faults and Darwin `SIGKILL`;
- require explicit stale-writer evidence removal after every terminated recovery process;
- recover each boundary to exact base bytes and `rolled-back` or exact target bytes and `committed`;
- fail closed when foreign drift appears after recovery-process termination.

Completed in the ninth slice:

- persist a canonical digest-bound mutation intent before creating each transaction-owned repository temporary file;
- derive the exact same-directory temporary path from transaction, writer, target path, and target content digests without PID, time, or age heuristics;
- persist exact writer clearance before removing an unchanged stale writer record after external process-death confirmation;
- reclaim only intent paths whose writer fingerprint has matching clearance and refuse every uncleared recorded temporary file;
- keep cooperative write failures self-cleaning while retaining empty or synchronized partial-file evidence after `SIGKILL`;
- verify creation and synchronization termination boundaries through a real child process on Darwin;
- reject symbolic links, directories, malformed records, unknown paths, and conflicting temporary paths;
- include intent and clearance registries in terminal store verification and cleanup inventory;
- document that hostile regular-file replacement at an exact authorized path remains indistinguishable from owned partial bytes.

Completed in the tenth slice:

- require an existing empty dedicated parent before private lifecycle initialization;
- publish and revalidate a canonical owner record before cleanup mutation or disposal inspection;
- define immutable cleanup-receipt retention for the full parent lifetime without time, count, or size heuristics;
- refuse unclaimed, non-empty, changed, malformed, extended, or non-canonical parent ownership;
- produce a deterministic read-only disposal snapshot only when the parent contains no active store or tombstone;
- bind the disposal snapshot to the owner record and every sorted canonical receipt identity and digest;
- reject symbolic links, directories, foreign files, invalid receipts, and unexpected receipt filenames from disposal readiness;
- leave whole-parent deletion as a future explicitly authorized administrative action rather than deleting retained evidence automatically.

Prepared in the eleventh slice:

- verify current Node.js release and GitHub-hosted runner facts from official primary sources;
- define blocking Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 cells for Node.js 22 and 24;
- use explicit runner labels, read-only workflow permission, disabled credential persistence, disabled package caching, and full-SHA action pins;
- probe directory synchronization, synchronized rename, hard links, symbolic links, case sensitivity, and forced child termination before the full suite;
- remove Windows skips from transaction interruption and symbolic-link tests;
- add a zero-skip qualification command and fail if tracked files change;
- audit workflow action pins, privileged triggers, and top-level permission mechanically;
- define the private [interruption contract](interruption-contract.md), filesystem prerequisites, operator boundary, and explicit power-loss non-claims;
- qualify four hosted Ubuntu and macOS cells only after run 29531413592 passed and its resolved environments were recorded;
- retain both Windows cells as failed evidence after directory synchronization returned `EPERM` before the zero-skip suite.

Completed in the twelfth slice:

- compare clean-Git reset, digest-aware rerun, and the write-ahead journal at one reproducible complete-file failure boundary;
- reject automatic Git reset as the default because it loses concurrent tracked work and does not restore ignored or untracked managed paths;
- accept staged before-or-after digest convergence as the V1 default in ADR 0002;
- derive a deterministic same-directory temporary path from the plan, target path, and target digest;
- retain safe-path, symbolic-link, and regular-file checks while separating process-termination recovery from directory durability;
- recheck every managed path before mutation and fail closed on foreign content;
- converge creates, updates, deletes, repeated apply, regular partial temporary files, and mixed before-and-after targets;
- terminate real child processes with `SIGKILL` at all twelve provider write boundaries and resume to exact target bytes;
- keep the exact plan caller-supplied without selecting a public storage path or serialized recovery format.

Completed in the thirteenth slice:

- separate V1 qualification from the stronger write-ahead directory-durability experiment;
- define six blocking Ubuntu 24.04 x64, macOS 15 arm64, and Windows 2025 x64 cells for Node.js 22 and 24;
- probe synchronized file content, rename replacement, symbolic-link handling, and forced process termination without requiring directory synchronization or hard links;
- select 14 V1-compatible compiled test files and pass 103 local tests with zero failures and zero skips;
- exclude exactly five complete strong-transaction test files and mechanically require the V1 apply and subprocess suites;
- run the complete 202-test stronger suite in one designated Ubuntu 24.04 and Node.js 24 regression cell;
- retain the stronger write-ahead workflow as a manually dispatched experiment;
- use read-only workflow permissions, full-SHA action references, disabled credential persistence, and tracked-file cleanliness checks.
- qualify all six hosted cells with 103 selected tests and zero skips after retaining the first Windows failure as diagnostic evidence;
- pass the complete 202-test stronger regression in the designated Ubuntu 24.04 and Node.js 24 cell.

Completed in the fourteenth slice:

- bind all known plan fields, diagnostics, target bytes, and previous ownership into a closed private exact-plan snapshot;
- reject snapshot extensions, corruption, malformed ownership, and plan-digest mismatch before mutation;
- require plan previous ownership to equal ownership derived from the caller-supplied base lock;
- derive the target lock before mutation without selecting a public path or serialized contract;
- reject lock and temporary-path overlap with managed outputs;
- accept only exact base or target lock bytes and reject a target lock paired with incomplete outputs;
- apply and verify exact output targets before convergently publishing the lock;
- recover through cooperative faults and real process termination before and after lock publication;
- prove repeated exact execution is an output and lock no-op;
- retain the write-ahead implementation as non-default evidence without extending it;
- leave directory durability and power-loss work deferred until a separately accepted property requires it.

Exit criteria:

- a repeated render is a no-op;
- drift, ownership conflicts, deletions, and adoption are explicit;
- an interrupted apply can be restored deterministically without accepting a partially updated artifact set and contradictory lock;
- volatile machine data and secrets never enter the lock.

### 5. Command services and thin CLI

Status: **In progress.** The private `check`, `diff`, mutating `render`, provider-neutral `doctor`, and read-only non-interactive `init` proposal semantic services are available. No public command handler, probe adapter, extensible discovery rule, stable exit-code contract, output format, or CLI parser has been selected. See [private check evidence](../evidence/private-check-command-service.md), [private diff evidence](../evidence/private-diff-command-service.md), [private render evidence](../evidence/private-render-command-service.md), [private doctor evidence](../evidence/private-doctor-command-service.md), and [private init evidence](../evidence/private-init-command-service.md).

Development order:

1. `check`;
2. `diff`;
3. `render`;
4. `doctor`;
5. `init`.

Command handlers must remain thin wrappers around testable services. Read-only commands precede mutating commands, and safe ownership behavior precedes existing-file initialization.

Completed in the fifteenth slice:

- accept only caller-supplied private materialization, exact plan snapshot, expected base lock, lock path, and read-only workspace;
- classify exact observations as `clean`, `changes-required`, or `blocked`;
- retain candidate exit codes `0`, `1`, and `2` without accepting a public compatibility contract;
- distinguish recognized before-state changes from foreign drift;
- retain renderer ownership and unsupported-capability diagnostics;
- fail closed with structured diagnostics for malformed snapshots, malformed base locks, foreign lock bytes, and contradictory target-lock state;
- sort diagnostics deterministically and prove repeated checks return identical results;
- prove the service has no mutation-capable workspace interface and leaves repository bytes unchanged.

Completed in the sixteenth slice:

- build exact-byte diff only after the private check service reports non-blocked state;
- return deterministic create, update, delete, and render-lock entries with before and target digests and content;
- omit managed outputs already at target during partial forward convergence;
- reread and revalidate every planned path and the lock before returning exact entries;
- discard every accumulated entry if a post-check observation becomes foreign or contradictory;
- read no path outside the exact plan and caller-supplied lock path;
- preserve a read-only workspace interface and prove repeated diff leaves repository bytes unchanged;
- defer line formatting, terminal disclosure, redaction, truncation, machine output, and public compatibility.

Completed in the seventeenth slice:

- validate one closed revisioned envelope of provider and environment observations;
- bind provider observations to configured instance id, product, and surface;
- retain observed version, execution context, principal, capability, strength, mechanism, evidence source, reference, and freshness;
- classify healthy, degraded, and blocked evidence with candidate exit codes;
- reject stale, unknown-freshness, missing, mismatched, duplicate, unavailable, or insufficient required evidence;
- derive compiler-compatible capability availability only for a non-blocked result;
- keep the semantic service deterministic and free of provider execution, network access, credentials, and environment inspection;
- defer probe adapters, version support, authentication claims, persistence, redaction, and public output.

Completed in the eighteenth slice:

- observe only the fixed project-level instruction paths already validated for Codex, Claude Code, and Cursor;
- require exactly one deterministic target for every configured provider product;
- expose the normalized candidate configuration, canonical JSON, digest, exact target bytes, and source references before apply;
- classify absent paths as `create` and only byte-exact existing content as `adopt`;
- accept import proposals only from assessments bound to current observed bytes, the same candidate configuration digest, and exact target bytes;
- retain complete asserted information-loss entries for lossy import proposals;
- classify absent, stale, unsupported, mismatched, or unreadable import evidence as explicit `abort` outcomes;
- keep foreign existing bytes out of the result and prove that a temporary repository remains unchanged;
- defer provider parsing, managed-region syntax, public discovery, interactive prompts, output formatting, and all mutation.

Exit criteria:

- stable structured diagnostics and candidate exit-code behavior;
- end-to-end tests in temporary repositories;
- `check` and `diff` never modify project state;
- `render` accepts only a verified, conflict-free plan.

### 6. Adoption and initialization

Status: **In progress.** The private proposal core and fixed initial path discovery are available. Provider-specific import analyzers, managed-region adoption, apply integration, and reproducible file or flag representations for future interactive choices remain open.

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
