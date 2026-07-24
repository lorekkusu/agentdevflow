# 0005: External agents operate onboarding through the CLI

Status: Accepted product and architecture boundary; implementation pending

Date: 2026-07-23

## Context

The primary audience already uses coding agents and often has project
instructions in `AGENTS.md`, `CLAUDE.md`, or Cursor rules. Deterministic file
copying cannot reliably classify duplicated, conflicting, role-specific, or
provider-specific natural language. Requiring every user to perform that
classification manually would make existing-project adoption unnecessarily
expensive.

Embedding model SDKs or provider authentication in `agentdevflow` would expand
the product into credential management, billing, model routing, and agent
runtime behavior. At the same time, limiting an external agent to prose advice
would force the user to repeat the mechanical rule, diff, render, and check
steps that the agent can already operate.

Current Codex, Claude Code, Cursor, and OpenCode CLIs expose non-interactive
execution surfaces, but their executable, permission, output, authentication,
and session behavior differ.

## Decision

Existing-project onboarding may launch one user-selected, already installed
and authenticated coding-agent CLI in the foreground.

External-agent operation is downstream of the accepted fixed
`init -> onboard` entry. The selected project configuration must already be
present and valid; a launcher must not create an alternate pre-init discovery
or onboarding path.

The external agent acts as the user's operator of the exact current
`agentdevflow` executable. It may:

1. inspect the supported existing instruction files;
2. propose and explain canonical rule organization;
3. invoke `agentdevflow rule` commands for accepted canonical changes;
4. invoke `agentdevflow diff`;
5. invoke `agentdevflow render` with the current exact plan digest;
6. invoke `agentdevflow check`; and
7. report applied rules, unresolved content, and failures.

The user explicitly selects whether the external agent may only propose or may
also apply through `agentdevflow`.

Proposal mode stops before canonical or provider mutation. Selecting apply
explicitly delegates canonical-rule decisions and exact render approval to the
chosen agent for this one onboarding operation. This grant is the semantic
authorization; the exact plan digest remains a freshness binding rather than
proof that a human separately approved the agent's classification. Ambiguous or
unresolved content must stop rather than be silently omitted.

Provider-specific launchers are thin process adapters outside workflow and
policy compilation. They map one bounded task to a fixed executable, argv,
stdin, working directory, bounded environment, and process result. A reviewed,
visible, English product-owned runtime instruction template defines the task
sent through stdin. They reuse the user's existing CLI authentication without
reading, copying, storing, printing, refreshing, or provisioning credentials.

The external agent is not a second provider-file writer. Managed provider files
and the ownership lock remain valid only through the existing complete plan,
exact render approval, renderer apply, and final check. Product success is
determined by canonical rule validation and managed state, not by the agent's
prose, claimed completion, session identity, or exit code alone.

The initial launcher candidates are Codex CLI, Claude Code, Cursor CLI, and
OpenCode. A launcher becomes supported only after its installed-version
contract and end-to-end onboarding behavior pass qualification. The manual
onboarding path remains available.

## Consequences

- Existing projects can borrow the user's preferred external agent for
  semantic classification while retaining one deterministic project mutation
  model.
- `agentdevflow` does not need provider API keys, SDKs, login flows, a model
  selector, or a credential store.
- External-agent behavior and cost remain governed by the user's installed CLI
  and account.
- Every supported launcher needs a small, separately tested compatibility
  adapter and actionable missing-version, auth, permission, timeout,
  cancellation, malformed-output, and non-zero-exit diagnostics.
- Starting a new process does not prove reviewer independence or produce
  trusted workflow evidence.
- Provider permission controls may reduce accidental direct edits, but the
  product does not claim hostile-process confinement. The supported environment
  remains a cooperative local user and selected agent.
- The exact current `agentdevflow` executable must be passed to the external
  agent so one onboarding operation cannot mix package versions.

## Alternatives considered

- **Embed provider SDKs and manage credentials.** Rejected because it adds
  credential, model, billing, retry, and provider-runtime ownership unrelated
  to the local configurator.
- **Generate a proposal and require the user to repeat every CLI step.**
  Rejected as the only path because it discards the main convenience of using
  an external agent as the user's operator. Proposal-only remains an explicit
  mode.
- **Let the external agent edit provider files directly.** Rejected because it
  bypasses canonical rules, complete diff, exact approval, ownership state, and
  drift checking.
- **Add a background agent queue or general workflow executor.** Rejected
  because onboarding requires one bounded foreground operation, not an
  orchestration runtime.
- **Support only manual onboarding.** Retained as a required fallback but
  insufficient as the primary experience for users with large existing
  instruction sets.

## Evidence

Official current CLI documentation establishes viable one-shot surfaces and
the need for provider-specific adapters:

- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage)
- [Cursor headless CLI](https://docs.cursor.com/en/cli/headless)
- [OpenCode CLI run](https://opencode.ai/docs/cli/#run)

Implementation, installed-version compatibility fixtures, and private
repository dogfood remain acceptance gates in the root
[product roadmap](../../ROADMAP.md).

## Security and disclosure considerations

The launcher must disclose that selected project instruction content may be
sent to the chosen external provider and may incur usage cost. The reviewed
product-owned runtime instruction template is packaged source. Expanded
requests containing project content, transcripts, private reasoning,
credentials, and raw provider sessions must not be written into the user's
repository or retained as project evidence.

Use fixed executable and argv construction rather than shell interpolation.
Do not print inherited secrets. Cancellation and timeouts must stop the bounded
foreground operation without creating a daemon or automatic retry loop.

Existing provider instructions are untrusted natural-language input. External
analysis may be incorrect or influenced by that content. Canonical validation,
the complete provider diff, exact plan freshness, renderer ownership, final
check, and explicit unresolved-content reporting remain required.

## Revisit triggers

- A supported provider removes or materially changes its non-interactive CLI.
- Launcher maintenance becomes larger than the onboarding effort it removes.
- Users require remote, background, concurrent, or multi-agent execution.
- A provider requires agentdevflow-managed credentials or model billing.
- Dogfood shows that external-agent operation bypasses canonical rules or
  cannot reliably reach a clean checked state.
- A smaller standardized agent protocol becomes available and passes the same
  installed-version and ownership requirements.

## Supersedes

This decision supersedes the assumption that agent-assisted onboarding must be
proposal-only or indefinitely deferred. It does not supersede the prohibition
on embedded provider runtimes, credential management, direct provider-file
editing, or general repository analysis.
