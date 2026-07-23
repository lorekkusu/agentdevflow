# CLI implementation evidence

## Scope

This document maps the current four-command implementation to reproducible
coverage. It does not claim that the unreleased working tree has passed
external dogfood or has been published.

Implementation:

- `src/cli/private-local-cli.ts`;
- `src/cli/private-local-cli-output.ts`;
- `src/interface/private-cli-arguments.ts`;
- `src/application/private-domain-project-plan.ts`;
- `src/commands/private-check-command-service.ts`;
- `src/commands/private-diff-command-service.ts`;
- `src/commands/private-render-command-service.ts`.

Primary tests:

- `test/interface/private-cli-arguments.test.ts`;
- `test/cli/private-local-cli.test.ts`;
- `test/commands/private-check-command-service.test.ts`;
- `test/commands/private-diff-command-service.test.ts`;
- `test/commands/private-render-command-service.test.ts`;
- `test/commands/private-render-command-subprocess.test.ts`.

## Current command surface

```text
agentdevflow init ...
agentdevflow diff ...
agentdevflow render --approve-plan <exact-plan-digest> ...
agentdevflow check ...
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

The four canonical guidance paths are:

- `.agentdevflow/rules/shared.md`;
- `.agentdevflow/rules/steward.md`;
- `.agentdevflow/rules/developer.md`;
- `.agentdevflow/rules/reviewer.md`.

Source edits therefore change the exact plan. They do not require another
command, approval store, or transaction boundary.

## Command behavior

- `init` creates only an absent configuration after validating the complete
  project and provider-file disposition.
- `diff` is read-only and returns the recognized target plus exact digest.
- `render` rereads and replans through the mutable workspace, rejects stale
  approval, writes provider files, and publishes the lock last.
- `check` is read-only and reports clean, changes-required, or blocked state.

All commands support bounded human or schema-version-1 JSON output. Exit `0`
means clean or successful, `1` means reviewable changes, and `2` means blocked
or invalid.

## External-system limit

The tracker-backed workflow compiles advisory procedures. CLI execution does
not access Linear, GitHub, CI, coding-agent processes, credentials, or the
network. The generated agent instructions carry the stop conditions.

## Qualification boundary

Source-level tests are necessary but do not prove installed behavior. The
current candidate requires:

```bash
npm run check
npm run check:v1-qualification
npm run check:package-entrypoint
npm pack --dry-run --json
```

Installed-entrypoint qualification must cover both workflow families,
canonical guidance routing, responsibility-specific outputs, exact-approved
render, clean check, repeated clean diff, stale approval, and generated-file
drift.
