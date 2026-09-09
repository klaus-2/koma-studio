# Contributing to KŌMA Studio

Thanks for wanting to help. KŌMA Studio is a free, community-driven scanlation
toolkit, and every kind of contribution counts — code, translations, bug
reports, documentation, or just testing the alpha and telling us what broke.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Ways to contribute

| | |
| --- | --- |
| 🐛 **Report a bug** | Open an issue with steps to reproduce, your OS, and the app version. In-app: **Help → Report a bug**. |
| 💡 **Suggest a feature** | Open an issue describing the workflow problem first, the solution second. |
| 🌍 **Translate** | See [Translations](#translations) — the UI ships in 14 languages. |
| 📝 **Improve docs** | READMEs, code comments. Small PRs welcome, no issue needed. |
| 🧪 **Test** | Run the alpha, work through `apps/tauri/tests/e2e/e2e-scenarios.json`, report what fails. |
| 💻 **Write code** | Read the rest of this file first. |

## Development setup

See the [README](./README.md) for the monorepo map. Short version:

```bash
git clone https://github.com/klaus-2/koma-studio.git
cd koma-studio

bun install                          # Bun is the ONLY supported package manager
cd apps/tauri && bun run mini:install-deps && cd ../..   # Python sidecar (several GB)
bun run dev:tauri                    # or dev:electron / dev:landing / dev:auth
```

**Never use `npm`, `yarn` or `pnpm`.** Only `bun.lock` is committed; the other
lockfiles are git-ignored and a PR that adds one will be rejected.

## Before you open a pull request

Run the full local gate. Every command must pass:

```bash
bun run lint          # oxlint + per-app ESLint
bun run typecheck     # tsc --noEmit across workspaces
bun run test          # vitest

# If you touched Python:
cd packages/mini-backend && python -m pytest tests -q
```

A `.husky/pre-commit` hook runs lint-staged (oxlint + per-app ESLint) on the
staged files. Don't use `--no-verify`.

## Engineering standards

The essentials — the bar for the codebase:

1. **Verify before you claim.** Don't write "should work" or "probably fine" in
   a PR description. Run the command, paste the output.
2. **Surgical edits.** Every changed line must trace back to the stated purpose
   of the PR. Don't reformat, rename or "improve" adjacent code. If you spot
   unrelated dead code, mention it in the PR instead of deleting it.
3. **No file over 1000 lines** (`.ts`/`.tsx`); components warn above 300.
   Enforced by `apps/tauri/scripts/audit-line-counts.mjs`.
4. **No `any`, `unknown` escape hatches, `as any` or `@ts-ignore`.** If the types
   fight you, fix the types.
5. **Never leave the build or tests broken**, and never delete a failing test
   to make CI green.
6. **No telemetry, ever.** KŌMA Studio collects nothing. PRs adding analytics,
   usage tracking or automatic beaconing will be closed. See the privacy
   section in the app READMEs.
7. **No paywalls, ever.** The product is 100% free. Do not add plans, tiers,
   quotas, credits, entitlements or billing of any kind.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), enforced by
`.husky/commit-msg`:

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`,
`style`, `revert`. Subject: ≤ 100 characters, lower case, imperative mood, no
trailing period.

```
feat(ocr): add batch inference to the manga-ocr engine
fix(dashboard): keep stage selection after a failed batch
docs(readme): document MINI_BACKEND_PYTHON
```

## Pull requests

- Branch from `main`. One logical change per PR; split large work into
  reviewable pieces.
- Fill in what changed, why, and how you verified it — with actual command
  output.
- Include before/after screenshots for UI changes.
- Add or update tests for behaviour changes.
- Keep the PR rebased on `main`; CI must be green.

## Translations

UI strings live in `packages/interface/src/i18n/langs/<locale>.ts`, with
`en.ts` as the reference locale and the application default.

- **Fixing or completing a locale:** edit the file directly, keeping the key
  structure identical to `en.ts`. Never invent keys that don't exist in the
  reference.
- **Adding a locale:** create `packages/interface/src/i18n/langs/<locale>.ts`,
  then register it in `packages/interface/src/i18n/config.ts`. Locales other
  than `en` are lazy-loaded.
- Keep placeholders (`{count}`, `{name}`, …) intact and don't translate them.
- Legal documents live separately in
  `packages/interface/src/legal/legalContent.<locale>.ts`.

`bun run test` includes i18n structure checks — run it after any locale change.
You can also run `node scripts/i18n-key-report.mjs` to see the per-locale
coverage and any dead keys still defined in `en.ts`.

## Third-party code and licenses

The project is MIT. If your contribution vendors or adapts code from another
project:

- State the upstream source and license in the PR.
- **Do not add GPL/AGPL code to the MIT-licensed application layers.** Some AI
  model adapters under `packages/mini-backend/models/` already derive from
  copyleft upstreams — see [`docs/THIRD-PARTY-NOTICES.md`](docs/THIRD-PARTY-NOTICES.md)
  — and any new one must be flagged explicitly so it can be reviewed.
- Prefer downloading model weights at runtime over committing them.

## Reporting security issues

**Do not open a public issue.** Follow [SECURITY.md](./SECURITY.md).

## Questions

Ask on [Discord](https://discord.gg/tzaV2efD4e) or email
<klaus@koma-studio.site>.
