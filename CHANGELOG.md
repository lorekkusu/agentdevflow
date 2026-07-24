# Changelog

All notable public changes will be recorded in this file. During beta, incompatible configuration or JSON-output changes must include migration notes.

## Unreleased

### Added

- Add `issue-to-reviewed-pull-request` to the non-interactive init surface with
  explicit Linear or GitHub Issues selection, draft or ready pull-request
  state, pull-request-host id, and CI id.
- Compile distinct Steward, Developer, and Reviewer procedures into the native
  Codex, Claude Code, and Cursor outputs.
- Add bounded human and JSON `rule list`, `rule show`, `rule add`, `rule
  update`, and `rule remove` commands over globally unique rule ids.
- Add read-only `onboard` inventory for the three fixed native instruction
  targets with exact bounded content, digest, ownership disposition, and
  classification state.
- Add Codex-operated onboarding through `onboard --agent codex`, with one
  interactive proposal, revision, confirmation, and execution session or one
  non-interactive operation authorized by `--yes`. The parent CLI independently
  runs the existing final check.
- Add repeatable exact `--replace-existing <path>=<observed-sha256>` inputs to
  `diff` and `render` for reviewed whole-file existing-project onboarding.
- Read optional user-owned Markdown rules from fixed shared, Steward,
  Developer, and Reviewer scope directories.
- Add an idempotent draft-to-ready procedure after required CI succeeds. It
  marks the pull request ready only when it is still a draft.

### Changed

- Fix the non-interactive first-use order as
  `init -> onboard -> rule as needed -> diff -> render -> check`. `onboard`
  and every rule operation now require the valid selected configuration, so
  neither can become a pre-init entry.
- Make the smallest one-provider configuration explicit in package-facing
  guidance and order the README and global help by the executable first-use
  journey.
- Exclude TypeScript declarations and source maps from the CLI-only build
  because the package exposes no programmatic entrypoint.
- Make every generated provider projection declare its target coding-agent
  product and provider id. A nonmatching runtime is instructed to ignore the
  entire projection, including shared guidance, after Cursor discovery overlap
  showed that native instruction surfaces cannot be assumed to be isolated.
- Require a multi-responsibility provider target to select exactly one
  responsibility section for each applicable workflow task. This remains
  advisory text, not identity, permission, session, or authority isolation.
- Treat every issue-workflow external capability as an advisory compiled
  procedure. The CLI does not connect to trackers, pull-request hosts, or CI,
  and the bounded onboarding launcher does not run configured workflow roles.
- Fix auxiliary review to disabled and merge method to squash in the current
  issue-workflow CLI surface.
- Reject multiple configured ids for one provider product because its single
  project-wide instruction target cannot isolate them.
- Establish the root `ROADMAP.md` as the durable requirement ledger and record
  the rule-management, existing-project onboarding, external-agent-operated
  onboarding, interactive wizard, and Strict preset sequence. Completion
  evidence now distinguishes implemented rule management from later work.
- Remove the unused high-risk-evidence placeholder from Fast and Balanced
  profiles and keep the unavailable Strict diagnostic neutral until its exact
  safety properties are accepted.
- Keep rule mutations separate from provider rendering: rule commands change
  one canonical source, while generated files and the ownership lock still
  require `diff` and exact-approved `render`.
- Fail closed with exact manual-move guidance when an unreleased aggregate rule
  path is present. Do not add automatic migration or a dual reader.
- Reject rule ids longer than 64 ASCII characters and Windows reserved
  basenames so every accepted id remains a portable filename.
- Allow init to create only an absent valid configuration and return
  `review-required` when unsupported existing provider content must be
  onboarded; provider targets and the lock remain unchanged.

### Removed

- Remove the low-value caller-supplied observation command from the current
  CLI and runtime. The current command set is `init`, `onboard`, `diff`,
  `render`, `check`, and the bounded `rule` command family.
- Remove obsolete research systems and detailed evidence whose conclusions are
  already represented by current architecture decisions or Git history.

### Migration

- Projects using the retired fifth beta command must stop invoking it; there
  is no replacement command in this candidate.
- Remove the retired `surface` property from every provider in existing
  configuration documents. Update scripted init calls from
  `--provider <id,product,surface>` to `--provider <id,product>`; the legacy
  property and three-component CLI form now fail validation.
- Consolidate multiple provider ids for the same provider product into one
  provider entry. Update `roles.steward`, `roles.developer`, and
  `roles.reviewer` to the retained id. Keep capability bindings targeted to
  responsibilities or integration ids rather than provider ids.
- Existing generated files remain subject to the complete diff, exact approval,
  whole-file ownership, and drift rules.
- Published `0.1.0-beta.2` projects require no aggregate-rule migration because
  that package did not contain the unreleased guidance reader. A repository
  that evaluated the intervening source tree must manually move any
  `.agentdevflow/rules/<scope>.md` bytes to a non-conflicting
  `.agentdevflow/rules/<scope>/<rule-id>.md` path before retrying; the CLI never
  performs that move.

The release sections below are historical snapshots. Their command and workflow
lists do not describe the unreleased candidate above.

## 0.1.0-beta.2 - 2026-07-21

### Fixed

- Preserve an executable POSIX mode on the built npm CLI and verify the packed, installed entrypoint directly.
- Support command-specific help for all five beta commands.
- Reject oversized doctor observation files with a bounded read instead of loading the complete file first.
- Preserve bounded schema-version-1 JSON when repository observation or planning fails unexpectedly.

### Documentation

- Add a public quick start, complete current option reference, generated-file ownership behavior, caller-supplied doctor example, and explicit non-features.
- Clarify advisory policy behavior, whole-file ownership and deletion, and the unauthenticated doctor-observation trust boundary.
- Synchronize the published beta, OIDC closure, and maintainer dogfood status across current project guidance.

### Publication

- Publish the repaired executable package through the protected OIDC workflow under npm's `next` tag.
- Verify exact-version, `next`, and `npm exec` entrypoints plus the complete documented first-run path from the public registry.

## 0.1.0-beta.1 - 2026-07-21

#### Added

- Local-first `init`, `diff`, `render`, `check`, and `doctor` commands.
- Provider-neutral project configuration with built-in local reviewed-change policy compilation.
- Native project-instructions rendering for Codex, Claude Code, and Cursor.
- Exact-root defaults for `agentdevflow.config.jsonc` and `.agentdevflow/lock.json`.
- Deterministic ownership, drift, conflict, exact-plan approval, and forward-convergent render behavior.
- Human-readable output and bounded JSON schema version 1.
- Apache License 2.0.

#### Limitations

- Only the local reviewed-change workflow is executable through `init`; workflows requiring external tracker, pull-request, CI, review-service, or merge adapters fail closed.
- `doctor` validates caller-supplied observations and does not run provider commands, inspect credentials, or use the network.
- Strict and Custom presets are unavailable.
- Beta configuration and JSON report fields may change through documented migration before 1.0.
- At first publication, npm established both `next` and the required `latest` tag at this version. Both tags now identify `0.1.0-beta.2`, and this first beta is deprecated; no distribution tag makes a prerelease stable.
