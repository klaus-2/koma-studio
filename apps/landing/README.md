# KŌMA Studio — Landing Page

Marketing website for [**KŌMA Studio**](https://github.com/klaus-2/koma-studio), deployed at
[koma-studio.site](https://koma-studio.site/).

KŌMA Studio is a **free and open-source (MIT)** scanlation studio for manga, manhwa, and comics.
This site is the project's public front page: what the app does, how the workflow fits together,
how it compares with the alternatives, and how to contribute.

**Stack**: Next.js (static export) · Tailwind CSS · Bun

## Development

```bash
bun install
bun run dev        # local dev server
bun run build      # static export to out/
bun run lint
```

`npm` works too if you do not have Bun installed.

## Structure

- `src/app/` — routes (`page.tsx` is the landing page, `[slug]` renders the SEO/compare pages)
- `src/components/` — sections and UI (`Hero`, `OpenSource`, `Contribute`, `ComparisonTable`, …)
- `src/content/` — the copy for every page (`seo-pages.ts`, `compare-pages.ts`, `site-faqs.ts`)
- `src/lib/project.ts` — repository, license, and community coordinates (single source of truth)
- `public/` — static assets, `llms.txt`, agent skills, and `.well-known` discovery files

Most content lives in `src/content/*.ts`, so changing copy rarely means touching a component.

## Adding a page

Add an entry to `src/content/seo-pages.ts` (`SeoPage`) or `src/content/compare-pages.ts`
(`ComparePage`). Routes, metadata, JSON-LD, and the sitemap are generated from those arrays.

## Deploy

The static export can be served by any web server. A helper script for deploying to a VPS over SSH
is provided:

```powershell
./scripts/deploy-vps.ps1 -SshHost <your-ssh-host> -RemoteDir </var/www/your-site>
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © KŌMA Studio
