# KŌMA Studio API Overview

This document lists the main machine-relevant endpoints in the KŌMA Studio ecosystem.

## Public hosts

- Main site: https://koma-studio.site/
- Source repository (MIT): https://github.com/klaus-2/koma-studio
- Chat / Open WebUI: https://chat.koma-studio.site/
- Auth host: https://auth.koma-studio.site/
- Update host: https://api.koma-studio.site/updates/

## Auth

Common Better Auth routes live under:

- `https://auth.koma-studio.site/api/auth/sign-up/email`
- `https://auth.koma-studio.site/api/auth/sign-in/email`
- `https://auth.koma-studio.site/api/auth/get-session`
- `https://auth.koma-studio.site/api/auth/sign-out`

## Update and artifact distribution

- Stable Windows ZIP: [latest.json](https://api.koma-studio.site/updates/stable/latest.json) (index of current stable artifacts)
- Stable archive: `https://api.koma-studio.site/updates/stable/koma-studio-latest-x64.nsis.7z`
- Stable mini-backend artifacts index: `https://api.koma-studio.site/updates/stable/mini-backend-artifacts/latest.json`

## Open source

KŌMA Studio is MIT-licensed and self-hostable. Build from source with:

- `git clone https://github.com/klaus-2/koma-studio.git`

Releases and changelogs: https://github.com/klaus-2/koma-studio/releases

## Agent discovery

- API catalog: `https://koma-studio.site/.well-known/api-catalog`
- OAuth authorization server metadata: `https://koma-studio.site/.well-known/oauth-authorization-server`
- OAuth protected resource metadata: `https://koma-studio.site/.well-known/oauth-protected-resource`
- MCP server card: `https://koma-studio.site/.well-known/mcp/server-card.json`
- Agent skills index: `https://koma-studio.site/.well-known/agent-skills/index.json`
