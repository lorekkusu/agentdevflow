# Private preset expansion

## Status

Fast and Balanced are executable beta profiles. Strict is recognized but fails
closed until a safety-property set is accepted and has executable semantics.
Custom remains deferred.

The implementation is in `src/project/private-domain-preset.ts` and is covered
by `test/project/private-domain-preset.test.ts` and project-resolution tests.

## Boundary

A preset is a policy profile, not a workflow-family selector. It must not
choose:

- issue-to-reviewed-pull-request or local-reviewed-change;
- draft or immediately ready pull-request creation;
- a provider, tracker, or capability target.

Expansion receives an explicit workflow family and definition, validates that
the base workflow meets the selected minimum, and returns one deterministic
effective definition and digest.

Fast represents the minimum basic-review profile. Balanced adds explicit
blocking-finding and reviewer-isolation requirements to both current workflow
families. Provider instruction procedures derive those visible completion and
review requirements from the effective compiled policies rather than from the
preset name alone. Strict never downgrades silently.

Topology remains a separate choice. For example, selecting a preset does not
choose a pull-request state or tracker, while the selected workflow still
determines whether pull-request and CI steps exist.

## Non-claims

This boundary does not define a public arbitrary preset format, public workflow
DSL, migration source for unpublished schema-version-0 data, execution trace,
scheduler, or provider runtime.

## Verification

```bash
npm run build
node --test dist/test/project/private-domain-preset.test.js
npm run check
```
