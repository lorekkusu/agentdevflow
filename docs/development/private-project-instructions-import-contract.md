# Private project-instructions import contract

## Status

This contract defines an internal, deterministic analyzer for the single project-instructions capability supported by the native renderer. It is not a public import API, provider-file parser framework, configuration migration format, merge algorithm, or mutation authorization.

## Required inputs

The pure analyzer accepts:

- one of the three initial provider products;
- exact existing provider-file bytes;
- exact proposed native target bytes;
- the normalized candidate-configuration digest.

It performs no filesystem reads, repository scans, Git inspection, writes, network access, provider execution, or configuration inference.

The candidate-configuration digest and target must be valid before content analysis begins. A malformed digest or a target that is not canonical output from the current native emitter is an internal input error rather than an import assessment.

## Supported equivalence

The first revision recognizes only logical content already representable by the current single project-instructions source document:

| Provider | Supported existing form |
| --- | --- |
| Codex | Plain project Markdown or canonical agentdevflow-generated Markdown. |
| Claude Code | Plain project Markdown or canonical agentdevflow-generated Markdown. |
| Cursor | The exact validated project-wide `alwaysApply: true` frontmatter followed by plain or canonical agentdevflow-generated Markdown. |

Existing line endings are normalized to LF and terminal whitespace is
normalized in the same way as the native emitter. This is treated internally
as lossless instruction intent because those bytes do not survive deterministic
native rendering. Public documentation calls the behavior equivalent-content
import to distinguish it from the accepted existing-project onboarding flow.
The observed digest still binds the original exact bytes.

The proposed target remains strict canonical LF output. Cursor frontmatter with different values, fields, formatting, or scope is unsupported. The analyzer does not embed a general YAML parser or infer whether another Cursor rule form is equivalent.

If normalized logical bodies are equal, the analyzer returns a `lossless` assessment bound to:

- the exact existing-content digest;
- the candidate-configuration digest;
- the exact target-content digest.

If bodies differ, the analyzer returns `unsupported`. It does not concatenate, merge, prioritize, summarize, or silently discard instructions. A malformed agentdevflow notice is also unsupported rather than being reinterpreted as user content.

## Relationship to private init

The returned shape is the assessment consumed by the private init proposal
service. A lossless assessment allows that service to propose `import`; an
unsupported assessment produces `abort` with the retained explanation.

This analyzer does not grant apply authority. Its digest-bound assessment is
already incorporated into the normal complete render plan. Even a lossless
result requires the private init proposal, explicit approval of that exact
plan, and an exact reread before the existing render path may apply it.

## Determinism and disclosure

The result contains digests, classification, and a closed explanation. It does not return existing content, semantic summaries, excerpts, local paths, timestamps, host data, or private configuration values.

Runtime is linear in existing and target content length. No parser recursion, executable predicate, dynamic provider discovery, or network-dependent behavior is involved.

## Explicit non-claims

The analyzer does not support:

- combining different provider instructions into one source document;
- importing content that differs from the proposed target body;
- arbitrary Cursor YAML or alternate rule scope;
- nested, global, manual, or agent-requested instructions;
- commands, skills, hooks, MCP configuration, permissions, or ignore files;
- semantic deduplication, conflict resolution, summarization, or AI-assisted analysis;
- public configuration syntax, filenames, CLI flags, or output compatibility;
- ownership claims, filesystem mutation, lock publication, or recovery.

Broader import support requires a separately evidenced representation and must preserve every unsupported or lossy construct explicitly.

Manual onboarding is tracked in the root `ROADMAP.md` and ADR 0006. Its exact
whole-file replacement input is separate from this analyzer; it does not
broaden the pure equivalence test or reinterpret the current `lossless`
classification as semantic proof.
