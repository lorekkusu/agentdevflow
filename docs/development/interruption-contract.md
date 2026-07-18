# Interruption contract

## Status

This document defines the stronger experimental write-ahead transactional workspace claim boundary. It is not the V1 default selected by [ADR 0002](../decisions/0002-v1-forward-convergent-render-apply.md). See the accepted [V1 recovery contract](v1-recovery-contract.md) for default render behavior.

This document does not freeze a public API, storage path, lock format, supported operating-system list, or CLI behavior.

`agentdevflow` provides recoverability across a tested set of interruptions. It does not provide cross-file atomicity and must not describe a multi-file render as an atomic filesystem transaction.

## State contract

A prepared private transaction binds:

- every affected path to an observed before digest and intended after digest;
- exact base and target lock digests;
- all before, after, and lock bytes required for recovery;
- a strict write-ahead journal;
- one cooperative writer lease;
- exact temporary mutation intents and evidence-bound stale-writer clearances.

Before target-lock publication, the base lock remains authoritative and recovery restores exact before bytes. After target-lock publication, the target lock is authoritative and recovery completes exact after bytes. Recovery reaches `rolled-back` or `committed`, or fails closed without accepting unknown path or lock content.

This is a recoverability contract. Other processes can observe intermediate output mixtures while execution is in progress.

## Verified interruption classes

The repository has executable evidence for:

| Interruption | Current evidence | Claim |
| --- | --- | --- |
| Cooperative exception | Complete local suite | Temporary files are cleaned when control returns; recovery reaches the deterministic side selected by the lock anchor. |
| Forced process termination | Local Darwin arm64 Node.js 24 plus hosted Ubuntu x64 and macOS arm64 Node.js 22 and 24 | Stale writers block ordinary recovery; after external death confirmation and exact clearance, recovery reaches deterministic terminal bytes. |
| Repeated recovery termination | Local Darwin arm64 Node.js 24 plus hosted Ubuntu x64 and macOS arm64 Node.js 22 and 24 | Every instrumented rollback and roll-forward mutation boundary can be interrupted and resumed. |
| Cleanup termination | Local Darwin arm64 Node.js 24 plus hosted Ubuntu x64 and macOS arm64 Node.js 22 and 24 | Retirement, tombstone, receipt, and removal boundaries resume under the dedicated parent lifecycle. |
| Foreign drift after interruption | Cooperative and Darwin subprocess fixtures | Unknown bytes or contradictory lock state fail closed. |

The [candidate platform qualification](../evidence/candidate-platform-qualification.md) workflow provides hosted Ubuntu and macOS evidence. Its Windows cells failed the directory-synchronization prerequisite before the subprocess suite, so they provide no Windows process-termination support claim.

## Required operator boundary

The store cannot prove that a writer process is dead. A stale writer must never be cleared from PID reuse, elapsed time, hostname, timestamp, or automatic retry.

The operator or supervising process must:

1. independently observe owner-process termination;
2. capture the unchanged opaque writer fingerprint;
3. bind the request to the prepared transaction digest;
4. persist exact writer clearance before removing the unchanged writer record;
5. start recovery under a new writer lease.

Clearing a live writer violates the contract. Lease checks narrow cooperative races but do not turn the writer record into an operating-system lock.

## Filesystem prerequisites

A candidate platform must pass:

- canonical repository-root and relative-path checks;
- existing-parent and final-leaf symbolic-link refusal;
- regular-file-only generated leaves;
- exclusive same-directory temporary-file creation;
- content synchronization before rename;
- same-directory rename replacement;
- directory synchronization after creation, rename, hard-link publication, cleanup, and unlink;
- hard-link-based exclusive writer publication;
- forced child termination and observed exit;
- all transaction, recovery, temporary reclamation, retirement, cleanup, and parent-lifecycle tests with zero skips.

The workspace refuses to open when its directory-synchronization probe fails. Qualification must not replace that refusal with a silent weaker path.

## Explicit non-claims

The project does not currently claim behavior under:

- sudden power loss;
- kernel panic or operating-system crash;
- storage-controller or device-cache loss;
- filesystem corruption;
- network or distributed filesystems;
- a hostile process with concurrent write access;
- case-folding or Unicode-equivalence path collisions;
- parent-directory replacement races against path-based APIs;
- process termination on an operating system whose qualification cell has not passed.

`FileHandle.sync()` and directory synchronization requests establish that the operating system accepted synchronization calls; they do not alone prove storage durability after power loss ([Node.js filesystem API](https://nodejs.org/api/fs.html)).

## Qualification rule

A platform and Node.js line may be recommended for release only after one blocking matrix cell passes the direct primitive probe, complete zero-skip suite, and tracked-file check. The evidence record must capture the workflow run, resolved runner image, platform, architecture, exact Node.js version, and outcome.

If a cell fails, the project must fix and rerun or explicitly defer the cell. It must not weaken ownership, synchronization, symlink, drift, or recovery assertions to convert missing capability into a passing claim.

Power-loss support requires a separate reproducible harness that can control the filesystem and failure point and then inspect post-reboot state. GitHub-hosted process termination is not such a harness. Until that evidence exists, documentation and diagnostics must state that power-loss behavior is unverified.
