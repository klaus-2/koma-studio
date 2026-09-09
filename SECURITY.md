# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| `2.x` (Tauri shell) | ✅ Actively developed — fixes land here |
| `1.x` (Electron shell) | ✅ Critical fixes only |

The current release is pre-release software. It has not been through a formal
security audit. Treat it accordingly: don't run it against sensitive data or
expose the local sidecar to a network you don't control.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
pull requests, or the Discord server.**

Email **<klaus@koma-studio.site>** with the subject line
`SECURITY: <short description>`, OR use GitHub's private vulnerability
reporting at **https://github.com/klaus-2/koma-studio/security/advisories/new**.

Please include:

- The type of issue (e.g. RCE, path traversal, SSRF, credential leak,
  privilege escalation)
- Affected component — `packages/interface/`, `apps/tauri/`, `apps/electron/`,
  `packages/mini-backend/`, `apps/auth-server/`, updater
- Version or commit hash, and your OS
- Step-by-step reproduction instructions, ideally with a proof of concept
- The impact you believe an attacker could achieve

### What to expect

| | |
| --- | --- |
| **Acknowledgement** | Within 72 hours |
| **Initial assessment** | Within 7 days |
| **Fix target** | 30 days for critical/high, best effort otherwise |
| **Disclosure** | Coordinated — we'll agree on a date with you before publishing |

This is a small volunteer project; there is no bug bounty. We will credit you
in the release notes and the advisory unless you prefer to stay anonymous.

## Scope

**In scope**

- Both desktop shells: React UI (`packages/interface/`), Tauri/Rust
  (`apps/tauri/src-tauri/`), Electron (`apps/electron/electron/`)
- The Python `packages/mini-backend/` sidecar and its HTTP API
- The bundled `apps/auth-server/`
- The update mechanism: manifest handling, signature verification, patch
  application
- Build and hardening scripts under `apps/*/scripts/` and root `scripts/`
- Handling of user secrets, in particular bring-your-own-key API credentials

**Out of scope**

- Vulnerabilities in third-party AI models or their upstream projects —
  report those upstream
- Vulnerabilities in cloud AI providers you configure with your own API key
- Issues that require an already-compromised machine or physical access to
  the device
- Missing hardening that has no demonstrable impact (e.g. "header X is
  absent")
- Automated scanner output without a working proof of concept

## Security model in brief

Useful context when assessing an issue:

- **The mini-backend binds to `127.0.0.1` by default** and is intended for
  loopback use only. Exposing it on `0.0.0.0` is unsupported and outside the
  threat model.
- **The app collects no telemetry.** Any outbound request that is not in the
  documented list (see the app READMEs) is itself a security bug — report it.
- **API keys are user-provided** and stored locally. Reports about credentials
  leaking into logs, crash reports, bug reports or the Discord presence
  payload are especially welcome.
- **Updates are signed** and verified before being applied. Anything that lets
  an attacker bypass or downgrade that verification is critical.
- **Certificate pinning** is applied to first-party endpoints
  (`apps/tauri/src-tauri/src/security/`, `apps/electron/electron/`).
- **Bug reports are opt-in and user-triggered.** They contain only what the
  user types and attaches.

## Third-party components

The application code is MIT-licensed, but AI models and some vendored adapters
come from other projects with their own licenses and their own security
posture — see [`docs/THIRD-PARTY-NOTICES.md`](docs/THIRD-PARTY-NOTICES.md).
Model weights are downloaded at runtime from public repositories; verify
checksums if you distribute a build.
