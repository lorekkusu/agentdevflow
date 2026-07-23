# Private domain project resolution

## Status

This internal contract resolves the bounded beta project intent into
one authoritative workflow compilation, responsibility providers, tracker
selection, and logical capability targets. The same result feeds renderer
materialization directly. It does not define a provider runtime, tracker
runtime, execution transport, or public arbitrary-workflow DSL.

The implementation is in `src/project/private-domain-project-resolution.ts`. Reproducible results are in [private domain project resolution evidence](../evidence/private-domain-project-resolution.md).

## Purpose

The resolver lets the project-level configuration choose materially different
development flows without adding provider products, tracker products, or
pull-request fields to the generic compiler.

The revision-1 beta input contains:

- revision `1`;
- one Fast, Balanced, or recognized-but-unavailable Strict preset;
- provider instances from the initial Codex, Claude Code, and Cursor validation set;
- Steward, Developer, and Reviewer references to provider instances;
- one tracker mode;
- one built-in workflow family with its bounded options;
- logical capability bindings to responsibilities, the selected tracker, or opaque external integration identifiers.

The current workflow families are:

- `issue-to-reviewed-pull-request`, with draft or immediately ready
  pull-request creation and squash merge; the current CLI fixes auxiliary
  review to disabled;
- `local-reviewed-change`, with no issue, pull-request, CI, or merge concepts.

Both are selectable through the current CLI. Their finite-state definitions
remain private and are not a public workflow-extension language.

## Resolution layers

Resolution keeps four integrity identities separate:

1. The intent digest binds normalized providers, roles, tracker mode, workflow choice, and logical capability targets.
2. The workflow-compilation digest binds provider-neutral topology, policies, artifact invalidation, and observed logical capabilities.
3. The project-resolution digest binds the intent digest, exact workflow compilation, tracker, responsibility-to-provider resolution, and capability targets.
Preset expansion adds a separate deterministic identity inside project resolution. The effective definition id binds the preset name while the expansion digest binds the private profile and effective workflow definition.

Changing the Reviewer from one provider instance to another changes the project resolution but does not change an otherwise identical provider-neutral workflow compilation. Changing draft to ready changes the workflow definition and compilation.

Project resolution has no execution-manifest, evidence-transport, scheduler, or
provider-client dependency.

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

An external identifier is a configuration reference, not an authenticated
client, credential, package, executable, or proof of capability. The current
issue workflow resolves each requirement through a compiled-procedure
observation.

## Compatibility and failure behavior

The issue-to-reviewed-pull-request workflow requires GitHub Issues or Linear. The local workflow requires local or no-tracker mode. Incompatible combinations fail instead of creating fictitious tracker evidence or empty pull-request fields.

Resolution also fails for:

- duplicate or invalid provider identifiers;
- responsibility references to unknown provider instances;
- duplicate, missing, or unused logical capability bindings;
- a binding routed to the wrong target kind or responsibility;
- invalid opaque external identifiers;
- any downstream workflow definition, capability, state-budget, or safety-policy compilation failure.

Diagnostics are deterministic internal values. Their public presentation and
beta compatibility belong to the CLI contract. No partial project or workflow
compilation is returned after failure.

## Provider neutrality

Provider products appear in the project resolution because they are material
bindings. They do not appear in the workflow compilation. Tracker products
similarly resolve outside generic workflow topology.

Provider replacement should normally change the intent and project-resolution digests while retaining the same workflow-compilation digest. A capability gap may still prevent workflow compilation; provider neutrality does not imply capability equivalence or silent degradation.

## Private application planning bridge

`src/application/private-domain-project-plan.ts` accepts bounded revision-1
document bytes, an explicit lock path, and a read-only repository workspace.
It selects the built-in workflow's declared capability observations, compiles
the project, reads canonical guidance, materializes responsibility-specific
provider instructions, reads and validates lock bytes, derives ownership,
stages native outputs, and retains the exact plan snapshot.

The bridge does not accept caller-supplied compiler output, materialization, manifest, lock object, render request, plan, or snapshot. Planning performs no write or external operation. Identical configuration, lock, and repository bytes produce an identical result.

The issue-to-reviewed-pull-request capabilities are all advisory
`compiled-procedure` observations. This lets the bridge generate honest
instructions without inventing an external adapter. The output requires the
active agent to stop and report when a required tool, integration, or
permission is unavailable.

## Non-claims and open boundaries

- The resolver accepts typed in-memory data. The separate private project-document boundary validates untrusted serialized content before calling it.
- Revision `1` is the current beta configuration revision, not a permanent 1.0
  compatibility promise.
- Role bindings do not prove fresh reviewer context or distinct identity.
  Balanced compiles a procedure that requires current reviewer-isolation
  evidence, but the current CLI neither acquires nor authenticates that
  evidence.
- External identifiers do not select or initialize adapters.
- No network access, credential access, provider invocation, tracking, scheduling, waiting, retry, merge, or filesystem mutation occurs.
- Custom workflows, provider versions, execution-context selection, discovery,
  and migration remain open.
- Fast and Balanced are executable. Strict remains intentionally unavailable
  until stronger evidence semantics exist.

## Change boundary

Keep the resolver and workflow definitions private while the bounded project
choices remain user-facing. Keep execution outside the compiler. Do not expose
arbitrary workflow topology merely to generalize the current built-ins.
