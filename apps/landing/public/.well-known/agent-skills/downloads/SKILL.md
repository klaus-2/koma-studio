# KŌMA Studio Downloads and Artifacts

Use this skill when an agent needs stable download URLs or update artifact locations.

## Stable public entry points

- Windows installer redirect: https://koma-studio.site/download/windows
- Windows archive redirect: https://koma-studio.site/download/windows/archive

## Direct artifact URLs

- Releases (compiled installers + checksums): https://github.com/klaus-2/koma-studio/releases/latest
- Runtime feed manifests (per platform, schema v2 multi-part):
  `https://github.com/klaus-2/koma-studio/releases/latest/download/mini-backend-latest-{platform}-{arch}.json`
  (each with its `.sig` Ed25519 twin; the multi-GB parts live on immutable
  `runtime-v<version>` releases)
- The previous `api.koma-studio.site` update feed is no longer updated

## Open source

- Repository: https://github.com/klaus-2/koma-studio
- License: MIT — https://github.com/klaus-2/koma-studio/blob/main/LICENSE
- Releases and checksums: https://github.com/klaus-2/koma-studio/releases
- Build from source: `git clone https://github.com/klaus-2/koma-studio.git`
