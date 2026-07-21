# Private local CLI evidence

Snapshot date: 2026-07-21.

## Verdict

**Pass for the private offline local init/check/diff/approved-render slice on the tested local Darwin environment.** One experimental development entry generates the executable revision-1 local intent from explicit inputs, exclusively creates an absent configuration, classifies existing native provider paths, prepares the authoritative exact plan, executes the existing read-only `check` or `diff` semantic service, and invokes the sole forward-convergent render service only after exact snapshot approval and a second analysis and plan match.

This result closes roadmap steps 2 through 4. Later package evidence qualifies the same entry through an installed npm bin, but does not make its flags, configuration or lock discovery, diagnostics, exit codes, machine output, or terminal format public contracts.

## Reproduction

Implementation:

- `src/cli/private-local-cli.ts`;
- `src/cli/private-local-cli-output.ts`;
- `src/cli/private-doctor-command.ts`;
- `src/interface/private-cli-arguments.ts`;
- `src/application/private-domain-project-plan.ts`;
- `src/commands/private-check-command-service.ts`;
- `src/commands/private-diff-command-service.ts`;
- `src/commands/private-render-command-service.ts`;
- `src/renderer/staged-adapter.ts`.

Automated coverage:

- `test/cli/private-local-cli.test.ts`;
- `test/interface/private-cli-arguments.test.ts`.

Run:

```bash
npm run build
node --test dist/test/cli/private-local-cli.test.js dist/test/interface/private-cli-arguments.test.js
npm run check
```

The private development invocation is:

```bash
npm run phase1:local-cli -- check --repository <path> --config <path> --lock <relative-path>
npm run phase1:local-cli -- diff --repository <path> --config <path> --lock <relative-path>
npm run phase1:local-cli -- render --repository <path> --config <path> --lock <relative-path> --approve-plan <exact-plan-digest>
npm run phase1:local-cli -- init --repository <path> --config <relative-path> --lock <relative-path> --workflow local-reviewed-change --preset <fast|balanced> --tracker <local|none> --provider <id,product,surface>... --steward <id> --developer <id> --reviewer <id>
npm run phase1:local-cli -- doctor --config <path> --observations <path>
```

## Observed behavior

The focused subprocess fixtures demonstrate:

- two fresh temporary repositories produce identical offline configuration, provider output, and lock bytes through init, diff, render, clean check, and empty diff;
- init exclusively creates only an absent exact revision-1 configuration and adopts an exact repeated configuration without writing it;
- provider observations are reported as create, exact adopt, lossless import, or abort while provider bytes and the lock remain unchanged until render;
- exact adopt and lossless import complete through the normal exact diff and approved-render path;
- foreign initialization bytes abort without disclosure or configuration creation;
- an empty repository reports recognized output and lock changes with candidate exit code `1`;
- an already rendered exact state reports clean check and empty diff with candidate exit code `0`;
- an unowned existing generated path blocks rather than being silently adopted or overwritten;
- changed bytes under retained ownership block as drift;
- unavailable issue, pull-request, CI, review-service, and merge capabilities fail closed;
- invalid configuration and unsafe lock paths fail before any mutation;
- exact diff output includes the plan identity and JSON-quoted recognized before and after text;
- blocked output contains no exact change entries and does not disclose fixture foreign bytes;
- complete repository snapshots are identical before and after every read-only command fixture;
- approved render applies the exact displayed target and publishes the lock;
- a wrong or stale approval fails before repository mutation;
- the exact current clean plan repeats without writes or lock publication;
- an interrupted partially applied plan resumes with its original approval and reaches a clean check.
- an interrupted initialization import rejects its stale approval after the original before-bytes are gone, then completes only after a new exact diff and approval;
- an npm-style symbolic-link invocation reaches the entry point rather than silently skipping command execution;
- explicit current provider and filesystem observations produce a healthy doctor result without live probes, while a non-local workflow is blocked.

The final focused CLI, argument, and doctor suites pass 29 tests with zero failures and zero skips. The complete repository suite passes 388 tests with zero failures, skips, or todos, and the repository publication audit passes 211 text files.

## Boundary and limitations

Init, check, and diff begin through `PrivateFilesystemWorkspace.openReadOnly`, whose workspace exposes only `read(path)`. Init validates the generated intent, configuration path, lock absence, provider observations, and exact plan before opening mutation authority. Its only mutation is `createExclusively` for the absent configuration after a second observation and plan match. It never writes provider files or the lock. Render compares the supplied approval with the complete snapshot digest, rereads configuration, opens the mutation-capable workspace, reanalyzes existing provider paths, replans, and requires the same digest before provider mutation.

The reconstruction is not a general conflict resolver. It can replace an ownership conflict or an exact initial-adoption observation only when current bytes equal the exact target, or restore a post-delete observation from the base ownership claim. The original exact approval must match the reconstructed snapshot, and normal convergent preflight still rejects any path outside before-or-target state. An interrupted import cannot reconstruct different original bytes from the digest alone and therefore requires a newly reviewed exact plan. No journal, Git operation, hidden state, or silent adoption was added.

The formatter is intentionally minimal and untruncated. Exact recognized text is encoded as a JSON string so the target bytes remain unambiguous before later approval. Foreign bytes are not returned by blocked diff results. A public formatter still requires decisions about output size, terminal paging, redaction, sensitive managed files, color, machine output, and compatibility.

The development script builds before invocation; separate package evidence exercises the installed executable. Init currently supports only the offline local workflow, Fast or Balanced, and explicit local/no-tracker choices because the hosted workflow lacks real external capability adapters. Doctor accepts caller-supplied observations but does not authenticate them. Public configuration syntax, filenames, discovery precedence, option names, approval UX, lock location, exit codes, and package behavior remain open. The command does not lock the repository against a hostile or concurrent process; post-plan drift is caught by the existing exact preflight, not prevented.

## Recommendation

Use the qualified private package as evidence for the next public-surface decision packet. Keep public filenames, discovery, output, exit codes, support claims, licensing, and publication explicit rather than accepting the current private specimens by inertia.
