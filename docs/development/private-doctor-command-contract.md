# Private doctor command contract

## Status

This contract defines an internal deterministic doctor service over caller-supplied observations. It is not a stable CLI, API, probe protocol, provider integration, version-support table, discovery rule, or machine-output schema.

## Boundary

The service does not locate provider executables, spawn commands, call provider APIs, inspect credentials, read environment variables, or probe filesystem and network access. Those side effects belong to future narrow probe adapters with separately reviewed permissions.

The pure doctor core accepts:

- configured provider instances;
- private workflow capability requirements;
- caller-selected required environment capabilities;
- one closed, revisioned observation envelope.

This separation keeps provider command paths, authentication, version syntax, probe permissions, and platform support outside the semantic result model.

## Observation envelope

Each provider observation records:

- configured provider instance id, product, and surface;
- observed version or explicit unknown value;
- execution context;
- observed principal or explicit unknown value;
- supported capability, enforcement strength, and mechanism;
- evidence source, reference, and freshness.

Each environment observation records availability for one closed capability:

- filesystem read;
- filesystem write;
- process execution;
- network access.

Evidence source is `probe` or `manual`. Freshness is `current`, `stale`, or `unknown`. The core validates these values but does not independently prove that a probe ran, that its reference is authentic, or that `current` accurately reflects wall-clock age. A future adapter must define and test those claims.

Unknown fields, missing fields, unsupported enum values, and unsupported envelope revisions fail closed.

## Outcomes

| Outcome | Candidate exit code | Meaning |
| --- | ---: | --- |
| `healthy` | `0` | All required observations are current and sufficient, with no evidence-quality warning. |
| `degraded` | `1` | Requirements are satisfied, but evidence quality or optional availability has warnings. |
| `blocked` | `2` | Required provider, capability, strength, freshness, identity, or environment evidence is invalid or insufficient. |

Candidate exit codes remain private until CLI behavior is qualified and explicitly accepted.

Warnings include manual provider evidence, unknown provider version, unknown principal, unexpected provider observations, and unavailable optional environment capabilities. Missing provider evidence, identity mismatch, stale or unknown provider freshness, unavailable required capabilities, insufficient enforcement strength, duplicate observations, and unavailable required environment capabilities are errors.

## Compiler evidence

For non-blocked results, the service derives deterministic `PrivateCapabilityAvailability` entries from current provider observations. This is the existing private compiler input shape.

If any error exists, the service returns no capability availability entries. This prevents partial evidence from being passed to the compiler as if the doctor result succeeded.

Current manual evidence produces a degraded result but remains available to the private compiler, matching the existing asserted-fixture boundary. A future policy may require probe evidence for selected capabilities; this contract does not silently claim that manual evidence is mechanically verified.

## Determinism and disclosure

Reports, diagnostics, and capability availability are sorted deterministically. The service does not mutate observations and does not record timestamps, hostnames, absolute paths, credentials, tokens, environment variable values, or command output.

The durable repository should contain probe contracts and reproducible fixtures, not private local observation output. The current private CLI reads an explicit bounded observation file, emits only the semantic report, and persists nothing. A public CLI must define redaction and persistence before exposing environment reports.

## Explicit non-claims

The private service does not define:

- commands or APIs used to inspect Codex, Claude Code, or Cursor;
- supported or minimum provider versions;
- package-manager, binary-path, or authentication discovery;
- whether a principal represents a distinct human, account, process, or security boundary;
- authenticated evidence or attestations;
- live process, filesystem, network, or credential access;
- public diagnostic compatibility or JSON output;
- automatic installation, upgrade, login, repair, or configuration changes;
- broad provider support beyond the current candidate model.

Probe adapters must remain narrower than this provider-neutral result model and require separate evidence before use.

## Private local composition

The installed private command supports only the `local-reviewed-change` workflow. It parses the active revision-1 project document, reads a caller-selected observation envelope capped at 262,144 UTF-8 bytes, requires current filesystem-read and filesystem-write observations, and evaluates project-instructions capability evidence for the configured provider set.

This composition does not authenticate the observation producer. A healthy result means only that the supplied closed envelope is structurally valid, current by its own assertion, identity-consistent with the configuration, and sufficient for the current local requirements. Hosted workflows fail explicitly rather than reusing fixture observations or implying unavailable tracker, pull-request, CI, review-service, or merge adapters.
