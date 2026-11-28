# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-11-28

330 commits since v1.3.1. This release introduces the hybrid Tauri v2 updater with UI OTA hotswap and Zstd binary deltas, replaces PyInstaller runtime bundles with a 2-layer relocatable Python 3.12 engine and hot-reconcilable backend overlay, adds AIO AI image editing with local Hugging Face models, and brings a mandatory setup wizard with interactive tool labs, Koma Neeko animations, bilingual sheet workflows, and major inference and UI performance upgrades.

### Added

- **Hybrid Tauri v2 updater with UI OTA hotswap and Zstd binary deltas.** Frontend and Python backend overlay releases now update via signed `koma-ui-<version>.tar.zst` bundles served by `HotswapAssets` with crash-safe watchdog rollback (`desktop:updater:ack-ui-ready`), while native upgrades attempt Zstd dictionary delta reconstruction before falling back to full installer downloads and installing cleanly on quit instead of forcing immediate restarts. Beta opt-in updates resolve against the rolling `beta` release feed, and release manifests are signed with Minisign version comments (`requireSignedVersion: true`).
  ([`de4fac4c`](https://github.com/klaus-2/koma-studio/commit/de4fac4c),
  [`1c06e6f2`](https://github.com/klaus-2/koma-studio/commit/1c06e6f2),
  [`13a1ace8`](https://github.com/klaus-2/koma-studio/commit/13a1ace8),
  [`d6624c84`](https://github.com/klaus-2/koma-studio/commit/d6624c84))

- **Two-layer Python 3.12 runtime with DirectML for Windows AMD GPUs.** PyInstaller runtime archives are replaced by a relocatable Layer-1 Python 3.12 engine built with `uv` and hardlink-deduplicated `.tar.zst` shards paired with an independently reconcilable Layer-2 `koma-backend-overlay` bundled inside the app for offline boot. Native DXGI and DRM GPU probing selects `windows-directml` automatically on AMD GPUs under Windows, and `Settings.standalone_python` provisions relocatable layouts without a `pyvenv.cfg` while guarding CPU profiles against accidental CUDA PyPI wheels.
  ([`de4fac4c`](https://github.com/klaus-2/koma-studio/commit/de4fac4c),
  [`d304c119`](https://github.com/klaus-2/koma-studio/commit/d304c119),
  [`8660245e`](https://github.com/klaus-2/koma-studio/commit/8660245e),
  [`4d30ada0`](https://github.com/klaus-2/koma-studio/commit/4d30ada0))

- **AIO AI all-in-one image editing and eight local Hugging Face models.** A dedicated AIO AI strategy (`direct`, `hybrid_guided`, `script_guided`) and standalone AI Clean integration support InstructPix2Pix, SDXL InstructPix2Pix, FLUX.2 Klein 4B (Q4 and BF16), LongCat-Image-Edit, Qwen-Image-Edit 2511 (Q4 and BF16), and FireRed-Image-Edit 1.1 across Classic and Noir workspaces, including `images/edits` endpoint negotiation for custom profiles.
  ([`c9e3319b`](https://github.com/klaus-2/koma-studio/commit/c9e3319b),
  [`280ceb1f`](https://github.com/klaus-2/koma-studio/commit/280ceb1f),
  [`15ca04c4`](https://github.com/klaus-2/koma-studio/commit/15ca04c4),
  [`70a6caa2`](https://github.com/klaus-2/koma-studio/commit/70a6caa2))

- **Mandatory onboarding wizard, interactive tool labs, and Koma Neeko HyperFrames studio.** First-run setup guides users through language, visual theme, Noir accent color, hardware tiers, background model downloads, and interactive Healing, Refine Text, and Area & Canvas labs powered by live `RenderTextPreview` and `TypeDock` instances across all 14 locales. Koma Neeko gains 13 poses rendered as 60fps VP9 alpha animations and 17 tool demos that can be dragged anywhere on the dashboard.
  ([`bc635a23`](https://github.com/klaus-2/koma-studio/commit/bc635a23),
  [`b4dbb18d`](https://github.com/klaus-2/koma-studio/commit/b4dbb18d),
  [`c3878ef4`](https://github.com/klaus-2/koma-studio/commit/c3878ef4),
  [`2ceaa6a1`](https://github.com/klaus-2/koma-studio/commit/2ceaa6a1),
  [`585fa0a1`](https://github.com/klaus-2/koma-studio/commit/585fa0a1),
  [`68733945`](https://github.com/klaus-2/koma-studio/commit/68733945))

- **Local `llama-server` backend, LibreTranslate, DeepL, and per-work glossary.** Local GGUF models can now run via `llama-server` with token-budget chunking, while Integrations adds configurable LibreTranslate and DeepL engines. AIO translation gains a per-work glossary merged with global rules, `translation_source` provenance with translation memory hit readouts, and automatic stage model resolution.
  ([`41c6784b`](https://github.com/klaus-2/koma-studio/commit/41c6784b),
  [`06c0ef61`](https://github.com/klaus-2/koma-studio/commit/06c0ef61),
  [`efe1d0a6`](https://github.com/klaus-2/koma-studio/commit/efe1d0a6),
  [`3d77d208`](https://github.com/klaus-2/koma-studio/commit/3d77d208),
  [`07d1ac87`](https://github.com/klaus-2/koma-studio/commit/07d1ac87),
  [`f15011c5`](https://github.com/klaus-2/koma-studio/commit/f15011c5),
  [`e1dace8f`](https://github.com/klaus-2/koma-studio/commit/e1dace8f))

- **Side-by-side render compare, QA review panels, and bilingual CSV/XLSX roundtrip.** Reviewers can compare original and rendered pages side by side with synchronized zoom and pan, inspect balloon overflow and leftover-text issues in a dedicated review panel with bounded auto-adjust, export bilingual CSV or XLSX sheets via worker, and reimport edited translations.
  ([`f645a9b6`](https://github.com/klaus-2/koma-studio/commit/f645a9b6),
  [`625c7a41`](https://github.com/klaus-2/koma-studio/commit/625c7a41),
  [`fec365f5`](https://github.com/klaus-2/koma-studio/commit/fec365f5),
  [`20e8c073`](https://github.com/klaus-2/koma-studio/commit/20e8c073))

- **Rebuilt text effects engine, font previews, SFX presets, and Photoshop PSD layers.** Both effect popovers and canvas rendering share one Canvas 2D engine with snapshot restoration on clearing effects and bleed-padded raster layers on PSD export. The typography toolbar adds font picker previews, favorites, a style eyedropper popover, seeded SFX presets with hover preview, and per-field region locks with overlap selection.
  ([`d0b54541`](https://github.com/klaus-2/koma-studio/commit/d0b54541),
  [`cb9f2d8c`](https://github.com/klaus-2/koma-studio/commit/cb9f2d8c),
  [`3b1b8aa9`](https://github.com/klaus-2/koma-studio/commit/3b1b8aa9),
  [`9b2d51c0`](https://github.com/klaus-2/koma-studio/commit/9b2d51c0),
  [`0ab1e34a`](https://github.com/klaus-2/koma-studio/commit/0ab1e34a))

- **Batch SSE streaming, pause/resume, priority queue, economic mode, and cache controls.** Batch execution adds Server-Sent Events streaming, cleaned-page routes, pause boundaries that preserve editor state, economic mode, stage timing panels, cloud preview popouts, per-stage CPU thread overrides, idle-unload and working-resolution settings, and a cache usage/prune/vacuum manager.
  ([`6d87d450`](https://github.com/klaus-2/koma-studio/commit/6d87d450),
  [`1084ca09`](https://github.com/klaus-2/koma-studio/commit/1084ca09),
  [`d00ca61f`](https://github.com/klaus-2/koma-studio/commit/d00ca61f),
  [`a9146239`](https://github.com/klaus-2/koma-studio/commit/a9146239),
  [`b10fe458`](https://github.com/klaus-2/koma-studio/commit/b10fe458),
  [`b0153af5`](https://github.com/klaus-2/koma-studio/commit/b0153af5))

- **Command palette, custom Noir RGB accent, workspace import/export, and desktop shell tools.** Users gain a `Ctrl+K` command palette, custom Noir RGB accent customization, discrete interface scale and compact density options, drag-reordering for sidebar pages, `Ctrl+V` clipboard page import, hold-to-peek original page shortcut, marquee multi-select for regions, on-demand CBZ/ZIP extraction, OPFS WebP thumbnail caching, folder watch streaming, tray/keep-awake/close-guard integration, and text-only or pattern-named export bundles.
  ([`295c0e18`](https://github.com/klaus-2/koma-studio/commit/295c0e18),
  [`09bf9bc4`](https://github.com/klaus-2/koma-studio/commit/09bf9bc4),
  [`cb87683f`](https://github.com/klaus-2/koma-studio/commit/cb87683f),
  [`4ad16054`](https://github.com/klaus-2/koma-studio/commit/4ad16054),
  [`d7713687`](https://github.com/klaus-2/koma-studio/commit/d7713687),
  [`8d21d920`](https://github.com/klaus-2/koma-studio/commit/8d21d920),
  [`41d038cc`](https://github.com/klaus-2/koma-studio/commit/41d038cc),
  [`975c37fe`](https://github.com/klaus-2/koma-studio/commit/975c37fe),
  [`c18f51c5`](https://github.com/klaus-2/koma-studio/commit/c18f51c5),
  [`60cf9602`](https://github.com/klaus-2/koma-studio/commit/60cf9602),
  [`0ab78db2`](https://github.com/klaus-2/koma-studio/commit/0ab78db2),
  [`675d618e`](https://github.com/klaus-2/koma-studio/commit/675d618e),
  [`1de8feda`](https://github.com/klaus-2/koma-studio/commit/1de8feda))

- **Per-file model download progress with ETA, curated model guides, and diagnostics reporting.** The model vault now reports per-file progress, completed counts, ETA, disk slack estimates, and backend-managed IDs, alongside curated local model comparison guides and AIO benchmarks. Bug reports submit rotating JSONL runtime logs to the bug-report endpoint with Discord notification attachments and an Open Logs Folder action.
  ([`15fafe1a`](https://github.com/klaus-2/koma-studio/commit/15fafe1a),
  [`1aa8623d`](https://github.com/klaus-2/koma-studio/commit/1aa8623d),
  [`c886b04f`](https://github.com/klaus-2/koma-studio/commit/c886b04f),
  [`4ebb29a0`](https://github.com/klaus-2/koma-studio/commit/4ebb29a0),
  [`2b5a6f2b`](https://github.com/klaus-2/koma-studio/commit/2b5a6f2b),
  [`52466ed7`](https://github.com/klaus-2/koma-studio/commit/52466ed7),
  [`3caf268a`](https://github.com/klaus-2/koma-studio/commit/3caf268a),
  [`9abdad73`](https://github.com/klaus-2/koma-studio/commit/9abdad73))

- **Support Discord bot rewritten in Rust.** The community support bot moved to Rust with RAG documentation search, moderation controls, GitHub triage commands, and dedicated CI Clippy/test checks.
  ([`6f98796c`](https://github.com/klaus-2/koma-studio/commit/6f98796c),
  [`47e5573f`](https://github.com/klaus-2/koma-studio/commit/47e5573f))

### Changed

- **Frontend build migrated to Vite 8 with React Compiler and native binary IPC.** Upgrading to Vite 8 and React Compiler replaced SheetJS `xlsx` and circular package imports while adopting raw binary IPC, thumbnail caching, native Windows Job Object sidecar supervision, ephemeral sidecar ports, and decoupled `/ready` warmup checks for faster desktop startup.
  ([`e22049f9`](https://github.com/klaus-2/koma-studio/commit/e22049f9),
  [`4e5cf695`](https://github.com/klaus-2/koma-studio/commit/4e5cf695),
  [`d2b59aac`](https://github.com/klaus-2/koma-studio/commit/d2b59aac),
  [`342db5b4`](https://github.com/klaus-2/koma-studio/commit/342db5b4),
  [`bf4d096d`](https://github.com/klaus-2/koma-studio/commit/bf4d096d))

- **OCR, bubble detection, segmentation, and inpainting pipelines tuned for throughput and VRAM.** Manga-OCR and Meiki-OCR run batched inference with KV-caching, ONNX graphs cache on disk, CPU sessions flush denormals, event-loop stalls are offloaded under GPU VRAM leases, blank webtoon bands are skipped, and bubble shape detection plus neural segmentation defaults were upgraded.
  ([`1925a86b`](https://github.com/klaus-2/koma-studio/commit/1925a86b),
  [`d21057d7`](https://github.com/klaus-2/koma-studio/commit/d21057d7),
  [`9ef45ec0`](https://github.com/klaus-2/koma-studio/commit/9ef45ec0),
  [`16d27646`](https://github.com/klaus-2/koma-studio/commit/16d27646),
  [`42534571`](https://github.com/klaus-2/koma-studio/commit/42534571),
  [`9c8f015a`](https://github.com/klaus-2/koma-studio/commit/9c8f015a),
  [`57a9f40f`](https://github.com/klaus-2/koma-studio/commit/57a9f40f))

- **Dashboard UI, Settings, AIO pipeline toggle, and app icons refreshed.** Settings is reorganized into six tabs with sticky navigation, AIO AI lives directly inside the pipeline toggle with dynamic stage disabling, footer stats use compact badges with a RAM/VRAM meter and CPU fallback shortcut, Noir workspaces and modals are deduplicated, and app icons are updated across Windows, macOS, Linux, mobile, and web.
  ([`f0470364`](https://github.com/klaus-2/koma-studio/commit/f0470364),
  [`fa551722`](https://github.com/klaus-2/koma-studio/commit/fa551722),
  [`53921d89`](https://github.com/klaus-2/koma-studio/commit/53921d89),
  [`5eef4f70`](https://github.com/klaus-2/koma-studio/commit/5eef4f70),
  [`ddfd655a`](https://github.com/klaus-2/koma-studio/commit/ddfd655a),
  [`1dce0141`](https://github.com/klaus-2/koma-studio/commit/1dce0141))

- **Release CI moved to Tauri-only draft builds with OIDC build provenance.** Desktop and runtime workflows build unsigned draft artifacts attested via `actions/attest-build-provenance` with zero signing keys in CI, while a local signing CLI verifies provenance and publishes signed manifests in seconds.
  ([`2e17e30f`](https://github.com/klaus-2/koma-studio/commit/2e17e30f),
  [`1c06e6f2`](https://github.com/klaus-2/koma-studio/commit/1c06e6f2))

### Fixed

- **Native webview zoom, replay tour, and auth-disabled UI visibility.** UI scaling uses native Tauri `setZoom` so custom cursors, preview pointers, and region focus scrolling stay aligned. Replay Tour now works when auth is disabled by falling back to a local id while hiding Rankings, Scanlation Feed, Travel Token, and Account ID surfaces.
  ([`080a1005`](https://github.com/klaus-2/koma-studio/commit/080a1005),
  [`109bcd63`](https://github.com/klaus-2/koma-studio/commit/109bcd63))

- **Model download resume, `ctd_text_seg` payload markers, and TensorRT fallback.** Interrupted server responses now raise `IncompleteRead` so large weights resume via Range requests instead of failing SHA-256 and deleting `.part` files, `ctd_text_seg` writes `segmenter.meta` with aligned payload checks, and TensorRT EP creation failures fall back cleanly to CUDA.
  ([`51fadee8`](https://github.com/klaus-2/koma-studio/commit/51fadee8),
  [`68824049`](https://github.com/klaus-2/koma-studio/commit/68824049),
  [`dd202bc6`](https://github.com/klaus-2/koma-studio/commit/dd202bc6))

- **Deliberate mini-backend stops, Discord RPC lifecycle, and auth/security hardening.** Planned mini-backend shutdowns log as info rather than crashes, Discord Rich Presence syncs reliably on startup, provider API keys are redacted from echoed backend errors, auth-server login stays operational when Redis is unavailable, and Tauri thumbnail serving enforces `MediaScope` path allowlists.
  ([`3df43003`](https://github.com/klaus-2/koma-studio/commit/3df43003),
  [`60408d32`](https://github.com/klaus-2/koma-studio/commit/60408d32),
  [`1eca6fac`](https://github.com/klaus-2/koma-studio/commit/1eca6fac),
  [`1cd2a223`](https://github.com/klaus-2/koma-studio/commit/1cd2a223),
  [`dadddfa0`](https://github.com/klaus-2/koma-studio/commit/dadddfa0))

- **Dock, settings, typography, and WCAG 2.2 AA interface fixes.** Fixed Noir render-dock grid alignment and transform reset, shipped the Free typography preset without rotation or skew, kept settings tab navigation pinned on scroll, prevented page transition overlays from sticking, coordinated topbar portal menus and overlays, and closed WCAG 2.2 AA accessibility gaps in dialogs, tabs, and forms.
  ([`2ebff8b2`](https://github.com/klaus-2/koma-studio/commit/2ebff8b2),
  [`e257d949`](https://github.com/klaus-2/koma-studio/commit/e257d949),
  [`252b5d87`](https://github.com/klaus-2/koma-studio/commit/252b5d87),
  [`3244b7d8`](https://github.com/klaus-2/koma-studio/commit/3244b7d8),
  [`855b28bb`](https://github.com/klaus-2/koma-studio/commit/855b28bb),
  [`244538f4`](https://github.com/klaus-2/koma-studio/commit/244538f4),
  [`03a3db95`](https://github.com/klaus-2/koma-studio/commit/03a3db95))

### Removed

- **Retired `koma-build-tool` and Electron installer release builds.** Removed `apps/tools/koma-build-tool` from the workspace, retired Electron installer CI pipelines while keeping `SyncPanel` gated to unpackaged dev builds, and removed the legacy remote content catalog and hardened release scripts.
  ([`b781da7a`](https://github.com/klaus-2/koma-studio/commit/b781da7a),
  [`2e17e30f`](https://github.com/klaus-2/koma-studio/commit/2e17e30f),
  [`2d77d970`](https://github.com/klaus-2/koma-studio/commit/2d77d970),
  [`5dc2e8f1`](https://github.com/klaus-2/koma-studio/commit/5dc2e8f1))

## [1.3.1] - 2026-11-02

19 commits since v1.3.0, focused on stability fixes behind the local runtime. The release resolves cases where a 1.3.0 install could report a backend crash on normal shutdown, show "CPU (forced)" even with CUDA loaded, or fail at boot when a bundled data file was missing.

### Changed

- **The release build boots every packaged runtime profile before shipping it.** The smoke check that extracts parts into a clean tree and waits for `/health` used to run only in CI for Linux and macOS, leaving Windows artifacts unbooted; the release build now runs it locally across profiles.
  ([`de0c326`](https://github.com/klaus-2/koma-studio/commit/de0c326))

- **Release builds reuse matching runtime parts already built.** A fresh output directory previously triggered a full PyInstaller rebuild of every profile; builds now adopt intact sibling copies when source hashes and environments match, lock directories cleanly, and support `MINI_BACKEND_MANIFEST_ONLY=1`.
  ([`91132ca`](https://github.com/klaus-2/koma-studio/commit/91132ca),
  [`766c2e5`](https://github.com/klaus-2/koma-studio/commit/766c2e5))

### Fixed

- **A packaged backend no longer dies at boot when a data file is missing from the bundle.** The paddleocr module read its manifest on import, crashing all local features with a `FileNotFoundError` dialog when absent. Manifests now build on first use and release verification refuses incomplete bundles.
  ([`2db1b80`](https://github.com/klaus-2/koma-studio/commit/2db1b80),
  [`584d5b4`](https://github.com/klaus-2/koma-studio/commit/584d5b4),
  [`83e8946`](https://github.com/klaus-2/koma-studio/commit/83e8946))

- **The packaged app no longer forces the cpu profile over user selection and GPU detection.** Release builds baked `MINI_BACKEND_ACCELERATION_PROFILE=cpu` into runtime config, overriding manual choices and CUDA detection. The baked override was removed while preserving explicit environment overrides.
  ([`604b1df`](https://github.com/klaus-2/koma-studio/commit/604b1df))

- **Closing the app no longer reports a backend crash.** The Tauri supervisor filed ordinary shutdowns as unexpected exits with post-mortem logs; deliberate stops now report as normal stops without error codes.
  ([`ad96f31b`](https://github.com/klaus-2/koma-studio/commit/ad96f31b),
  [`5a034f2`](https://github.com/klaus-2/koma-studio/commit/5a034f2))

- **A missing detection model no longer downgrades the runtime to CPU.** Warmup smoke failures from missing models previously downgraded CUDA profiles to "CPU (forced)"; warmup is skipped cleanly and the requested profile is preserved.
  ([`9589c44`](https://github.com/klaus-2/koma-studio/commit/9589c44))

- **An interrupted runtime install reinstalls instead of booting a broken tree.** Both shells now require the runtime launch manifest, matching profile, and declared data files before spawning so partial trees trigger a clean reinstall.
  ([`2e35ee9`](https://github.com/klaus-2/koma-studio/commit/2e35ee9),
  [`544b3ac`](https://github.com/klaus-2/koma-studio/commit/544b3ac),
  [`9676e62`](https://github.com/klaus-2/koma-studio/commit/9676e62))

## [1.3.0] - 2026-11-01

172 commits since v1.2.0. AIO gains a sequential chapter batch mode with per-chapter presets and ETA, translation gains a glossary with never-translate masking, opt-in translation memory, and persistent SQLite cache, and render-performance passes keep high-frequency dashboard ticks scoped to leaf components.

### Added

- **AIO batch mode with editable chapters and an ETA.** Batch Mode runs loaded chapters sequentially over the local batch transport with per-chapter options, failure isolation, abort handling, capacity preflight, and per-chapter ETA tracking.
  ([`dd17d5a`](https://github.com/klaus-2/koma-studio/commit/dd17d5a),
  [`1f3eac1`](https://github.com/klaus-2/koma-studio/commit/1f3eac1),
  [`331ff9e`](https://github.com/klaus-2/koma-studio/commit/331ff9e),
  [`9a3ff14`](https://github.com/klaus-2/koma-studio/commit/9a3ff14))

- **Glossary terms reach local translation engines.** The AIO glossary editor feeds terms into LLM request settings, translation stages, and context prompts, running mandatory post-checks and masking never-translate terms.
  ([`c953be4`](https://github.com/klaus-2/koma-studio/commit/c953be4),
  [`38c2fe9`](https://github.com/klaus-2/koma-studio/commit/38c2fe9),
  [`575af64`](https://github.com/klaus-2/koma-studio/commit/575af64),
  [`69f8c89`](https://github.com/klaus-2/koma-studio/commit/69f8c89),
  [`91d77d3`](https://github.com/klaus-2/koma-studio/commit/91d77d3),
  [`f5cf8eb`](https://github.com/klaus-2/koma-studio/commit/f5cf8eb),
  [`0920d2e`](https://github.com/klaus-2/koma-studio/commit/0920d2e))

- **Opt-in translation memory and a persistent cache.** A SQLite store persists across restarts keyed by model, languages, mode, normalized text, and glossary hash while invalidating masked hits that omit required verbatim terms.
  ([`ca87f32`](https://github.com/klaus-2/koma-studio/commit/ca87f32),
  [`b5a1a5d`](https://github.com/klaus-2/koma-studio/commit/b5a1a5d),
  [`3d55274`](https://github.com/klaus-2/koma-studio/commit/3d55274))

- **Translation QA detectors.** Deterministic echo collapse, doubled-word flagging, symbol-only bypass, and per-request seed deduplication harden local translation output and custom profile stores.
  ([`b5cc3f2`](https://github.com/klaus-2/koma-studio/commit/b5cc3f2),
  [`f87e966`](https://github.com/klaus-2/koma-studio/commit/f87e966),
  [`0a27ad4`](https://github.com/klaus-2/koma-studio/commit/0a27ad4),
  [`dd35934`](https://github.com/klaus-2/koma-studio/commit/dd35934),
  [`62494de`](https://github.com/klaus-2/koma-studio/commit/62494de),
  [`d3ac6f7`](https://github.com/klaus-2/koma-studio/commit/d3ac6f7))

- **Custom GGUF models load from a manifest.** The backend lists custom GGUF models from a manifest and refreshes when models change on disk.
  ([`8d41ff0`](https://github.com/klaus-2/koma-studio/commit/8d41ff0),
  [`aa861b4`](https://github.com/klaus-2/koma-studio/commit/aa861b4))

- **Custom cursor toggle.** Users can disable the animated cursor overlay from App settings in both theme families across all 14 locales, restoring the native system pointer live.
  ([`3808c82`](https://github.com/klaus-2/koma-studio/commit/3808c82))

- **The NLLB int8 and 1.3B variants are runnable.** Full weight manifests now install and execute on CPU engines (CTranslate2 int8 and transformers fp32) with slug aliases preventing unwanted Google fallback.
  ([`abb4af7`](https://github.com/klaus-2/koma-studio/commit/abb4af7))

- **Terms of service and privacy policy on the landing.** Static legal routes ship without regenerating `dateModified` on every deploy, pointing contact references to Discord and GitHub.
  ([`1b3b384`](https://github.com/klaus-2/koma-studio/commit/1b3b384))

- **An e2e main-flow regression harness.** Playwright main-flow suites and isolated harness helpers validate core desktop user journeys.
  ([`c1ec553`](https://github.com/klaus-2/koma-studio/commit/c1ec553),
  [`425b3c0`](https://github.com/klaus-2/koma-studio/commit/425b3c0))

- **CI gates.** Mini-backend pytest suites and line-count ratchets enforce test health and file size limits on pull requests.
  ([`e9c683a`](https://github.com/klaus-2/koma-studio/commit/e9c683a),
  [`cf11364`](https://github.com/klaus-2/koma-studio/commit/cf11364),
  [`1ced177`](https://github.com/klaus-2/koma-studio/commit/1ced177))

### Changed

- **Six large files split into focused modules.** The noir chapter optimizer, V2 blogger workspace, settings sections, dashboard hooks, Tauri command helpers, and model manager download state moved into cohesive modules.
  ([`fb21fc2`](https://github.com/klaus-2/koma-studio/commit/fb21fc2),
  [`d47ff4c`](https://github.com/klaus-2/koma-studio/commit/d47ff4c),
  [`f3ad75d`](https://github.com/klaus-2/koma-studio/commit/f3ad75d),
  [`9ada4dc`](https://github.com/klaus-2/koma-studio/commit/9ada4dc),
  [`f6edccd`](https://github.com/klaus-2/koma-studio/commit/f6edccd),
  [`ccd248c`](https://github.com/klaus-2/koma-studio/commit/ccd248c))

- **Dashboard re-renders stop at leaf components.** Stage zoom, AIO progress labels, preset/LLM drafts, and rAF-coalesced drag/wheel updates avoid full-page re-renders during interactive work.
  ([`0c92093`](https://github.com/klaus-2/koma-studio/commit/0c92093),
  [`5da43ec`](https://github.com/klaus-2/koma-studio/commit/5da43ec),
  [`58a074c`](https://github.com/klaus-2/koma-studio/commit/58a074c),
  [`2210833`](https://github.com/klaus-2/koma-studio/commit/2210833),
  [`112cbee`](https://github.com/klaus-2/koma-studio/commit/112cbee),
  [`6a710c2`](https://github.com/klaus-2/koma-studio/commit/6a710c2))

- **First-load payload cut across app and landing.** Lazy-loaded markdown/PDF dependencies, unified `LazyMotion`, native `crypto.randomUUID`, and compressed landing assets cut bundle and media sizes.
  ([`a1d7300`](https://github.com/klaus-2/koma-studio/commit/a1d7300),
  [`a2c8a6d`](https://github.com/klaus-2/koma-studio/commit/a2c8a6d),
  [`3056ab0`](https://github.com/klaus-2/koma-studio/commit/3056ab0),
  [`bf68f3f`](https://github.com/klaus-2/koma-studio/commit/bf68f3f),
  [`649e8ba`](https://github.com/klaus-2/koma-studio/commit/649e8ba))

- **CSS animation moved onto compositor properties.** Keyframes, noir transitions, and progress bars animate `transform` and `opacity` instead of layout properties.
  ([`6133414`](https://github.com/klaus-2/koma-studio/commit/6133414),
  [`8f5ec52`](https://github.com/klaus-2/koma-studio/commit/8f5ec52),
  [`3176cb9`](https://github.com/klaus-2/koma-studio/commit/3176cb9),
  [`e38a41c`](https://github.com/klaus-2/koma-studio/commit/e38a41c))

- **Dependencies refreshed.** Updated `better-auth`, `drizzle-orm`, `next`, `vite`, `vitest`, `zod`, `python-multipart`, `rustls`, Rust crates, and GitHub Actions.
  ([`250f615`](https://github.com/klaus-2/koma-studio/commit/250f615))

### Fixed

- **A dead backend no longer keeps the model download queue latched forever.** Poll failures are bounded and surfaced as retryable network errors, uninstalls stay removed, cancellations land cleanly between retries, and indeterminate downloads stay indeterminate.
  ([`4f1ab2a`](https://github.com/klaus-2/koma-studio/commit/4f1ab2a),
  [`6764c74`](https://github.com/klaus-2/koma-studio/commit/6764c74),
  [`cc97bd7`](https://github.com/klaus-2/koma-studio/commit/cc97bd7),
  [`7063fc0`](https://github.com/klaus-2/koma-studio/commit/7063fc0),
  [`8ff6149`](https://github.com/klaus-2/koma-studio/commit/8ff6149),
  [`f068639`](https://github.com/klaus-2/koma-studio/commit/f068639))

- **Provisioned venvs keep their CUDA provider.** NVIDIA profiles assert `CUDAExecutionProvider` after installation and install CUDA PyTorch builds cleanly without CPU wheel clobbering.
  ([`5e243a1`](https://github.com/klaus-2/koma-studio/commit/5e243a1),
  [`3ac9c2d`](https://github.com/klaus-2/koma-studio/commit/3ac9c2d),
  [`ef2a12f`](https://github.com/klaus-2/koma-studio/commit/ef2a12f))

- **CB7 ingest works on py7zr 1.0.** Replaced removed `SevenZipFile.read()` calls with bounded `BytesIOFactory` reads and request-wide output budgets.
  ([`d7e1381`](https://github.com/klaus-2/koma-studio/commit/d7e1381),
  [`2aba874`](https://github.com/klaus-2/koma-studio/commit/2aba874),
  [`24283f7`](https://github.com/klaus-2/koma-studio/commit/24283f7))

- **Transient gateway errors retry on the shared HTTP client.** HTTP 502, 503, and 504 responses retry alongside 429 with `Retry-After` backoff while keeping 500 terminal.
  ([`b9b4532`](https://github.com/klaus-2/koma-studio/commit/b9b4532))

- **Glossary editor rows keep their identity.** Stable row ids and content-compared draft resyncs preserve focus and prevent shifted deletes.
  ([`697eda0`](https://github.com/klaus-2/koma-studio/commit/697eda0))

- **Interface fixes.** Fixed non-passive stage zoom wheel listeners, region removal snapshot patches, optimizer scrolling, untrusted LLM payload parsing, and managed font detector installs.
  ([`8594b95`](https://github.com/klaus-2/koma-studio/commit/8594b95),
  [`140ce11`](https://github.com/klaus-2/koma-studio/commit/140ce11),
  [`8115365`](https://github.com/klaus-2/koma-studio/commit/8115365),
  [`68a5290`](https://github.com/klaus-2/koma-studio/commit/68a5290),
  [`89b92a2`](https://github.com/klaus-2/koma-studio/commit/89b92a2),
  [`1f9e3dd`](https://github.com/klaus-2/koma-studio/commit/1f9e3dd))

- **Defaults.** Defaulted theme to dark, defaulted updater channel to `stable`, and bound Discord Rich Presence updates to the dashboard route.
  ([`cb9cf54`](https://github.com/klaus-2/koma-studio/commit/cb9cf54),
  [`4e19ea3`](https://github.com/klaus-2/koma-studio/commit/4e19ea3),
  [`0925e06`](https://github.com/klaus-2/koma-studio/commit/0925e06),
  [`c9b14ef`](https://github.com/klaus-2/koma-studio/commit/c9b14ef))

## [1.2.0] - 2026-10-26

278 commits since v1.1.0. This is the first release with compiled artifacts on GitHub, shipping Windows installers alongside signed multi-part mini-backend downloads fetched on demand.

### Added

- **Compiled releases with a multi-part runtime feed.** Mini-backend runtimes publish as signed per-part zips under 2 GiB described by `mini-backend-latest-{platform}-{arch}.json` with Range resume, per-part SHA-512 verification, and atomic commit.
  ([`a7b690c`](https://github.com/klaus-2/koma-studio/commit/a7b690c),
  [`8912445`](https://github.com/klaus-2/koma-studio/commit/8912445),
  [`d7a24f6`](https://github.com/klaus-2/koma-studio/commit/d7a24f6))

- **Runtime release choreography.** `publish-runtime-artifacts.mjs` coordinates draft `runtime-v<version>` uploads with CI smoke checks and remote release validation via `verify-release.mjs`.
  ([`3d6b238`](https://github.com/klaus-2/koma-studio/commit/3d6b238),
  [`080a431`](https://github.com/klaus-2/koma-studio/commit/080a431))

- **Security hardening of the local API and runtime feed.** The local API gate fails closed under `x-koma-local-session`, runtime manifests carry Ed25519 signatures, and archive URLs stay pinned to HTTPS manifest origins.
  ([`79dfa60`](https://github.com/klaus-2/koma-studio/commit/79dfa60))

- **Inline text editing with formatting.** Inline canvas editing renders bold, italic, and underline live in both Classic and Noir skins.
  ([`e3143ab`](https://github.com/klaus-2/koma-studio/commit/e3143ab),
  [`b3b3167`](https://github.com/klaus-2/koma-studio/commit/b3b3167))

- **AIO translation stages.** OPUS-MT and NLLB run as pipeline stages with per-stage batch progress and automatic sidecar crash recovery.
  ([`c5d45c3`](https://github.com/klaus-2/koma-studio/commit/c5d45c3),
  [`dfa239d`](https://github.com/klaus-2/koma-studio/commit/dfa239d))

### Changed

- **The mini-backend dev/runtime pipeline.** Contaminated venvs recreate cleanly, provisioner scripts bootstrap dependencies deterministically, and opencv/pip/certifi pins prevent broken installs.
  ([`f56161f`](https://github.com/klaus-2/koma-studio/commit/f56161f),
  [`42861b4`](https://github.com/klaus-2/koma-studio/commit/42861b4),
  [`f31bb34`](https://github.com/klaus-2/koma-studio/commit/f31bb34),
  [`076a17d`](https://github.com/klaus-2/koma-studio/commit/076a17d))

- **The runtime feed moved to GitHub Releases.** Default artifacts URL moved from `api.koma-studio.site` to `https://github.com/klaus-2/koma-studio/releases/latest/download/`.
  ([`d4a8538`](https://github.com/klaus-2/koma-studio/commit/d4a8538))

### Fixed

- **Packaged runtimes booted into a crash.** Bundled `model-assets.json` across every runtime profile so packaged executables pass `/health` startup checks.
  ([`38f7eae`](https://github.com/klaus-2/koma-studio/commit/38f7eae))

- **Multi-part extraction became deterministic.** Electron extraction reads central directories directly instead of failing on the trailing zip entry.
  ([`6354b57`](https://github.com/klaus-2/koma-studio/commit/6354b57))

- **The hardened Tauri build referenced a removed helper.** Dropped stale `updater-tools` / `make_bsdiff` references from the release script.
  ([`0fbdc32`](https://github.com/klaus-2/koma-studio/commit/0fbdc32))

- **The CI interface job and the release embed chain.** Fixed CI `changes` filters, Windows-portable script tests, and build ordering for embedded cores.
  ([`44b4c1a`](https://github.com/klaus-2/koma-studio/commit/44b4c1a),
  [`0f968f9`](https://github.com/klaus-2/koma-studio/commit/0f968f9),
  [`b91e401`](https://github.com/klaus-2/koma-studio/commit/b91e401))

- **Small backend and download fixes landed together.** Restored partial venv rebuilds, ModelScope/GitHub model downloads, GPU-OOM CPU fallback, and CPU-fallback notifications.
  ([`6970aaf`](https://github.com/klaus-2/koma-studio/commit/6970aaf),
  [`affa058`](https://github.com/klaus-2/koma-studio/commit/affa058),
  [`e8005a3`](https://github.com/klaus-2/koma-studio/commit/e8005a3),
  [`3b4d160`](https://github.com/klaus-2/koma-studio/commit/3b4d160))

- **The packaged Tauri shell opened a blank window.** Declared `scheduler` cleanly, enforced unresolved import checks, allowed Windows IPC in CSP, and stopped reporting an unconfigured runtime as ready.
  ([`20e0114`](https://github.com/klaus-2/koma-studio/commit/20e0114),
  [`cb57f80`](https://github.com/klaus-2/koma-studio/commit/cb57f80),
  [`20d1591`](https://github.com/klaus-2/koma-studio/commit/20d1591))

## [1.1.0] - 2026-10-10

90 commits since v1.0.3. Added the Noir theme family across the app and landing page, alongside the initial release-helper app.

### Added

- **The app ships two theme families, Classic and Noir.** Theme state persists in `koma_theme` with CSP-safe pre-paint bootstrap across all 14 locales.
  ([`ae4267b`](https://github.com/klaus-2/koma-studio/commit/ae4267b))

- **Most of the app gained a Noir view: 79 components and 12 stylesheets.** Splitter, Stitch, Translator, Cleaner, Enhance, AIO, Optimizer, Shortcuts, Watermark, Modals, and Auth views support Noir styling.
  ([`260bcf4`](https://github.com/klaus-2/koma-studio/commit/260bcf4),
  [`eaedb42`](https://github.com/klaus-2/koma-studio/commit/eaedb42),
  [`e1bb175`](https://github.com/klaus-2/koma-studio/commit/e1bb175),
  [`1fbd0ca`](https://github.com/klaus-2/koma-studio/commit/1fbd0ca))

- **The landing page reads in the same language as the app.** Rebuilt on Noir ink, paper, crimson, and gold tokens with a 4-mode manga markup preview.
  ([`d4f5548`](https://github.com/klaus-2/koma-studio/commit/d4f5548))

- **A Tauri app drives the release steps.** Added the initial `koma-build-tool` orchestrator for local builds and deployments.
  ([`e5b1bcf`](https://github.com/klaus-2/koma-studio/commit/e5b1bcf))

- **Bundle analysis on the electron vite build, opt-in.** Promoted `scheduler` to a direct dependency matching `vite.config.mts`.
  ([`8a73a33`](https://github.com/klaus-2/koma-studio/commit/8a73a33))

### Changed

- **The promo clip and the stage order moved above the fold in the README.** Reordered landing documentation to highlight the demo and workflow immediately.
  ([`ab800aa`](https://github.com/klaus-2/koma-studio/commit/ab800aa))

- **The model manager bars scale instead of re-laying out.** `DiskSpaceIndicator` and `ModelProgressBar` animate via `scaleX` transforms rather than `width`.
  ([`7a066ac`](https://github.com/klaus-2/koma-studio/commit/7a066ac))

- **The stitch render job and export handlers moved into a hook.** Extracted stitch orchestration so workspace views keep thin boundaries.
  ([`b95a4f8`](https://github.com/klaus-2/koma-studio/commit/b95a4f8))

### Fixed

- **Three stylesheet references left dangling by the noir move.** Fixed stale `App.css` imports and duplicate `enhance-noir` stylesheet loading.
  ([`d34162d`](https://github.com/klaus-2/koma-studio/commit/d34162d))

- **`ModelRankingsNoir.tsx` imported `./ModelRankings.css` instead of its own noir sheet.** Corrected the import to load the Noir stylesheet.
  ([`c17dff8`](https://github.com/klaus-2/koma-studio/commit/c17dff8))

- **The noir auth block read four tokens nothing defined.** Added the missing dark and light `--auth-*` backing tokens to `noir.css`.
  ([`b9237da`](https://github.com/klaus-2/koma-studio/commit/b9237da))

### Removed

- **Unused noir views and sheets are gone.** Removed `MangaScene`, `app-preview/shared`, `three`, `drei`, and `zustand` after the landing preview rewrite.
  ([`e884dc9`](https://github.com/klaus-2/koma-studio/commit/e884dc9),
  [`d4f5548`](https://github.com/klaus-2/koma-studio/commit/d4f5548))

## [1.0.3] - 2026-10-02

14 commits since v1.0.2, focused on Rust input validation, typed errors, and filesystem/network hardening in the Tauri shell.

### Changed

- **Rust error handling became typed across the Tauri shell.** Migrated shell services from `Result<_, String>` to `AppResult` / `AppError` and `RuntimeError`.
  ([`b19047b`](https://github.com/klaus-2/koma-studio/commit/b19047b),
  [`4cfd212`](https://github.com/klaus-2/koma-studio/commit/4cfd212),
  [`1e049c8`](https://github.com/klaus-2/koma-studio/commit/1e049c8),
  [`25c434c`](https://github.com/klaus-2/koma-studio/commit/25c434c))

- **Command files are thin typed layers now.** Extracted services and shared `ModelDownloadStore` mutexes out of Tauri IPC command entry points.
  ([`4cfd212`](https://github.com/klaus-2/koma-studio/commit/4cfd212),
  [`81b5bff`](https://github.com/klaus-2/koma-studio/commit/81b5bff))

- **Session logging stopped holding the log file open for the process lifetime.** Stopped opening and closing log files per line on the main thread.
  ([`ff91eea`](https://github.com/klaus-2/koma-studio/commit/ff91eea))

- **Both Tauri crates moved from Rust edition 2021 to edition 2024, with MSRV 1.85.** Updated Rust crate editions while staying on Tauri 2.11.5.
  ([`85e2766`](https://github.com/klaus-2/koma-studio/commit/85e2766))

- **Blocking probes moved off the async runtime.** Offloaded stale-instance and dev-venv probes to `spawn_blocking` and unified port parsing.
  ([`82c274b`](https://github.com/klaus-2/koma-studio/commit/82c274b))

### Fixed

- **A workspace manifest declaring 10k assets of 512 MiB each can no longer make the app buffer 5 TB.** Read paths now share `validate_manifest_entries` and bound reads to declared sizes.
  ([`82c274b`](https://github.com/klaus-2/koma-studio/commit/82c274b))

- **Certificate pins are anchored against the full presented chain.** Unified the pinned client builder with chain verification instead of checking only the leaf certificate.
  ([`af96795`](https://github.com/klaus-2/koma-studio/commit/af96795))

- **`api_client.method()` accepts only an allowlist of HTTP methods.** Rejected `TRACE`, `CONNECT`, and custom HTTP verbs from frontend IPC calls.
  ([`af96795`](https://github.com/klaus-2/koma-studio/commit/af96795))

- **Imgur delete hashes are validated before they reach a URL.** Enforced alphanumeric validation and a 128-character limit before keychain lookup and URL construction.
  ([`af96795`](https://github.com/klaus-2/koma-studio/commit/af96795))

- **Font installs check the file signature, not the extension.** Shared magic-byte verification covers TTF, OTF, WOFF, and WOFF2 fonts under a 64 MiB cap.
  ([`af96795`](https://github.com/klaus-2/koma-studio/commit/af96795),
  [`4cfd212`](https://github.com/klaus-2/koma-studio/commit/4cfd212))

- **Base URLs are HTTPS-only with loopback exempt.** Responses are capped at 8 MiB and deep links pass through an allowlist rejecting duplicate query keys.
  ([`4cfd212`](https://github.com/klaus-2/koma-studio/commit/4cfd212))

- **Renderer log lines are sanitized.** Control characters are stripped and lines cap at 8 KiB on character boundaries.
  ([`ff91eea`](https://github.com/klaus-2/koma-studio/commit/ff91eea))

- **Keychain inputs are validated and secrets zeroized.** Account names are validated before blocking keychain calls and secrets zeroized after use.
  ([`82c274b`](https://github.com/klaus-2/koma-studio/commit/82c274b),
  [`4cfd212`](https://github.com/klaus-2/koma-studio/commit/4cfd212))

- **Model download retry logic was backwards.** Transport and transient HTTP errors retry while integrity and local I/O failures fail immediately.
  ([`25c434c`](https://github.com/klaus-2/koma-studio/commit/25c434c))

- **Custom LLM API keys came back empty after saving on Tauri.** Added `desktop-api:llm-profiles:resolve-key` to hydrate keychain secrets for custom LLM bridge calls.
  ([`9fbcc47`](https://github.com/klaus-2/koma-studio/commit/9fbcc47))

- **Model downloads sat at 0%.** Throttled progress events to ~10/sec over a buffered 256 KiB writer with explicit flush before SHA-512 verification.
  ([`25c434c`](https://github.com/klaus-2/koma-studio/commit/25c434c))

- **Two concurrent sidecar starts can no longer fight over the port.** Added a single-flight atomic guard with exited checks before health polling.
  ([`82c274b`](https://github.com/klaus-2/koma-studio/commit/82c274b))

- **One corrupted profile no longer bricks the profile store.** Invalid entries are dropped cleanly under a store mutex while preserving valid profiles.
  ([`82c274b`](https://github.com/klaus-2/koma-studio/commit/82c274b))

- **`atomic_replace` no longer fails a completed save over backup cleanup.** Backup cleanup failures now warn while parent directories are fsynced.
  ([`82c274b`](https://github.com/klaus-2/koma-studio/commit/82c274b))

- **A failed font rename no longer leaves the `.tmp` file behind.** Stray corrupt fonts no longer abort manifest reconciliation.
  ([`af96795`](https://github.com/klaus-2/koma-studio/commit/af96795))

- **`load_or_create_fallback_id` no longer swallows the real I/O error.** Hardware profile detection also stopped walking the full process table.
  ([`af96795`](https://github.com/klaus-2/koma-studio/commit/af96795))

- **Listing a folder for images no longer freezes the webview.** Moved directory scanning off the main thread via `spawn_blocking` and skipped non-UTF-8 paths.
  ([`ff91eea`](https://github.com/klaus-2/koma-studio/commit/ff91eea))

- **A failed extraction no longer leaks the temp zip.** Cleaned up temporary download archives on every extraction error path.
  ([`25c434c`](https://github.com/klaus-2/koma-studio/commit/25c434c))

- **`dev:electron` stopped failing with `mini_backend_health_timeout` on a healthy CUDA machine.** Raised cold dev startup timeout from 120s to 360s.
  ([`04d6c3e`](https://github.com/klaus-2/koma-studio/commit/04d6c3e))

- **The bug report and Discord command rewrite compiles.** Fixed `#[serde(other)]` placement on the last enum variant.
  ([`537f638`](https://github.com/klaus-2/koma-studio/commit/537f638))

- **OCR fallback gamma is applied in the right domain.** Replaced eager fallback upscaling with lazy variants and a shared 256-entry `gamma_normalize` LUT off the event loop.
  ([`0165fff`](https://github.com/klaus-2/koma-studio/commit/0165fff))

## [1.0.2] - 2026-10-01

22 commits since v1.0.1, decomposing the Python mini-backend into modular packages and fixing security, memory, and inference bugs.

### Changed

- **PSD export stopped allocating a page-sized RGBA canvas for every text layer.** `_alpha_paste_with_bounds` composes each layer's bounding window only.
  ([`23ad7aa`](https://github.com/klaus-2/koma-studio/commit/23ad7aa))

- **Batch uploads stopped holding `batch_size x 32MiB` of image bytes in RAM.** Batch tasks read spooled files inside each concurrency slot and clean up temporary files in `finally`.
  ([`6099806`](https://github.com/klaus-2/koma-studio/commit/6099806))

- **`_build_segment_alpha` is a vectorized numpy column repeat now.** Replaced Python pixel loops with vectorized numpy operations pinned by an oracle test.
  ([`5cb9d72`](https://github.com/klaus-2/koma-studio/commit/5cb9d72))

- **`_detect_content_boxes` runs one labelling pass per polarity.** Replaced repeated per-component masks with a LUT over label indices.
  ([`9ec51e1`](https://github.com/klaus-2/koma-studio/commit/9ec51e1))

- **Segmentation runs off the event loop.** Synchronous `_segment` implementations run through `asyncio.to_thread`.
  ([`9ec51e1`](https://github.com/klaus-2/koma-studio/commit/9ec51e1))

- **The sidebar resize drag is imperative and commits on mouseup.** Eliminated 228ms per-pixel React re-renders during sidebar resizing.
  ([`bf11b38`](https://github.com/klaus-2/koma-studio/commit/bf11b38))

- **Tauri serves media through `koma-image://` and `koma-font://` custom URI schemes instead of base64 over IPC.** Enforces Rust-observed `MediaScope` allowlists, Range 206 streaming, and ETag/304 caching.
  ([#30](https://github.com/klaus-2/koma-studio/pull/30),
  [`21fd916`](https://github.com/klaus-2/koma-studio/commit/21fd916))

- **Large mini-backend routers moved into focused packages and services.** Split `routers/pipeline.py`, `providers.py`, and inpainting execution into modular packages, moving splitter and typography algorithms into testable services.
  ([`951897e`](https://github.com/klaus-2/koma-studio/commit/951897e),
  [`4de6136`](https://github.com/klaus-2/koma-studio/commit/4de6136),
  [`d924021`](https://github.com/klaus-2/koma-studio/commit/d924021),
  [`6099806`](https://github.com/klaus-2/koma-studio/commit/6099806))

- **Typed error taxonomies and wire TypedDicts across caches and writers.** Narrowed broad exception handlers across Hugging Face downloads, translation, and Photoshop output while adding `app.py` `create_app()`, `/diagnostics/memory`, and structured client 400 errors.
  ([`23ad7aa`](https://github.com/klaus-2/koma-studio/commit/23ad7aa),
  [`1e90fdc`](https://github.com/klaus-2/koma-studio/commit/1e90fdc),
  [`95c402e`](https://github.com/klaus-2/koma-studio/commit/95c402e),
  [`fb3032c`](https://github.com/klaus-2/koma-studio/commit/fb3032c),
  [`ef77bb0`](https://github.com/klaus-2/koma-studio/commit/ef77bb0),
  [`d5b91e6`](https://github.com/klaus-2/koma-studio/commit/d5b91e6),
  [`6099806`](https://github.com/klaus-2/koma-studio/commit/6099806))

### Fixed

- **`_download_remote_image` no longer follows any URL a model returned.** Resolves every redirect hop against global IPs, streams up to 32 MiB, and sniffs magic bytes.
  ([`5cb9d72`](https://github.com/klaus-2/koma-studio/commit/5cb9d72))

- **The Gemini key moved from a `?key=` query string to the `x-goog-api-key` header.** Prevented API key leaks into exception traces and access logs.
  ([`1e90fdc`](https://github.com/klaus-2/koma-studio/commit/1e90fdc))

- **Uploads answer 413 at the limit instead of loading the body first.** Chunked ingest adds zip-bomb guards (64 MB/entry, 2000 entries, 200 MB per upload).
  ([`1e90fdc`](https://github.com/klaus-2/koma-studio/commit/1e90fdc))

- **Splitter blur runs on the right axis.** Fixed axis orientation so horizontal strip detection smooths across cut positions properly.
  ([`6099806`](https://github.com/klaus-2/koma-studio/commit/6099806))

- **The baka segmenter partitions with `<= t` and `> t`.** Fixed empty-class edge cases when Otsu returns `t = 0`.
  ([`9ec51e1`](https://github.com/klaus-2/koma-studio/commit/9ec51e1))

- **Two different pages can no longer collide in the cache and serve each other's OCR.** Replaced sampled byte hashing with full blake2b digests and monotonic TTL clocks.
  ([`9ec51e1`](https://github.com/klaus-2/koma-studio/commit/9ec51e1))

- **Paddle CTC dictionaries with CRLF line endings are read correctly.** Stripped `\r\n` cleanly instead of leaving `\r` on entries.
  ([`15218a7`](https://github.com/klaus-2/koma-studio/commit/15218a7))

- **Comic NMS indexes the right list.** Fixed index alignment after size filtering so recall passes preserve valid boxes.
  ([`e2cba5d`](https://github.com/klaus-2/koma-studio/commit/e2cba5d))

- **Local translators await correctly.** Wrapped blocking inference in `asyncio.to_thread` under per-instance locks for ctranslate2 and llama.cpp thread safety.
  ([`fb3032c`](https://github.com/klaus-2/koma-studio/commit/fb3032c))

- **`OCRPipeline.last_model_key` is no longer mutable singleton state.** `run()` returns the model key directly per call.
  ([`23ad7aa`](https://github.com/klaus-2/koma-studio/commit/23ad7aa))

- **The export temp directory no longer leaks on failure.** `_run_export` cleans up temporary directories on all `BaseException` paths and returns 422 on non-numeric manifest fields.
  ([`23ad7aa`](https://github.com/klaus-2/koma-studio/commit/23ad7aa))

- **External cancellation propagates through the queue processor.** Rewrote queue execution on `asyncio.TaskGroup` and `asyncio.timeout`.
  ([`9ec51e1`](https://github.com/klaus-2/koma-studio/commit/9ec51e1))

- **The packaged runtime starts on pydantic 2.9.** Replaced PEP 695 `TypeAliasType` definitions with plain aliases compatible with pydantic 2.9.
  ([`3e4f879`](https://github.com/klaus-2/koma-studio/commit/3e4f879),
  [`c70c46e`](https://github.com/klaus-2/koma-studio/commit/c70c46e))

- **The dashboard builds again.** Restored missing `KomaTopbar` download and export props so Babel builds succeed.
  ([`7a63b42`](https://github.com/klaus-2/koma-studio/commit/7a63b42))

### Removed

- **The dead base64 image IPC is gone from both shells.** Removed unused `read-file` and `read-buffer` handlers.
  ([`41e3d22`](https://github.com/klaus-2/koma-studio/commit/41e3d22))

## [1.0.1] - 2026-09-24

Performance release. 23 commits since v1.0.0 in the desktop interface and dev tooling, with source-only release archives on GitHub.

### Changed

- **The marching-ants loop stopped pushing a full 1600x1200 pixel buffer through `putImageData` every 120ms tick.** Precomputed frames swap via `drawImage` on the GPU.
  ([`80f8aa9`](https://github.com/klaus-2/koma-studio/commit/80f8aa9))

- **Route-swap worst long task dropped from 940ms to 589ms and layout render from 14ms to 7ms.** Auth cover cards decode lazily and asynchronously.
  ([`a313688`](https://github.com/klaus-2/koma-studio/commit/a313688))

- **React Doctor diagnostics on `packages/interface` dropped from 58 errors to 0.** Eliminated 20 `ObjectURL` leaks and 22 layout-animation warnings by switching animations to `transform` and `opacity`.
  ([`91da2ec`](https://github.com/klaus-2/koma-studio/commit/91da2ec),
  [`92ad19c`](https://github.com/klaus-2/koma-studio/commit/92ad19c))

- **The Dashboard was split into domain modules.** Added a Playwright smoke spec covering all 9 protected routes.
  ([`147c78b`](https://github.com/klaus-2/koma-studio/commit/147c78b),
  [`e8bc97d`](https://github.com/klaus-2/koma-studio/commit/e8bc97d))

### Fixed

- **Dragging the render box no longer re-renders the whole page per frame.** Box drags coalesce via `requestAnimationFrame` and commit on pointerup while redrawing canvas text smoothly per frame.
  ([`fc1a6cf`](https://github.com/klaus-2/koma-studio/commit/fc1a6cf),
  [`17cda44`](https://github.com/klaus-2/koma-studio/commit/17cda44))

- **Selecting a region for the first time no longer re-renders the entire page.** Memoized workspace history handles and callbacks, cutting selection page renders to zero.
  ([`92a661c`](https://github.com/klaus-2/koma-studio/commit/92a661c),
  [`27305ea`](https://github.com/klaus-2/koma-studio/commit/27305ea))

- **Stage mounts no longer block the main thread.** Mode switching uses `useDeferredValue`, shared `Suspense` lazy caches eliminate fallback flashes, and same-value store writes bail out early.
  ([`5c20e54`](https://github.com/klaus-2/koma-studio/commit/5c20e54),
  [`1b7f22a`](https://github.com/klaus-2/koma-studio/commit/1b7f22a),
  [`a313688`](https://github.com/klaus-2/koma-studio/commit/a313688),
  [`75d5457`](https://github.com/klaus-2/koma-studio/commit/75d5457),
  [`80f8aa9`](https://github.com/klaus-2/koma-studio/commit/80f8aa9))

- **CTRL+C in the dev terminal kills child listeners without leaving orphaned ports.** Added stale stack markers and pidfile ownership checks across both Electron and Tauri dev stacks.
  ([`51e46e2`](https://github.com/klaus-2/koma-studio/commit/51e46e2),
  [`665a692`](https://github.com/klaus-2/koma-studio/commit/665a692))

- **Invalid hook call on Dashboard render is gone and `react-scan` is opt-in.** Deduplicated React across Vite pre-bundles and gated `react-scan` behind `VITE_REACT_SCAN=1`.
  ([`faac80f`](https://github.com/klaus-2/koma-studio/commit/faac80f),
  [`80f8aa9`](https://github.com/klaus-2/koma-studio/commit/80f8aa9))

## [1.0.0] - 2026-09-09

Initial public release.
