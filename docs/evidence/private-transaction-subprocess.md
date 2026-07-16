# Private transaction subprocess recovery evidence

Snapshot date: 2026-07-17.

## Verdict

**Pass on the tested Darwin environment.** A real Node.js child process can be terminated with `SIGKILL` at every forward transaction boundary, leave an exclusive writer record behind, and recover deterministically after an external actor confirms process exit and explicitly clears that unchanged writer record.

The first six boundaries recover exact base output and lock bytes with a terminal `rolled-back` journal. The last four recover exact target output and lock bytes with a terminal `committed` journal. This evidence does not claim power-loss behavior or support on untested platforms and filesystems.

## Reproduction

Implementation:

- `src/transaction/private-transaction-executor.ts`;
- `src/transaction/private-transaction-store.ts`;
- `src/workspace/private-filesystem-workspace.ts`.

Automated coverage:

- `test/transaction/private-transaction-subprocess.test.ts`;
- `test/fixtures/transaction/private-transaction-subprocess-worker.ts`;
- `test/transaction/private-transaction-executor.test.ts`;
- `test/transaction/private-transaction-store.test.ts`.

Run:

```bash
npm install
npm run check
```

The subprocess suite contains thirty tests including twenty-four boundary subtests. The complete suite contains 170 tests at this snapshot.

Recorded environment:

```text
Node.js v24.14.0
darwin arm64
Darwin kernel 25.5.0
```

## Termination protocol

The parent prepares a Balanced-to-Fast transaction in temporary repository and store directories, then forks the compiled worker with an IPC channel. The worker starts normal execution and blocks immediately after reporting the requested boundary. The parent sends `SIGKILL` and waits for the operating system to report child termination before touching the stale writer record.

The ten boundaries are:

1. `outputs-applying` journal persistence;
2. Cursor output mutation;
3. Codex temporary-file creation;
4. Codex temporary-file synchronization;
5. Codex output mutation;
6. Claude Code output mutation;
7. target-lock publication;
8. `lock-written` journal persistence;
9. target-state verification;
10. `committed` journal persistence.

For every boundary, an ordinary recovery attempt first fails with `PRIVATE_TRANSACTION_WRITER_BUSY`. The parent then:

1. captures an opaque SHA-256 fingerprint of the current canonical writer record;
2. supplies the expected prepared transaction digest;
3. persists clearance for that fingerprint and requests removal of only the unchanged writer record;
4. starts normal recovery under a newly acquired writer lease;
5. verifies terminal journal state and exact lock and output bytes.

The writer token is not returned as recovery evidence. A changed record, malformed record, wrong fingerprint, or wrong transaction digest fails closed. There is no timeout, PID test, age heuristic, or automatic takeover.

At the two Codex temporary-file boundaries, the durable intent registry identifies the exact same-directory path and binds it to the stale writer fingerprint. The creation boundary leaves an empty file; the synchronization boundary leaves bytes matching the target digest. After explicit writer clearance, recovery reclaims only that exact path and emits a deterministic reclamation event before rolling back. Replacing the path with a symbolic link instead fails closed without changing its target.

## Directory synchronization

The filesystem workspace synchronizes temporary-file content before publication and synchronizes affected directories after directory creation, rename, hard-link publication, temporary-file cleanup, and unlink. Workspace opening probes directory synchronization support and fails early if it is unavailable. These calls completed throughout all subprocess fixtures on the recorded environment.

Node.js exposes the underlying synchronization operation through `FileHandle.sync()` and creates the handle through `fsPromises.open()` ([Node.js filesystem API](https://nodejs.org/api/fs.html)). The experiment confirms successful API calls and process-kill recovery, not storage-device behavior after power loss.

## Retirement and cleanup termination

After a committed transaction, a child writes the retirement marker and is terminated before releasing its writer record. Cleanup refuses to start until the parent that observed child termination clears the exact stale writer evidence. The resumed lifecycle then tombstones and removes the store.

A separate child is terminated after each cleanup boundary: store tombstone publication, cleanup receipt publication, and tombstone removal. Re-entering cleanup reaches the same canonical receipt and leaves no transaction store or tombstone. See [transaction cleanup evidence](private-transaction-cleanup.md).

## Recovery-process termination

The parent separately prepares a base-anchor rollback state and target-anchor roll-forward state. The target-anchor mixture is an explicit valid recovery fixture; normal execution publishes the target lock only after all output mutations.

The child is terminated after each of eleven recovery mutation events: three rollback paths, base verification, `rolled-back`, three roll-forward paths, `lock-written`, target verification, and `committed`. Each termination leaves a stale writer. After the parent observes process exit and clears the exact writer evidence, another recovery reaches exact terminal bytes and journal state.

A separate fixture changes one output to an unknown digest after killing rollback recovery. Clearing the stale writer does not authorize those bytes: recovery reports conflict and leaves `outputs-applying` unchanged.

## Limitations

- The stale-writer clear operation relies on external proof that the owner process terminated; the store cannot determine liveness.
- The writer record is a cooperative exclusion mechanism, not an operating-system advisory lock.
- The executor revalidates its lease immediately before mutation, but path-based calls still have race windows against a hostile concurrent process.
- `SIGKILL` does not simulate kernel panic, sudden power loss, controller-cache loss, or filesystem corruption.
- Only the recorded Darwin environment is tested. Linux, Windows, network filesystems, and other local filesystems remain unqualified.
- A killed process can leave repository-side same-directory temporary files. Transaction-owned writes use exact intent-and-clearance reclamation, while ordinary non-transactional workspace writes do not.
- A hostile regular-file replacement at an exact cleared intent path remains indistinguishable from partial owned bytes.
- Cleanup receipts are retained for the lifetime of a dedicated, canonically claimed private parent; no per-receipt pruning exists.
- Private store, lock, transaction, and journal paths and formats remain intentionally unspecified.

## Recommendation

Retain the transaction, temporary-file ownership, cleanup, and parent-lifecycle protocols. The subprocess suite is enabled without Windows skips, but Linux and Windows remain unqualified until the [candidate platform matrix](candidate-platform-qualification.md) runs. Do not freeze public storage paths until those results establish an honest interruption contract.
