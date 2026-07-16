# Private filesystem workspace evidence

Snapshot date: 2026-07-17.

## Verdict

**Pass for the real filesystem path-safety slice.** The renderer workspace contract now has a private Node.js filesystem implementation that confines canonical relative paths to a canonical repository root, rejects existing symbolic-link traversal, requires regular-file leaves, and replaces files through same-directory temporary files.

This verdict does not cover concurrent hostile mutation, power-loss durability, or cross-platform release support. A separate private store and executor use the workspace for process-termination recovery on the tested Darwin environment. Roadmap step 4 remains in progress.

## Reproduction

Implementation:

- `src/workspace/private-filesystem-workspace.ts`;
- `src/renderer/contract.ts`.

Automated coverage:

- `test/workspace/private-filesystem-workspace.test.ts`;
- `test/renderer/staged-adapter.test.ts`;
- `test/transaction/private-render-transaction.test.ts`.

Run:

```bash
npm install
npm run check
```

The workspace-specific suite contains twelve tests. The complete suite contains 170 tests at this snapshot.

## Root and path rules

Opening a private filesystem workspace requires an existing directory. A symbolic link supplied as the root itself is rejected. The implementation resolves the accepted directory to its canonical path before resolving project-relative paths.

Every renderer path must be:

- non-empty and free of leading or trailing whitespace;
- free of control characters and backslashes;
- relative under POSIX project-path semantics;
- already normalized, without `.` segments, `..` traversal, duplicate separators, or trailing separators;
- lexically contained by the canonical root.

Diagnostics contain project-relative paths only. They do not include the local absolute repository path.

## Existing path inspection

Before reading, writing, or removing a path, the workspace inspects each existing parent component with `lstat`:

- a symbolic-link component is rejected;
- a non-directory parent is rejected;
- a missing parent is treated as missing for reads and removals;
- writes create missing parent directories one component at a time and inspect the result.

The final existing path must be a regular file. Symbolic links, directories, sockets, devices, and other file types are rejected.

Reads open the final file with `O_NOFOLLOW` and confirm the opened handle is still a regular file. This adds a final-leaf check beyond the preceding path inspection.

## Single-file mutation behavior

Writes:

1. create an exclusive temporary file in the target directory;
2. write and synchronize the temporary file contents;
3. re-inspect the parent and target paths;
4. rename the temporary file over the target;
5. synchronize the containing directory after rename;
6. remove the temporary file if the operation fails before rename and synchronize that removal.

Using the target directory avoids cross-filesystem rename. Existing file permission bits are retained; new files use the process umask applied to mode `0666`.

Removals only unlink an inspected regular-file leaf. Removing an absent path is a no-op.

Exclusive creation synchronizes a temporary file and publishes it through a same-directory hard link, which fails if the destination already exists. It removes the temporary link and synchronizes the final directory state before returning. Owner-matched removal reads the content twice and refuses to remove a value that does not match the caller's expected ownership token.

Workspace opening performs a directory synchronization probe and fails before mutation if the current filesystem cannot support it. Newly created directories and their parents are synchronized, as are containing directories after rename, hard-link publication, temporary-file cleanup, and unlink. Node.js documents `FileHandle.sync()` as forcing queued I/O to synchronized completion and `fsPromises.open()` as the source of the handle; the durability semantics still depend on the operating system and filesystem ([Node.js filesystem API](https://nodejs.org/api/fs.html)).

These methods satisfy the existing `RenderWorkspace` contract. The method names do not imply a durable multi-file transaction; transaction ordering and recovery remain executor responsibilities.

## Transaction-owned temporary files

The private transaction workspace additionally accepts a validated mutation intent whose transaction, writer, target path, target digest, deterministic temporary path, and intent digest were persisted before repository mutation. It exclusively creates that exact same-directory path, verifies the content digest, emits creation and synchronization boundaries, and then follows the same rename and directory-synchronization behavior.

Inspection and reclamation also require the complete intent. They never scan the repository or infer ownership from a filename, PID, timestamp, or age. Only a regular file at the exact path can be removed; a symbolic link or directory fails closed. The transaction executor separately proves that the intent's writer has durable clearance before calling removal. See [temporary-file ownership evidence](private-temporary-file-ownership.md).

## Observations

Automated tests demonstrate:

- nested directory creation, first write, replacement, read, removal, and repeated removal;
- no temporary file remains after successful replacement;
- deterministic owned writes emit creation and synchronization boundaries and leave no temporary file after success;
- cooperative faults at both owned-write boundaries remove the temporary file;
- an exact registered partial regular file can be inspected and removed;
- symbolic links, directories, invalid intents, digest mismatches, and existing exact-path conflicts are rejected;
- exclusive creation refuses an existing writer record and owner-matched removal refuses another token;
- missing and regular-file roots are rejected;
- absolute, parent-traversing, non-normalized, backslash, whitespace-padded, and control-character paths are rejected;
- root, parent, and leaf symbolic links are rejected without changing their external target;
- a directory cannot be treated as a generated file;
- a regular file cannot be traversed as a parent directory;
- the native Codex, Claude Code, and Cursor renderer completes plan, render, and verify in a temporary repository.

The symbolic-link fixture passed on the current macOS experiment host. It is no longer skipped on Windows, but no Windows runner result has been captured yet.

## Limitations

- Path inspection and mutation use path-based Node.js APIs, not directory-handle-relative `openat` operations. Another process can change a parent between checks.
- The transaction store has a cooperative exclusive writer record, but there is no repository-wide operating-system lock or comparison-and-swap apply service.
- Directory synchronization succeeded under Node.js 24.14.0 on Darwin arm64; other operating systems and filesystems are not yet release-qualified.
- Successful synchronization calls do not by themselves prove behavior under sudden power loss.
- Ordinary non-transactional workspace writes can still leave an untracked temporary file after abrupt process termination. Transaction-owned writes use the separate intent-and-clearance protocol.
- A hostile regular file placed at an exact cleared intent path is indistinguishable from owned partial bytes. The protocol assumes cooperative writers and fails closed for symbolic links and non-regular leaves.
- Hard-link ownership, case-folding collisions, Unicode normalization collisions, filesystem aliases, and network filesystems have not been evaluated.
- Windows and Linux behavior have not been validated in this slice.
- Process-kill recovery is verified only on the recorded Darwin environment; power-loss durability remains unverified.
- No public path, lock filename, transaction directory, schema, or CLI behavior is selected.

## Next experiment

Run the [candidate platform qualification](candidate-platform-qualification.md) matrix before promoting any additional operating system to supported status.
