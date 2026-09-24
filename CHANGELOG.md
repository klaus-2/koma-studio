# Changelog

Versions match the tags under `refs/tags/v*`. Entries describe what changed
between two tags, with the commit that carries each change.

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
