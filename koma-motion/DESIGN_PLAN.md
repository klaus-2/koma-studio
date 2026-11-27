# KŌMA Studio — Motion & Mascot Design Plan (`koma-motion`)

## 1. Engine Decision: **HyperFrames**

After auditing `koma-studio` (React 19, Vite 8, Tailwind CSS v4, Framer Motion `LazyMotion` strict mode, Electron v1 + Tauri v2 monorepo sharing `packages/interface` and `packages/ui`), **HyperFrames** is the optimal motion engine for `koma-motion/`:

- **Zero monorepo pollution:** `koma-motion/` stays an isolated HTML/CSS/SVG/GSAP motion studio outside `apps/*` and `packages/*`, leaving `package.json`, `bun.lock`, and production dependency graphs untouched.
- **Deterministic 60fps SVG/CSS/GSAP capture:** HyperFrames drives a paused GSAP timeline frame-by-frame in headless Chromium and encodes with FFmpeg — ideal for multi-layered SVG glow filters (`feGaussianBlur`, double-gradient rim lights), smooth Bezier curves, screentone patterns, and crisp manga typography.
- **Native alpha & lightweight web delivery:** Exports transparent VP9 WebM (`yuva420p`) for crisp glow edges over any dark/light surface, plus compact WebP posters/stills for instant first paint and `prefers-reduced-motion` fallbacks.
- **Single source of visual truth:** The modular SVG geometry and filters authored for Koma Neeko in `koma-motion/` mirror the live interactive `<KomaNekoRig />` React component in `packages/interface`.

---

## 2. Hybrid Smart Architecture

| Surface / Moment | Strategy | Format & Rationale |
|---|---|---|
| **Onboarding Tool Previews (11 Dock Tools)** & **Dashboard Dock Tooltips** | **Pre-rendered HyperFrames loops** + SVG/WebP reduced-motion poster | 440×232 (2× `220×116`), 30/60fps seamless VP9 WebM (~15–45 KB each). Shows authentic manga speech bubbles, screentones, kanji/katakana, and real tool mechanics at near-zero runtime cost. |
| **Onboarding AIO Pipeline Explorer (6 Stages)** | **Pre-rendered HyperFrames loops** | 480×270 seamless VP9 WebM showing real Detect → OCR → Translate → Segment → Clean (HD Crop) → Render behavior on a manga page. |
| **Koma Neeko Hero / Cinema Clips** (Onboarding Welcome/Finish, Empty Stage, Loading) | **Pre-rendered HyperFrames Alpha WebM** + live interactive fallback | 320×320 transparent VP9 WebM (`yuva420p`) with full neon-noir rim bloom, orbital runes, and floating particle FX. |
| **Live Interactive Companion & Micro-reactions** (Studio Companion, Onboarding Host, Hover/Click/Pet, Idle Sleep, Errors) | **Live React SVG Rig (`<KomaNekoRig />`)** | Pure vector SVG sharing exact Visual Bible proportions, double golden→magenta rim-light gradients & glow filters, live pointer-tracking pupils, natural blink cadence, independent ear twitches, breathing squash-and-stretch, and zero network/video decode overhead. |

---

## 3. Koma Neeko Visual Bible & Pose Repertoire

Fidelity anchored to `packages/interface/src/assets/koma-cat/frame-01.webp`..`frame-16.webp`:
- **Base fur:** Velvet near-black `#050308`–`#0A0710`, sculpted purely through silhouette and luminous contrast.
- **Signature Double Rim Light:** Warm amber-gold (`#FFE082` → `#FFD166` → `#FF8C00`) along top contours (ear crests, crown, back arch, top tail hook) transitioning smoothly into electric neon magenta-crimson (`#FF1E6E` → `#E11D62`) along cheeks, lower flanks, paws, and tail underside, rendered with multi-layer SVG Gaussian bloom.
- **Head & Ears:** Wide chibi head with 2 sharp cheek fur tufts per side; large rounded-triangle ears tilted slightly outward with glowing hot-pink interiors (`#FF1F6A` → `#FF5C93`) and 2–3 dark base fur wisps.
- **Eyes:** Large glowing electric-cyan irises (`#38F9FF` bottom crescent → `#0099FF` mid → `#003D99` upper depth), deep navy pupils (`#050B1F`), dual crisp white specular catchlights; closed/wink states use glowing `#4CE8FF`–`#93C5FD` arcs.
- **Nose, Mouth, Paws, Chest Heart, Tail:** Inverted pink triangle nose (`#FF3B7F`), joyful open pink mouth or `"o"` surprise mouth, neon-pink toe beans (`#FF2E7A`: 1 center pad + 4 oval toes), glowing pure-white chest heart (`#FFFFFF` + rosy outer glow), thick J-hook tail.

### 13 Poses (10 Reference + 3 New Studio Poses)
1. `idle` — Attentive seated loop: soft breath, rhythmic tail sway, natural blink, chest heart pulse, occasional ear twitch.
2. `wink` — Charming single-eye cyan arc wink + subtle head tilt.
3. `happy` — Joyful `^ ^` eyes + open pink laugh + floating pink hearts.
4. `curious` — ~18° head tilt + widened eyes + perked ear flick.
5. `wave` — Raised front paw waving with neon-pink toe beans + warm sparkle accent.
6. `peek` — Loafing chin-on-paws peeking over panel edges (ideal for Empty Stage & Onboarding rail).
7. `sleep` — Curled cozy ball wrapped in tail + slow breathing + floating neon `zZz` particles.
8. `stretch` — Classic cat stretch: extended front paws, arched back, high hooked tail.
9. `surprised` — Wide eyes, `"o"` mouth + 3 pulsing neon-pink impact lines (ideal for ErrorBoundary).
10. `back` — Mysterious back-facing silhouette with intense golden→magenta rim light (Easter egg / focus mode).
11. `casting` *(NEW — Kōma AI Pipeline)* — Levitating slightly with glowing magenta-cyan orbital rune ring & 4-point star sparkles (inspired by `frame-15.webp`), triggered while AIO/Cleaner/Translator/Enhance runs.
12. `celebrate` *(NEW — Task Complete / Onboarding Finish)* — Joyful jump with both paws showing pink toe beans, happy eyes, and cyan/gold/magenta confetti sparkles (inspired by `frame-14.webp`).
13. `working` *(NEW — Model Download / Focus)* — Focused leaning pose with cyan visor glint & orbiting data spark while models download or workspace saves.

---

## 4. Onboarding Redesign Architecture (NOIR vs CLASSIC)

Replaces the legacy single-stylesheet `OnboardingModal.css` with a true family-split architecture (`createFamilyComponent(OnboardingModalClassic, OnboardingModalNoir)`) backed by a shared headless controller (`useOnboardingModalController.ts`):

- **NOIR (`OnboardingModalNoir.tsx`):** Authentic Kōma Noir editorial aesthetic (`glass panel-cut halftone`, top crimson accent beam, vertical Japanese watermark `初回ガイド — KOMA`, left vertical editorial rail with `01`–`07` steps and perched Koma Neeko host, `// KICKER` + `font-display` uppercase titles with `font-accent` italic crimson accents, `panel-cut-sm` cards, `hard-hover` actions, custom Noir dropdowns & switches, dark + light paper support).
- **CLASSIC (`OnboardingModalClassic.tsx`):** Authentic Kōma Manhwa Glass UI (`rgba(10, 12, 24, 0.96)` frosted glass, purple-cyan iridescent top hairline, rounded left progress rail with luminous bar & Koma Neeko host, soft glass cards, gradient shimmer primary actions, custom selects & switches, dark + light support).
- **7 Interactive End-User Steps:**
  1. **Style & Language (`welcome`)**: Live visual family switcher (Noir vs Classic mini-cards), Dark/Light toggle, Language picker, UI Scale & compact density preview — changes apply live immediately with Koma waving.
  2. **Hardware & Tiers (`models-guide`)**: Detected GPU/VRAM diagnostic card + interactive 3-tier explorer (Fast Local / High Quality / Cloud API) with visual Speed / Quality / VRAM meters.
  3. **Install Models (`install-models`)**: Visual Source → Target pair bar, disk-space meter, one-click recommended pack installer with live per-model progress & Koma `casting` while downloading.
  4. **AIO Pipeline & HD Strategy (`aio-stages`)**: Auto vs Manual interactive mode cards + clickable 6-stage pipeline rail paired with **HyperFrames manga-panel animations** + visual HD Strategy comparator (`Original` vs `Resize` vs `Crop [Recommended]`).
  5. **Tools & Healing (`tools-healing`)**: Interactive featured demo stage + clickable grid of all **11 HyperFrames tool animations** (`healing`, `magic-wand`, `segment-brush`, `segment-eraser`, `paint`, `paint-eraser`, `clear-paint`, `reset-edits`, `area-select`, `config`, `clear-page`), plus 4-step healing flow and Text Refinement visual cards.
  6. **Preferences & Studio Map (`settings`)**: Live-synced workspace toggles (Tooltips, Custom Cursor, Autosave) + 6 quick-jump studio setting cards.
  7. **Ready to Launch (`finish`)**: Koma celebrating + Studio Configuration Summary + GitHub Star spotlight + clear `Start Interactive Tour` / `Enter Studio Now` CTAs.

---

## 5. App-Wide Integration Map

| Location | Files | Koma Integration & Guardrails |
|---|---|---|
| **Onboarding Wizard (Noir & Classic)** | `components/onboarding/*` | Live host Koma reacting per step + 17 HyperFrames tool/stage video demos. |
| **Manual Tools Dock Tooltips (Noir & Classic)** | `features/dashboard/components/DockToolAnimatedPreview.tsx` | All 11 tool previews upgraded to HyperFrames 60fps real-behavior manga videos (with crisp reduced-motion fallback & preserved SVG contract). |
| **Floating Studio Companion** | `components/koma-mascot/KomaStudioCompanion.tsx` mounted in `DashboardMainLayout` | Reactive companion (`z-index: 45`, `pointer-events-none` container, collapsible to a compact paw toggle). Responds to AIO processing (`casting`), downloads (`working`), errors (`surprised`), success (`celebrate`), empty canvas (`peek`), idle 90s (`sleep`), hover (`curious`/`wink`), click/pet (`happy` + floating hearts + 5-pet Easter egg). |
| **Dashboard Empty Stage (Noir & Classic)** | `DashboardEmptyStageNoir.tsx`, `DashboardEmptyStageClassic.tsx` | Koma peeking (`peek` HyperFrames loop / interactive rig) above the drop/start prompt & rotating tips. |
| **Error Boundary (Noir & Classic)** | `ErrorBoundaryNoir.tsx`, `ErrorBoundaryClassic.tsx` | Koma `surprised` pose humanizing recovery states. |
| **Lazy Fallback Loader** | `DashboardLazyFallback.tsx` | Koma `stretch`/`casting` loader with accessible status text. |

All motion honors `prefers-reduced-motion`, `economicHidden`, and `LazyMotion strict` (`m.*` only).
