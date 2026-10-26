# Focus Mode (Modo Foco / Zen)

> Status: implemented (2026-10). Audience: maintainers + support.
> User-facing summary: one button turns the dashboard into a single,
> distraction-free line — **add pages → run AIO → fix → export**.

## 1. Problem

The Studio dashboard exposes the full production surface at all times: 15 tool
modes, per-stage model pickers, presets, GPU panels, LLM profiles, manual
paint/wand/healing docks, tour coachmarks, decorative motion, custom cursor.
That is the right surface for full control, but a recurring class of users
only ever wants one job done:

1. drop the chapter pages in,
2. run the AIO automatic pipeline,
3. fix whatever the models got wrong,
4. export the chapter.

For those users every extra panel is friction and a chance to misclick into a
dead end (wrong mode, wrong stage toggle, half-configured preset). Focus Mode
is the answer: the same engine, a deliberately smaller room.

## 2. Principles (the contract)

1. **One job, one line.** Focus Mode is a linear flow with four steps —
   *Pages, Run AIO, Fix, Export*. The current step is *derived from real
   pipeline state*, never a wizard that can disagree with the workspace.
2. **One primary action at a time.** There is always exactly one obvious next
   button. Secondary actions are quiet; destructive recovery actions
   (re-running over your fixes) require an inline confirm.
3. **Same engine, zero fork.** Focus reuses the existing Zustand stores, the
   existing `processAIO` execution (preparation, readiness checks, model
   managers, consolidation), the existing region snapshot sync and the
   existing download-bundle export. It introduces **no** parallel pipeline,
   model selection or export logic that could drift from Studio behaviour.
4. **Work is never at risk.** Entering/leaving Focus never clears images,
   regions, snapshots or downloads, and never cancels a running pipeline.
   Workspace autosave, undo/redo history and Discord presence keep working
   because the dashboard page (and all its hooks) stays mounted — only the
   layout is swapped.
5. **Calm chrome.** No decorative backgrounds, no custom cursor, no tour or
   coachmarks, no animated transitions inside the Focus subtree (motion is
   collapsed to near-zero, like `prefers-reduced-motion`). The render canvas
   keeps the active theme family skin; everything around it is a single
   token-driven implementation shared by both families (classic/noir),
   dark and light.
6. **No dead ends.** If a model is missing, Focus says which stage is blocked
   and opens the regular model manager — the same refusal path the pipeline
   itself uses. Settings stay one click away, and the exit to Studio is
   always visible. Focus is a room with a door, never a trap.
7. **Persisted preference.** The chosen layout is remembered across restarts
   (`koma_focus_mode`, localStorage). A user who lives in Focus boots into
   Focus. Settings → Appearance exposes the same choice for discoverability.

## 3. The flow in detail

### Step 1 — Pages
- Empty state is one large drop target. Files can be dropped anywhere on the
  window, pasted with `Ctrl+V`, or picked through the file dialog — all
  funnel into the existing `useDashboardUploads` onDrop (including container
  extraction for zip/cbz-style chapter files).
- Pages live in a single rail: thumbnail, index, name, status
  (pending / processed / reviewed) and remove. The rail is the *only*
  navigation besides prev/next under the canvas.

### Step 2 — Run AIO
- The only visible configuration is the language pair (source → target):
  the one choice that invalidates a whole run if wrong. Models, presets and
  stage toggles are inherited from Studio but not shown.
- Preflight, shown *before* the click when actionable:
  - **Incomplete pipeline** — if stage toggles are off in Studio, Focus says
    which and offers one-click "enable full pipeline" (an explicit,
    user-approved write to the shared store; Focus never silently rewrites
    Studio configuration).
  - **Model readiness** — Focus mirrors the pipeline preparation's readiness
    resolution (`resolveStageModelReadiness`, same stage order) and surfaces
    the first blocker with an "install models" action. `processAIO` remains
    the authority at click time; the banner is guidance, not a second gate.
- While running: a hairline progress bar, the current stage label, and a
  single **Stop** action. Page add/remove and language changes are locked —
  mutating the collection mid-run would abort the batch (the executor
  enforces this invariant; Focus respects it in the UI instead of letting
  users trip it).

### Step 3 — Fix
Two coordinated correction surfaces over the same region data:
- **Canvas** — the existing `RenderTextPreview` for the active page in its
  quietest configuration: select, drag, resize and inline-edit bubbles;
  manual paint/wand/segment tools and snapshot time-travel are off. What you
  see is what exports (the AIO export re-renders the render stage from the
  current regions).
- **Fix list** — every bubble of the active page as *original text →
  editable translation*, bidirectionally synced with canvas selection.
  `Ctrl+Enter` advances to the next bubble. Bubbles without text are flagged
  and counted; false positives can be deleted; SFX candidates are badged.
- **Review queue** — each page can be marked *reviewed*. Marking a page
  auto-advances to the next unreviewed processed page, so a chapter is
  corrected in one continuous pass. Progress ("reviewed 3 of 12") is always
  visible. Review state is a Focus-local checklist keyed by image id (which
  the workspace format preserves), pruned when pages are removed. It never
  blocks export — it informs it.

Text edits write both `renderText` (what is drawn/exported as image) and
`translatedText` (what is exported as text dumps) so every artefact of the
chapter carries the corrected wording.

### Step 4 — Export
- One button exports the chapter through the existing AIO download bundle
  (rendered pages + optional raw/translated text dumps + inpainted images,
  exactly as configured in Studio). The single destination choice kept in
  Focus is the bundle container: ZIP / CBZ / PDF.
- Non-blocking QC summary sits next to the button: unreviewed pages and
  text-less bubbles are counted, never enforced. Shipping is the user's call.

## 4. Shell invariants and transitions

Focus is a **display mode**, orthogonal to tool mode and theme family:

- `displayMode: 'studio' | 'focus'` lives in `useFocusModeStore`
  (`pages/dashboard/stores/focus-mode-store.ts`), persisted. It is
  deliberately *not* a `ToolMode`: tool modes participate in workspace
  persistence, region-map gating and export scopes; display mode must not.
- Entering Focus stashes the current Studio shell (`mode`, `subMode`,
  `viewMode`) and enforces the Focus shell: `mode='aio'`,
  `subMode='manual'` (through the page's `handleAioSubModeChange`, so manual
  snapshot progress is normalised exactly as in Studio) and a single-page
  stage. Leaving restores the stash; when booting straight into Focus (no
  stash) it falls back to Studio defaults.
- Guards: entering is refused while a non-AIO tool is mid-processing (with a
  status explanation); entering during an AIO run is allowed (watch it
  calmly). Leaving mid-run keeps the run alive and only restores what is safe
  to restore while processing.
- Tour and mode coachmarks are suppressed while Focus is active (their
  anchors do not exist in the Focus layout).
- The global shortcut system is display-mode aware: mode-switch,
  tool-palette and panel/modal actions are disabled in Focus; zoom,
  workspace undo/redo/save, region navigation/edit/delete keep working; a
  configurable `toggleFocusMode` action (default `Alt+Z`) works from both
  layouts, and `Esc` exits Focus when not editing text or inside the model
  manager.

## 5. Accessibility & keyboard

- Stepper exposes `aria-current="step"`; status line is `aria-live="polite"`;
  page rail statuses have text equivalents, not colour-only.
- Focus order follows the work: pages → canvas → fix list → actions.
- Keyboard: `Alt+Z` toggle (configurable), `Esc` exit, `Ctrl+Enter` next
  bubble, `Ctrl+V` paste pages, `Ctrl+Z/Ctrl+Shift+Z` workspace history,
  `Ctrl+=`/`Ctrl+-` zoom, region navigation shortcuts inherited from Studio.
- Motion inside the Focus subtree is collapsed regardless of OS setting,
  which also makes Focus the recommended layout for motion-sensitive users.

## 6. Explicit non-goals (v1)

- No model/preset/GPU/LLM configuration UI (model *installation* via the
  existing manager is supported; model *selection* stays in Studio).
- No manual stage-by-stage pipeline, snapshot rewind/forward, or manual
  paint/wand/healing — full-pipeline AIO only.
- No PSD export, no Blogger/Imgur publishing, no other tool modes (Stitch,
  Split, Watermark, Enhance, Optimizer) — exit to Studio for those.
- No new persistence format: review marks are local checklist state, not part
  of the exported workspace document.

## 7. Code map

| Concern | Location |
|---|---|
| Persisted display mode + review checklist + shell stash | `pages/dashboard/stores/focus-mode-store.ts` |
| Enter/exit/toggle with processing guards | `pages/dashboard/hooks/use-focus-mode.ts` |
| Shell enforcement/restore around transitions | `pages/Dashboard.tsx` (effect on `displayMode`) |
| Step/review/export derivations (pure, unit-tested) | `pages/dashboard/lib/focus-flow.ts` |
| Preflight readiness mirroring pipeline preparation | `pages/dashboard/lib/focus-readiness.ts` |
| Layout (top bar, page rail, stage, fix list, action bar) | `pages/dashboard/sections/focus/` |
| Entry buttons | `pages/KomaTopbarNoir.tsx`, `pages/KomaTopbarClassic.tsx` |
| Shortcut action + display-mode gating | `shortcuts/keyboardShortcuts.ts`, `pages/dashboard/hooks/use-dashboard-keyboard.ts` |
| Settings preference | `pages/Settings.tsx`, `pages/settings/SettingsAppTab.tsx`, `pages/settings/noir/SettingsAppTabNoir.tsx` |
| Cursor suppression on the dashboard | `App.tsx` |

## 8. Future work (deliberately deferred)

- Optional per-run report ("3 bubbles empty, 1 page failed") as a review
  filter ("show only problems").
- Persisting review marks inside the workspace document (schema addition,
  needs migration story).
- A first-run chooser ("Start in Studio or Focus?") once onboarding is
  revisited; today the topbar button + Settings cover discovery.
