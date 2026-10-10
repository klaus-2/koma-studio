/**
 * Landing V2 content ("Editorial Manga Noir").
 * Links come from `@/lib/site` (single source of truth); claims are kept to
 * what the app actually ships — no invented metrics, no fabricated quotes.
 */
import {
  SITE_DISCORD_URL,
  SITE_GITHUB_URL,
  SITE_ISSUES_URL,
  SITE_LICENSE_URL,
  SITE_RELEASES_URL,
  SITE_CLONE_URL,
  SITE_CONTRIBUTORS_URL,
  SITE_GOOD_FIRST_ISSUES_URL,
  SITE_PULLS_URL,
  SITE_DISCUSSIONS_URL,
} from "@/lib/site";

export const SITE_CONFIG = {
  repo: "klaus-2/koma-studio",
  github: SITE_GITHUB_URL,
  license: "MIT",
  get stargazers() {
    return `${this.github}/stargazers`;
  },
  get issues() {
    return SITE_ISSUES_URL;
  },
  get goodFirstIssues() {
    return SITE_GOOD_FIRST_ISSUES_URL;
  },
  get pulls() {
    return SITE_PULLS_URL;
  },
  get discussions() {
    return SITE_DISCUSSIONS_URL;
  },
  get discord() {
    return SITE_DISCORD_URL;
  },
  get releases() {
    return SITE_RELEASES_URL;
  },
  get contributing() {
    return `${this.github}/blob/main/CONTRIBUTING.md`;
  },
  get codeOfConduct() {
    return `${this.github}/blob/main/CODE_OF_CONDUCT.md`;
  },
  get contributors() {
    return SITE_CONTRIBUTORS_URL;
  },
  get licenseFile() {
    return SITE_LICENSE_URL;
  },
  get cloneUrl() {
    return SITE_CLONE_URL;
  },
} as const;

export const FEATURES = [
  {
    n: "01",
    title: "AI Translation",
    color: "crimson",
    desc: "Context-aware LLM translation that reads the whole page — honorifics, SFX and panel flow included — not sentence-by-sentence guessing.",
    bullets: ["OpenAI · Anthropic · Gemini", "Any OpenAI-compatible API", "Local model support", "Batch chapter mode"],
  },
  {
    n: "02",
    title: "Smart Cleaning",
    color: "azure",
    desc: "One pass removes text, dust and compression artifacts while preserving the art underneath.",
    bullets: ["Bubble auto-detection", "Inpainting engine", "Level & denoise presets", "GPU-accelerated"],
  },
  {
    n: "03",
    title: "Auto Typesetting",
    color: "mint",
    desc: "Text placed, sized and styled inside bubbles automatically — with a full manual editor when you want control.",
    bullets: ["Bubble-fit placement", "Typography presets", "Inline region editor", "Manual override anytime"],
  },
  {
    n: "04",
    title: "AI Redraw",
    color: "gold",
    desc: "Reconstruct art behind removed text on busy backgrounds, and give tired pages a second pass.",
    bullets: ["Structure-aware inpaint", "Full-page redraw", "Enhance & upscale", "Spread stitching"],
  },
  {
    n: "05",
    title: "Chapter Tools",
    color: "azure",
    desc: "The utilities a release needs before it ships — built into the same studio.",
    bullets: ["Webtoon stitch & split", "Watermarking", "Chapter optimizer", "ZIP export"],
  },
  {
    n: "06",
    title: "Own Your AI",
    color: "crimson",
    desc: "A local vault of models plus bring-your-own API keys. The studio runs where you decide.",
    bullets: ["Local model vault", "Cloud API keys", "Zero telemetry", "Works offline"],
  },
];

export const STEPS = [
  {
    id: 1,
    color: "azure",
    title: "Intelligent Ingestion",
    sub: "Drop raws. KOMA sorts, preps and previews.",
    body: "Import entire volumes. Pages are auto-ordered, spreads detected, and every chapter gets its own workspace before you touch anything.",
    tags: ["Auto page ordering", "Spread detect", "Batch import"],
  },
  {
    id: 2,
    color: "mint",
    title: "Seamless Restoration",
    sub: "Clean + redraw in a single pass.",
    body: "Text removal, dust cleanup and structure-aware redraw run together. Screentones survive. Line art survives. Your sanity survives.",
    tags: ["Inpaint", "Denoise", "Enhance"],
  },
  {
    id: 3,
    color: "gold",
    title: "Precision Lettering",
    sub: "Translate and typeset with context.",
    body: "The LLM reads the whole page for context, then every line is placed inside its bubble with your typography presets — and an inline editor for the last mile.",
    tags: ["LLM context", "Bubble-fit", "Typography presets"],
  },
  {
    id: 4,
    color: "crimson",
    title: "One-Click Publish",
    sub: "Export and optimize for release.",
    body: "Export PNG, WebP or PSD, or run the chapter optimizer to shrink whole releases for the web — everything locally, no upload step.",
    tags: ["PNG · WebP · PSD", "Optimizer presets", "Fully local"],
  },
];

export const PRINCIPLES = [
  { title: "MIT Licensed", color: "crimson", desc: "Use it commercially, fork it, embed it. One short license file, zero lawyers required." },
  { title: "Zero Telemetry", color: "azure", desc: "No trackers, no phone-home, no analytics. Don't trust us — audit the code yourself." },
  { title: "Local-First", color: "mint", desc: "Your raws never leave your machine. No accounts, no upload caps, no metered credits." },
  { title: "Forkable Forever", color: "gold", desc: "If we ever disappear, the project lives on. That's the open-source guarantee." },
  { title: "Community Roadmap", color: "azure", desc: "Features are proposed, discussed and triaged in the open. You steer the press." },
  { title: "Bring Your Own Models", color: "mint", desc: "Local ONNX models or your own cloud API keys. Swap engines without asking permission." },
];

export const CONTRIBUTE_STEPS = [
  { n: "01", title: "Star & Fork", desc: "Star the repo to show support, then fork it to your account. Takes 30 seconds." },
  { n: "02", title: "Pick an Issue", desc: "Grab a “good first issue” — small, scoped, and mentored by maintainers." },
  { n: "03", title: "Open a PR", desc: "Ship your change with the guide. CI checks it, humans review it kindly." },
  { n: "04", title: "Get Merged", desc: "Your name lands in the contributor graph, forever. Welcome to the studio." },
];

export const CONTRIBUTE_ROLES = [
  { title: "Code", desc: "Pipeline, UI, models, plugins." },
  { title: "Translate", desc: "Localize the studio itself." },
  { title: "Design", desc: "Icons, themes, UX flows." },
  { title: "Docs", desc: "Guides, tutorials, examples." },
];
