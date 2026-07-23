# Private preset expansion evidence

Snapshot updated: 2026-07-23.

## Verdict

**Pass for Fast and Balanced; fail closed for Strict.** The retained tests prove
that preset expansion is deterministic, orthogonal to workflow family and
provider bindings, and compiled through the same finite-state policy seam.

Observed retained cases include:

- repeated Fast expansion produces an identical object and digest;
- Balanced adds the declared findings and reviewer-isolation requirements;
- draft/ready state remains an explicit CLI choice outside preset expansion;
- Fast retains issue CI, review-verdict, and merge-authorization gates while
  omitting Balanced-only reviewer-isolation and blocking-finding gates;
- an incompatible base workflow fails deterministically;
- Strict returns `PRESET_UNAVAILABLE` rather than a weaker profile;
- Fast and Balanced produce different workflow compilation digests and
  agent-facing procedures for both workflow families.

The previous schema-version-0 convergence fixtures were removed after
revision-1 became the authoritative beta path. They were never a public
migration source.

## Reproduction

```bash
npm run build
node --test dist/test/project/private-domain-preset.test.js
npm run check
```

Implementation and tests:

- `src/project/private-domain-preset.ts`;
- `src/project/private-domain-project-resolution.ts`;
- `test/project/private-domain-preset.test.ts`;
- `test/project/private-domain-project-resolution.test.ts`;
- `test/guidance/private-project-guidance.test.ts`;
- `test/renderer/native-project-instructions.test.ts`.
