# Private domain project resolution

## Status

This is a private, fixture-only contract. It resolves a bounded project intent into one built-in workflow definition, an exact execution manifest, responsibility providers, tracker selection, and logical capability targets. It does not define a public `ProjectConfig`, filename, parser, schema, compatibility promise, provider adapter, tracker runtime, or workflow DSL.

The implementation is in `src/project/private-domain-project-resolution.ts`. Reproducible results are in [private domain project resolution evidence](../evidence/private-domain-project-resolution.md).

## Purpose

The experiment tests whether a project-level configuration boundary can choose materially different development flows without adding provider products, tracker products, or pull-request fields to the generic compiler.

The bounded input contains:

- private revision `1`;
- one private Fast, Balanced, or recognized-but-unavailable Strict preset;
- provider instances from the initial Codex, Claude Code, and Cursor validation set;
- Steward, Developer, and Reviewer references to provider instances;
- one tracker mode;
- one built-in workflow family with its bounded options;
- logical capability bindings to responsibilities, the selected tracker, or opaque external integration identifiers.

The accepted workflow families are:

- `issue-to-reviewed-pull-request`, with draft or immediately ready pull-request creation, optional auxiliary review, and squash merge as the only current fixture;
- `local-reviewed-change`, with no issue, pull-request, CI, or merge concepts.

These are private TypeScript specimens. They are not accepted configuration syntax.

## Resolution layers

Resolution keeps three integrity identities separate:

1. The intent digest binds normalized providers, roles, tracker mode, workflow choice, and logical capability targets.
2. The execution-manifest digest binds provider-neutral workflow topology, policies, artifact invalidation, and observed logical capabilities.
3. The project-resolution digest binds the intent digest, exact manifest digest, tracker, responsibility-to-provider resolution, and capability targets.

Preset expansion adds a separate deterministic identity inside project resolution. The effective definition id binds the preset name while the expansion digest binds the private profile and effective workflow definition.

Changing the Reviewer from one provider instance to another changes the project resolution but does not change an otherwise identical provider-neutral workflow manifest. Changing draft to ready or enabling auxiliary review changes the workflow definition and manifest.

## Logical capability targets

Each built-in workflow declares the logical capability bindings it needs. The project intent must supply every required binding exactly once and must not supply unused bindings.

The current bounded target rules are:

| Logical binding | Required target |
| --- | --- |
| `developer` | Developer responsibility and its resolved provider instance |
| `reviewer` | Reviewer responsibility and its resolved provider instance |
| `tracker` | Selected GitHub Issues or Linear tracker |
| `pull-request-host` | Opaque external integration identifier |
| `ci` | Opaque external integration identifier |
| `auxiliary-reviewer` | Opaque external integration identifier when the stage is enabled |

An external identifier is a configuration reference, not an authenticated client, credential, package, executable, or proof of capability. Capability observations remain separate input to the workflow compiler and must meet the declared enforcement strength.

## Compatibility and failure behavior

The issue-to-reviewed-pull-request workflow requires GitHub Issues or Linear. The local workflow requires local or no-tracker mode. Incompatible combinations fail instead of creating fictitious tracker evidence or empty pull-request fields.

Resolution also fails for:

- duplicate or invalid provider identifiers;
- responsibility references to unknown provider instances;
- duplicate, missing, or unused logical capability bindings;
- a binding routed to the wrong target kind or responsibility;
- invalid opaque external identifiers;
- any downstream workflow definition, capability, state-budget, or safety-policy compilation failure.

Diagnostics are deterministic private candidates. No partial resolution or manifest is returned after failure.

## Provider neutrality

Provider products appear in the project resolution because they are material bindings. They do not appear in the execution manifest. Tracker products similarly resolve outside generic workflow topology.

Provider replacement should normally change the intent and project-resolution digests while retaining the same manifest digest. A capability gap may still prevent manifest compilation; provider neutrality does not imply capability equivalence or silent degradation.

## Non-claims and open boundaries

- The resolver accepts typed in-memory data. The separate private project-document boundary validates untrusted serialized content before calling it.
- Revision `1` is an experiment identifier, not a public version.
- Role bindings do not prove fresh reviewer context or distinct identity; execution evidence handles those observations separately.
- External identifiers do not select or initialize adapters.
- No network access, credential access, provider invocation, tracking, scheduling, waiting, retry, merge, or filesystem mutation occurs.
- Custom workflows, provider versions, execution context selection, discovery, migration, persistence, and lock integration remain open.
- Fast and Balanced preset expansion is private and executable. Strict remains intentionally unavailable until stronger evidence semantics exist.

## Change boundary

Keep this contract private until evidence payload validation and a real migration boundary can preserve all resolution layers without silent intent loss. Do not add a public filename or arbitrary workflow representation merely to serialize these fixtures.
