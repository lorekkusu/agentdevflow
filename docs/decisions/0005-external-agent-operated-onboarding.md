# 0005: External agents operate onboarding through the CLI

Status: Accepted; Codex-first interaction amended 2026-07-24

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

The initial interface does not expose separate propose and apply modes.
`agentdevflow onboard` presents a bounded Manual/Codex picker in an interactive
terminal. `--agent manual` selects the existing exact inventory directly.
`--agent codex` launches one interactive Codex session in which the agent
analyzes the inventory, explains its proposed rule organization, accepts
natural-language correction, and asks the user before mutation. The same
session then operates the CLI after acceptance, so the proposal does not need
to be copied into a second process or stored by `agentdevflow`.

`--agent codex --yes` authorizes one non-interactive operation without that
question. In both paths the exact plan digest remains a freshness binding, not
authentication or a second approval record. Ambiguous or unresolved content
must stop rather than be silently omitted.

The Codex launcher is a thin process adapter outside workflow and policy
compilation. It maps one bounded task to the fixed `codex` executable, argv,
stdin when non-interactive, working directory, timeout, and process result. A
reviewed, visible, English product-owned runtime instruction template defines
the task. The launcher uses the user's installed Codex CLI with its existing
authentication, configuration, permissions, hooks, MCP servers, and session
behavior. `agentdevflow` does not inspect, copy, store, print, override,
refresh, provision, or diagnose those facilities.

The external agent is not a second provider-file writer. Managed provider files
and the ownership lock remain valid only through the existing complete plan,
exact render approval, renderer apply, and final check. Product success is
determined by canonical rule validation and managed state, not by the agent's
prose, claimed completion, session identity, or exit code alone.

Codex CLI is the only initial public launcher. Other launchers may be considered
later but remain unsupported and absent from the picker until separately
implemented and qualified. The adapter does not maintain a proactive Codex
version allowlist. It invokes the user's current installed CLI and handles
actual process failure. A reproduced incompatibility may justify a targeted
compatibility check later. The manual onboarding path remains available.

## Consequences

- Existing projects can borrow the user's preferred external agent for
  semantic classification while retaining one deterministic project mutation
  model.
- `agentdevflow` does not need provider API keys, SDKs, login flows, a model
  selector, or a credential store.
- External-agent behavior, persistence, permissions, extensions, and cost
  remain governed by the user's installed CLI and account.
- The Codex adapter reports bounded missing-executable, launch, timeout,
  cancellation, non-zero-exit, and final-check failures. It does not infer
  authentication state, classify provider permission failures, parse a
  provider proposal schema, or maintain a compatibility catalog.
- Starting a new process does not prove reviewer independence or produce
  trusted workflow evidence.
- The product does not override provider permission controls or claim
  hostile-process confinement. The supported environment remains a cooperative
  local user and selected agent.
- The exact current `agentdevflow` executable must be passed to the external
  agent so one onboarding operation cannot mix package versions.

## Alternatives considered

- **Embed provider SDKs and manage credentials.** Rejected because it adds
  credential, model, billing, retry, and provider-runtime ownership unrelated
  to the local configurator.
- **Generate a proposal and require the user to repeat every CLI step.**
  Rejected as the only path because it discards the main convenience of using
  an external agent as the user's operator.
- **Launch separate proposal and apply processes.** Rejected because it repeats
  startup and context transfer, spends additional provider tokens, and requires
  a proposal handoff format. One interactive provider session already supports
  explanation, natural-language correction, confirmation, and execution.
- **Maintain a qualified Codex version allowlist.** Rejected until a reproduced
  incompatibility justifies the maintenance cost. Fast-moving provider
  releases make proactive exact-version tracking disproportionate for the
  current product.
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

Implementation, deterministic process fixtures, installed-package exercise,
and authenticated private-repository dogfood remain acceptance gates in the root
[product roadmap](../../ROADMAP.md).

## Security and disclosure considerations

Public documentation states that the selected external CLI may process project
instruction content and incur provider usage. The launcher does not add a
separate warning or cost workflow. The reviewed product-owned runtime
instruction template is packaged source. Expanded requests containing project
content, transcripts, private reasoning, credentials, and raw provider sessions
must not be written into the user's repository or retained as project evidence.

Use fixed executable and argv construction rather than shell interpolation.
Do not print inherited secrets. The one internal timeout and cancellation path
must stop the bounded foreground operation without creating a daemon,
automatic retry loop, public timeout control, or provider diagnostic subsystem.

Existing provider instructions are untrusted natural-language input. External
analysis may be incorrect or influenced by that content. Canonical validation,
the complete provider diff, exact plan freshness, renderer ownership, final
check, and explicit unresolved-content reporting remain required.

## Revisit triggers

- Codex removes or materially changes its interactive or non-interactive CLI in
  a reproduced user failure.
- Launcher maintenance becomes larger than the onboarding effort it removes.
- Users require remote, background, concurrent, or multi-agent execution.
- A provider requires agentdevflow-managed credentials or model billing.
- Dogfood shows that external-agent operation bypasses canonical rules or
  cannot reliably reach a clean checked state.
- A smaller standardized agent protocol becomes available and passes the same
  ownership requirements.

## Supersedes

This decision supersedes the assumption that agent-assisted onboarding must be
proposal-only or indefinitely deferred. The 2026-07-24 amendment also
supersedes separate public propose/apply modes, a two-process proposal handoff,
runtime content/cost confirmation, and proactive installed-version allowlists.
It does not supersede the prohibition on embedded provider runtimes, credential
management, direct provider-file editing, or general repository analysis.
