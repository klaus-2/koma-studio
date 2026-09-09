import type { ComparePage, CompareRow, CompareSection, CompareStepResult } from "@/types";

const KOMA_CLEANER: CompareStepResult = {
  description:
    "Cleaning and redraw are treated as one stage inside a broader scanlation workflow, so the page context stays visible while the chapter moves forward.",
  quality: "excellent",
  notes: [
    "Built for chapter continuity, not only isolated page cleanup",
    "Redraw decisions remain visible to lettering and QA",
    "Less downstream rework after text removal",
  ],
};

const KOMA_TYPESET: CompareStepResult = {
  description:
    "Typesetting stays adjacent to translation, cleanup, and review, which makes balloon fit and readability easier to judge in the actual page context.",
  quality: "excellent",
  notes: [
    "Lettering stays connected to page art",
    "Better fit for chapter-scale consistency",
    "QA happens without rebuilding context in another tool",
  ],
};

const baseComparePages: ComparePage[] = [
  {
    slug: "compare",
    type: "hub",
    title: "Compare KOMA Studio",
    metaTitle: "Compare KOMA Studio Against Manga Workflow and Translation Tools",
    metaDescription:
      "Compare KOMA Studio with Comic Translator, Photoshop, Mangaday, Yomu, Transmonkey, and other manga workflow tools. See where KOMA fits best for chapter-scale scanlation work.",
    keywords: [
      "koma studio comparison",
      "manga workflow software comparison",
      "scanlation software alternatives",
      "koma studio vs competitors",
    ],
    heroTitle:
      "Compare KOMA Studio Against the Tools People Evaluate Before They Burn More Time",
    heroSubtitle:
      "Use this hub to compare KOMA Studio — free, open source and MIT-licensed — against the translation tools, web apps, and general editors that scanlation teams actually evaluate in the wild.",
    intro:
      "The goal here is simple: help you compare workflow scope, production fit, licensing, and operational tradeoffs without forcing you through vague marketing copy.",
    summaryQuestion: "What is the best KOMA Studio alternative for scanlation teams?",
    summaryAnswer:
      "That depends on whether your team needs a fast translation utility, a general editor, or a full chapter workflow. This hub is designed to make that difference obvious quickly.",
    summaryTakeaways: [
      "Some tools are strong only at translation",
      "Some are strong only at manual editing",
      "KOMA is open source, MIT-licensed, and workflow-first",
    ],
    sections: [
      {
        title: "Start with the tool your team already knows",
        content:
          "Most teams do not begin with a generic search for scanlation software. They start with the tool already in their workflow and ask whether switching would remove friction, reduce rework, or make the chapter move faster.",
      },
      {
        title: "Compare by workflow, not just by first feature",
        content:
          "A translator can look strong if you only measure first-pass text output. A general editor can look strong if you only measure manual control. What matters is how much of the chapter still needs cleanup, lettering, redraw, and QA after that first strength runs out.",
        bullets: [
          "What the other tool genuinely does well",
          "Where KOMA becomes the stronger workflow option",
          "How the decision changes when work scales from one page to a full chapter",
        ],
      },
      {
        title: "What KOMA is being compared against",
        content:
          "The pages in this hub cover web translators, browser extensions, credit-based manga tools, and Photoshop-style manual editing stacks. That makes it easier to separate translation utilities from workflow systems.",
      },
      {
        title: "Licensing is part of the comparison",
        content:
          "KOMA Studio is MIT-licensed and self-hosted, so there is no credit balance to run out of and no vendor decision that can remove a feature you depend on. Where a competitor is closed source, metered, or subscription-only, the comparison pages say so explicitly.",
        bullets: [
          "KOMA: MIT, free forever, runs on your machine",
          "Hosted tools: credits, seats, and capped free tiers",
          "Closed source: you cannot patch it when it breaks your workflow",
        ],
      },
    ],
    faqs: [
      {
        question: "Why build dedicated comparison pages instead of one generic feature table?",
        answer:
          "Because evaluators searching for a specific competitor want a direct answer about that exact tool, not a vague generic landing page.",
      },
      {
        question: "Are these pages meant to replace the main landing page?",
        answer:
          "No. The landing page introduces KOMA broadly. Comparison pages exist for high-intent searchers who are already evaluating alternatives.",
      },
    ],
    relatedPages: [
      {
        title: "Manga Translation Software",
        href: "/manga-translation-software",
      },
      {
        title: "Workflow",
        href: "/workflow",
      },
      {
        title: "Features",
        href: "/features",
      },
    ],
    cards: [
      {
        slug: "comictranslator-vs-koma-studio",
        title: "Comic Translator vs KOMA Studio",
        summary:
          "A browser-first comic translator with credits, extensions, and fast image translation versus a desktop-native chapter workflow.",
      },
      {
        slug: "photoshop-vs-koma-studio",
        title: "Photoshop vs KOMA Studio",
        summary:
          "A general-purpose editor with deep manual control versus a dedicated scanlation workflow product.",
      },
      {
        slug: "aimangatranslate-vs-koma-studio",
        title: "AI Manga Translate vs KOMA Studio",
        summary:
          "A web translator with OCR/model controls and file translation versus a desktop workflow built for release work.",
      },
      {
        slug: "mangaday-vs-koma-studio",
        title: "Mangaday vs KOMA Studio",
        summary:
          "A browser extension and file translator with credits/subscriptions versus a desktop-native workflow for teams.",
      },
      {
        slug: "yomu-vs-koma-studio",
        title: "Yomu AI vs KOMA Studio",
        summary:
          "A manga-focused web translator with credits and inpainting versus a workflow product built for chapter continuity.",
      },
      {
        slug: "transmonkey-vs-koma-studio",
        title: "Transmonkey vs KOMA Studio",
        summary:
          "A broad AI translator suite with comic mode versus a dedicated scanlation workspace.",
      },
    ],
  },
  {
    slug: "comictranslator-vs-koma-studio",
    type: "versus",
    title: "Comic Translator vs KOMA Studio",
    metaTitle: "Comic Translator vs KOMA Studio for Manga and Comic Production",
    metaDescription:
      "Compare Comic Translator vs KOMA Studio. Learn the difference between a translation-first tool and a complete desktop-native scanlation workflow.",
    keywords: [
      "comic translator vs koma studio",
      "comic translator alternative",
      "manga translation tool comparison",
    ],
    heroTitle:
      "Comic Translator vs KOMA Studio: Translation Utility or Full Desktop Workflow?",
    heroSubtitle:
      "Comic Translator focuses on fast browser and upload-based comic translation with credits, extensions, and 160+ language support. KOMA is the stronger fit when translation is only one stage inside a larger scanlation release process.",
    intro:
      "This comparison matters when your team is deciding between a translation-first web tool and a desktop workflow that still has to carry cleanup, lettering, redraw, and QA after the text is translated.",
    competitorName: "Comic Translator",
    competitorUrl: "https://comictranslator.com/",
    sourceLinks: [
      { title: "Comic Translator pricing", href: "https://comictranslator.com/pricing" },
      { title: "Comic Translator upload tool", href: "https://comictranslator.com/upload" },
      { title: "Comic Translator FAQ", href: "https://comictranslator.com/faq" },
    ],
    summaryQuestion: "Which is better for scanlation teams: Comic Translator or KOMA Studio?",
    summaryAnswer:
      "Comic Translator is stronger when quick browser or bulk image translation is the main job. KOMA is stronger when the same chapter still needs cleanup, lettering, redraw, and QA after translation.",
    summaryTakeaways: [
      "Comic Translator is translation-first",
      "KOMA is workflow-first",
      "The bigger the chapter workload, the more KOMA benefits",
    ],
    comparisonRows: [
      {
        label: "Primary scope",
        koma: "Desktop-native scanlation workflow across translation, cleanup, lettering, redraw, and QA.",
        competitor: "Browser extension and upload-based comic translation with webpage translate, frame translate, and image output in 160+ languages.",
      },
      {
        label: "Pricing model",
        koma: "MIT-licensed and free forever — no credits, no seats. You only pay the AI provider you choose, or run a local model and pay nothing.",
        competitor: "Free trial credits, monthly plans, and credit-based usage tied to image count and detected text volume.",
      },
      {
        label: "Best use case",
        koma: "Teams moving complete chapters from raw import to release packaging.",
        competitor: "Readers or small teams who want fast browser translation or quick batch uploads up to 300 images.",
      },
      {
        label: "Workflow continuity",
        koma: "One workspace keeps translation, cleanup, lettering, redraw, and QA in context.",
        competitor: "Strong translation output, but chapter cleanup, redraw review, and final QA usually continue in other tools.",
      },
    ],
    cleaner: {
      provider: {
        description:
          "Comic Translator can remove and replace text while preserving artwork, and its Frame Translate mode helps on protected sites or long-strip pages. It is still built around translation output rather than cleanup and redraw as a dedicated production workspace.",
        quality: "good",
        notes: [
          "Upload tool supports PNG, JPG, WEBP, and ZIP with up to 300 images",
          "Frame Translate is designed for long-strip and access-restricted sites",
          "Redraw decisions still live outside a broader chapter QA workflow",
        ],
      },
      koma: KOMA_CLEANER,
    },
    typeset: {
      provider: {
        description:
          "Comic Translator returns translated images and lets you pick font family in the upload flow, but lettering is still translation-led rather than a dedicated chapter typesetting and QA environment.",
        quality: "average",
        notes: [
          "Supports translated image output and bubble text overlays in Frame Translate",
          "Webpage and extension flows are optimized for reading speed, not lettering polish",
          "Teams focused on chapter typography usually still need a second workspace",
        ],
      },
      koma: KOMA_TYPESET,
    },
    sections: [
      {
        title: "Where Comic Translator is genuinely strong",
        content:
          "Comic Translator is a solid option when the bottleneck is translating comic images quickly in the browser or through a bulk upload tool. Its extension, frame translate mode, and credit-based plans make it useful for translation-first workflows.",
      },
      {
        title: "Where KOMA becomes the better production fit",
        content:
          "Once the work stops being only translation, the center of gravity changes. Scanlation teams still need cleanup, lettering, redraw, chapter continuity, and QA. KOMA is built around that full flow instead of a browser-first translation stage.",
        bullets: [
          "Less workflow fragmentation after the first translation pass",
          "Stronger fit for chapter-scale release work",
          "Better positioned when the page still has to be cleaned, lettered, checked, and shipped",
        ],
      },
      {
        title: "Bottom line",
        content:
          "Choose Comic Translator if you mainly want a translation-focused utility. Choose KOMA if you want one desktop-native system that carries the chapter past translation into release work.",
      },
    ],
    faqs: [
      {
        question: "Is Comic Translator a direct one-to-one replacement for KOMA?",
        answer:
          "Not really. The overlap is strongest around translation, but KOMA is positioned around the broader scanlation production workflow.",
      },
      {
        question: "Who should prefer KOMA in this comparison?",
        answer:
          "Teams that need translation, cleanup, lettering, redraw, and QA to stay connected will usually get more value from KOMA.",
      },
    ],
    relatedPages: [
      { title: "Compare KOMA Studio", href: "/compare" },
      { title: "Photoshop vs KOMA Studio", href: "/photoshop-vs-koma-studio" },
      { title: "AI Manga Translator", href: "/ai-manga-translator" },
    ],
  },
  {
    slug: "photoshop-vs-koma-studio",
    type: "versus",
    title: "Photoshop vs KOMA Studio",
    metaTitle: "Photoshop vs KOMA Studio for Scanlation Workflow Teams",
    metaDescription:
      "Compare Photoshop vs KOMA Studio for manga scanlation. See the difference between a general-purpose editor and a purpose-built desktop workflow.",
    keywords: [
      "photoshop vs koma studio",
      "photoshop alternative for manga",
      "scanlation workflow comparison",
    ],
    heroTitle:
      "Photoshop vs KOMA Studio: General-Purpose Editor or Purpose-Built Scanlation Workflow?",
    heroSubtitle:
      "Photoshop remains powerful for manual editing on desktop, web, and mobile. KOMA is built for teams that are tired of turning a general-purpose canvas into an improvised scanlation operating system.",
    intro:
      "This is not a fake feature-parity argument. Photoshop is a broad raster editor with deep manual control. KOMA is the better fit when the real problem is not image editing in isolation, but keeping translation, cleanup, lettering, redraw, and QA moving as one pipeline.",
    competitorName: "Adobe Photoshop",
    competitorUrl: "https://www.adobe.com/products/photoshop.html",
    sourceLinks: [
      { title: "Adobe Photoshop product page", href: "https://www.adobe.com/products/photoshop.html" },
      { title: "Adobe Creative Cloud plans", href: "https://www.adobe.com/creativecloud/plans.html" },
    ],
    summaryQuestion: "Which is better for scanlation teams: Photoshop or KOMA Studio?",
    summaryAnswer:
      "Photoshop is stronger when deep manual image editing is the real requirement. KOMA is stronger when translation, cleanup, lettering, redraw, and QA need to move inside one operational workflow.",
    summaryTakeaways: [
      "Photoshop wins on broad manual editing depth",
      "KOMA wins on workflow continuity",
      "Teams outgrow Photoshop when handoffs become the main pain",
    ],
    comparisonRows: [
      {
        label: "Primary role",
        koma: "Purpose-built for scanlation workflow continuity.",
        competitor: "General-purpose raster editing and compositing tool with deep manual control and AI-assisted image editing.",
      },
      {
        label: "Pricing model",
        koma: "MIT-licensed and free forever — no credits, no seats. You only pay the AI provider you choose, or run a local model and pay nothing.",
        competitor: "Subscription software, with Photoshop listed publicly at US$22.99/month on Adobe's annual billed monthly plan.",
      },
      {
        label: "Best use case",
        koma: "Running a chapter through multiple production stages with less tool switching.",
        competitor: "Detailed manual editing, compositing, and retouch work where deep canvas control is the main requirement.",
      },
      {
        label: "Operational feel",
        koma: "Built to act like a chapter workspace.",
        competitor: "Acts like a powerful editor, not a dedicated scanlation pipeline with translation, OCR, or QA structure.",
      },
    ],
    cleaner: {
      provider: {
        description:
          "Manual cleaning and redraw can be extremely strong in Photoshop, especially with experienced editors and Adobe's AI-assisted object removal tools. The downside is that the workflow layer still has to be invented and maintained by the team.",
        quality: "excellent",
        notes: [
          "Powerful manual control",
          "Desktop, web, and mobile access are available in the Photoshop plan",
          "Requires more process discipline around each chapter",
          "Less workflow guidance for repeated team handoffs",
        ],
      },
      koma: KOMA_CLEANER,
    },
    typeset: {
      provider: {
        description:
          "Photoshop can produce strong typesetting, but it behaves like a general editor rather than a lettering workflow built specifically for scanlation pace and QA continuity.",
        quality: "good",
        notes: [
          "Deep manual control remains a strength",
          "Teams still build the workflow layer themselves",
          "Consistency depends more on team process than product structure",
        ],
      },
      koma: KOMA_TYPESET,
    },
    sections: [
      {
        title: "Where Photoshop is still strong",
        content:
          "Photoshop is still one of the most capable image-editing tools available. If the main problem is highly bespoke manual editing, compositing, or retouch work, it remains a serious option.",
      },
      {
        title: "Why scanlation teams outgrow Photoshop-as-workflow",
        content:
          "The friction starts when the team is no longer just editing a page. Translation context, cleanup, lettering, redraw, QA, and chapter handoff all happen around Photoshop rather than inside it. That usually means more hidden process debt.",
        bullets: [
          "Chapter continuity lives in the team's process, not in the tool structure",
          "Manual power is high, but operational overhead stays high too",
          "The editor is strong; the workflow layer is still something you have to invent",
        ],
      },
      {
        title: "Bottom line",
        content:
          "Choose Photoshop if your core need is a broad manual editing environment. Choose KOMA if your team needs a dedicated scanlation workflow where translation, cleanup, lettering, redraw, and QA stop fighting each other.",
      },
    ],
    faqs: [
      {
        question: "Is KOMA trying to replace every advanced Photoshop capability?",
        answer:
          "No. The argument is about workflow fit, not pretending a scanlation-focused product should mimic every general-purpose editing feature Photoshop has accumulated over years.",
      },
      {
        question: "Why compare KOMA with Photoshop at all?",
        answer:
          "Because many scanlation teams still use Photoshop as the backbone of the workflow, even when the real pain is operational fragmentation rather than missing editor power.",
      },
    ],
    relatedPages: [
      { title: "Compare KOMA Studio", href: "/compare" },
      { title: "Manga Cleaning & Redraw Tool", href: "/manga-cleaning-redraw-tool" },
      { title: "Workflow", href: "/workflow" },
    ],
  },
  {
    slug: "aimangatranslate-vs-koma-studio",
    type: "versus",
    title: "AI Manga Translate vs KOMA Studio",
    metaTitle: "AI Manga Translate vs KOMA Studio for Chapter Workflow Teams",
    metaDescription:
      "Compare AI Manga Translate vs KOMA Studio. See the trade-off between translator-first convenience and a broader scanlation workflow built for chapter production.",
    keywords: [
      "ai manga translate vs koma studio",
      "ai manga translate alternative",
      "manga translator comparison",
    ],
    heroTitle:
      "AI Manga Translate vs KOMA Studio: Translator-First Convenience or Full Chapter Workflow?",
    heroSubtitle:
      "AI Manga Translate combines web translation, model switching, OCR options, and file support for formats like PDF, EPUB, and CBZ. KOMA becomes the better fit when the chapter still has to survive cleanup, lettering, redraw, and QA.",
    intro:
      "This comparison matters for teams deciding whether translation tooling with flexible OCR/model controls is enough, or whether they need a desktop workflow that carries the page through the rest of production.",
    competitorName: "AI Manga Translate",
    competitorUrl: "https://aimangatranslate.com/",
    sourceLinks: [
      { title: "AI Manga Translate pricing", href: "https://aimangatranslate.com/pl/price" },
      { title: "AI Manga Translate homepage", href: "https://aimangatranslate.com/pl" },
    ],
    summaryQuestion: "Which is better for scanlation teams: AI Manga Translate or KOMA Studio?",
    summaryAnswer:
      "AI Manga Translate is stronger when flexible OCR/model controls and web translation are the priority. KOMA is stronger when translation has to feed directly into cleanup, lettering, redraw, and QA.",
    summaryTakeaways: [
      "AI Manga Translate is more translator-first",
      "KOMA is broader after the first draft",
      "The tradeoff is web translation flexibility versus workflow continuity",
    ],
    comparisonRows: [
      {
        label: "Primary value",
        koma: "Integrated chapter workflow from translation through final review.",
        competitor: "Web-based manga translation with multiple OCR/model choices, extension support, and file translation.",
      },
      {
        label: "Pricing model",
        koma: "MIT-licensed and free forever — no credits, no seats. You only pay the AI provider you choose, or run a local model and pay nothing.",
        competitor: "Pay-as-you-go packs and subscriptions, with public starter pricing around $6.90 for ~300 translations and higher packs for heavier use.",
      },
      {
        label: "File and model support",
        koma: "Designed around chapter continuity inside one app.",
        competitor: "Supports JPG, PNG, WEBP, PDF, EPUB, and CBZ plus multiple OCR and MT model options in the web app and extension.",
      },
      {
        label: "Post-translation continuity",
        koma: "Cleanup, typesetting, redraw, and QA stay inside the same app.",
        competitor: "Translation is strong, but teams still need another environment for cleanup, lettering, chapter review, and final sign-off.",
      },
    ],
    cleaner: {
      provider: {
        description:
          "AI Manga Translate includes OCR, layout controls, and inpainting-oriented translation output, so it covers more of the page than a bare translator. Even so, cleaning and redraw are still anchored to a web translation flow rather than a broader chapter production workspace.",
        quality: "good",
        notes: [
          "Supports multiple OCR and MT models, including offline and premium options",
          "Works in the web app and extension with file translation support",
          "Still weaker than a dedicated desktop workflow once redraw becomes part of team QA",
        ],
      },
      koma: KOMA_CLEANER,
    },
    typeset: {
      provider: {
        description:
          "AI Manga Translate includes text direction controls and translation layout options, so it is more capable than a simple translator. Production teams still need another environment for polished chapter lettering and QA continuity.",
        quality: "good",
        notes: [
          "Multiple model switching and layout controls are available",
          "Better than a basic translator when page output matters",
          "Still not a full lettering workspace for chapter review and release management",
        ],
      },
      koma: KOMA_TYPESET,
    },
    sections: [
      {
        title: "Where AI Manga Translate is strong",
        content:
          "AI Manga Translate is worth evaluating when you want flexible OCR/model choices, browser extension support, and file translation for formats like PDF, EPUB, and CBZ. It is more capable than a bare image translator and clearly built around manga-specific translation needs.",
      },
      {
        title: "Where KOMA is broader",
        content:
          "KOMA is stronger when the work does not stop at translated text. If your workflow still includes cleanup, redraw, lettering, review, and chapter coordination, the integrated desktop structure matters more than a web-first translation environment.",
        bullets: [
          "Broader workflow fit beyond AI translation",
          "Stronger alignment with scanlation release work",
          "Better internal continuity for teams, not only individual experiments",
        ],
      },
      {
        title: "Bottom line",
        content:
          "Choose AI Manga Translate if fast AI translation is the center of the job. Choose KOMA if the chapter still needs to become a polished release after translation exists.",
      },
    ],
    faqs: [
      {
        question: "Is this comparison mostly about translation quality?",
        answer:
          "No. The bigger difference is workflow scope: translation-only convenience versus a desktop environment built for full chapter production.",
      },
      {
        question: "Who should lean toward KOMA here?",
        answer:
          "Teams that still need cleanup, lettering, redraw, and QA inside the same system will usually see the larger advantage.",
      },
    ],
    relatedPages: [
      { title: "AI Manga Translator", href: "/ai-manga-translator" },
      { title: "Compare KOMA Studio", href: "/compare" },
      { title: "Mangaday vs KOMA Studio", href: "/mangaday-vs-koma-studio" },
    ],
  },
  {
    slug: "mangaday-vs-koma-studio",
    type: "versus",
    title: "Mangaday vs KOMA Studio",
    metaTitle: "Mangaday vs KOMA Studio for Manga Translation and Production",
    metaDescription:
      "Compare Mangaday vs KOMA Studio. Learn when a quota-driven translation product is enough and when a desktop-native scanlation workflow is the better fit.",
    keywords: [
      "mangaday vs koma studio",
      "mangaday alternative",
      "manga translation workflow comparison",
    ],
    heroTitle:
      "Mangaday vs KOMA Studio: Quota-Friendly Translation Tool or Workflow-Native Desktop App?",
    heroSubtitle:
      "Mangaday combines a browser extension, file translator support for PDF/EPUB/MOBI, and scan translation with credits or paid plans. KOMA becomes more compelling when the workflow must keep moving past translation into production and QA.",
    intro:
      "If your team already knows Mangaday, the real question is whether translation convenience is enough or whether the chapter still needs a larger workflow system after translation.",
    competitorName: "Mangaday",
    competitorUrl: "https://mangaday.ai/",
    sourceLinks: [
      { title: "Mangaday homepage", href: "https://mangaday.ai/" },
      { title: "Mangaday pricing", href: "https://mangaday.ai/pricing/" },
    ],
    summaryQuestion: "Which is better for scanlation teams: Mangaday or KOMA Studio?",
    summaryAnswer:
      "Mangaday is stronger when browser extension access, file translation, and lightweight translation convenience are the priority. KOMA is stronger when the chapter still needs a coordinated production workflow after translation.",
    summaryTakeaways: [
      "Mangaday is accessible and translation-led",
      "KOMA is stronger at downstream production work",
      "The biggest difference appears after translation",
    ],
    comparisonRows: [
      {
        label: "Primary focus",
        koma: "Full desktop workflow across translation, cleanup, redraw, lettering, and review.",
        competitor: "Browser extension and file-based manga translation across major sites and document formats.",
      },
      {
        label: "Pricing model",
        koma: "MIT-licensed and free forever — no credits, no seats. You only pay the AI provider you choose, or run a local model and pay nothing.",
        competitor: "Free daily credits for registered users plus monthly, yearly, and non-expiring credit plans.",
      },
      {
        label: "Translation surface",
        koma: "Built around chapter continuity inside one app.",
        competitor: "Supports web translation, file translation, and scan/image translation, including major manga sites and multiple models.",
      },
      {
        label: "Workflow continuity",
        koma: "One system keeps downstream production work in view.",
        competitor: "Translation coverage is broad, but cleanup, redraw review, lettering polish, and release QA usually continue elsewhere.",
      },
    ],
    cleaner: {
      provider: {
        description:
          "Mangaday can preserve page structure during scan translation and supports file/image translation formats, but cleanup and redraw are still part of a translation-led workflow rather than a dedicated production environment.",
        quality: "average",
        notes: [
          "Supports scan/image translation with PNG, JPG, and WEBP uploads",
          "Works well when translation accessibility is the main goal",
          "Still leaves redraw-heavy teams with more downstream tool switching",
        ],
      },
      koma: KOMA_CLEANER,
    },
    typeset: {
      provider: {
        description:
          "Mangaday is better described as a translation and file-reading tool than a dedicated lettering workspace. It can get text onto the page, but chapter typography and review continuity still need another layer.",
        quality: "average",
        notes: [
          "Good fit for users translating pages on manga sites or uploaded files",
          "Less native support for chapter-wide lettering operations",
          "Production polish still leans on external process",
        ],
      },
      koma: KOMA_TYPESET,
    },
    sections: [
      {
        title: "Where Mangaday is strong",
        content:
          "Mangaday is appealing when you want a browser extension and file translator that can work across major manga sites, PDFs, EPUBs, and image uploads without building a bigger pipeline first.",
      },
      {
        title: "Where KOMA becomes the stronger workflow choice",
        content:
          "Once the team still needs cleanup, redraw, typesetting, and QA, the decision changes. KOMA is built for those downstream stages, which makes the workflow more coherent when chapter output quality matters.",
        bullets: [
          "More suited to chapter-scale release work",
          "Stronger fit for teams and repeatable QA",
          "Less dependence on external process glue",
        ],
      },
      {
        title: "Bottom line",
        content:
          "Choose Mangaday if you mainly need an accessible translation utility. Choose KOMA if you need the rest of the scanlation production workflow to live in the same system.",
      },
    ],
    faqs: [
      {
        question: "Is Mangaday a direct workflow substitute for KOMA?",
        answer:
          "The overlap is strongest at translation. KOMA goes further into cleanup, lettering, redraw, and QA workflow continuity.",
      },
      {
        question: "Why would a team move from Mangaday to KOMA?",
        answer:
          "Usually because translated text is no longer the hard part. The harder problem becomes keeping the full release pipeline coherent.",
      },
    ],
    relatedPages: [
      { title: "Compare KOMA Studio", href: "/compare" },
      { title: "Yomu AI vs KOMA Studio", href: "/yomu-vs-koma-studio" },
      { title: "Workflow", href: "/workflow" },
    ],
  },
  {
    slug: "yomu-vs-koma-studio",
    type: "versus",
    title: "Yomu AI vs KOMA Studio",
    metaTitle: "Yomu AI vs KOMA Studio for Manga and Comic Teams",
    metaDescription:
      "Compare Yomu AI vs KOMA Studio. See when AI translation convenience is enough and when a broader chapter workflow becomes the better product fit.",
    keywords: [
      "yomu ai vs koma studio",
      "yomu ai alternative",
      "ai manga translator alternative",
    ],
    heroTitle:
      "Yomu AI vs KOMA Studio: AI Translation Convenience or Desktop Workflow Depth?",
    heroSubtitle:
      "Yomu AI focuses on browser-based manga translation with OCR, inpainting, and reader-friendly tools. KOMA is stronger when the page still needs cleanup, lettering, redraw, and review after translation.",
    intro:
      "If your team already knows Yomu AI, the useful question is whether browser-based translation convenience is enough or whether the chapter still needs a deeper production workflow.",
    competitorName: "Yomu AI",
    competitorUrl: "https://yomumangatranslator.com/",
    sourceLinks: [
      { title: "Yomu homepage", href: "https://yomumangatranslator.com/" },
      { title: "Yomu pricing", href: "https://yomumangatranslator.com/pricing" },
    ],
    summaryQuestion: "Which is better for scanlation teams: Yomu AI or KOMA Studio?",
    summaryAnswer:
      "Yomu AI is stronger when browser-based manga translation convenience is the goal. KOMA is stronger when the same pages still need cleanup, lettering, redraw, and team review after translation.",
    summaryTakeaways: [
      "Yomu AI is reader-side translation first",
      "KOMA is chapter-workflow first",
      "KOMA becomes more valuable as production complexity grows",
    ],
    comparisonRows: [
      {
        label: "Primary strength",
        koma: "Integrated workflow for chapter production.",
        competitor: "Web-based manga translation with manga-specific OCR, inpainting, and reader-focused convenience.",
      },
      {
        label: "Pricing model",
        koma: "MIT-licensed and free forever — no credits, no seats. You only pay the AI provider you choose, or run a local model and pay nothing.",
        competitor: "Free/no-signup positioning on the homepage plus Reader and Pro credit plans on the pricing page.",
      },
      {
        label: "Best fit",
        koma: "Teams that need continuity across roles and stages.",
        competitor: "Solo readers or lightweight translators optimizing for browser-based translation access rather than full release workflow.",
      },
      {
        label: "Operational outcome",
        koma: "Designed to reduce tool switching across a chapter.",
        competitor: "Extension, mobile app, batch translation, and offline workflows are still positioned as coming soon, so teams often need additional tools today.",
      },
    ],
    cleaner: {
      provider: {
        description:
          "Yomu already markets OCR and in-painting for manga pages, so it does more than raw text translation. The limitation is that the surrounding chapter workflow is still lighter, especially where batch and offline production are concerned.",
        quality: "good",
        notes: [
          "Homepage positioning emphasizes manga-specific OCR and background redraw",
          "Good fit for quick reader-side translation in the browser",
          "Batch and offline workflows are still listed as coming soon",
        ],
      },
      koma: KOMA_CLEANER,
    },
    typeset: {
      provider: {
        description:
          "Yomu preserves layout better than generic image translators, but it is still optimized for reading convenience more than for a full lettering and QA workflow across a chapter.",
        quality: "average",
        notes: [
          "Better than generic image translators at preserving manga layout",
          "Less native emphasis on final-page typography and review states",
          "Weaker continuity into QA and team handoffs",
        ],
      },
      koma: KOMA_TYPESET,
    },
    sections: [
      {
        title: "Where Yomu AI is strong",
        content:
          "Yomu AI is worth evaluating if you want browser-based manga translation with OCR, inpainting, and a low-friction reading experience. It is clearly focused on getting you readable translated pages quickly.",
      },
      {
        title: "Where KOMA becomes the better production fit",
        content:
          "The moment translation stops being the finish line, KOMA becomes more relevant. Cleanup, redraw, lettering, and QA benefit from staying in the same desktop workspace rather than branching into separate browser and external processes.",
        bullets: [
          "Stronger fit for teams than isolated translation tasks",
          "Better for repeat chapter operations",
          "More coherent path from raw pages to reviewed release output",
        ],
      },
      {
        title: "Bottom line",
        content:
          "Choose Yomu AI if you mainly want AI translation convenience. Choose KOMA if your workflow still has real production work to do after the translated draft exists.",
      },
    ],
    faqs: [
      {
        question: "Does this comparison say Yomu AI is bad?",
        answer:
          "No. It says the product fits a narrower translation-first intent, while KOMA is built for the broader scanlation production workflow.",
      },
      {
        question: "Who should prefer KOMA in this comparison?",
        answer:
          "Teams that care about chapter continuity, QA, and integrated post-translation production usually have the clearest reason to choose KOMA.",
      },
    ],
    relatedPages: [
      { title: "Compare KOMA Studio", href: "/compare" },
      { title: "Transmonkey vs KOMA Studio", href: "/transmonkey-vs-koma-studio" },
      { title: "Features", href: "/features" },
    ],
  },
  {
    slug: "transmonkey-vs-koma-studio",
    type: "versus",
    title: "Transmonkey vs KOMA Studio",
    metaTitle: "Transmonkey vs KOMA Studio for AI Translation and Workflow Fit",
    metaDescription:
      "Compare Transmonkey vs KOMA Studio. See whether capped translation access is enough for your manga workflow or whether a broader production system is the better choice.",
    keywords: [
      "transmonkey vs koma studio",
      "transmonkey alternative",
      "manga translation workflow alternative",
    ],
    heroTitle:
      "Transmonkey vs KOMA Studio: Translation Access Cap or Full Desktop Workflow?",
    heroSubtitle:
      "Transmonkey is a broader AI translation suite for images, documents, video, speech, and comics. KOMA is the stronger choice when manga production itself is the core job after translation.",
    intro:
      "The key question here is whether a broad AI translator suite is enough for your workflow or whether you need a product built specifically for scanlation production after the text is translated.",
    competitorName: "Transmonkey",
    competitorUrl: "https://www.transmonkey.ai/comic-translator",
    sourceLinks: [
      { title: "Transmonkey comic translator", href: "https://www.transmonkey.ai/comic-translator" },
      { title: "Transmonkey image translator", href: "https://www.transmonkey.ai/image-translator" },
    ],
    summaryQuestion: "Which is better for scanlation teams: Transmonkey or KOMA Studio?",
    summaryAnswer:
      "Transmonkey is stronger when you want one AI service for many translation tasks across media types. KOMA is stronger when manga production itself is the job after translation is done.",
    summaryTakeaways: [
      "Transmonkey is broad across formats",
      "KOMA is focused on scanlation workflow",
      "Comic translation mode is not the same as a chapter workspace",
    ],
    comparisonRows: [
      {
        label: "Primary role",
        koma: "Full scanlation workflow for desktop teams.",
        competitor: "Multi-format AI translation suite with a comic translator mode layered on top.",
      },
      {
        label: "Pricing model",
        koma: "MIT-licensed and free forever — no credits, no seats. You only pay the AI provider you choose, or run a local model and pay nothing.",
        competitor: "Free image usage plus monthly, yearly, and pay-as-you-go credit plans.",
      },
      {
        label: "Best use case",
        koma: "Teams handling chapters from import to review.",
        competitor: "Users who want one AI service for images, documents, videos, and occasional comic translation.",
      },
      {
        label: "Workflow continuity",
        koma: "Cleanup, typesetting, redraw, and QA stay in the product.",
        competitor: "Comic translation is one mode inside a broader translation platform, so production polish usually continues in other tools.",
      },
    ],
    cleaner: {
      provider: {
        description:
          "Transmonkey's comic translator goes beyond raw text output: it uses OCR, context-aware translation, artwork restoration, and bulk upload. It still treats comic translation as one mode inside a broader translation suite rather than a dedicated cleanup and redraw workspace.",
        quality: "average",
        notes: [
          "Comic translator preserves artwork and supports bulk page uploads",
          "The broader product also covers documents, videos, and speech translation",
          "Serious redraw-heavy scanlation teams still need a stronger production layer after translation",
        ],
      },
      koma: KOMA_CLEANER,
    },
    typeset: {
      provider: {
        description:
          "Transmonkey can return translated comic images while keeping layout readable, but it is not positioned as a lettering or QA workspace for scanlation teams.",
        quality: "average",
        notes: [
          "Good for quick translation evaluation",
          "Weaker for polished scanlation lettering and balloon-fit control",
          "Less native workflow continuity into review",
        ],
      },
      koma: KOMA_TYPESET,
    },
    sections: [
      {
        title: "Where Transmonkey is strong",
        content:
          "Transmonkey is useful when your team wants one AI service that can translate images, documents, videos, and comics without committing to a dedicated scanlation environment first.",
      },
      {
        title: "Where KOMA is more complete",
        content:
          "The moment your workflow needs real production structure, KOMA becomes the better answer. Translation is only the first pass for scanlation teams trying to ship a polished chapter.",
        bullets: [
          "Integrated cleanup, redraw, lettering, and QA",
          "Stronger fit for repeated release work",
          "Less dependence on external process glue after translation",
        ],
      },
      {
        title: "Bottom line",
        content:
          "Choose Transmonkey if lightweight translation access is the main need. Choose KOMA if you need a workflow system that keeps the rest of chapter production under control.",
      },
    ],
    faqs: [
      {
        question: "Why compare Transmonkey with KOMA?",
        answer:
          "Because both can surface during AI translation research, but they solve different scopes of the workflow.",
      },
      {
        question: "When does KOMA become the better option?",
        answer:
          "When translation is no longer the whole problem and the team still needs cleanup, lettering, redraw, review, and chapter continuity inside one system.",
      },
    ],
    relatedPages: [
      { title: "Compare KOMA Studio", href: "/compare" },
      { title: "Yomu AI vs KOMA Studio", href: "/yomu-vs-koma-studio" },
      { title: "Download", href: "/download/windows" },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
   Open-source layer applied to every "versus" page
   ══════════════════════════════════════════════════════════════ */

const OSS_COMPARISON_ROW: CompareRow = {
  label: "License, source access and long-term risk",
  koma:
    "MIT-licensed and self-hosted. Read the code, patch it, build your own release, and keep using it even if the project stops moving.",
  competitor:
    "Proprietary product. Features, pricing and availability change at the vendor's discretion, and nothing can be patched from the outside.",
};

const OSS_COMPARISON_SECTION: CompareSection = {
  title: "Licensing and long-term risk",
  content:
    "KOMA Studio is free, open-source software under the MIT license. It runs on your machine, keeps your pages on your disk, and never gates a feature behind a paid tier. The alternative here is hosted and closed: if the pricing changes, the credits run out, or the product is retired, your workflow has to move again.",
  bullets: [
    "KOMA: MIT license, free forever, no credits or seats",
    "Bring your own API key, or run a local model offline",
    "Fork the project instead of waiting for a vendor roadmap",
  ],
};

export const comparePages: ComparePage[] = baseComparePages.map((page) => {
  if (page.type !== "versus") {
    return page;
  }

  return {
    ...page,
    comparisonRows: [...(page.comparisonRows ?? []), OSS_COMPARISON_ROW],
    sections: [...page.sections, OSS_COMPARISON_SECTION],
  };
});

export const comparePageMap = new Map(
  comparePages.map((page) => [page.slug, page]),
);
