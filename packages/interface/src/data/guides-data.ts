/* ============================================================
   KŌMA STUDIO — Guides Data Constants
   ============================================================ */

import {
  AlertTriangle,
  Bot,
  CheckSquare,
  Eraser,
  Keyboard,
  Languages,
  Layers,
  RefreshCw,
  Repeat,
  Sparkles,
  Type,
  Zap,
} from 'lucide-react';

import type {
  GuideCategoryMeta,
  GuideEntry,
  GuideSection,
  GuideStep,
  GuideStepType,
} from './guides-types';

/* ---------- Category Metadata ---------- */

export const GUIDE_CATEGORIES: GuideCategoryMeta[] = [
  {
    id: 'quick-start',
    label: 'Quick Start',
    icon: Zap,
    description: 'Start using KOMA Studio in minutes.',
    accentColor: 'amber',
  },
  {
    id: 'workflows',
    label: 'Workflows & Pipelines',
    icon: Layers,
    description: 'Workflows optimized for scanlation.',
    accentColor: 'purple',
  },
  {
    id: 'tools-translator',
    label: 'Translator',
    icon: Languages,
    description: 'Integrated translation tools and techniques.',
    accentColor: 'cyan',
  },
  {
    id: 'tools-typesetter',
    label: 'Typesetter',
    icon: Type,
    description: 'Text placement, typography and fonts.',
    accentColor: 'rose',
  },
  {
    id: 'tools-cleaner',
    label: 'Cleaner / Redrawer',
    icon: Eraser,
    description: 'Balloon cleaning and area redrawing.',
    accentColor: 'emerald',
  },
  {
    id: 'tools-qc',
    label: 'Quality Checker',
    icon: CheckSquare,
    description: 'Quality review and final verification.',
    accentColor: 'amber',
  },
  {
    id: 'ai-models',
    label: 'AI Models',
    icon: Bot,
    description: 'Configuring and using artificial intelligence models.',
    accentColor: 'purple',
  },
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard Shortcuts',
    icon: Keyboard,
    description: 'Master the shortcuts for maximum productivity.',
    accentColor: 'cyan',
  },
  {
    id: 'automation',
    label: 'Automation & Batch',
    icon: Repeat,
    description: 'Batch processing and advanced automation.',
    accentColor: 'rose',
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    icon: AlertTriangle,
    description: 'Diagnosing and fixing common errors.',
    accentColor: 'amber',
  },
];

/* ---------- Guide Entries ---------- */

type GuideStepDraft = Omit<GuideStep, 'id' | 'type'> & Partial<Pick<GuideStep, 'id' | 'type'>>;
type GuideSectionDraft = Omit<GuideSection, 'steps'> & { steps: GuideStepDraft[] };
type GuideEntryDraft = Omit<GuideEntry, 'sections'> & { sections: GuideSectionDraft[] };

const inferGuideStepType = (step: GuideStepDraft): GuideStepType => {
  if (step.type) return step.type;
  if (step.warning) return 'warning';
  if (step.tip) return 'tip';
  if (step.code) return 'code';
  if (step.image) return 'image';
  if (step.checklist) return 'checklist';
  if (step.shortcuts) return 'shortcut-table';
  return 'text';
};

const normalizeGuideSections = (guideId: string, sections: GuideSectionDraft[]): GuideSection[] =>
  sections.map((section) => ({
    ...section,
    steps: section.steps.map((step, index) => ({
      ...step,
      id: step.id ?? `${guideId}-${section.id}-${index + 1}`,
      type: inferGuideStepType(step),
    })),
  }));

const normalizeGuides = (guides: GuideEntryDraft[]): GuideEntry[] =>
  guides.map((guide) => ({
    ...guide,
    sections: normalizeGuideSections(guide.id, guide.sections),
  }));

export const GUIDES: GuideEntry[] = normalizeGuides([
  /* ── Quick Start ── */
  {
    id: 'qs-first-project',
    category: 'quick-start',
    title: 'Your First Project',
    subtitle: 'Create and process your first manga in 5 minutes.',
    icon: Zap,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '5 min',
    tags: ['getting started', 'project', 'upload'],
    sections: [
      {
        id: 'qs-fp-s1',
        title: 'Importing Images',
        steps: [
          {
            title: 'Drag your images into the Dashboard',
            content:
              'Select or drag raw manga images straight into the central Dashboard area. Supported formats: PNG, JPG, WEBP, AVIF and TIFF.',
            tip: 'You can drag entire folders - KOMA imports every image recursively.',
          },
          {
            title: 'Organize the page order',
            content:
              'Images appear in the left sidebar list. Drag to reorder, or use the auto-sort button to sort by file name.',
          },
        ],
      },
      {
        id: 'qs-fp-s2',
        title: 'Fast Processing with AIO',
        steps: [
          {
            title: 'Select the AIO pipeline',
            content:
              'Click the AIO icon (lightning bolt) in the top bar. This enables the all-in-one pipeline that detects text, translates, cleans and typesets automatically.',
          },
          {
            title: 'Configure languages',
            content:
              'Select the source language (e.g. Japanese) and the target language (e.g. English). The system picks the matching translation model.',
            tip: 'For Korean comics, select "Korean" as the source for better detection results.',
          },
          {
            title: 'Start processing',
            content:
              'Click "Process All" or press Ctrl+Shift+Enter. A progress bar shows every stage: Detection, Translation, Cleaning, Typesetting.',
          },
        ],
      },
      {
        id: 'qs-fp-s3',
        title: 'Exporting Results',
        steps: [
          {
            title: 'Review the processed pages',
            content:
              'Browse the pages in the left panel. Compare original vs. processed with the toggle button (shortcut: Tab).',
          },
          {
            title: 'Export the final result',
            content:
              'Click Download (down-arrow icon) in the top toolbar. Choose the format (individual PNG, ZIP or local folder) and the output quality.',
            tip: 'Use "Web Optimized" for WEBP output with a reduced size, ideal for online reading.',
          },
        ],
      },
    ],
  },
  {
    id: 'qs-interface-overview',
    category: 'quick-start',
    title: 'Interface Tour',
    subtitle: 'Get to know every panel and area of the interface.',
    icon: Sparkles,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '8 min',
    tags: ['interface', 'panels', 'tour'],
    sections: [
      {
        id: 'qs-io-s1',
        title: 'Main Layout',
        steps: [
          {
            title: 'Barra Superior (Top Bar)',
            content:
              'Contains: the KOMA logo, the mode selector (AIO, Translator, Cleaner, etc.), quick actions (download, settings) and the user profile menu.',
          },
          {
            title: 'Left Sidebar',
            content:
              'Lists the pages of the current project. Shows thumbnails and processing status (colored indicators), and supports drag-and-drop reordering.',
          },
          {
            title: 'Central Area (Stage)',
            content:
              'Displays the current page at full resolution. Supports zoom (scroll), pan (click and drag) and an overlay of detected text boxes.',
          },
          {
            title: 'Right Sidebar (Tools Panel)',
            content:
              'Contextual tools that change with the active mode. For example, in Translator mode it shows detected text and translation fields.',
          },
        ],
      },
    ],
  },

  /* ── Workflows ── */
  {
    id: 'wf-aio-pipeline',
    category: 'workflows',
    title: 'Complete AIO Pipeline',
    subtitle: 'End-to-end automated workflow.',
    icon: Layers,
    accentColor: 'purple',
    difficulty: 'intermediate',
    estimatedTime: '12 min',
    tags: ['aio', 'pipeline', 'automation'],
    sections: [
      {
        id: 'wf-aio-s1',
        title: 'Understanding the Pipeline',
        steps: [
          {
            title: 'What is AIO?',
            content:
              'AIO (All-In-One) is the pipeline that runs every scanlation stage in sequence: Text Detection, Recognition (OCR), Translation, Balloon Cleaning, Typesetting. Each stage can be configured individually.',
          },
          {
            title: 'Step Configuration',
            content:
              'In the AIO panel every step has an on/off toggle. Disable the steps you do not need - for example, if you already have translations, turn off Translation and OCR.',
            tip: 'The step order is fixed and optimized. You cannot reorder steps, but you can skip any of them.',
          },
        ],
      },
      {
        id: 'wf-aio-s2',
        title: 'Pipeline Presets',
        steps: [
          {
            title: 'Bundled presets',
            content:
              'KOMA ships with optimized presets: "Manga JP-EN" (Japanese to English, manga fonts), "Manhwa KR-EN" (Korean, webtoon fonts), "Manhua CN-EN" (Simplified Chinese).',
          },
          {
            title: 'Creating custom presets',
            content:
              'Configure each step as you like, then click "Save Preset". Give it a descriptive name and it becomes available for any future project.',
          },
        ],
      },
    ],
  },
  {
    id: 'wf-manual-flow',
    category: 'workflows',
    title: 'Step-by-Step Manual Workflow',
    subtitle: 'Full control over every stage of the process.',
    icon: RefreshCw,
    accentColor: 'purple',
    difficulty: 'intermediate',
    estimatedTime: '15 min',
    tags: ['manual', 'control', 'step-by-step'],
    sections: [
      {
        id: 'wf-mf-s1',
        title: 'Recommended Workflow',
        steps: [
          {
            title: '1. Text Detection',
            content:
              'Switch to "Detect" mode and run detection. Review the detected balloons - adjust boxes manually if needed by clicking and dragging their corners.',
          },
          {
            title: '2. OCR and Translation',
            content:
              'With the text detected, switch to "Translate" mode. OCR extracts the text from each balloon and the translator produces the localized version.',
          },
          {
            title: '3. Cleaning',
            content:
              'In "Clean" mode the AI removes the original text from the balloons. Review areas with complex art behind the text - use the manual eraser for corrections.',
            warning:
              'Balloons with text over detailed artwork may require manual redrawing (RD).',
          },
          {
            title: '4. Typesetting',
            content:
              'In "Type" mode the translated text is applied automatically to the cleaned balloons. Adjust font, size, alignment and position as needed.',
          },
        ],
      },
    ],
  },

  /* ── Tools: Translator ── */
  {
    id: 'tl-basics',
    category: 'tools-translator',
    title: 'Translator Fundamentals',
    subtitle: 'How to use the KOMA translation module.',
    icon: Languages,
    accentColor: 'cyan',
    difficulty: 'beginner',
    estimatedTime: '10 min',
    tags: ['translation', 'languages', 'OCR'],
    sections: [
      {
        id: 'tl-b-s1',
        title: 'Language Configuration',
        steps: [
          {
            title: 'Select the language pair',
            content:
              'In the translation panel, select the source language and the target language. KOMA supports Japanese, Korean, Simplified Chinese, Traditional Chinese, English, Spanish and Portuguese.',
          },
          {
            title: 'Choose the translation engine',
            content:
              'Available options: GPT-4o (best quality), Google Translate (free, fast), DeepL (excellent for European pairs) and local models (Ollama).',
            tip: 'For JP to EN, GPT-4o gives the best results with manga context. Use Google Translate as a cheap fallback.',
          },
        ],
      },
      {
        id: 'tl-b-s2',
        title: 'Editing Translations',
        steps: [
          {
            title: 'Text panel',
            content:
              'Each detected balloon appears as a card in the right sidebar with the original text, the editable translated text, and the detection confidence (%).',
          },
          {
            title: 'Inline editing',
            content:
              'Click any translated text to edit it in place. Press Ctrl+Enter to confirm and move to the next balloon.',
          },
          {
            title: 'Retranslate a single balloon',
            content:
              'Click the refresh icon next to any translation to regenerate just that balloon.',
          },
        ],
      },
    ],
  },

  /* ── Tools: Typesetter ── */
  {
    id: 'ts-typography',
    category: 'tools-typesetter',
    title: 'Typography for Manga',
    subtitle: 'Best practices for font, size and style.',
    icon: Type,
    accentColor: 'rose',
    difficulty: 'intermediate',
    estimatedTime: '12 min',
    tags: ['typography', 'fonts', 'style'],
    sections: [
      {
        id: 'ts-typ-s1',
        title: 'Choosing Fonts',
        steps: [
          {
            title: 'Fonts for regular dialogue',
            content:
              'Use fonts such as CC Wild Words, Anime Ace or Manga Temple for normal dialogue. They stay legible at small sizes and carry the manga feel.',
            tip: 'Avoid Comic Sans. Use Wild Words or Anime Ace for an authentic look.',
          },
          {
            title: 'Fonts for thoughts and narration',
            content:
              'Use italic or lightly serifed fonts such as CC Comicrazy Italic or Manga Temple Italic for inner thoughts. For narration, fonts like CC Meanwhile work well.',
          },
          {
            title: 'Fonts for shouts and emphasis',
            content:
              'For shouts, use bold, high-impact fonts such as Badaboom BB, CC Astro City or anime-style display fonts. Increase the size by 20-30% compared to normal dialogue.',
          },
        ],
      },
      {
        id: 'ts-typ-s2',
        title: 'Text Settings',
        steps: [
          {
            title: 'Size and spacing',
            content:
              'The default size is computed automatically from the balloon area. Adjust it manually when needed. KOMA uses anti-aliasing tuned for screens.',
          },
          {
            title: 'Alignment and line breaks',
            content:
              'Text is centered inside balloons by default. Left-align it in narration boxes. Tweak line breaks to avoid rivers (unwanted vertical gaps).',
          },
        ],
      },
    ],
  },

  /* ── Tools: Cleaner ── */
  {
    id: 'cl-cleaning-basics',
    category: 'tools-cleaner',
    title: 'Cleaning Guide (CL/RD)',
    subtitle: 'Balloon cleaning and redrawing techniques.',
    icon: Eraser,
    accentColor: 'emerald',
    difficulty: 'intermediate',
    estimatedTime: '15 min',
    tags: ['cleaning', 'balloons', 'redraw'],
    sections: [
      {
        id: 'cl-cb-s1',
        title: 'Automatic Cleaning (AI)',
        steps: [
          {
            title: 'How it works',
            content:
              'The AI model analyzes the detected text mask and rebuilds the missing background with inpainting. The result is a clean balloon ready for new text.',
          },
          {
            title: 'Adjusting the mask',
            content:
              'If detection missed part of the text, use the manual mask tool to expand the area. Paint over the remaining text with the mask brush.',
            tip: 'Increase the brush size (shortcut: ] to grow, [ to shrink) to cover larger areas quickly.',
          },
        ],
      },
      {
        id: 'cl-cb-s2',
        title: 'Manual Redrawing',
        steps: [
          {
            title: 'When to redraw',
            content:
              'Manual redrawing is needed when text sits over detailed artwork, for sound effects (SFX) baked into the art, or for irregular balloon borders the AI did not rebuild well.',
          },
          {
            title: 'Redrawing tools',
            content:
              'Use the clone brush (S) to copy nearby textures, the healing brush (H) for automatic blending, or import patches from Photoshop when necessary.',
          },
        ],
      },
    ],
  },

  /* ── Tools: QC ── */
  {
    id: 'qc-review',
    category: 'tools-qc',
    title: 'Quality Review',
    subtitle: 'QC checklists and best practices.',
    icon: CheckSquare,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '8 min',
    tags: ['quality', 'review', 'qc'],
    sections: [
      {
        id: 'qc-r-s1',
        title: 'QC Checklist',
        steps: [
          {
            title: 'Check the translations',
            content:
              'Compare the translated text with the original. Check semantic accuracy, naturalness, term consistency (character names, techniques, etc.) and register (formal vs. informal).',
          },
          {
            title: 'Check the typesetting',
            content:
              'Verify that text stays inside the balloons, fonts are consistent across the chapter, SFX are translated where applicable, and there are no typos.',
          },
          {
            title: 'Check the cleaning',
            content:
              'Look for leftovers of the original text, inpainting artifacts, damaged balloon borders, and blurry or badly aliased fonts.',
          },
        ],
      },
    ],
  },

  /* ── AI Models ── */
  {
    id: 'ai-model-setup',
    category: 'ai-models',
    title: 'Configuring AI Models',
    subtitle: 'Installing and setting up local and cloud models.',
    icon: Bot,
    accentColor: 'purple',
    difficulty: 'advanced',
    estimatedTime: '20 min',
    tags: ['ai', 'models', 'setup'],
    sections: [
      {
        id: 'ai-ms-s1',
        title: 'Cloud Models',
        steps: [
          {
            title: 'OpenAI (GPT-4o)',
            content:
              'Go to Settings > AI Providers > OpenAI and enter your API key. GPT-4o is used for high-quality, context-aware translation.',
            tip: 'Use the "prompt cache" option to reduce costs on large batches.',
          },
          {
            title: 'Google Gemini',
            content:
              'Configure it in Settings > AI Providers > Google. Gemini Pro offers excellent value for batch translation.',
          },
        ],
      },
      {
        id: 'ai-ms-s2',
        title: 'Local Models',
        steps: [
          {
            title: 'Ollama (local LLMs)',
            content:
              'Install Ollama on your system and pull models such as Qwen2.5, Llama 3 or Mistral. In KOMA, set the endpoint in Settings > AI Providers > Ollama > URL (default: localhost:11434).',
          },
          {
            title: 'Detection Models',
            content:
              'KOMA uses specialized models for manga text detection. Go to Settings > Models > Download to fetch the required models (manga-text-detector, bubble-segmenter).',
            warning:
              'The detection models need a GPU with at least 4 GB of VRAM for good performance.',
          },
        ],
      },
    ],
  },

  /* ── Keyboard Shortcuts ── */
  {
    id: 'kb-shortcuts',
    category: 'keyboard-shortcuts',
    title: 'Essential Shortcuts',
    subtitle: 'Complete keyboard shortcut reference.',
    icon: Keyboard,
    accentColor: 'cyan',
    difficulty: 'beginner',
    estimatedTime: '5 min',
    tags: ['shortcuts', 'keyboard', 'productivity'],
    sections: [
      {
        id: 'kb-es-s1',
        title: 'Navigation',
        steps: [
          {
            title: 'Navigating between pages',
            content:
              'Left/Right arrows or A/D - previous/next page. Home/End - first/last page. Ctrl+G - go to a specific page number.',
          },
          {
            title: 'Zoom e viewport',
            content:
              'Ctrl+0 - fit to screen. Ctrl++ / Ctrl+- - zoom in/out. Ctrl+Scroll - smooth zoom. Space+Drag - pan across the image.',
          },
        ],
      },
      {
        id: 'kb-es-s2',
        title: 'Tools',
        steps: [
          {
            title: 'Operating modes',
            content:
              '1 - AIO mode. 2 - Translator mode. 3 - Cleaner mode. 4 - Typesetter mode. 5 - Review mode. Tab - toggle original/processed.',
          },
          {
            title: 'Quick actions',
            content:
              'Ctrl+S - save progress. Ctrl+Z / Ctrl+Y - undo/redo. Ctrl+Shift+Enter - process everything (AIO). Ctrl+E - export. Escape - cancel the current operation.',
          },
        ],
      },
    ],
  },

  /* ── Automation ── */
  {
    id: 'auto-batch',
    category: 'automation',
    title: 'Batch Processing',
    subtitle: 'Automate multiple chapters at once.',
    icon: Repeat,
    accentColor: 'rose',
    difficulty: 'advanced',
    estimatedTime: '15 min',
    tags: ['batch', 'automation', 'queue'],
    sections: [
      {
        id: 'auto-b-s1',
        title: 'Batch Processing',
        steps: [
          {
            title: 'Setting up a batch',
            content:
              'Drag several folders (one per chapter) into KOMA. In AIO mode, enable "Batch Mode" in the controls panel. The system processes each chapter in sequence.',
          },
          {
            title: 'Per-chapter presets',
            content:
              'You can assign a different preset to each chapter in the queue. Useful when different series need different settings.',
            tip: 'For long series with a consistent style, apply the same preset to every chapter for consistency.',
          },
          {
            title: 'Monitoring',
            content:
              'The progress bar shows the current stage, the current chapter and the estimated time remaining. Detailed logs live in Settings > Logs.',
          },
        ],
      },
    ],
  },

  /* ── Troubleshooting ── */
  {
    id: 'ts-common-issues',
    category: 'troubleshooting',
    title: 'Common Problems',
    subtitle: 'Fixes for the most frequent errors.',
    icon: AlertTriangle,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '10 min',
    tags: ['problems', 'errors', 'fixes'],
    sections: [
      {
        id: 'ts-ci-s1',
        title: 'Detection Errors',
        steps: [
          {
            title: 'Text not detected',
            content:
              'If the text was not detected: 1) check that the image is at least 720px wide; 2) confirm the detection model is installed; 3) try a lower threshold in Settings > Detection > Confidence Threshold.',
          },
          {
            title: 'False positives in detection',
            content:
              'Patterns, textures and page numbers can be mistaken for text. Use manual edit mode to delete unwanted boxes (select one and press Delete).',
          },
        ],
      },
      {
        id: 'ts-ci-s2',
        title: 'Translation Errors',
        steps: [
          {
            title: 'Invalid or expired API key',
            content:
              'Go to Settings > AI Providers and check: 1) the key is correct (no stray spaces); 2) the key has not expired; 3) your provider account still has credit/quota.',
          },
          {
            title: 'Truncated or incomplete translation',
            content:
              'This is usually a timeout. Raise it in Settings > Advanced > API Timeout. For long texts, try splitting them into smaller segments.',
          },
        ],
      },
      {
        id: 'ts-ci-s3',
        title: 'Performance Errors',
        steps: [
          {
            title: 'Slow processing',
            content:
              'Check that: 1) the GPU is actually in use (Settings > System > GPU Status); 2) the images are not oversized (>4000px); 3) enough RAM is free (8 GB minimum recommended).',
            tip: 'Close other heavy applications while processing. KOMA uses the GPU for AI model inference.',
          },
          {
            title: 'Crash or freeze',
            content:
              'Restart KOMA and try again. If it persists: 1) clear the cache in Settings > Advanced > Clear Cache; 2) update to the latest version; 3) send the logs (Help > Report Bug).',
            warning:
              'Save your progress often (Ctrl+S) to avoid losing work.',
          },
        ],
      },
    ],
  },
]);

interface RemoteGuideCategoryPayload {
  id: string;
  label: string;
  description: string;
  accentColor: GuideCategoryMeta['accentColor'];
  iconName?: string;
  status?: string;
  sortOrder?: number;
}

interface RemoteGuideEntryPayload {
  id: string;
  categoryId: GuideEntry['category'];
  title: string;
  subtitle: string;
  accentColor: GuideEntry['accentColor'];
  difficulty: GuideEntry['difficulty'];
  estimatedTime: string;
  tags: string[];
  iconName?: string;
  status?: string;
  sortOrder?: number;
  sections: GuideEntry['sections'];
}

const GUIDE_ICON_MAP = {
  AlertTriangle,
  Bot,
  CheckSquare,
  Eraser,
  Keyboard,
  Languages,
  Layers,
  RefreshCw,
  Repeat,
  Sparkles,
  Type,
  Zap,
} as const;

const resolveGuideIcon = (iconName: string | undefined, fallback: keyof typeof GUIDE_ICON_MAP = 'Sparkles') =>
  (iconName && iconName in GUIDE_ICON_MAP
    ? GUIDE_ICON_MAP[iconName as keyof typeof GUIDE_ICON_MAP]
    : GUIDE_ICON_MAP[fallback]);

const GUIDE_CATEGORY_FALLBACK_ICONS: Record<string, keyof typeof GUIDE_ICON_MAP> = {
  'quick-start': 'Zap',
  workflows: 'Layers',
  'tools-translator': 'Languages',
  'tools-typesetter': 'Type',
  'tools-cleaner': 'Eraser',
  'tools-qc': 'CheckSquare',
  'ai-models': 'Bot',
  'keyboard-shortcuts': 'Keyboard',
  automation: 'Repeat',
  troubleshooting: 'AlertTriangle',
};

export const hydrateGuidesCatalog = (payload: {
  categories?: RemoteGuideCategoryPayload[];
  entries?: RemoteGuideEntryPayload[];
}): void => {
  if (!Array.isArray(payload.categories) || !Array.isArray(payload.entries)) {
    return;
  }

  const nextCategories: GuideCategoryMeta[] = payload.categories
    .filter((category) => category.status !== 'draft')
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .map((category) => ({
      id: category.id as GuideCategoryMeta['id'],
      label: category.label,
      description: category.description,
      accentColor: category.accentColor,
      icon: resolveGuideIcon(category.iconName, GUIDE_CATEGORY_FALLBACK_ICONS[category.id] ?? 'Sparkles'),
    }));

  const nextGuides: GuideEntry[] = payload.entries
    .filter((entry) => entry.status !== 'draft')
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .map((entry) => ({
      id: entry.id,
      category: entry.categoryId,
      title: entry.title,
      subtitle: entry.subtitle,
      accentColor: entry.accentColor,
      difficulty: entry.difficulty,
      estimatedTime: entry.estimatedTime,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      icon: resolveGuideIcon(
        entry.iconName,
        GUIDE_CATEGORY_FALLBACK_ICONS[entry.categoryId] ?? 'Sparkles',
      ),
      sections: Array.isArray(entry.sections)
        ? normalizeGuideSections(entry.id, entry.sections as GuideSectionDraft[])
        : [],
    }));

  if (nextCategories.length > 0) {
    GUIDE_CATEGORIES.splice(0, GUIDE_CATEGORIES.length, ...nextCategories);
  }

  if (nextGuides.length > 0) {
    GUIDES.splice(0, GUIDES.length, ...nextGuides);
  }
};
