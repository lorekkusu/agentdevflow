# Development roadmap

## Status

Phase 0 is complete with a Go recommendation. The repository has validated a provider-neutral finite-state policy core, a replaceable native renderer for the initial three providers, generated-file ownership, deterministic lock state, and staged forward-convergent apply.

Phase 1 private prototypes also cover command semantics, bounded initialization, two domain workflow families, project-intent parsing and resolution, Fast and Balanced preset expansion, typed execution evidence, strict private transport, and one GitHub Check Runs observation mapping.

These components now form an accepted initial beta boundary, not a stable 1.0 product. Revision-1 is the active forward path from non-interactive local initialization through bounded configuration bytes, policy compilation, native materialization, canonical lock observation, exact repository planning, read-only `check` and `diff`, exact approved `render`, and explicit-observation `doctor`; schema-version-0 remains compatibility and regression evidence. The private package has an allowlisted npm `bin`, clean offline installation evidence, exact-root defaults, and bounded JSON schema version 1. The current objective is beta release hardening without publishing or expanding product scope.

See [project health](project-health.md) for the current sanitized scope and complexity assessment. This roadmap records accepted sequence and exit criteria, not implementation chronology, staffing, or release dates.

## Completed foundations

| Foundation | Status | Durable evidence or decision |
| --- | --- | --- |
| Phase 0 renderer backend gate | Complete | [Renderer backend evidence](../evidence/renderer-backend.md) and [ADR 0001](../decisions/0001-native-project-instructions-renderer.md) |
| Phase 0 finite-state policy gate | Complete | [Policy safety evidence](../evidence/policy-safety.md) |
| Candidate configuration and private compiler | Complete as private prototypes | [Candidate configuration](../evidence/candidate-configuration.md) and [private compiler](../evidence/private-compiler.md) |
| Native project-instructions renderer | Complete for project-wide Codex, Claude Code, and Cursor output | [Renderer integration](../evidence/renderer-integration.md) |
| Ownership, lock, drift, and conflict behavior | Complete as private boundaries | [Private render lock](../evidence/private-render-lock.md) and [render command](../evidence/private-render-command-service.md) |
| V1 apply and interruption recovery | Complete for staged forward convergence | [ADR 0002](../decisions/0002-v1-forward-convergent-render-apply.md), [V1 recovery contract](v1-recovery-contract.md), and [convergent apply evidence](../evidence/private-convergent-apply.md) |
| Private command semantics | Complete for isolated services and executable local `init`, `check`, `diff`, approved `render`, and explicit-observation `doctor` | [Local CLI](../evidence/private-local-cli.md), [check](../evidence/private-check-command-service.md), [diff](../evidence/private-diff-command-service.md), [render](../evidence/private-render-command-service.md), [doctor](../evidence/private-doctor-command-service.md), and [init](../evidence/private-init-command-service.md) evidence |
| Private package qualification | Complete for one allowlisted local tarball and offline installed-bin exercise | [Private package qualification](../evidence/private-package-qualification.md) |
| Initial beta candidate qualification | Complete locally and on the selected hosted Node.js 22/24 matrix | [Beta release-candidate evidence](../evidence/beta-release-candidate.md) and [ADR 0004](../decisions/0004-initial-beta-public-surface.md) |
| Existing-file initialization bridge | Complete for create, exact adopt, lossless import, abort, and exact approved render | [Project-instructions import](../evidence/private-project-instructions-import.md) and [approved init render](../evidence/private-approved-init-render.md) |
| V1 candidate platform qualification | Complete as candidate evidence, not a public support promise | [V1 platform qualification](../evidence/v1-platform-qualification.md) |
| Domain workflow validation | Complete as a private prototype for issue-to-reviewed-PR and local reviewed change | [Domain workflow evidence](../evidence/private-domain-workflows.md) |
| Private project intent, presets, parser, and runtime schema | Complete as private prototypes | [Project resolution](../evidence/private-domain-project-resolution.md), [preset expansion](../evidence/private-preset-expansion.md), [project document contract](private-project-document-contract.md), and [ADR 0003](../decisions/0003-private-jsonc-zod-boundary.md) |
| Typed execution evidence and replay | Complete as a private verification boundary | [Execution contract evidence](../evidence/private-execution-contract.md) |
| Strict private execution transport | Complete and frozen pending a real transport consumer | [Execution transport evidence](../evidence/private-execution-transport.md) |
| GitHub Check Runs evidence mapping | Complete and frozen at caller-attested acquisition | [GitHub Check Runs evidence](../evidence/private-github-check-runs-evidence.md) |

Completion in this table means that the stated private question has reproducible evidence. It does not imply a stable public API, production CLI, package, discovery rule, persisted format, authenticated external observation, or runtime orchestration.

## Completed closure checkpoint

The 2026-07-21 checkpoint closed the domain-workflow and execution-evidence research direction without extending it.

Scope:

- maintain one disclosure-safe project health review procedure and current assessment;
- reconcile README, architecture, roadmap, tooling, and repository guidance with actual package and qualification state;
- record `Invest`, `Keep`, `Freeze`, `Defer`, and later removal-candidate dispositions;
- retain explicit verdicts and non-claims for project resolution, presets, execution evidence, transport, and GitHub mapping;
- inspect the cumulative working tree for incomplete imports, accidental coupling, stale hashes, unsupported public claims, and unreviewable commit scope;
- propose coherent commit groups without staging, committing, or pushing;
- run the complete repository verification.

Exit criteria:

- no current-facing document treats live GitHub acquisition as the immediate next objective;
- the strong transaction, strict execution transport, and GitHub mapper are visibly frozen rather than implied product dependencies;
- the active project-model convergence problem is explicit;
- repository entry points accurately state that no production CLI exists;
- the working tree has a reviewed file disposition and commit proposal;
- repository audit, type checking, build, and all automated tests pass;
- no change is staged, committed, or pushed without explicit authorization.

## Completed local vertical CLI path

This milestone connected existing private components before any additional horizontal capability.

Target path:

```text
explicit configuration bytes
-> parse and validate
-> resolve preset, workflow, providers, tracker, and capabilities
-> compile policy
-> materialize provider instructions
-> inspect repository and lock
-> check and diff
-> explicit approved render
-> repeated check reports clean
```

### 1. Converge the active project model

Status: **Complete as a private local planning bridge.**

Recommendation:

- use the revision-1 private domain project intent as the active forward model;
- select one authoritative compiled representation, or introduce one explicit one-way bridge with semantic-parity tests;
- separate required project and workflow compilation from optional execution-manifest export;
- retain schema-version-0 candidate configuration only as an explicit one-way compatibility input or regression fixture;
- do not add a third project model or conceal intent loss behind another adapter;
- keep public names, filenames, and compatibility promises open.

Progress:

- revision-1 project resolution now returns the authoritative workflow compilation directly;
- optional execution-manifest export consumes that compilation and is mechanically forbidden as a project-layer dependency;
- revision-1 configuration bytes now reach deterministic project-instructions materialization and the native Codex, Claude Code, and Cursor staging boundary;
- schema-version-0 remains only a private compatibility and regression path;
- `src/application/private-domain-project-plan.ts` now composes revision-1 bytes, native local capability observations, canonical lock bytes, repository observations, materialization, and exact snapshot creation through a read-only workspace;
- identical configuration, lock, and repository bytes produce an identical plan;
- the bridge requires only an explicit lock path and does not accept caller-supplied compiler output, materialization, manifest, lock object, render request, plan, or snapshot;
- issue-to-reviewed-pull-request input fails with unavailable-capability diagnostics because live tracker, pull-request, CI, review-service, and merge adapters do not exist yet.

Exit criteria:

- one configuration document reaches one authoritative policy compilation and renderer materialization without caller-supplied compiler output;
- any temporary bridge rejects unsupported intent and proves parity for every represented policy and renderer input;
- renderer planning does not require an execution manifest, and optional manifest export consumes the authoritative compiled result rather than defining it;
- workflow family, pull-request initial state, auxiliary review, tracker, providers, and capability targets retain exact intent;
- identical input and repository state produce an identical exact plan;
- incompatible legacy input fails or requires explicit missing choices without inference.

### 2. Add executable read-only `check` and `diff`

Status: **Complete as a private experimental entry point.**

Use Node.js `util.parseArgs` unless real help, completion, nesting, or output requirements justify a framework. Accept explicit configuration and lock paths before deciding public discovery precedence.

Progress:

- `npm run phase1:local-cli -- check ...` and `diff ...` compose explicit repository, configuration, and lock paths into the revision-1 planner and existing semantic services;
- the repository is opened through `PrivateFilesystemWorkspace.openReadOnly` and the command boundary contains no mutation operation;
- output includes deterministic human-readable diagnostics, plan and snapshot identity, and exact JSON-quoted recognized diff content;
- blocked diff output contains no change entries or foreign bytes;
- temporary-repository subprocess tests cover clean, changes-required, invalid input, unowned conflicts, retained-ownership drift, and unavailable capabilities;
- options, formatting, exit codes, discovery, filenames, npm `bin`, and machine output remain private and unaccepted.

Exit criteria:

- the package has one experimental executable entry point;
- `check` and `diff` accept user-level repository and configuration inputs rather than private materialization or snapshot values;
- both commands are read-only and cover clean, changes-required, blocked, foreign-drift, ownership-conflict, and unsupported-capability outcomes;
- human-readable diagnostics and private candidate exit behavior are exercised end to end in temporary repositories.

### 3. Add explicit approved `render`

Status: **Complete as a private experimental entry point.**

Use only the accepted staged forward-convergent apply path. Do not make the write-ahead transaction experiment a runtime dependency.

Progress:

- `diff` exposes complete exact target bytes and the full snapshot digest separately from the narrower renderer plan digest;
- `render` requires the exact snapshot digest, rereads configuration, opens mutable authority only after the first approval match, replans, and requires a second match;
- stale configuration or repository state fails closed before the existing render service receives authority;
- exact current-plan repetition is a no-op;
- interrupted before-or-after output state reconstructs the originally approved all-before plan only from exact target bytes and an authoritative base lock or absence;
- the original approval and normal convergent preflight remain mandatory, so reconstruction is not silent adoption or foreign-drift repair;
- no journal, snapshot file, Git reset, CLI framework, discovery rule, or second writer was added.

Exit criteria:

- `diff` exposes the complete exact target and plan identity before mutation;
- `render` requires explicit approval bound to the current exact plan;
- stale approval and post-plan drift fail closed;
- repeated render is a no-op;
- process termination at the accepted V1 boundaries converges safely when the exact plan is repeated.

### 4. Add minimal non-interactive `init`

Status: **Complete as a private experimental entry point.**

The private entry generates only the currently executable revision-1 local workflow intent from explicit flags. It requires Fast or Balanced, an explicit local or no-tracker mode, explicit provider instances, and explicit responsibility bindings. It creates the caller-selected relative configuration path only when absent, adopts only byte-exact repeated configuration, and never overwrites different configuration bytes.

When no render lock exists, the active planner stages the native provider targets and classifies every selected provider path as create, exact adopt, lossless import, or abort. Exact adopt and import authorization are carried into the same exact plan displayed by `diff`; `render` rereads, reanalyzes, replans, and requires approval of the complete matching snapshot. This is the revision-1 evidence-backed successor to the schema-version-0 proposal envelope. It adds no approval file, discovery path, merge algorithm, second writer, or Git operation.

Progress:

- initialization opens a read-only repository first and validates configuration, lock, provider, role, workflow, and path boundaries before mutation authority exists;
- the only init mutation is exclusive creation of an absent exact configuration file through the hardened workspace;
- provider outputs and the lock remain unchanged until a later exact approved `render`;
- existing target bytes are adopted only through an explicit exact plan, and differing bytes are importable only when the narrow analyzer proves exact logical preservation;
- unsupported or foreign bytes abort without disclosure, and a present lock routes the user to normal check/diff/render behavior;
- two independent temporary repositories reproduce identical offline init, diff, render, clean-check, and empty-diff results;
- fresh-create interruption retains original-approval recovery; an interrupted initialization import that has consumed its original before-bytes requires a newly reviewed exact diff rather than inventing the lost observation.

Exit criteria:

```text
fresh repository
-> init
-> diff
-> explicit render
-> check clean
-> diff empty
```

The path must reproduce in a second temporary repository without network access.

## Completed private package and local doctor qualification

Status: **Complete as private candidate evidence; public-surface decisions remain gated.**

Keep `doctor` local and honest. Report unknown external capability truth rather than adding a provider runtime merely to fill a diagnostic.

Observed closure:

- the normal workspace runtime graph no longer imports the frozen transaction subsystem;
- the installed npm bin executes through npm-style symbolic links;
- the tarball uses an explicit runtime allowlist and excludes tests, experiments, frozen transaction code, Rulesync process integration, and private evidence;
- an isolated installation using only local tarballs completes `init`, `diff`, approved `render`, clean `check`, and `doctor` with network-disabled npm resolution;
- doctor consumes a bounded revisioned observation file and performs no live provider, credential, process, or network probe;
- at this historical qualification snapshot the package remained `private: true`, and no package was published or reserved.

Exit criteria:

- `npm pack` contains only intended runtime and documentation files;
- a clean installation executes the five candidate command names;
- core initialization, rendering, checking, and diffing work offline;
- Node.js and platform claims match qualified evidence;
- publication remains separately authorized.

## Completed public-surface decision packet

Status: **Complete; accepted by [ADR 0004](../decisions/0004-initial-beta-public-surface.md).**

The accepted packet covers exact-root configuration and lock discovery, explicit overrides, stable exit classes, bounded versioned JSON, Node.js 22 and 24, Apache-2.0, and the separately authorized `0.1.0-beta.1` release candidate on npm's `next` tag with provenance. See the [beta CLI contract](beta-cli-contract.md).

## Current: beta release hardening

Status: **Technical qualification complete; publication preparation remains externally gated and unauthorized.**

Required sequence:

1. **Complete:** enforce accepted package metadata, publication guard, exact-root path behavior, JSON version, and output limits in repository checks and tests;
2. **Complete:** repeat complete repository verification and Node.js 22/24 qualification against the accepted beta surface;
3. **Complete:** inspect the final tarball, installed bin, dependency advisories, lifecycle scripts, signatures, and license inclusion;
4. **Complete:** define a minimal public release checklist, changelog, vulnerability-reporting policy, and bounded full-history disclosure audit without adding a release framework;
5. **Complete:** the manual release-preparation workflow and packageable manifest passed local qualification, were committed as `96c253c`, and passed all six hosted Node.js 22/24 cells on the exact pushed commit;
6. **Current gate:** the bounded full-history and external-state disclosure preflight found no publication blocker. Stop for explicit authorization before changing repository visibility. Public-repository protections, vulnerability reporting, first-publication or trusted-publisher state, tags, releases, and npm publication remain separately authorized actions.

No new provider, workflow family, live probe, wizard, framework, or public arbitrary-workflow language belongs in this milestone.

## Frozen research

Frozen work remains reviewable evidence but receives no feature expansion unless a material accepted requirement reopens it.

### Strong write-ahead transaction

The transaction store, executor, cleanup lifecycle, receipts, and stronger platform workflow are not the V1 default. Do not extend them, expose them, or include them in the runtime package. The shared temporary-intent primitive now lives under `src/workspace/`, and the normal workspace graph has no `src/transaction/` import. Revisit the frozen subsystem only under the triggers in ADR 0002.

### Execution transport

The strict path-free codecs demonstrate deterministic private transport. Do not generalize formats, discovery, persistence, signing, migration, or resource limits until a real storage or external-executor consumer exists.

### GitHub Check Runs mapper

The pure mapper demonstrates exact-SHA, pinned-App conversion into provider-neutral `CiResult`. Do not add a live probe, credentials, branch-protection discovery, merge-queue selection, polling, retry, or mutation before the local vertical CLI milestone requires an authenticated external consumer.

### Provider-neutral doctor semantics

The pure observation validator remains available. Do not add provider command execution, network access, credentials, or environment mutation without a narrow accepted probe contract tied to a real command outcome.

## Later

After the private local vertical path and package qualification:

- reevaluate one read-only authenticated provider observation only if a real consumer requires it;
- stabilize `ProjectConfig`, configuration discovery, lock storage, and migration behavior with synthetic migration evidence;
- decide supported Node.js lines and platform guarantees before a public support promise;
- add broader import or managed-region behavior only from real adoption failures;
- reconsider Strict only when its stronger evidence and completion gates are executable;
- reconsider Custom only after multiple built-in workflows demonstrate a stable composition model;
- reconsider additional providers, trackers, workflow families, or runtime exports from concrete user evidence.

Interactive configuration, a complete `migrate` command, agent-assisted repository analysis, broad provider support, marketplaces, GUI, SaaS, scheduling, automatic repair, merge, and release remain deferred as defined by [product direction](../product-direction.md).

## Candidate decisions

These recommendations remain private or prerelease candidates rather than public compatibility promises:

| Decision | Current recommendation | Acceptance gate |
| --- | --- | --- |
| Active internal project model | Revision-1 private domain project intent | Lossless connection through renderer planning and command services, including explicit legacy disposition |
| Runtime schema | Exact Zod 4.4.3 behind the private jitless boundary | Existing schema and security evidence plus real vertical-path diagnostics |
| Configuration parser | Exact `jsonc-parser` 3.3.1 behind one private boundary | Existing ambiguity and edit tests plus real CLI input handling |
| CLI parser | Node.js `util.parseArgs` | End-to-end help, error, output, and option qualification |
| Configuration input | Explicit caller path before discovery precedence | Vertical-path fixtures and a later migration decision before stabilization |
| Lock input | Explicit caller path before discovery precedence | V1 ownership, plan, package, and migration fixtures |
| First release | Prerelease on a non-default npm tag | Tarball review, clean installation, provenance, platform qualification, and separate publication authorization |

Accepting a public filename, schema, lock format, exit-code contract, major dependency, or publication flow requires explicit approval and the relevant evidence.

## Stop and pivot conditions

During beta release hardening:

- do not add a live GitHub probe;
- do not extend the strong transaction subsystem;
- do not add a provider, tracker, workflow family, preset, or evidence schema;
- do not generalize execution transport;
- do not require users to construct private compiler, materialization, manifest, evidence, lock, or snapshot values;
- do not use additional tests, fixtures, or evidence documents as a substitute for a user-operable outcome;
- do not extend public discovery, filenames, schema compatibility, output, exit classes, or support claims without package evidence and explicit approval.

Reconsider or pivot when:

- provider-specific fields dominate user intent;
- adapter maintenance approaches backend reimplementation;
- provenance or ownership cannot support safe review;
- realistic workflows exceed explicit policy state budgets;
- Strict can only be represented as advisory prompt text;
- the vertical path cannot demonstrate independent policy-compiler value beyond deterministic file generation.

## Maintenance

Update this file only when a milestone, dependency, disposition, exit criterion, or stop condition changes. Put current health findings in [project health](project-health.md), reversible tooling in [tooling](tooling.md), accepted material decisions in `docs/decisions/`, and reproducible observations in `docs/evidence/`. Do not append implementation-slice chronology or private review history.
