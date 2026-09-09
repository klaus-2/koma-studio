# Contributing

Thanks for helping out. [KŌMA Studio](https://github.com/klaus-2/koma-studio) is a
monorepo: this `apps/landing` workspace holds the marketing site, while the desktop
apps, auth server, and shared packages live alongside it in the same repository.

- Landing page bugs, copy, and SEO → open an issue or PR **here** (under `apps/landing`)
- Desktop app bugs and features → same repo, but see the
  [root CONTRIBUTING.md](../../CONTRIBUTING.md) first
- Questions and roadmap talk → [Discord](https://discord.gg/tzaV2efD4e)

## Getting set up

```bash
bun install                # from the repository root — single install for all workspaces
bun run dev:landing        # http://localhost:3000
```

Running from `apps/landing` directly, `bun run dev`, `bun run build`, and `bun run lint`
work as well. `npm` works too if you do not have Bun installed.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/app/page.tsx` | The landing page and its section order |
| `src/components/` | Sections and shared UI |
| `src/content/seo-pages.ts` | Copy for guide pages (features, workflow, faq, download, …) |
| `src/content/compare-pages.ts` | Copy for `/compare` and the "vs" pages |
| `src/content/site-faqs.ts` | Shared FAQ items |
| `src/lib/project.ts` | Repository, license, and community links |

To add a page, append an entry to `seo-pages.ts` or `compare-pages.ts`. Routes, metadata, JSON-LD,
and the sitemap are generated from those arrays — no routing changes needed.

## Pull requests

1. Fork the repository and create a branch (`git switch -c fix/hero-copy`).
2. Keep one concern per pull request.
3. Run `bun run lint` and `bun run build` before pushing.
4. Describe the change and add a screenshot for anything visual.

## Content rules

Claims on this site must be **verifiable**. Do not add user counts, ratings, testimonials, or
performance numbers that cannot be pointed back to something real. Project facts (license,
platforms, self-hosting, telemetry) live in `src/lib/project.ts` so they stay consistent.

## License

By contributing you agree that your work is released under the [MIT license](./LICENSE).
