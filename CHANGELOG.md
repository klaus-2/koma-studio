# Changelog

Versions match the tags under `refs/tags/v*`. Entries describe what changed
between two tags, with the commit that carries each change.

## [v1.0.3] - 2026-10-02

13 commits since v1.0.2, and this time they are in the Rust side of the Tauri
shell rather than the Python side. Most of it is input validation and error
typing on code that talks to the OS keyring, the network and the filesystem.

### Security

- A Tauri workspace manifest declaring 10k assets of 512 MiB each passed every
  per-asset cap and buffered 5 TB, because the read path did not run the
  structural validation the write path runs. Reads now share
  `validate_manifest_entries`, and take `declared + 1` bytes instead of
  trusting the ZIP headers for the manifest and for every asset. (82c274b)
- Certificate pins were checked against the end-entity certificate only. They
  are now anchored against the full presented chain, so a rotated leaf inside
  a pinned chain still validates. The pinned client builder was unified with
  the public one for connect timeout, redirect bound and user agent. (af96795)
- `api_client.method()` accepted any HTTP method the frontend asked for,
  TRACE, CONNECT and custom verbs included. There is an explicit allowlist now.
  (af96795)
- Imgur delete hashes reached the URL path through form encoding. They are
  validated as alphanumeric and at most 128 characters before the keychain
  lookup and the URL build. (af96795)
- `install_bytes` for fonts checked the file extension and nothing else, so any
  payload named `.ttf` was accepted as a font. The magic-byte signature test is
  shared with `install_from_path` now, covering ttf, otf, woff and woff2 under a
  64 MiB cap. (af96795, 4cfd212)
- Base URLs are HTTPS-only with loopback exempt, responses are capped at 8 MiB,
  and deep links go through an allowlist with duplicate query keys rejected.
  (4cfd212)
- Renderer log lines are sanitized: control characters are replaced and length
  is capped at 8 KiB on a character boundary, so a stray `\n` can no longer
  forge a log line or inject terminal escapes. (ff91eea)
- Keychain account names are validated for empty, oversized and control
  characters before the blocking call. Secrets are zeroized after use.
  (82c274b, 4cfd212)
- Model download retry logic was backwards: `is_retryable_error` retried
  everything except a sha512 mismatch. Transport errors and 408, 429, 500,
  502, 503 and 504 retry now, while integrity and local I/O failures are
  terminal, with a test pinning that. (25c434c)

### Fixed

- Custom LLM API keys came back empty after saving on Tauri. The profile
  rewrite stores keys in the OS keychain and answers list and save with
  `apiKey: ""` plus a `hasApiKey` flag, but the frontend consumes `apiKey`
  inline, which is the contract Electron keeps by returning keys directly.
  Validation failed on save and `custom_llm` requests went out without the key.
  A `desktop-api:llm-profiles:resolve-key` command returns the keychain secret
  for one profile, and `customLlm.ts` hydrates keys on the desktop bridge path
  after list and save. (9fbcc47)
- Model downloads sat at 0%. Progress emitted a `patch_runtime_state` per
  stream chunk, which is thousands of IPC events per second on a multi-gigabyte
  download, and the speed snapshot was a float. Emission is throttled to about
  10 per second with a guaranteed final frame, and the hot write path uses a
  256 KiB `BufWriter` with an explicit flush before the sha512 re-open.
  (25c434c)
- Two concurrent sidecar starts could both pass the child check and then fight
  over the port. A single-flight `AtomicBool` with an RAII guard re-arms on
  every exit path, and `wait_for_mini_backend` reads the exited flag before the
  health check, so a dead child fails fast even when a foreign instance answers
  on the port. (82c274b)
- `sanitize_stored_profiles` bricked list and save permanently on a single
  corrupted entry. Invalid entries are dropped with a warning and duplicate ids
  keep the newest record. The profile store read-modify-write is serialized by
  one mutex acquired per public entry point. (82c274b)
- `atomic_replace` failed a completed save when the backup cleanup errored. It
  warns now, and the parent directory is fsynced. (82c274b)
- A failed font rename left the `.tmp` file behind, and one corrupt stray font
  aborted the whole manifest reconciliation, which took `list()` down with it.
  (af96795)
- `load_or_create_fallback_id().unwrap_or_default()` swallowed the real I/O
  error, and building the CPU and memory profile called `System::new_all()`,
  which walks the entire process table. (af96795)
- Listing a folder for images ran synchronously on the main thread, so a large
  directory froze the webview. It is async over `spawn_blocking` now, the
  extension scan is a string operation before any `stat()`, and non-UTF-8 paths
  are logged and skipped instead of producing an unservable lossy path.
  (ff91eea)
- The downloaded archive was only reclaimed when `binary_path` existed, so a
  failed extraction leaked the temp zip. (25c434c)
- `dev:electron` failed intermittently with `mini_backend_health_timeout` on a
  CUDA machine that was healthy. Measured on first boot of the day:
  `detection.model_loaded` at +145s, `warmup.done` at +151.17s, then health 200
  immediately. The dev budget was 120s, so it was about 30s short, and earlier
  boots passed because the OS file cache was warm. Raised to 360s, roughly 2.4
  times the worst cold run observed. (04d6c3e)
- The bug report and Discord command rewrite did not compile. `#[serde(other)]`
  sat on the second enum variant instead of the last one, which invalidated the
  whole `Deserialize` derive. (537f638)
- OCR fallback applied gamma in the wrong domain: the formula computed
  `(mean/255)^gamma` in 0-255 and then applied it in 0-1. There is one shared
  LUT-based `gamma_normalize` now, used by detection and ocr alike. Detection
  fallback also built all 5 to 7 variants eagerly, including a 2048px cubic
  upscale, before the first pass, and used a float64 `np.power` over the full
  page. Variants are lazy and off the event loop, gamma is a 256-entry LUT, the
  original pass exits early, and the `except TypeError` engine-signature probe
  is gone because the `BaseOCR` contract already declares
  `cancellation_event`. (0165fff)

### Structure

- `Result<_, String>` became `AppResult` across the models, runtime, api
  client, imgur, fonts, identity and cert pinning layers. `AppError` grew
  NotAllowed, Conflict, NotConfigured, Authentication, Security, Network,
  Serialization, Archive, Update, Remote, RateLimited and CommandError, with
  typed `From` impls for serde_json, zip, tauri, reqwest, keyring and JoinError.
  A `RuntimeError` with thiserror and a manual `{kind, message}` serialization
  covers the runtime profile commands. (b19047b, 4cfd212, 1e049c8, 25c434c)
- Command files are thin typed layers now. Models, API, fonts, identity,
  imgur, integrations and the model manager live under `services/`, workspace
  models and download state moved to `models/` and `state.rs`, and the queue,
  active and reserved sets sit on one `ModelDownloadStore` mutex that is never
  held across an await. (4cfd212, 81b5bff)
- Session logging held the log file open for the process lifetime. Before that
  it did `create_dir_all`, open and close on every line, on the main thread.
  (ff91eea)
- Both Tauri crates moved from Rust edition 2021 to edition 2024, with MSRV
  1.85. Tauri stays on 2.11.5 because 3.x is not stable yet. (85e2766)
- The kill-stale-instance probe and the dev venv probe left the async runtime
  for `spawn_blocking`, and the duplicated `split(':')` port parser collapsed
  into `parse_configured_port`. (82c274b)

### Contracts and checks

Wire contracts held: the `desktop:*` command names, the
`mini-backend-runtime` event channel, `emit_to(main)`, and the state and patch
shapes are unchanged, because the workspace and Imgur payloads are shared with
the Electron shell as buffers and base64. The error payload for three desktop
runtime commands moved to `{kind, message}`, matching the commands already
migrated. (b19047b, 25c434c)

`cargo test` went 111, then 113, then 117 passed across the batch, with the same
one pre-existing sidecar failure each time. Clippy sits at one pre-existing
warning.

## [v1.0.2] - 2026-10-01

21 commits since v1.0.1, almost all of them in the bundled Python mini-backend.
This is the release where that layer stopped being a set of routers with code
copy-pasted between them.

### Security

- `_download_remote_image` followed any URL a model returned, redirects
  included, with no host validation. A prompt-injected response could point it
  at 169.254.169.254 or at LAN endpoints. Every hop now resolves through
  getaddrinfo and only proceeds when all returned addresses are global IPs,
  with a 32 MiB cap while streaming and magic-byte sniffing on the result.
  (5cb9d72)
- The Gemini key moved from a `?key=` query string to the `x-goog-api-key`
  header. In the URL it leaked into exception text, into access logs, and into
  `Request.__repr__`. (1e90fdc)
- Uploads read in chunks and answer 413 at the limit instead of loading the
  body first. The ingest path gained zip-bomb guards: 64 MB per entry, 2000
  entries, 200 MB bounded read per upload. (1e90fdc)
- The PEP 562 `__getattr__` backdoor on the pipeline router is gone; its only
  consumer was an outdated script. (6099806)

### Fixed

- Splitter blur ran on the wrong axis. The kernel rotated together with the
  image, so for `axis=horizontal` it smoothed within each cut position, which
  `mean(axis=1)` already averages, instead of between positions. Horizontal
  strips had no smoothing at all. A regression test pins horizontal against
  transposed vertical. (6099806)
- The baka segmenter split polarity with `gray < t` and `gray > t` while Otsu
  partitions as `<= t` and `> t`. Pixels equal to the threshold fell into
  neither class, and on a clean binary crop Otsu returns `t = 0`, so the dark
  class came back empty: the simplest possible input found nothing. (9ec51e1)
- `CacheManager._hash_image_bytes` sampled every 97th byte on images above 4
  KiB, so two different pages could collide and serve each other's OCR. It is
  now a full blake2b digest, and the TTL clock moved off `time.time()` to
  `time.monotonic()` because wall-clock expiry breaks on NTP adjustments.
  (9ec51e1)
- Paddle CTC dictionaries with CRLF line endings were silently emptied, because
  `strip("\n")` left the `\r` attached to every entry. (15218a7)
- Comic NMS indexed the original list with indices taken from the
  size-filtered boxes, producing wrong detections whenever any box was
  dropped. The score threshold also re-filtered by confidence and defeated the
  recall pass. (e2cba5d)
- Local translators were sync methods overriding an async abstract, so
  `_translate` returned a bare list under `await` and raised TypeError. They
  now run blocking inference through `asyncio.to_thread` under a per-instance
  lock, because ctranslate2 and llama.cpp handles are not thread-safe.
  (fb3032c)
- `OCRPipeline.last_model_key` was mutable singleton state: two concurrent
  exports could report each other's model. `run()` returns the model key
  alongside the detections now. (23ad7aa)
- The export temp directory leaked on any failure between `run()` and the
  `FileResponse`, including the 120s timeout. `_run_export` owns it and removes
  it on `BaseException`; the background task only cleans up on success.
  (23ad7aa)
- Non-numeric fields in an export manifest returned a 500 from an unhandled
  `ValueError`. They return 422 now. (23ad7aa)
- `queue_processor` caught `asyncio.CancelledError` per item, recorded "task
  cancelled", and kept going, so external cancellation never propagated.
  Rewritten on `asyncio.TaskGroup` and `asyncio.timeout`; the cancellation
  event still stops the loop gracefully. (9ec51e1)
- The packaged runtime ships pydantic 2.9, which cannot schema-generate PEP 695
  `TypeAliasType` aliases. The mini-backend died at import with a FastAPIError
  on `/enhance` and a PydanticSchemaGenerationError on
  `/typography/shapes/refine`, while the dev venv on pydantic 2.13 resolved
  them fine, which is why the suite never caught it. `OutputFormat` and `Bbox`
  are plain assignment aliases now. (3e4f879, c70c46e)
- The dashboard did not build. The port of the topbar memoization left
  `KomaTopbar` without its download and export props and spliced a fragment of
  the old inline handler into the props list, which Babel rejected. (7a63b42)

### Performance

- `psd_exporter._alpha_paste_with_bounds` allocated a page-sized RGBA canvas
  for every text layer. A thousand layers on a page was gigabytes. It composes
  the layer's own window now, so cost is per layer. (23ad7aa)
- Batch uploads held `batch_size x 32MiB` of image bytes in RAM while
  Starlette had already spooled each part to disk. Batch tasks carry a path
  now and read off disk inside each concurrency slot, so peak memory is
  concurrency x 32MiB, and the spool directory is removed in a finally block.
  (6099806)
- `_build_segment_alpha` looped over W*H pixels in Python. It is a vectorized
  numpy column repeat now, with an oracle test pinning exact equivalence to
  the old output. (5cb9d72)
- `_detect_content_boxes` ran connectedComponentsWithStats twice per polarity
  and rebuilt each component mask with a `(labels == idx)` and a bitwise or per
  component, which is components x pixels. One labelling pass per polarity with
  a LUT over the labels now. (9ec51e1)
- `BaseSegmenter.segment` was async in name only and ran OpenCV on the event
  loop. Sync `_segment` implementations go through `asyncio.to_thread`.
  (9ec51e1)
- Dragging the sidebar resize handle called `setLeftSidebarWidth`, a page-level
  `useState`, on every window mousemove, so each pixel re-rendered
  DashboardPage and the whole chrome, repositioned the dock and relaid out the
  full-resolution stage canvas: 228ms of non-React work. The drag is
  imperative now and commits on mouseup. (bf11b38)

### Desktop

- Tauri serves media through `koma-image://` and `koma-font://` custom URI
  schemes instead of base64 over IPC. The handler canonicalizes paths, checks
  them against a component-wise MediaScope allowlist that only ever widens from
  Rust-observed gestures like list-folder and drag-drop and never from JS,
  filters by extension, pages Range requests with a 206 and an 8 MiB cap,
  answers ETag/304 and HEAD, and pins CORS to the origin. (#30, 21fd916)
- The dead base64 image IPC is gone from both shells. `read-file` and
  `read-buffer` had zero frontend callers. (41e3d22)

### Structure

- `routers/pipeline.py`, the 1729-line god file, is a thin HTTP boundary of
  about 250 lines plus a `pipelines/batch/` package. `providers.py`, 2029
  lines, is a package with the import path unchanged. The inpainting router
  dropped from 680 to about 370 lines after the GPU-OOM to CPU fallback to PNG
  encode block, copied four times, moved into
  `services/inpainting_execution.py`. (951897e, 4de6136, d924021)
- Splitter and typography algorithms moved out of routers into services, so
  they are testable without HTTP, and routers run analysis through
  `to_thread`. (6099806)
- The cache manager is typed over wire TypedDicts for OCR and translation
  records, storing the foreground gradient so cache hits skip pixel work. One
  decode path raises typed `ImageTooLargeError` or `InvalidImageError`. One
  upload reader. Typed error taxonomies for HuggingFace download, translation
  and the Photoshop writer, where 25 broad `except Exception` blocks were
  narrowed and cosmetic COM property writes go through a context manager that
  logs and continues. (23ad7aa, 1e90fdc, 95c402e, fb3032c, ef77bb0)
- `app.py` is settings plus a `create_app()` factory, and logging is single-line
  JSON with structured extras. Warmup retries cpu once after a GPU failure.
  (d5b91e6)
- `GET /diagnostics/memory` reports RSS and VMS, distinguishes `gc_pending`
  from `gc_tracked_objects`, includes tracemalloc, torch VRAM and per-cache
  stats. `scripts/memory_profile.py` stopped being an in-process profiler with a
  hardcoded known-issues list and became a sampling HTTP client against a
  running server, exiting 1 on CRITICAL growth. (6099806)
- Errors a client can fix themselves, like ModelNotInstalled,
  InvalidModelSelection, ModelConfiguration and MissingDependency, map to 400
  and get logged. Unexpected errors return a fixed message with the traceback
  only in the logs. (6099806, 1e90fdc)
- pytest moved from 5 failed / 240 passed to 4 failed / 282 passed across the
  batch. The 4 remaining are pre-existing inpaint and mask failures that depend
  on the environment. pyright reports 0 errors on every file touched. One
  failure everyone had been calling flaky turned out to be real contract drift:
  its fake translation engine was missing kwargs the router had always sent.
  (1e90fdc, 6099806, 23ad7aa)

## [v1.0.1] - 2026-09-24

Performance release. 22 commits since v1.0.0, all in the desktop interface and
the dev tooling around it. No new features.

### Drag and first selection

- Dragging the render box committed a new bbox to the region store on every
  pointermove, 60 to 500 times a second, and each commit deep-cloned every
  region for the image. A 1px drag re-rendered the whole Dashboard page and
  redrew the full canvas per frame. Moves now stash the pending value and
  commit once through a single in-flight rAF, with the store write landing on
  pointerup. Input delay went from over 650ms to 0 long tasks. (fc1a6cf)
- The box outline followed the pointer but the canvas text only repainted at
  pointerup. The dragged region's bbox now swaps to the rAF-coalesced visual
  box during the move, so the existing redraw effect runs per frame without
  adding store commits. (17cda44)
- Selecting a region for the first time re-rendered the entire page. The
  workspace-history handle and the typographerWorkspace argument were both
  fresh object literals on every render, which defeated every memo downstream
  and churned all 11 useTypographerControls callbacks. Both are memoized now,
  and selection costs 0 page renders. (92a661c, 27305ea)

### Mode switches and startup

- Stage mounts blocked the main thread for the whole mount: mode:aio around
  205ms, typesetter around 210ms, cleaner around 121ms of long task.
  startTransition on the zustand setMode made no difference, because
  useSyncExternalStore re-renders synchronously. The fix sits at the consumer
  instead: DashboardStageSection reads its mode through useDeferredValue, so
  topbar, tabs and tool panels stay on the immediate value while the stage
  subtree re-mounts at transition priority. (5c20e54)
- The five tool panels became lazy with Suspense and render on the deferred
  lane. A memoLoad cache holds one import() promise so React.lazy and the idle
  preload share it; the old preload fired fresh imports, so first mounts still
  suspended. Fallback flashes went from 11 to 0 across 10 mode switches.
  (1b7f22a)

### Re-renders nobody asked for

- The 30-second processing-stats interval re-rendered the app chrome even when
  no minute boundary was crossed. A minute-bucket guard takes chrome renders
  per tick from 3-4 down to 1. (a313688)
- Roughly 34 tooltip components re-rendered on every layout pass, measured as
  2.5k Tooltip renders in one probe session with no hover at all. (75d5457)
- Every stage pointerdown called setActiveId with the id that was already
  active, notifying all store subscribers for nothing. Same-value bail-outs
  went in there and in setActiveStageTab. (92a661c, 80f8aa9)
- The dock re-renders on every reposition. The TextEffect, RenderEffect,
  FillStyle and CircularText popovers are memoized, and the font option list
  stopped being re-reconciled on each position and anchor change. That list
  can run to hundreds of options and accounted for 82ms of the dock's
  self-time. (27305ea, 92a661c)
- images, downloadItems and translatorDetectionsByImage were reactive
  subscriptions consumed only inside download callbacks at click time. They
  are now event-time getState() reads, so handleDownload keeps its identity
  across image changes. (27305ea)

### Canvas and route swaps

- The marching-ants loop pushed a full 1600x1200 pixel buffer through
  putImageData every 120ms tick, which is main-thread raster work invisible to
  React profiling. Frames are precomputed into offscreen canvases and swapped
  with drawImage, a GPU copy. (80f8aa9)
- Route-swap worst long task went from 940ms to 589ms, and layout render from
  14ms to 7ms. The auth cover wall decodes 10 images, about 13.9MP, into
  88-125px cards; those are lazy with async decode now, taking boot worst task
  from 141ms to 111ms. (a313688)

### Fixed

- CTRL+C in the electron terminal kills the dev supervisor without running its
  SIGINT handlers, leaving auth-server, mini-backend and vite bound to
  3001/8001/5173. The next launch saw a healthy port and reused a process
  nobody's terminal controlled anymore. A stale stack marker now kills the
  listener tree and boots fresh. Live markers and listeners that do not look
  like koma dev tooling are left alone. (51e46e2)
- The tauri mini-backend had the same failure mode after a hard kill, and now
  uses a pidfile ownership marker the same way. (665a692)
- "Invalid hook call ... Cannot read properties of null (reading 'useMemo')"
  on Dashboard render came from the dep optimizer holding two React
  pre-bundles in flight with different ?v= hashes after bun.lock was
  regenerated over stale node_modules/.vite caches. Hooks resolved against one
  copy while react-dom rendered with another. Added resolve.dedupe and
  optimizeDeps.include in both vite shells. (faac80f)
- react-scan is opt-in for normal dev sessions behind VITE_REACT_SCAN=1 and
  stays always-on for the e2e probe server. The overlay and per-render
  profiling cost the dev runtime measurably and were polluting interaction
  measurements. (80f8aa9)

### Quality

- React Doctor on packages/interface went from 58 errors to 0, 704 diagnostics
  to 556, Performance 127 to 38, deslop 12 to 0. ObjectURL leaks went from 20
  to 0 through traced ownership chains, and 22 layout-animation errors to 0 by
  moving FLIP drags and height/width animations onto transform/opacity. A
  follow-up cleared the 4 errors the subscription conversions introduced: two
  latest-value refs mutated during render and two multi-store subscribe
  effects whose cleanup the rule could not trace. (91da2ec, 92ad19c)
- The Dashboard was split into domain modules, and a Playwright smoke spec
  walks the 9 protected routes, failing on any page error, React render error,
  Vite overlay, or non-sidecar 5xx. (147c78b, e8bc97d)
- A bitmap raster cache was implemented, verified firing at 11 blits per
  session, pixel-exact, 51/51 tests, and then reverted: A/B medians showed the
  region raster costs 2-15ms while the mode-switch cost is the React/DOM mount
  itself. (b49b777)

### What this release ships

Source only. GitHub attaches the zip and tar.gz archives. There are no
installers and no latest.yml in this release, so the in-app updater will report
"no update available" and leave people on v1.0.0 until a build goes out through
electron-builder.

## [v1.0.0] - 2026-09-09

Initial public release.
