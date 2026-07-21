# Private approved-init render contract

## Status

This contract defines the retained schema-version-0 bridge from a complete private init proposal to the existing exact-plan render command. It is not a public approval protocol, authentication mechanism, CLI contract, configuration format, snapshot location, lock location, or general overwrite facility.

The active revision-1 local path does not translate its richer project intent into this older proposal shape. Instead, the application planner rederives exact adoption and lossless-import authorization from current native targets whenever the lock is absent. `diff` displays the complete resulting snapshot, and `render` rereads configuration, reanalyzes every current provider path, replans, and requires the same complete snapshot approval before invoking the same render command. This is the evidence-backed successor allowed by the original boundary; it introduces no second writer or generic overwrite flag.

## Eligible proposals

The bridge accepts only a complete private init result that:

- has a valid normalized candidate configuration;
- contains exactly one sorted entry for every configured provider product;
- has no diagnostics or `abort` dispositions;
- contains only `create`, exact-byte `adopt`, or lossless `import` dispositions;
- has no information-loss entries;
- binds every target byte string, target digest, observed digest, source reference, and provider path consistently.

Lossy imports are not eligible for this path. A future representation for retained and discarded intent requires separate evidence and review.

## Approval envelope

The proposal digest covers the proposal outcome, candidate exit code, normalized configuration revision, canonical configuration JSON and digest, every complete proposal entry, and diagnostics. Unknown proposal fields fail closed instead of being omitted from the digest.

The revisioned approval envelope binds that proposal digest and the provider, path, disposition, observed digest, and target digest of every entry. Its digest covers the complete envelope. The helper that creates the envelope records a caller assertion that the complete proposal was approved; it does not authenticate a person, establish organizational authority, or prove that a user interface displayed the proposal correctly.

## Preparation

Preparation occurs before repository mutation:

1. validate the complete proposal and approval envelope;
2. require the private compilation to belong to the proposed candidate configuration;
3. reread every provider path;
4. require every exact current digest or absence to match the proposal;
5. re-run the narrow project-instructions analyzer for every import and require a current lossless result;
6. build a renderer request with no previous ownership, exact adoption paths, and exact observed-to-target initialization-import authorizations;
7. require the renderer plan to reproduce every proposed path, action, observed digest, target byte string, target digest, and source reference;
8. create the existing exact render-plan snapshot;
9. bind the proposal digest, approval digest, and snapshot digest into a revisioned prepared-plan digest.

The staged adapter accepts an unowned initialization import only when its current observed digest and staged target digest both match the authorization. A stale, unused, missing, duplicated, or conflicting authorization makes the plan unsafe. This authorization cannot express an arbitrary replacement because both states are fixed before planning and the bridge independently rechecks lossless import semantics.

## Execution and interruption

Execution revalidates the proposal, approval envelope, prepared-plan digest, exact snapshot, and proposal-to-plan mapping. It then invokes the existing private render command with explicit absence of a base lock. No second filesystem writer is introduced.

The retained snapshot contains the original before and target digests. If execution stops after some outputs reach the target, the same prepared package can resume through the existing before-or-after convergence rules and publish the target lock. Re-running preparation is not required and may correctly fail because the repository no longer matches the original all-before observation.

The revision-1 CLI persists neither this prepared package nor another journal. Fresh creates can reconstruct the original all-before plan from exact target bytes and the original approval. If an initialization import reaches its target and loses the original different before-bytes before lock publication, the old import snapshot cannot be reconstructed from a digest alone. The CLI then requires a new diff and approval of the exact adopt-and-complete plan; it does not invent the lost observation or silently reuse the stale import approval.

The existing private render command remains responsible for output convergence, verification, lock-path separation, base-or-target lock validation, target-lock publication, and exact post-write verification.

## Explicit non-claims

The bridge does not provide:

- a public approval, configuration, snapshot, or lock format;
- approval authentication, signatures, identities, roles, or audit-log storage;
- lossy import, content merge, semantic equivalence, or AI-assisted analysis;
- import for commands, skills, hooks, permissions, MCP configuration, or provider-global files;
- mutation based on Git cleanliness, Git reset, clean, stash, commit, or branch operations;
- a force flag, silent overwrite, or ownership inference;
- public CLI prompts, exit codes, persistence discovery, or migration behavior;
- hostile concurrent-writer exclusion or cross-file atomic visibility.

Any future user-facing initialization flow must retain the proposal before mutation, make approval scope explicit, and call this bridge or an evidence-backed successor rather than bypassing the normal renderer plan and command path.
