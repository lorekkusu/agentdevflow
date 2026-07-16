# Private repository temporary-file ownership evidence

Snapshot date: 2026-07-17.

## Verdict

**Pass for cooperative repository-side temporary-file recovery on the tested Darwin environment.** Every transaction-owned repository write now persists a digest-bound mutation intent before creating its same-directory temporary file. A later process can reclaim only the exact path recorded for a writer whose unchanged record was explicitly cleared after external process-death confirmation.

Recovery refuses an existing owned temporary file when no matching writer clearance exists. It also refuses a symbolic link, directory, malformed intent, unknown path, or conflicting deterministic temporary path. This verdict does not claim protection from a hostile process that can replace a regular file at the exact authorized path, power-loss durability, or support on untested platforms and filesystems.

## Reproduction

Implementation:

- `src/transaction/private-temporary-intent.ts`;
- `src/transaction/private-transaction-store.ts`;
- `src/transaction/private-transaction-executor.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/transaction/private-temporary-intent.test.ts`;
- `test/transaction/private-transaction-store.test.ts`;
- `test/transaction/private-transaction-executor.test.ts`;
- `test/transaction/private-transaction-subprocess.test.ts`;
- `test/workspace/private-filesystem-workspace.test.ts`.

Run:

```bash
npm install
npm run check
```

The complete suite contains 170 tests at this snapshot. The subprocess fixture includes ten forward termination boundaries, including temporary-file creation and synchronization for `AGENTS.md`.

Recorded environment:

```text
Node.js v24.14.0
darwin arm64
Darwin kernel 25.5.0
```

## Ownership protocol

For every repository write, the executor uses this order:

```text
verify active writer
-> persist canonical temporary mutation intent in the private store
-> verify active writer again
-> exclusively create the intent's exact same-directory temporary path
-> write and synchronize content
-> rename over the target
-> synchronize the target directory
```

The intent binds:

- private record revision;
- prepared transaction digest;
- opaque writer-record fingerprint;
- canonical target path;
- target content digest;
- deterministic temporary path;
- intent digest.

The temporary filename is derived from all ownership inputs. It contains no PID, timestamp, hostname, username, or random cleanup heuristic. Intent and clearance registries use strict canonical private JSON, sorted entries, exact fields, and digest validation. Their paths and revision are implementation details rather than public storage contracts.

A cooperative exception before rename closes the handle and removes the temporary file. A terminated process can leave an empty partial file after exclusive creation or complete synchronized target bytes before rename.

## Reclamation authority

The store does not infer process death. An external actor must first observe owner-process termination, capture the unchanged writer-record fingerprint, and supply the matching prepared transaction digest. The store persists a writer clearance before removing that exact writer record.

The next writer:

1. reads mutation intents whose writer fingerprints have a matching clearance;
2. verifies its own lease before each removal;
3. inspects and removes only each exact intent path;
4. synchronizes the containing directory;
5. refuses to continue if any recorded temporary file remains without clearance.

There is no directory scan, age threshold, PID reuse assumption, filename-only match, or automatic stale-writer takeover. Registry entries remain in the single-use store and are included in its retirement and cleanup inventory.

## Observations

Automated tests demonstrate:

- identical ownership inputs produce the same intent and temporary path;
- changing the writer, target path, or target digest changes the temporary path;
- intent is persisted while the repository temporary file is still absent;
- cooperative faults after temporary creation and synchronization remove the file immediately;
- recovery refuses a recorded temporary file without writer clearance;
- explicit evidence-bound writer clearance permits removal of that exact file;
- `SIGKILL` after creation leaves an empty regular temporary file;
- `SIGKILL` after synchronization leaves bytes matching the target digest;
- normal recovery remains writer-busy until the parent observes termination and explicitly clears the stale writer;
- resumed recovery reclaims the exact temporary file and restores exact base state;
- replacing the temporary file with a symbolic link fails closed without changing the link target;
- malformed, extended, non-canonical, unsafe, and digest-invalid records fail validation.

## Limitations

- Writer clearance depends on truthful external confirmation that the owner process terminated. Clearing a live writer violates the protocol.
- The opaque deterministic path makes accidental collision unlikely, but a hostile process with repository write access can observe the intent store or path and place a regular file at the exact authorized path. The recovery process cannot distinguish that replacement from partial owned bytes and will remove it.
- Symbolic links and directories at the exact path are rejected. Path-based Node.js calls still have race windows against hostile parent replacement.
- Intent persistence and repository mutation span separate directories and are recoverable, not atomically committed together. An intent with no temporary file is harmless and remains auditable until store cleanup.
- Store-local atomic-write temporary files are governed by the retired-store inventory, not this repository-side protocol.
- `SIGKILL` does not simulate sudden power loss, kernel failure, controller-cache loss, or filesystem corruption.
- Only the recorded Darwin environment is tested. Linux, Windows, network filesystems, case-folding behavior, and other local filesystems remain unqualified.
- No public lock path, store path, intent schema, configuration filename, or CLI behavior is selected.

## Recommendation

Retain the explicit intent-and-clearance design as the private transaction boundary. It closes repository-side temporary-file ambiguity without scanning or automatic takeover. Qualify the complete protocol, including the [parent lifecycle](private-transaction-parent-lifecycle.md), on intended release platforms before completing roadmap step 4.
