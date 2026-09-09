import type { FaqItem, SeoPage, SeoSection } from "@/types";
import { landingFaqs } from "@/content/site-faqs";
import { SITE_GITHUB_URL, SITE_RELEASES_URL } from "@/lib/project";

const basePages: SeoPage[] = [
  {
    slug: "manga-translation-software",
    title: "Manga Translation Software",
    metaTitle: "Manga Translation Software for Full Chapter Workflows | KOMA",
    metaDescription:
      "Compare manga translation software for real chapter production. KOMA keeps translation, cleanup, lettering, redraw, and QA in one desktop workflow.",
    keywords: [
      "manga translation software",
      "scanlation translation software",
      "desktop manga translator",
      "manga localization software",
    ],
    intro:
      "Most manga translation tools stop at the first draft. KOMA is built for teams that still need cleanup, lettering, redraw, and QA after the translation is written.",
    heroTitle: "Manga Translation Software Built for Real Scanlation Throughput",
    heroSubtitle:
      "KOMA Studio is built for teams comparing translation software at the workflow and operations level, not just the first-pass text output.",
    summaryQuestion: "What is the best manga translation software for full chapter workflows?",
    summaryAnswer:
      "If your team needs more than raw translation, KOMA is the stronger fit because it keeps translation, cleanup, lettering, redraw, and QA in one desktop workflow.",
    summaryTakeaways: [
      "Page context stays visible during translation",
      "Cleanup and lettering stay in the same workspace",
      "Built for chapter-scale release work",
    ],
    sections: [
      {
        title: "Why manga translation software is more than an AI text layer",
        content:
          "Manga translation software has to support terminology consistency, page context, role handoffs, and chapter batching. Generic translators treat every line as an isolated job; production teams need something closer to an operating environment.",
        features: [
          "Page context stays visible during translation review",
          "Teams can keep chapter voice consistent from page to page",
          "Translation stays attached to the production workflow",
        ],
      },
      {
        title: "What KOMA changes for chapter translation teams",
        content:
          "Instead of exporting strings from one app and rebuilding pages in another, KOMA keeps translation, cleanup, typesetting, redraw, and QA inside one desktop workspace. That reduces context switching and makes chapter throughput easier to manage.",
        features: [
          "Translate with manga-aware page context",
          "Move straight into lettering and cleanup",
          "Keep chapter-scale batches organized in one workspace",
        ],
      },
      {
        title: "When KOMA is the right software choice",
        content:
          "KOMA is a strong fit for solo translators, scanlation groups, and in-house localization teams that care about page context, glossary continuity, chapter batching, and a clean path from translated draft to final release.",
      },
    ],
    faqs: [
      {
        question: "What makes manga translation software different from a generic AI translator?",
        answer:
          "It has to account for page layout, balloons, redraw constraints, and chapter continuity instead of translating isolated text strings.",
      },
      {
        question: "Can I use KOMA for full chapter translation workflows?",
        answer:
          "Yes. KOMA is designed for chapter-scale production, not one-page translation experiments.",
      },
    ],
    relatedPages: [
      { title: "AI Manga Translator", href: "/ai-manga-translator" },
      { title: "Comic Translator vs KOMA Studio", href: "/comictranslator-vs-koma-studio" },
      { title: "AI Manga Translate vs KOMA Studio", href: "/aimangatranslate-vs-koma-studio" },
    ],
  },
  {
    slug: "scanlation-typesetting-software",
    title: "Scanlation Typesetting Software",
    metaTitle: "Scanlation Typesetting Software for Balloon Fit and QA | KOMA",
    metaDescription:
      "Professional scanlation typesetting software for manga, manhwa, and comics. Keep lettering, cleanup, redraw, and QA connected in one desktop workflow.",
    keywords: [
      "scanlation typesetting software",
      "manga lettering software",
      "comic typesetting software",
      "balloon text layout tool",
    ],
    intro:
      "Good lettering makes the difference between a readable chapter and a messy release. Teams comparing balloon-fit quality, page context, and final QA need more than a font picker.",
    heroTitle: "Scanlation Typesetting Software That Respects the Page, Not Just the Text",
    heroSubtitle:
      "KOMA Studio helps you move from translated dialogue to release-ready lettering inside the same environment used for cleanup and review.",
    summaryQuestion: "What matters most in scanlation typesetting software?",
    summaryAnswer:
      "The best typesetting software keeps balloon fit, page context, cleanup, and review connected so lettering decisions do not get lost between tools.",
    summaryTakeaways: [
      "Balloon fit should stay tied to the page",
      "Lettering quality affects final QA",
      "Integrated review reduces rework",
    ],
    sections: [
      {
        title: "Why lettering quality decides whether a release feels professional",
        content:
          "Weak typesetting breaks immersion fast. In scanlation, typography has to fit the balloon, preserve emphasis, and stay visually coherent across the chapter. KOMA keeps lettering decisions attached to the actual page art instead of a detached text list.",
      },
      {
        title: "How KOMA supports lettering work",
        content:
          "KOMA keeps lettering adjacent to translation, cleanup, and review so the typesetting pass is informed by the real panel instead of a disconnected file handoff.",
        features: [
          "Text fitting stays tied to panel context",
          "Lettering decisions remain inside the chapter workspace",
          "QA can happen without leaving the app",
        ],
      },
      {
        title: "When integrated typesetting matters most",
        content:
          "If your team is tired of moving from translator to editor to QA with disconnected files, KOMA is the stronger fit. It keeps lettering decisions attached to the actual page and review workflow.",
      },
    ],
    faqs: [
      {
        question: "Is KOMA only a translator, or can it support lettering too?",
        answer:
          "KOMA is a broader scanlation workflow product, not just a translation utility.",
      },
      {
        question: "Why does integrated lettering matter?",
        answer:
          "Because dialogue fit, cleanup, redraw, and review all influence final readability. Splitting them across apps increases friction and mistakes.",
      },
    ],
    relatedPages: [
      { title: "Manga Translation Software", href: "/manga-translation-software" },
      { title: "Photoshop vs KOMA Studio", href: "/photoshop-vs-koma-studio" },
      { title: "Workflow", href: "/workflow" },
    ],
  },
  {
    slug: "manga-cleaning-redraw-tool",
    title: "Manga Cleaning & Redraw Tool",
    metaTitle: "Manga Cleaning and Redraw Tool for Release Workflows | KOMA",
    metaDescription:
      "Compare manga cleaning and redraw tools for real release work. Remove source text, preserve art, and keep pages ready for lettering and QA.",
    keywords: [
      "manga cleaning tool",
      "manga redraw tool",
      "comic text removal software",
      "scanlation cleanup software",
    ],
    intro:
      "Cleanup is rarely the final problem. Teams need to remove source text, preserve the art, and keep the page ready for lettering and QA without creating downstream rework.",
    heroTitle: "A Manga Cleaning and Redraw Tool That Fits the Full Release Workflow",
    heroSubtitle:
      "KOMA Studio is built for the reality of scanlation work: remove source text, preserve the art, and keep moving toward a finished release without context loss.",
    summaryQuestion: "What makes a manga cleaning and redraw tool useful in production?",
    summaryAnswer:
      "A useful cleanup tool does more than erase text. It has to preserve art quality and keep the page ready for lettering, redraw review, and final QA.",
    summaryTakeaways: [
      "Cleanup quality affects every downstream stage",
      "Redraw choices need review context",
      "Chapter workflows punish extra handoffs",
    ],
    sections: [
      {
        title: "Where cleanup tools usually fail",
        content:
          "Many tools can remove text, but the workflow falls apart when redraw, lettering, and QA all happen somewhere else. That is when chapter consistency starts leaking.",
      },
      {
        title: "How KOMA approaches cleaning and redraw",
        content:
          "KOMA positions cleaning and redraw as one stage inside the same chapter workspace used for translation and typesetting. That makes it easier to review every decision in context instead of rebuilding pages downstream.",
        features: [
          "Page cleanup lives next to translation and lettering",
          "Redraw work stays visible during QA",
          "The workflow scales from single-page fixes to chapter batches",
        ],
      },
      {
        title: "When cleanup has to survive the whole chapter",
        content:
          "KOMA is the better fit when text removal is only the beginning and the same page still needs redraw review, lettering, and final QA. The bigger the chapter workload, the more that continuity matters.",
      },
    ],
    faqs: [
      {
        question: "Does KOMA only remove text, or does it support the rest of the page workflow?",
        answer:
          "KOMA is built around end-to-end scanlation work, so cleaning is one stage inside a larger release pipeline.",
      },
      {
        question: "Why is redraw context important?",
        answer:
          "Because redraw choices affect lettering, readability, and final QC. Context makes those tradeoffs easier to evaluate.",
      },
    ],
    relatedPages: [
      { title: "Scanlation Typesetting Software", href: "/scanlation-typesetting-software" },
      { title: "Photoshop vs KOMA Studio", href: "/photoshop-vs-koma-studio" },
      { title: "Workflow", href: "/workflow" },
    ],
  },
  {
    slug: "ai-manga-translator",
    title: "AI Manga Translator",
    metaTitle: "AI Manga Translator with OCR and Layout Awareness | KOMA",
    metaDescription:
      "Evaluate an AI manga translator with OCR, layout awareness, and production fit. KOMA helps teams move from AI draft to finished release.",
    keywords: [
      "ai manga translator",
      "manga ai translator",
      "ai comic translator",
      "scanlation ai translation",
    ],
    intro:
      "A fast AI draft is useful, but scanlation teams still need the page to survive lettering, cleanup, redraw, and QA. KOMA is built for teams that want translation speed without losing the rest of the production workflow.",
    heroTitle: "An AI Manga Translator That Does Not Stop at the First Draft",
    heroSubtitle:
      "KOMA Studio is for teams comparing AI manga translator capabilities like OCR, layout awareness, vertical text handling, and what happens after the first translated draft.",
    summaryQuestion: "What should an AI manga translator handle beyond text output?",
    summaryAnswer:
      "A serious AI manga translator needs OCR, page awareness, and a clean path into cleanup, lettering, redraw, and review. Otherwise the team still rebuilds the workflow elsewhere.",
    summaryTakeaways: [
      "OCR and layout awareness matter",
      "The translated draft is not the finish line",
      "Workflow continuity decides team efficiency",
    ],
    sections: [
      {
        title: "What to evaluate in an AI manga translator",
        content:
          "The real question is not whether AI can draft the translation. The question is whether the translator handles OCR quality, vertical text, panel layout, and the page cleanup that often follows.",
      },
      {
        title: "How KOMA compares on OCR and page context",
        content:
          "KOMA keeps the AI translation pass connected to the page itself instead of treating it like detached text. That matters when OCR quality, layout awareness, and downstream cleanup affect whether the result is actually usable.",
        features: [
          "AI translation stays connected to the page",
          "OCR and layout decisions remain visible in context",
          "The next production stages are already in the same workspace",
        ],
      },
      {
        title: "When KOMA is the stronger choice after the AI draft",
        content:
          "If the AI draft is only the beginning, KOMA is the stronger fit. It keeps translation tied to the page while cleanup, lettering, redraw, and review move forward in the same workspace.",
      },
    ],
    faqs: [
      {
        question: "What makes an AI manga translator useful for scanlation teams?",
        answer:
          "It needs to fit the rest of the chapter workflow, not just output translated text. Teams still need lettering, cleanup, redraw, and QA in context.",
      },
      {
        question: "Is KOMA positioned as a translation-only product?",
        answer:
          "No. Translation is one stage in a broader desktop-native scanlation workflow.",
      },
    ],
    relatedPages: [
      { title: "Manga Translation Software", href: "/manga-translation-software" },
      { title: "AI Manga Translate vs KOMA Studio", href: "/aimangatranslate-vs-koma-studio" },
      { title: "Workflow", href: "/workflow" },
    ],
  },
  {
    slug: "features",
    title: "KOMA Studio Features",
    metaTitle: "KOMA Studio Features for Translation, Cleaning, QA, and Redraw",
    metaDescription:
      "Explore KOMA Studio features for AI translation, smart cleaning, typesetting, redraw, raw management, and QA in one desktop workflow.",
    keywords: [
      "scanlation software features",
      "manga software features",
      "ai typesetting features",
      "manga workflow tools",
    ],
    intro:
      "Here is the full KOMA feature set in one place: translation, cleanup, lettering, redraw, raw management, and QA. It is written for teams comparing real workflow depth, not one isolated feature.",
    heroTitle: "The KOMA Studio Feature Stack, Mapped for Production Teams",
    heroSubtitle:
      "AI translation, cleanup, lettering, redraw, chapter organization, and QA all sit inside one desktop-native workflow instead of being spread across five different products.",
    summaryQuestion: "What are the core KOMA Studio features?",
    summaryAnswer:
      "KOMA combines translation, cleanup, lettering, redraw support, raw organization, and QA in one desktop workspace for manga, manhwa, and comic production.",
    summaryTakeaways: [
      "Translation stays connected to the page",
      "Cleanup and redraw are part of the same flow",
      "Raw management and QA live in the same app",
    ],
    sections: [
      {
        title: "Translation and context retention",
        content:
          "KOMA is designed for manga and comic page structure, so translation happens with balloon and panel context still visible. That makes editorial review faster and reduces downstream revisions.",
        features: [
          "Context-aware translation workflows",
          "Glossary and terminology continuity",
          "Batch translation support for chapter throughput",
        ],
      },
      {
        title: "Cleanup, redraw, and lettering in the same workspace",
        content:
          "Page cleanup is not treated as an isolated action. Redraw and lettering decisions stay in the same environment, so teams do not need to recreate visual context every time the chapter moves to a new stage.",
        features: [
          "Smart cleaning and text removal",
          "Redraw support tied to the real page state",
          "Lettering decisions that stay adjacent to QA",
        ],
      },
      {
        title: "Raw management and release control",
        content:
          "Beyond page edits, KOMA supports the operational side of scanlation: keeping raw pages organized, moving teams through QA, and preparing for release without building a custom process around general-purpose tools.",
      },
    ],
    faqs: [
      {
        question: "Does KOMA replace several separate scanlation tools?",
        answer:
          "That is the point of the feature set. KOMA is positioned as one integrated workspace for translation, cleanup, lettering, redraw, and review.",
      },
      {
        question: "Which KOMA features matter most for a scanlation team?",
        answer:
          "For most teams, the core stack is translation, cleanup, lettering, redraw support, raw organization, and QA. Those features matter most because they determine whether a chapter can move cleanly from import to release.",
      },
    ],
    relatedPages: [
      { title: "Workflow", href: "/workflow" },
      { title: "App Preview", href: "/app-preview" },
      { title: "Compare KOMA Studio", href: "/compare" },
    ],
  },
  {
    slug: "app-preview",
    title: "KOMA Studio App Preview",
    metaTitle: "KOMA Studio App Preview and Workflow Demo",
    metaDescription:
      "See the KOMA Studio desktop workflow from raw page import through translation, cleanup, redraw, lettering, and QA in one product view.",
    keywords: [
      "koma studio app preview",
      "scanlation workflow demo",
      "manga translation app preview",
      "desktop scanlation app",
    ],
    intro:
      "Use the app preview to judge whether KOMA feels like a real desktop workspace before you download it. The focus here is the interface and how the workflow is laid out.",
    heroTitle: "KOMA Studio App Preview for Workflow Evaluation",
    heroSubtitle:
      "See how the KOMA Studio interface is designed to move a chapter from raw import to release-ready review without rebuilding the process in outside tools.",
    summaryQuestion: "What should the KOMA app preview prove?",
    summaryAnswer:
      "The preview should prove that KOMA behaves like a real desktop workspace, with translation, cleanup, lettering, redraw, and QA connected in one operational layout.",
    summaryTakeaways: [
      "The interface shows real workflow stages",
      "Page and chapter context stay visible",
      "Review happens in the same workspace",
    ],
    sections: [
      {
        title: "What the app preview shows",
        content:
          "The preview should answer whether KOMA behaves like a real desktop workspace for scanlation teams, not just whether a screenshot looks polished. The goal is to show how the product is organized for actual chapter work.",
      },
      {
        title: "How the preview maps to the actual workflow",
        content:
          "Each major capability shown on the site reflects a production stage teams already care about: translation, cleanup, redraw, lettering, chapter organization, and QA. The app preview page ties those stages together into one narrative.",
        features: [
          "Preview translation and cleanup in context",
          "Show how lettering and redraw decisions stay linked",
          "Reinforce that QA happens inside the same workspace",
        ],
      },
      {
        title: "What to check before you download",
        content:
          "Check whether translation, cleanup, lettering, redraw, and QA feel connected, whether chapter batches are easy to follow, and whether the interface matches how your team already works.",
      },
    ],
    faqs: [
      {
        question: "Does the preview reflect the real workflow?",
        answer:
          "Yes. The preview is designed to mirror the desktop workflow and show how KOMA organizes translation, cleanup, lettering, redraw, and QA.",
      },
      {
        question: "What should I look at after the preview?",
        answer:
          "Check the features page for capability depth, the workflow page for chapter flow, and the comparison pages if your team is deciding between KOMA and a tool it already uses.",
      },
    ],
    relatedPages: [
      { title: "Features", href: "/features" },
      { title: "Workflow", href: "/workflow" },
      { title: "Compare KOMA Studio", href: "/compare" },
    ],
  },
  {
    slug: "workflow",
    title: "Scanlation Workflow",
    metaTitle: "Scanlation Workflow Software from Raw Import to QA | KOMA",
    metaDescription:
      "Understand the KOMA Studio scanlation workflow from raw import through translation, cleaning, typesetting, redraw, and final QA in one desktop system.",
    keywords: [
      "scanlation workflow",
      "manga workflow software",
      "chapter production workflow",
      "manga localization workflow",
    ],
    intro:
      "Teams that care about how a chapter actually moves from raw pages to final QA need a workflow that reduces handoff debt and keeps production moving.",
    heroTitle: "A Scanlation Workflow Designed Around Chapter Throughput, Not One-Off Page Wins",
    heroSubtitle:
      "KOMA Studio is structured around the real stages that slow teams down: raw import, translation, cleanup, lettering, redraw, and QA handoff.",
    summaryQuestion: "How should a scanlation workflow move from raw pages to final QA?",
    summaryAnswer:
      "The most efficient scanlation workflows keep translation, cleanup, lettering, redraw, and review connected so each stage inherits context from the one before it.",
    summaryTakeaways: [
      "Organization starts before translation",
      "Mid-pipeline handoffs create most rework",
      "QA should be a native stage, not an afterthought",
    ],
    sections: [
      {
        title: "Stage 1: move from raw pages into a structured workspace",
        content:
          "A chapter workflow starts with organization, not just editing. KOMA is designed to keep raw pages, naming, and page state controlled before translation work begins.",
      },
      {
        title: "Stage 2: keep translation, cleanup, and lettering aligned",
        content:
          "The middle of the workflow is where most fragmentation costs appear. KOMA reduces that by keeping the production steps connected, so each pass inherits context from the last.",
        features: [
          "Translation decisions stay connected to balloons and layout",
          "Cleanup and redraw remain visible to lettering and QA",
          "Teams avoid detached handoff files whenever possible",
        ],
      },
      {
        title: "Stage 3: finish the chapter with review confidence",
        content:
          "A chapter is only done when review is clear. KOMA is built to make QA a native stage instead of an afterthought, which is critical when multiple people touch the same release.",
      },
    ],
    faqs: [
      {
        question: "What makes a workflow-native scanlation tool different from separate utilities?",
        answer:
          "A workflow-native tool keeps translation, cleanup, lettering, redraw, and review connected in one environment. Separate utilities can each be good at one stage, but the handoffs between them create more coordination debt.",
      },
      {
        question: "Who benefits most from a workflow-native tool?",
        answer:
          "Teams handling repeat chapter production, split roles, or QA coordination usually benefit most because the tool reduces operational fragmentation.",
      },
    ],
    relatedPages: [
      { title: "Features", href: "/features" },
      { title: "Compare KOMA Studio", href: "/compare" },
      { title: "App Preview", href: "/app-preview" },
    ],
  },
  {
    slug: "faq",
    title: "KOMA Studio FAQ",
    metaTitle: "KOMA Studio FAQ for Scanlation Teams and Contributors",
    metaDescription:
      "Read the KOMA Studio FAQ covering licensing, open source, platforms, privacy, batch processing, workflow fit, AI translation, and Photoshop-alternative questions.",
    keywords: [
      "koma studio faq",
      "scanlation software faq",
      "manga translation software questions",
      "photoshop alternative faq",
    ],
    intro:
      "Use this FAQ when you're already evaluating KOMA and want direct answers about platforms, privacy, batch work, offline expectations, and how the workflow compares with general tools.",
    heroTitle: "The KOMA Studio FAQ for Teams Vetting an Open-Source Scanlation Workflow",
    heroSubtitle:
      "From licensing and platform fit to privacy, chapter batching and AI translation, this FAQ answers the questions teams ask when the workflow actually matters.",
    summaryQuestion: "What does the KOMA Studio FAQ cover?",
    summaryAnswer:
      "The FAQ covers the practical questions teams ask before adopting it: licensing, open source, platform fit, privacy, workflow reliability, batch production, and how KOMA differs from general tools.",
    summaryTakeaways: [
      "Covers product fit and rollout questions",
      "Addresses privacy and workflow reliability",
      "Handles common comparison objections",
    ],
    sections: [
      {
        title: "Product fit and team setup",
        content:
          "Most teams need to understand whether KOMA is right for solo use, team use, desktop environments, and chapter-scale production — and what the MIT license means for them. These are the questions that usually decide fit first.",
      },
      {
        title: "Reliability, privacy, and production workflow",
        content:
          "Privacy, offline behavior, batch processing, and QA all shape whether the product can be trusted for recurring releases, not just quick experiments.",
      },
      {
        title: "Alternatives and common buying questions",
        content:
          "FAQ content also supports alternative-intent traffic by explaining how KOMA differs from general editors, narrow translation tools, and stitched-together multi-app workflows — and why the open-source license changes the long-term risk calculation.",
      },
    ],
    faqs: landingFaqs,
    relatedPages: [
      { title: "Compare KOMA Studio", href: "/compare" },
      { title: "Workflow", href: "/workflow" },
      { title: "Photoshop vs KOMA Studio", href: "/photoshop-vs-koma-studio" },
    ],
    downloadLinks: [
      { title: "Windows Download", href: "/download/windows" },
      { title: "macOS Download", href: "/download/macos" },
      { title: "Linux Download", href: "/download/linux" },
      { title: "Source code on GitHub", href: SITE_GITHUB_URL },
      { title: "Latest release notes", href: SITE_RELEASES_URL },
    ],
  },
  {
    slug: "download",
    title: "Download KOMA Studio",
    metaTitle: "Download KOMA Studio for Windows, macOS, and Linux",
    metaDescription:
      "Download KOMA Studio for Windows, macOS, and Linux. Check platform support, workflow fit, and rollout expectations for scanlation teams.",
    keywords: [
      "download koma studio",
      "koma studio desktop app",
      "scanlation desktop software download",
      "manga workflow app for windows mac linux",
    ],
    intro:
      "If you're evaluating KOMA seriously, answer three practical questions first: does it run on your OS, what workflow does it replace, and what should your team review before rollout?",
    heroTitle: "Download KOMA Studio for Windows, macOS, and Linux",
    heroSubtitle:
      "KOMA Studio is free, open-source, and built for Windows, macOS, and Linux — download a binary, or clone the repository and compile it yourself under the MIT license.",
    summaryQuestion: "What should you confirm before downloading KOMA Studio?",
    summaryAnswer:
      "Confirm platform support and workflow fit, then decide whether you want a prebuilt binary or your own build from source. Either way there is no account, no license key, and no paid tier.",
    summaryTakeaways: [
      "Desktop support is a core decision point",
      "Workflow fit matters as much as OS support",
      "You can always build the latest code yourself",
    ],
    sections: [
      {
        title: "Supported desktop environments",
        content:
          "KOMA Studio targets Windows, macOS, and Linux teams that want one desktop application for translation, cleanup, lettering, redraw, and review. Because the project is open source, other platforms can be built from the repository as well.",
      },
      {
        title: "Download a binary or build it from source",
        content:
          "Prebuilt binaries are the fastest path. If you want the newest commits, or you need to patch something for your own group, clone the repository and build it — the same MIT-licensed code ships in both.",
        features: [
          "Prebuilt installers for Windows, macOS, and Linux",
          "git clone plus the build steps in the README",
          "Fork it and ship your own build if you need to",
        ],
      },
      {
        title: "Why a desktop workflow matters for scanlation teams",
        content:
          "Desktop-native workflow matters because chapter production is more than a quick browser task. Teams need local organization, visual context, and less dependency on fragile browser-only editing flows.",
        features: [
          "Windows, macOS, and Linux positioning",
          "One application for the full scanlation workflow",
          "Cleaner adoption for teams leaving multi-tool stacks",
        ],
      },
      {
        title: "What to review before rollout",
        content:
          "Before you roll KOMA out to a team, check the feature depth, workflow fit, and the comparison pages for any tools your process currently depends on.",
      },
    ],
    faqs: [
      {
        question: "Can I download KOMA Studio for Windows, macOS, and Linux?",
        answer:
          "That is the current platform positioning on the site. The product is presented as a desktop-native workflow for Windows, macOS, and Linux environments.",
      },
      {
        question: "What should I review before rolling KOMA out to a team?",
        answer:
          "Review the features page, workflow page, and relevant comparison pages so you can confirm fit at the product, process, and competitive levels before installation.",
      },
    ],
    relatedPages: [
      { title: "Features", href: "/features" },
      { title: "Workflow", href: "/workflow" },
      { title: "Compare KOMA Studio", href: "/compare" },
    ],
  },
];


/* ══════════════════════════════════════════════════════════════
   Open-source layer applied to every guide page
   ══════════════════════════════════════════════════════════════ */

const OSS_SECTION: SeoSection = {
  title: "Open source, MIT licensed, free forever",
  content:
    "KOMA Studio is developed in the open under the MIT license. It runs on your own machine, keeps projects on your disk, and never gates a feature behind a paid tier. You bring the AI model — hosted or local — and everything else is yours to inspect, modify, and redistribute.",
  features: [
    "MIT license — commercial use, forks and redistribution allowed",
    "Self-hosted desktop app with no account and no usage telemetry",
    "Bring your own API key, or run a local model offline",
    "Issues, milestones, and the roadmap are public",
  ],
};

const OSS_FAQS: FaqItem[] = [
  {
    question: "Is KOMA Studio open source?",
    answer:
      "Yes. The source code is published on GitHub under the MIT license, so you can read it, build it, fork it, or send a pull request.",
  },
  {
    question: `Is it really free, or is there a paid tier?`,
    answer:
      "There is no paid tier, credit system, or feature lock. The app is free forever and every capability ships in the open-source build. If you choose a hosted AI model you pay that provider directly; run a local model and there is nothing to pay at all.",
  },
  {
    question: "How do I contribute or request a feature?",
    answer:
      "Open an issue on GitHub, claim a good first issue, translate the UI, or improve the docs. Development happens in public and priorities are discussed with the community in Discord.",
  },
];

const OPEN_SOURCE_PAGE: SeoPage = {
  slug: "open-source",
  title: "Open Source",
  metaTitle: "KOMA Studio Is Open Source (MIT) Scanlation Software",
  metaDescription:
    "KOMA Studio is free and open-source scanlation software under the MIT license. Read the source, build it, fork it, self-host it, and shape the roadmap in public.",
  keywords: [
    "open source scanlation software",
    "open source manga translator",
    "MIT licensed manga translation",
    "self-hosted scanlation tool",
    "free manga typesetting software",
  ],
  intro:
    "The repository, the issue tracker, the milestones, and every release are public. The license lets you use the code commercially, change it, and redistribute it.",
  heroTitle: "Open-Source Scanlation Software, Licensed MIT",
  heroSubtitle:
    "No credits, no seats, no paywalled features. KOMA Studio hands you the whole chapter pipeline as source code you can read, build, fork, and ship.",
  summaryQuestion: "Is KOMA Studio really open source?",
  summaryAnswer:
    "Yes — MIT-licensed and developed in public. You can build the application from the repository, fork it for your own group, self-host it, and contribute changes back through pull requests.",
  summaryTakeaways: [
    "MIT license — commercial use allowed",
    "Public issues, milestones and roadmap",
    "Build from source or download a binary",
  ],
  sections: [
    {
      title: "Why open source matters for a scanlation workflow",
      content:
        "Scanlation is long-term work. Chapters, glossaries, and typesetting conventions outlive any single tool vendor. When the software is MIT-licensed and self-hosted, a discontinued roadmap or a pricing change cannot take your pipeline away — you keep the code, the files, and the ability to build it again in ten years.",
      features: [
        "No shutdown risk — fork the repository and keep going",
        "Projects stay on your disk in inspectable formats",
        "Model calls go to the provider you choose, not a middleman",
      ],
    },
    {
      title: "What you can do with the code",
      content:
        "The MIT license is permissive: use it commercially, modify it, redistribute it, or embed it in your own product. The only obligation is keeping the license notice.",
      features: [
        "Fork it and publish a build tuned for your group",
        "Add new OCR, translation, or inpainting backends",
        "Script or extend the chapter pipeline",
        "Audit exactly what happens to every page",
      ],
    },
    {
      title: "How the project is run",
      content:
        "Development happens on GitHub: issues for bugs and features, milestones for what is shipping next, and pull requests for the work itself. Larger design questions are argued out in discussions and in the community Discord before code is written.",
      features: [
        "Issues and milestones are public",
        "Feature requests come from people shipping chapters",
        "Releases and changelogs are published on GitHub",
      ],
    },
    {
      title: "Free does not mean unmaintained",
      content:
        "The project is free to use and free to modify, and it is built by people who need it for their own releases. Contributions are reviewed in public, and bug reports with reproducible sample pages are treated as first-class contributions.",
    },
  ],
  faqs: [
    {
      question: "Can I use KOMA Studio commercially?",
      answer:
        "Yes. The MIT license permits commercial use, modification, distribution, and private use. You just need to keep the copyright and license notice.",
    },
    {
      question: "Do I have to contribute my changes back?",
      answer:
        "No — the MIT license does not require it. Publishing your fork or opening a pull request is encouraged, but never mandatory.",
    },
    {
      question: "Where is the source code?",
      answer: `The repository is public on GitHub at ${SITE_GITHUB_URL}, including the issue tracker, milestones, and release downloads.`,
    },
    {
      question: "Is there telemetry in the app?",
      answer:
        "No. KOMA Studio ships no analytics or usage tracking: your chapters and projects stay on your disk. Network calls are limited to what you configure and opt into — your model providers, plus optional services such as the update check and the account login.",
    },
  ],
  relatedPages: [
    { title: "Contributing", href: "/contributing" },
    { title: "Features", href: "/features" },
    { title: "Download", href: "/download" },
    { title: "Compare KOMA Studio", href: "/compare" },
  ],
  sourceLinks: [
    { title: "Source code on GitHub", href: SITE_GITHUB_URL },
    { title: "Latest releases", href: SITE_RELEASES_URL },
  ],
};

const CONTRIBUTING_PAGE: SeoPage = {
  slug: "contributing",
  title: "Contributing",
  metaTitle: "Contribute to KOMA Studio | Open-Source Scanlation Software",
  metaDescription:
    "How to contribute to KOMA Studio: code, translations, docs, bug reports and sample pages. Learn the workflow for your first pull request.",
  keywords: [
    "koma studio contribute",
    "open source scanlation contribution",
    "manga translation software contribute",
    "good first issue scanlation",
  ],
  intro:
    "KOMA Studio is built in the open by people who use it to ship chapters. Code is only one of the ways to help — and it is rarely the most urgent one.",
  heroTitle: "Contribute to KOMA Studio",
  heroSubtitle:
    "Fix a bug, translate the interface, document a workflow, or send a reproducible report. Every contribution moves the project forward, and none of them require being a maintainer.",
  summaryQuestion: "How do I contribute to KOMA Studio?",
  summaryAnswer:
    "Start from an issue: report a bug, claim a good first issue, translate the UI, or improve the docs. Code contributions follow the usual fork, branch, commit, pull request flow.",
  summaryTakeaways: [
    "Good first issues are labelled on GitHub",
    "Non-code contributions matter just as much",
    "Big changes are discussed before they are written",
  ],
  sections: [
    {
      title: "Before you start",
      content:
        "Search the issue tracker first — someone may already be working on it. For anything larger than a bug fix, open an issue or a discussion and describe the approach before writing code. Small, focused pull requests get reviewed fastest.",
      features: [
        "Search existing issues and pull requests",
        "Discuss large changes before implementing them",
        "One concern per pull request",
      ],
    },
    {
      title: "Development workflow",
      content:
        "Fork the repository, create a branch, make the change, and open a pull request against the default branch. Include what changed, why, and how you tested it — screenshots or sample pages help a lot for visual work.",
      features: [
        "gh repo fork, then git switch -c your-change",
        "Conventional commit messages (fix:, feat:, docs:)",
        "Run the linter and build before pushing",
        "Describe the change and attach screenshots",
      ],
    },
    {
      title: "Ways to help that are not code",
      content:
        "A project like this lives or dies on real-world feedback. Translations, documentation, and reproducible bug reports from actual chapters are often more valuable than another feature branch.",
      features: [
        "Translate the UI and the documentation",
        "Report bugs with a sample page and exact steps",
        "Test builds on your operating system",
        "Answer questions in the community Discord",
      ],
    },
    {
      title: "What to expect in review",
      content:
        "Reviews are public and focused on the code, not the person. Expect questions about edge cases, performance on large chapters, and whether the change fits the workflow. Maintainers may ask for changes before merging — that is normal for any open-source project.",
    },
  ],
  faqs: [
    {
      question: "I have never contributed to open source. Where do I start?",
      answer:
        "Look for issues labelled as good first issues on GitHub. They are scoped small and usually have enough context to get you going. Documentation and translation fixes are also an easy first pull request.",
    },
    {
      question: "Do I need to be able to build the desktop app?",
      answer:
        "Only for code changes. Translations, documentation, and many bug reports need no build toolchain at all — you can work directly on GitHub.",
    },
    {
      question: "How do I report a bug properly?",
      answer:
        "Include the version, your operating system, the exact steps to reproduce, and — if you can share it — a sample page. A reproducible report is worth more than a vague complaint.",
    },
    {
      question: "Can I work on a feature I care about?",
      answer:
        "Yes, but open an issue first so the design can be discussed. It avoids duplicate work and makes sure the feature fits how chapters actually get produced.",
    },
  ],
  relatedPages: [
    { title: "Open Source", href: "/open-source" },
    { title: "Features", href: "/features" },
    { title: "Workflow", href: "/workflow" },
    { title: "FAQ", href: "/faq" },
  ],
  sourceLinks: [
    { title: "Issues on GitHub", href: `${SITE_GITHUB_URL}/issues` },
    { title: "Good first issues", href: `${SITE_GITHUB_URL}/contribute` },
    { title: "Community Discord", href: "https://discord.gg/tzaV2efD4e" },
  ],
};

const withOpenSourceLayer = basePages.map((page) => {
  const isFaqPage = page.slug === "faq";
  const alreadyOpenSource = page.slug === "open-source" || page.slug === "contributing";

  if (alreadyOpenSource) {
    return page;
  }

  return {
    ...page,
    sections: [...page.sections, OSS_SECTION],
    faqs: isFaqPage ? page.faqs : [...page.faqs, ...OSS_FAQS],
  };
});

export const seoPages: SeoPage[] = [
  ...withOpenSourceLayer,
  OPEN_SOURCE_PAGE,
  CONTRIBUTING_PAGE,
];

export const seoPageMap = new Map(seoPages.map((page) => [page.slug, page]));

