# KŌMA Studio — Auth Server

Self-hosted authentication for KŌMA Studio. Handles account registration, login
sessions, email verification, bans, and desktop-client session bootstrap.

**Stack**: TypeScript, Express 4, [Better Auth](https://better-auth.com),
[Drizzle ORM](https://orm.drizzle.team), PostgreSQL.

> KŌMA Studio is a free, open-source product: there are **no plans, no billing,
> and no quotas**. Every account has full access. This server exists purely for
> identity and session management.

---

## Quick start (monorepo)

```bash
# from the repo root
bun install                                  # workspace install

# from apps/auth-server/
cp .env.example .env.development             # fill DATABASE_URL + secrets
bun run dev                                  # starts on http://localhost:3001
```

For the desktop app (`apps/electron` or `apps/tauri`), the auth server is
started automatically as part of the dev stack — see
[`apps/tauri/README.md`](../../apps/tauri/README.md) for details. To run it
manually in a second terminal:

```bash
# from apps/auth-server/
bun run dev
```

## Migrations

```bash
# from apps/auth-server/
bun run db:generate   # generate a new migration after schema changes
bun run db:migrate    # apply pending migrations
bun run db:push       # dev-only shortcut (skips migration files)
```

## Common issues

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Cloudflare 522 | DB connect timeout | Increase `connect_timeout` (now 15 s) in `src/db/client.ts` if your DB is remote |
| Content catalog fails on startup | Migrations not applied | Run `bun run db:migrate` |
| Redis errors on startup | Redis not running locally | Ignored in dev — server uses memory fallback |
| `bun run dev` fails | Missing `.env.development` | Run `cp .env.example .env.development` |

## Production deployment

1. Provision PostgreSQL and create a database.
2. Set production env vars (see [`.env.example`](.env.example) for the full
   list with comments):

   | Variable | Purpose |
   |---|---|
   | `DATABASE_URL` | Postgres connection string |
   | `JWT_SECRET` / `JWT_ALGORITHM` | Access-token signing (HS256 default; RS256 supported) |
   | `BETTER_AUTH_SECRET` | Session/cookie signing |
   | `BETTER_AUTH_URL` | Public base URL of the auth server |
   | `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (the app's origin) |
   | `RESEND_API_KEY` | Optional — email delivery for verification codes |
   | `CLOUDFLARE_TURNSTILE_*` | Optional — signup/login captcha |

3. Run migrations: `bun run db:migrate`
4. Start behind HTTPS (nginx/Caddy reverse proxy).

## Scripts

| Command (from `apps/auth-server/`) | Description |
|---|---|
| `bun run dev` | Dev server (:3001) with reload |
| `bun run build` | Compile to `dist/` |
| `bun run start` | Run compiled build |
| `bun run test` | Test suite (`tsx --test`) |
| `bun run smoke` | Smoke check against running server |
| `bun run db:generate` | Generate a Drizzle migration from schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:push` | Push schema directly (dev only) |

## Security notes

- All secrets belong in environment files (`.env.*`), never in code.
- Security-relevant events (failed logins, anomalies) are logged server-side
  for abuse defense. No usage analytics or telemetry of any kind.
- To report a vulnerability: see the root [SECURITY.md](../../SECURITY.md).
