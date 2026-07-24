# CLI implementation evidence

## Scope

This document maps the current CLI implementation to reproducible coverage. It
does not claim that the unreleased working tree has passed external dogfood or
has been published.

Implementation:

- `src/cli/private-local-cli.ts`;
- `src/cli/private-local-cli-output.ts`;
- `src/interface/private-cli-arguments.ts`;
- `src/application/private-domain-project-plan.ts`;
- `src/commands/private-check-command-service.ts`;
- `src/commands/private-diff-command-service.ts`;
- `src/commands/private-render-command-service.ts`;
- `src/commands/private-rule-command-service.ts`;
- `src/cli/private-rule-input.ts`;
- `src/cli/private-onboarding-operator.ts`;
- `src/guidance/private-project-guidance.ts`;
- `src/onboarding/private-codex-onboarding-process.ts`;
- `src/onboarding/private-codex-onboarding-prompt.ts`.

Primary tests:

- `test/interface/private-cli-arguments.test.ts`;
- `test/cli/private-local-cli-output.test.ts`;
- `test/cli/private-local-cli.test.ts`;
- `test/cli/private-rule-input.test.ts`;
- `test/commands/private-check-command-service.test.ts`;
- `test/commands/private-diff-command-service.test.ts`;
- `test/commands/private-render-command-service.test.ts`;
- `test/commands/private-render-command-subprocess.test.ts`;
- `test/guidance/private-project-guidance.test.ts`;
- `test/onboarding/private-codex-onboarding-process.test.ts`;
- `test/onboarding/private-codex-onboarding-prompt.test.ts`.

## Current command surface

```text
agentdevflow init ...
agentdevflow onboard [--agent <manual|codex>] [--yes] ...
agentdevflow diff ...
agentdevflow render --approve-plan <exact-plan-digest> ...
agentdevflow check ...
agentdevflow rule list [--config <relative-path>] ...
agentdevflow rule show <id> [--config <relative-path>] ...
agentdevflow rule add <id> --scope <scope> (--file <path> | --stdin) [--config <relative-path>] ...
agentdevflow rule update <id> (--file <path> | --stdin) [--config <relative-path>] ...
agentdevflow rule remove <id> [--config <relative-path>] ...
```

`init` accepts:

- `local-reviewed-change` with local or no tracker;
- `issue-to-reviewed-pull-request` with Linear or GitHub Issues, draft or
  ready state, pull-request-host id, and CI id;
- Fast or Balanced;
- Codex, Claude Code, and Cursor providers;
- Steward, Developer, and Reviewer assignments.

The issue workflow fixes auxiliary review to disabled and merge method to
squash.

## Planning inputs

Every plan is derived from:

- current revision-1 configuration bytes;
- current optional canonical guidance bytes;
- current provider target bytes;
- current ownership lock bytes.

Canonical guidance is discovered from immediate `<rule-id>.md` files under:

- `.agentdevflow/rules/shared/`;
- `.agentdevflow/rules/steward/`;
- `.agentdevflow/rules/developer/`;
- `.agentdevflow/rules/reviewer/`.

Source edits therefore change the exact plan. They do not require another
command, approval store, or transaction boundary.

## Command behavior

- `init` creates an absent configuration or accepts byte-identical existing
  configuration after validating the complete project and provider-file
  disposition. It never overwrites different configuration bytes.
- `onboard` requires the valid selected configuration before selecting Manual
  or Codex. Missing, unreadable, or invalid configuration blocks before the
  ownership lock, provider targets, picker, or external process is accessed.
- Manual inventories the three fixed provider targets without mutation.
- Codex launches one fixed foreground process. The normal path keeps proposal,
  natural-language correction, confirmation, and command operation in one
  interactive session; `--yes` authorizes one non-interactive operation.
- Codex receives the exact current Node executable and agentdevflow entrypoint,
  operates the existing rule, diff, render, and check path, and is followed by
  an independent parent-run final check.
- `diff` is read-only and returns the recognized target plus exact digest.
- `render` rereads and replans through the mutable workspace, rejects stale
  approval, writes provider files, and publishes the lock last.
- `check` is read-only and reports clean, changes-required, or blocked state.
- Every rule operation first validates the selected configuration.
- `rule list` and `rule show` then read the deterministic canonical catalog.
- `rule add`, `rule update`, and `rule remove` then mutate one canonical rule
  file without writing provider outputs or the ownership lock.

All command families support bounded human or schema-version-1 JSON output.
Exit `0` means clean or successful, `1` means reviewable changes, and `2`
means blocked or invalid.

## External-system limit

The tracker-backed workflow compiles advisory procedures. CLI execution does
not access Linear, GitHub, CI, or their credentials or networks. The bounded
Codex onboarding path may launch the user's installed Codex CLI, but
agentdevflow does not inspect or manage provider authentication,
configuration, permissions, hooks, MCP servers, sessions, or credentials.
Generated agent instructions carry the remaining stop conditions.

## Qualification boundary

Source-level tests are necessary but do not prove installed behavior. The
current candidate requires:

```bash
npm run check
npm run check:v1-qualification
npm run check:package-entrypoint
npm pack --dry-run --json
```

Installed-entrypoint qualification must cover both workflow families, all five
rule operations, canonical guidance routing, responsibility-specific outputs,
exact-approved render, clean check, repeated clean diff, stale approval,
generated-file drift, and fail-closed aggregate-layout diagnostics.
