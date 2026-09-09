# KŌMA Build Tool

Internal build and deployment orchestrator for KŌMA Studio releases. **Not a
public product**. Only project maintainers need to run it.

This is a Tauri + Svelte 5 application used by maintainers to:
- Build Windows MSI installers
- Build and sign update manifests
- Build mini-backend runtime artifacts (CPU/CUDA profiles)
- Deploy artifacts and landing page to the update server

## Usage

```bash
# from the repo root
bun install
bun run --filter @koma/build-tool tauri dev      # development
bun run --filter @koma/build-tool tauri build    # production build
```

## Stack

- **Frontend**: Svelte 5 + TailwindCSS 4
- **Backend**: Tauri 2 + Rust
- **Package manager**: Bun


## Configuration

Set the following environment variables (or copy `.env.example` to `.env`):

| Variable | Purpose |
|----------|---------|
| `KOMA_VPS_HOST` | Update server hostname |
| `KOMA_VPS_USER` | SSH user |
| `KOMA_VPS_PATH` | Remote path for updates |
| `KOMA_VPS_SSH_KEY` | SSH private key path |
| `BUILD_VERSION` | Version string for the build |
| `UPDATE_CHANNEL` | Update channel (stable/beta) |