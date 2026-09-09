<!--
Thanks for contributing to KŌMA Studio!
Please read CONTRIBUTING.md if you have not already.
Keep the diff focused: every changed line should trace back to the stated goal.
-->

## Summary

<!-- What does this PR change, and why? Link the issue it closes. -->

Closes #

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (existing behaviour changes)
- [ ] Documentation / translations
- [ ] Build, tooling or CI

## How was this tested?

<!--
Paste the actual commands you ran and their results. "Should work" is not evidence.
-->

```text

```

## Checklist

- [ ] `bun run lint` passes.
- [ ] `bun run typecheck` passes.
- [ ] `bun run test` passes.
- [ ] `bun run build` passes.
- [ ] Python changes: `python -m compileall -q packages/mini-backend` passes and relevant `pytest` tests run.
- [ ] No `any`, `unknown`, `as any` or `@ts-ignore` was introduced.
- [ ] New user-facing strings go through i18n (no hardcoded copy in components).
- [ ] No telemetry, analytics, paid tiers, quotas or entitlement checks were added.
- [ ] No secrets, API keys, personal paths or `.env` files are committed.
- [ ] New dependencies are license-compatible with MIT and added to `docs/THIRD-PARTY-NOTICES.md`.

## Screenshots / recordings

<!-- For UI changes. Delete this section if not applicable. -->
