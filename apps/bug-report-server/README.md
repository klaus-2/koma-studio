# bug-report-server

Zero-dependency Node >= 20 ESM intake server for desktop bug reports (plan contract C1/C5). Single file, node built-ins only, no `package.json` and no npm installs.

## Run

```bash
node apps/bug-report-server/server.mjs
```

Listens on `127.0.0.1:3101`. On a Windows dev machine the POSIX default state dir resolves to a drive-rooted path; override it explicitly:

```powershell
$env:KOMA_BUG_REPORTS_DIR = "$PWD\.tmp\koma-bug-reports"; node apps\bug-report-server\server.mjs
```

## Test

```bash
node --test apps/bug-report-server/server.test.mjs
```

## API

### POST /api/bug-reports (Content-Type: application/json)

Required fields: `schema` (integer `1`), `title` (string 5..180), `description` (string 0..3500), `includeLogs` (boolean), and a `client` object with required `appVersion` (<=64), `shell` (`"tauri"` | `"electron"`), `platform` (<=64), `arch` (<=32), `channel` (<=64), `sessionId` (<=64).

Validated when present, safe to omit: `diagnostics` (object, <= 65536 bytes serialized), `screenshot` (null or `data:image/(png|jpeg);base64,...` decoding to <= 6 MB), `logs` (array <= 24 items of `{name <= 120, content <= 512 KB}`, total content <= 3 MB), `attachments` (array <= 4 items of `{name <= 200, mime image/*|text/*, base64 data decoding to <= 5 MB}`), `droppedAttachments` (integer >= 0). Unknown extra fields are ignored by validation and preserved in storage.

Responses (`application/json`):

| Status | Body | Condition |
|---|---|---|
| 201 | `{"id": "<uuid>", "received": "<iso8601>"}` | stored |
| 400 | `{"error", "field"}` | schema violation; `field` names the offender |
| 413 | `{"error": "payload too large"}` | Content-Length or streamed body > 25 MB |
| 429 | `{"error": "rate limit exceeded"}` + `Retry-After` | more than 5 POSTs/hour from one client IP (fixed window) |
| 405 | `{"error": "method not allowed"}` | non-POST on `/api/bug-reports` |
| 500 | `{"error": "internal server error"}` | storage failure |

### GET /healthz and GET /api/bug-reports/healthz

`200 {"ok":true}`.

## Storage

`KOMA_BUG_REPORTS_DIR/<yyyy-mm>/<uuid>.json`, one file per report, envelope `{"id","received","report"}` where `report` is the validated request body (unknown fields preserved).

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3101` | listen port (host is fixed to `127.0.0.1`) |
| `KOMA_BUG_REPORTS_DIR` | `/var/lib/koma-bug-reports` | state directory |
| `KOMA_BUG_REPORTS_RETENTION_DAYS` | `180` | files older than N days are deleted at startup and by a daily timer; emptied month directories are pruned |
| `KOMA_BUG_REPORTS_MAX_TOTAL_MB` | `512` | total stored size budget; the sweeps delete oldest-first when the state directory exceeds it |
| `KOMA_BUG_RATE_LIMIT_PER_HOUR` | `5` | fixed-window POST budget per client IP |
| `KOMA_BUG_NOTIFY_DISCORD_WEBHOOK_URL` | unset (notify disabled) | best-effort Discord post after each 201; delivery failures are logged and never fail the report |

## Deploy (VPS)

```bash
sudo bash apps/bug-report-server/deploy/deploy.sh
```

Idempotent: installs `server.mjs` to `/opt/koma-bug-reports/`, installs the systemd unit (`deploy/bug-report-server.service`: DynamicUser with `StateDirectory` mode 0700, `MemoryMax=100M`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp`, `NoNewPrivileges`, `Restart=always`), daemon-reload, enable + restart, curls `/healthz`, then prints the nginx steps. nginx is intentionally not edited by the script: apply `deploy/nginx-bug-reports.conf` per its inline instructions — the `limit_req_zone` declaration once at http context and the two exact location blocks inside the `koma-studio.site` 443 server block. `client_max_body_size 25m` on `/api/bug-reports` is required; nginx's 1m default would silently 413 real payloads.

To enable Discord notify on the VPS (secret stays on the server, never in the repo):

```bash
sudo systemctl edit bug-report-server
# add under [Service]:
# Environment=KOMA_BUG_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
sudo systemctl restart bug-report-server
```

## Notes

- The server trusts `X-Forwarded-For` only from loopback peers (nginx) and keys the rate limiter on the last XFF entry; `deploy/nginx-bug-reports.conf` sets `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` accordingly. Direct non-loopback clients are keyed by socket address.
- Body reading is size-safe: the Content-Length pre-check rejects > 25 MB before reading, and a hard read cap also defends against missing or false Content-Length.
- Requires Node >= 20 (global `fetch`, `AbortSignal.timeout`, `crypto.randomUUID`).
