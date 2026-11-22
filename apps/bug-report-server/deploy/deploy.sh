#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="bug-report-server"
INSTALL_DIR="/opt/koma-bug-reports"
STATE_DIR="/var/lib/koma-bug-reports"
HEALTH_URL="http://127.0.0.1:3101/healthz"

if [[ ${EUID} -ne 0 ]]; then
  echo "run as root: sudo bash ${BASH_SOURCE[0]}" >&2
  exit 1
fi

for tool in node curl systemctl install; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "missing required tool: ${tool}" >&2
    exit 1
  fi
done

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ ${NODE_MAJOR} -lt 20 ]]; then
  echo "node >= 20 required, found $(node --version)" >&2
  exit 1
fi

install -d -m 0755 "${INSTALL_DIR}"
install -m 0644 "${SCRIPT_DIR}/../server.mjs" "${INSTALL_DIR}/server.mjs"
install -m 0644 "${SCRIPT_DIR}/bug-report-server.service" "/etc/systemd/system/${SERVICE_NAME}.service"

NODE_BIN="$(command -v node)"
if [[ "${NODE_BIN}" != "/usr/bin/node" ]]; then
  sed -i "s|^ExecStart=/usr/bin/node|ExecStart=${NODE_BIN}|" "/etc/systemd/system/${SERVICE_NAME}.service"
fi

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service" >/dev/null
systemctl restart "${SERVICE_NAME}.service"

health_ok=0
for _ in $(seq 1 15); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    health_ok=1
    break
  fi
  sleep 1
done

if [[ ${health_ok} -ne 1 ]]; then
  echo "health check failed after install: curl ${HEALTH_URL}" >&2
  echo "inspect with: journalctl -u ${SERVICE_NAME}.service -n 50 --no-pager" >&2
  exit 1
fi

echo "bug-report-server healthy: ${HEALTH_URL}"
echo "state dir: ${STATE_DIR} (created by systemd StateDirectory=, mode 0700, owned by the DynamicUser)"
echo
cat <<'NGINX_NOTES'
nginx is intentionally not edited by this script. Apply apps/bug-report-server/deploy/nginx-bug-reports.conf:
  1. declare the zone once at http context (e.g. /etc/nginx/conf.d/koma-bug-reports-zone.conf):
       limit_req_zone $binary_remote_addr zone=bugreports:10m rate=10r/m;
  2. paste the two location blocks into the existing koma-studio.site 443 server block;
     client_max_body_size 25m on /api/bug-reports is required (nginx's 1m default would 413 real payloads)
  3. validate and reload:
       nginx -t && systemctl reload nginx
  4. optional Discord notify (secret stays on the VPS, never in the repo):
       systemctl edit bug-report-server   # add: Environment=KOMA_BUG_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
       systemctl restart bug-report-server
NGINX_NOTES
