# Getting started with the beta

This guide covers the complete public behavior of the repaired `agentdevflow` beta. It separates CLI-supported features from longer-term product direction.

> **Version notice:** do not use `0.1.0-beta.1`; its POSIX entrypoint is not
> executable. The examples below target `0.1.0-beta.2` and become registry-ready
> when the [exact npm version page](https://www.npmjs.com/package/agentdevflow/v/0.1.0-beta.2) resolves.

## Requirements and invocation

Use Node.js 22 or 24 and an npm release compatible with those Node.js versions. During beta, invoke the exact prerelease version:

```bash
npx --yes agentdevflow@0.1.0-beta.2 --help
```

Commands use the current directory as the exact repository root unless `--repository <path>` is supplied. They do not search parent directories.

Default paths are:

| Purpose | Default | Override |
| --- | --- | --- |
| Project configuration | `agentdevflow.config.jsonc` | `--config <repository-relative-path>` |
| Ownership lock | `.agentdevflow/lock.json` | `--lock <repository-relative-path>` |

Absolute, escaping, symbolic-link, and non-regular-file paths fail closed.

## Current configuration choices

The current CLI-supported workflow model is `local-reviewed-change`. It has no issue, pull-request, CI, or merge operation.

### Providers and responsibilities

Declare each provider as `id,product,surface`:

- `id` is a project-local name chosen by the user;
- `product` is `codex`, `claude-code`, or `cursor`;
- `surface` is `cli` or `ide`.

The `--steward`, `--developer`, and `--reviewer` options must reference declared provider ids. One provider may hold multiple responsibilities, or each responsibility may use a different provider.

| Responsibility | Purpose |
| --- | --- |
| Steward | Plans the change and coordinates movement between implementation and rework. |
| Developer | Implements and verifies the change. |
| Reviewer | Reviews the current change and either accepts it or returns blocking findings. |

Role bindings describe responsibility. They do not authenticate a person, provider account, fresh context, or independent principal.

### Presets

| Preset | Current local policy |
| --- | --- |
| `fast` | Generated advisory policy instructs the workflow to obtain a review verdict before acceptance. It does not model separate reviewer-isolation evidence. |
| `balanced` | Generated advisory policy models a review verdict, reviewer-isolation evidence, and no active blocking finding at acceptance. |

The public CLI does not receive, track, or validate actual review verdicts, blocking findings, or reviewer-isolation evidence. These presets select the policy model and generated instructions; they do not create a runtime gate.

### Tracker mode

`--tracker local` and `--tracker none` are accepted for the local workflow. Neither value starts or integrates a tracker. The choice is retained as project intent and appears in generated instructions.

## Multi-provider example

This example assigns Codex as Steward, Cursor as Developer, and Claude Code as Reviewer:

```bash
npx --yes agentdevflow@0.1.0-beta.2 init \
  --workflow local-reviewed-change \
  --preset balanced \
  --tracker local \
  --provider codex-steward,codex,cli \
  --provider cursor-developer,cursor,cli \
  --provider claude-reviewer,claude-code,cli \
  --steward codex-steward \
  --developer cursor-developer \
  --reviewer claude-reviewer
```

For this absent-target example, successful initialization creates only the configuration and exits with status `0`. A supported lossless-import proposal is also successful but exits with status `1` because the imported target still requires review. Continue with:

```bash
npx --yes agentdevflow@0.1.0-beta.2 diff
npx --yes agentdevflow@0.1.0-beta.2 render --approve-plan <exact-plan-digest>
npx --yes agentdevflow@0.1.0-beta.2 check
```

Reviewable changes produce exit status `1`. Do not treat that status as an execution failure. Blocked or invalid state produces exit status `2`.

## Generated targets and ownership

The configured provider products select these project-wide targets:

| Product | Managed target |
| --- | --- |
| Codex | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/agentdevflow.mdc` |

The plan classifies each target before mutation:

- **Create**: the target is absent.
- **Exact adopt**: existing bytes already equal the target.
- **Lossless import**: supported existing bytes have the same complete logical instructions and can be normalized without losing meaning.
- **Abort**: different existing instructions cannot be preserved exactly.

The beta does not merge arbitrary existing instructions or manage a delimited section inside a foreign file. Move or reconcile conflicting content manually, then rerun `diff`; never authorize replacement merely because Git reports a clean repository.

Exact adopt and lossless import transfer ownership of the whole target path; this is not managed-section adoption. Lossless import replaces the whole file with canonical generated bytes after the exact diff is approved.

After render, `.agentdevflow/lock.json` records ownership. Modifying a managed target outside a new approved plan produces blocked drift instead of silent repair. Removing a provider product can plan deletion of its formerly managed file, but only when the file still matches the exact lock digest and the user approves that deletion in the complete diff.

## Exact approval flow

`diff` prints both human-readable changes and an `exact-plan-digest`. The digest binds the complete current plan snapshot, including existing-file observations. It is not an identity or authentication mechanism.

`render --approve-plan <digest>` rereads the configuration and repository, replans through a mutation-capable workspace, and requires the digest to match again. A stale digest or foreign state fails before provider-file mutation.

## Machine output and exit statuses

Add `--json` to emit one bounded UTF-8 JSON object with `schemaVersion: 1`, the command, outcome, exit code, sorted diagnostics, and command-specific fields.

| Exit status | Meaning |
| --- | --- |
| `0` | Success and clean or acceptable state. |
| `1` | Reviewable changes are required, or supplied observations are degraded. |
| `2` | Input or state is blocked, invalid, unsafe, unsupported, or failed unexpectedly. |

When scripting `diff` or `doctor`, handle exit status `1` as a documented result rather than losing the report under shell fail-fast behavior.

## Caller-supplied doctor observations

`doctor` does not discover provider installations, execute commands, inspect credentials, or access the network. It validates a revision-1 JSON envelope supplied by the caller. Every source, reference, freshness, version, principal, and capability value is a caller assertion. The `probe` label is not authenticated or independently verified. A `healthy` result means only that the envelope is structurally valid and internally sufficient if those assertions are true; it is not proof that the environment is healthy. Manual assertions produce a degraded result.

For the single-provider quick start, save this as `agentdevflow-doctor-observations.json`:

```json
{
  "revision": 1,
  "providerObservations": [
    {
      "providerId": "codex-main",
      "product": "codex",
      "surface": "cli",
      "version": null,
      "executionContext": "local-project",
      "principal": null,
      "capabilities": [
        {
          "capability": "project-instructions",
          "strength": "advisory",
          "mechanism": "instruction-file"
        }
      ],
      "evidence": {
        "source": "manual",
        "reference": "manual:getting-started",
        "freshness": "current"
      }
    }
  ],
  "environmentObservations": [
    {
      "capability": "filesystem-read",
      "availability": "available",
      "evidence": {
        "source": "manual",
        "reference": "manual:getting-started-read",
        "freshness": "current"
      }
    },
    {
      "capability": "filesystem-write",
      "availability": "available",
      "evidence": {
        "source": "manual",
        "reference": "manual:getting-started-write",
        "freshness": "current"
      }
    }
  ]
}
```

Run:

```bash
npx --yes agentdevflow@0.1.0-beta.2 doctor \
  --observations agentdevflow-doctor-observations.json \
  --json
```

The expected outcome for these manual assertions is degraded with exit status `1`. Do not change `source` to `probe` unless a real bounded probe produced the observation.

## Current non-features

The beta does not:

- launch, delegate to, monitor, or retry coding agents;
- create or update GitHub Issues or Linear work items;
- create, observe, mark ready, review, or merge pull requests;
- query CI, branch protection, provider versions, credentials, or environment access;
- expose a public arbitrary-workflow language;
- provide Strict or Custom preset behavior;
- merge unrelated existing project-instruction content;
- claim that advisory instructions mechanically enforce agent behavior.

The provider-neutral issue-to-reviewed-pull-request model and external evidence contracts remain validated internal directions. They become user-facing only after real adapter and migration evidence supports an explicit product decision.
