

import {
  CheckSquare,
  Eraser,
  Languages,
  Layers,
  RefreshCw,
  Sparkles,
  Type,
  Zap,
} from 'lucide-react';

import type {
  GuideEntry,
  GuideEntryDraft,
} from '../guides-types';

import {
  normalizeGuideSections,
} from './normalize';

const toGuide = (
  draft: GuideEntryDraft,
): GuideEntry => ({
  ...draft,
  origin: 'app',
  sections: normalizeGuideSections(
    draft.id,
    draft.sections,
  ),
});

export const APP_GUIDES_SETUP: GuideEntry[] = [
  toGuide({
    id: 'qs-first-project',
    category: 'quick-start',
    title: 'Your First Project',
    subtitle:
      'From a folder of raws to a finished chapter.',
    icon: Zap,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '8 min',
    tags: ['getting started', 'import', 'export'],
    sections: [
      {
        id: 'qs-fp-s1',
        title: 'Bring the pages in',
        steps: [
          {
            title: 'Drop the files on the sidebar',
            content:
              'The drop zone is the Files block of the left sidebar, not the centre stage. It accepts single images (JPG, PNG, WEBP) and containers (ZIP, PDF, CBZ, CB7, PSD). You can also paste images from the clipboard, and a folder dropped on the sidebar is walked recursively.',
            tip:
              'A ZIP or a CBZ is read in the browser, page by page, so a long chapter opens without waiting for the backend. CB7, PDF and PSD go through the runtime instead.',
          },
          {
            title: 'One archive, one chapter',
            content:
              'Each ZIP or CBZ becomes a single chapter, and each folder you drop in becomes one chapter as well. Images you add on their own share one chapter between them until you group them.',
            warning:
              'A chapter is a group of pages, not a folder on disk. Renaming the folder later does not change the chapter.',
          },
          {
            title: 'Fix the order before you start',
            content:
              'Drag a page in the sidebar to move it, or use the Move up and Move down buttons on the row. The Files header also holds Select images, which is how you tick pages and turn them into a chapter of their own.',
          },
        ],
      },
      {
        id: 'qs-fp-s2',
        title: 'Run the pipeline',
        steps: [
          {
            title: 'Open AIO',
            content:
              'AIO lives in the top bar, under the Main group. It runs six stages in a fixed order: Detect Text, Recognize Text, Get Translations, Segment Text, Clean Image and Render.',
            tip:
              'The stage order is fixed on purpose — each stage consumes the output of the previous one. Turn a stage off, do not reorder them.',
          },
          {
            title: 'Pick the languages',
            content:
              'The source language drives detection, recognition and translation. Ten source languages are available: Korean, Japanese, French, Chinese, English, Russian, German, Dutch, Spanish and Italian. The target list is longer: English, Korean, Japanese, French, Simplified Chinese, Traditional Chinese, Russian, German, Dutch, Spanish, Italian, Turkish, Polish, Portuguese, Brazilian Portuguese, Thai, Vietnamese, Hungarian, Indonesian, Finnish and Arabic.',
          },
          {
            title: 'Start and watch',
            content:
              'Run AIO from the pipeline panel. The stage header advances as each stage finishes, and the canvas follows the page through the stages so you can see where it is.',
          },
        ],
      },
      {
        id: 'qs-fp-s3',
        title: 'Get the result out',
        steps: [
          {
            title: 'Compare before you trust it',
            content:
              'Hold Alt+O to peek at the original page while you work. It is the fastest way to catch a stage that went wrong on a page you were not looking at.',
          },
          {
            title: 'Export',
            content:
              'The export control in the top bar opens a menu with a Format choice (PNG, JPEG or WEBP), a Quality slider for everything but PNG, and a Package choice (PDF, CBZ, CB7 or ZIP). You can also include the raw text, the translation and the inpainted page, and there is a Layered PSD section for the pages that need to go back into Photoshop.',
            tip:
              'The quick export preset "Light WebP (0.6)" is a good default for a web release. CBZ is what most hosting platforms expect.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'qs-interface-overview',
    category: 'quick-start',
    title: 'Interface Tour',
    subtitle:
      'Every region of the Dashboard, and what it is for.',
    icon: Sparkles,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '8 min',
    tags: ['interface', 'panels', 'tour'],
    sections: [
      {
        id: 'qs-io-s1',
        title: 'The four regions',
        steps: [
          {
            title: 'Top bar',
            content:
              'A tab navigation grouped into Main, Production, Utilities and Information. It also carries zoom, the parallel thread control, the view switch between Paginated and Long strip, the sidebar and tools toggles, the export menu and the user menu.',
            tip:
              'The parallel thread control decides how many pages inside a chapter run at the same time. The default is four.',
          },
          {
            title: 'Left sidebar',
            content:
              'Titled Workspace. It carries the local statistics block and the Files list with the count of pages, the Select images and Clear all actions, and the drop zone.',
          },
          {
            title: 'Centre stage',
            content:
              'Shows the active page at full resolution. Ctrl with the wheel zooms, and Shift with the wheel rotates the selected text box.',
          },
          {
            title: 'Right panel',
            content:
              'The tools panel. Its header prints the mode you are in, and its contents change with it: the translation panel lists the detected text, the typesetter panel carries the font and placement controls, and the compare-review overlay sits above the rendered page.',
          },
        ],
      },
      {
        id: 'qs-io-s2',
        title: 'The modes and the dock',
        steps: [
          {
            title: 'Twelve modes, one shortcut each',
            content:
              'AIO, Cleaner / Redrawer, Typesetter, Translator, Raw Provider, Proofreader / QC, Stitch, Smart Split, Watermark, Enhance Image, Guides and Resources. Every one of them has a keyboard shortcut, and the shortcut centre (H) lists them with their current bindings.',
            tip:
              'Raw Provider and Proofreader / QC are still under development and are not in the noir navigation yet. The classic theme shows them.',
          },
          {
            title: 'The dock tools',
            content:
              'In the manual path of AIO and in the Cleaner mode, the dock on the left of the stage carries the editing tools: Select area, Clear page, Segment brush and eraser, Paint and paint eraser, Magic wand and Healing brush. Each one has a single-key binding.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'wf-aio-pipeline',
    category: 'workflows',
    title: 'The AIO Pipeline',
    subtitle:
      'What each of the six stages actually does.',
    icon: Layers,
    accentColor: 'purple',
    difficulty: 'intermediate',
    estimatedTime: '12 min',
    tags: ['aio', 'pipeline', 'automation'],
    sections: [
      {
        id: 'wf-aio-s1',
        title: 'The six stages',
        steps: [
          {
            title: '1 — Detect Text',
            content:
              'A detection model finds the lettering on the page and returns a box for every region, with its position, angle and size. This is the stage that decides what the rest of the pipeline sees. It always runs: the toggle is locked on, because nothing downstream works without it.',
          },
          {
            title: '2 — Recognize Text',
            content:
              'The text inside each detected region is read. The recognition model is chosen per language, so a Japanese page and a Korean page do not go through the same weights.',
          },
          {
            title: '3 — Get Translations',
            content:
              'Each region is translated with the model you picked in the AIO panel. The same panel carries the context options — extra context, translator notes, the image as multimodal context, temperature — that decide how much the model knows about each line.',
          },
          {
            title: '4 — Segment Text',
            content:
              'The page is split into regions: text, balloon, artwork. The result is what the cleaner and the renderer work against.',
          },
          {
            title: '5 — Clean Image',
            content:
              'The original lettering is removed and the background underneath is rebuilt. This stage has two engines: the local one, and Automatic AI Clean.',
            tip:
              'Turn on Automatic AI Clean and the Segment Text stage is locked off — the AI engine takes the whole page and returns a clean one, so the local segmentation has nothing left to do.',
          },
          {
            title: '6 — Render',
            content:
              'The translation is drawn back onto the page with the font, size, alignment and stroke from the render style.',
          },
        ],
      },
      {
        id: 'wf-aio-s2',
        title: 'Presets and batches',
        steps: [
          {
            title: 'Presets are yours, not shipped',
            content:
              'There are no bundled presets. The pipeline panel and Settings → Presets let you build one from the current configuration, scope it to a source language and save it. The panel buttons are Save current, New, Edit, Delete and Open Presets in Settings.',
            tip:
              'The presets live in the local storage of the machine, so a preset you build on one computer is not on the next one.',
          },
          {
            title: 'Batch mode',
            content:
              'Batch mode turns a list of chapters into a queue. Each chapter can carry its own preset, which is what you want when a series mixes a Japanese original with a Korean remake. The footer shows the chapter you are on and an estimate of the time left.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'wf-manual-flow',
    category: 'workflows',
    title: 'Step-by-Step Manual Workflow',
    subtitle:
      'Running the stages yourself, one at a time.',
    icon: RefreshCw,
    accentColor: 'purple',
    difficulty: 'intermediate',
    estimatedTime: '14 min',
    tags: ['manual', 'control', 'step-by-step'],
    sections: [
      {
        id: 'wf-mf-s1',
        title: 'The manual path',
        steps: [
          {
            title: 'Automatic and manual are two sides of AIO',
            content:
              'AIO runs in automatic or manual. Manual hands you the same six stages one at a time, through the stage tabs under the pipeline. Detect Text, Recognize Text and Get Translations are stage tabs inside AIO; cleaning and typesetting are also available as their own modes.',
          },
          {
            title: 'Run one stage at a time',
            content:
              'Each stage has its own tab with its own model picker, and the pipeline panel offers Run Stage, Re-run Stage, Skip, Rewind and Forward. A stage that fails tells you exactly what is missing — a model that is not installed, a key that is not set, a model that does not support the language pair.',
          },
          {
            title: 'Check the detection first',
            content:
              'Run detection on the page and look at the boxes. A missed balloon is invisible to every later stage, so this is the cheapest moment to fix a detection problem.',
            tip:
              'Hold Alt+O to peek at the original while you judge the boxes.',
          },
          {
            title: 'Clean',
            content:
              'Clean the page in the Cleaner / Redrawer mode. The Assisted flow uses the segmentation mask, and the dock tools let you paint the mask by hand where it missed a stroke of text.',
            warning:
              'Text that crossed a face or a patterned background will not come back from an automatic clean. That is a manual redraw, and the Healing brush is the tool for it.',
          },
          {
            title: 'Render',
            content:
              'Typeset the page in the Typesetter mode. Select a region and apply a preset to fill it; the shape detection and the multi-bubble controls live in the contextual dock that opens for the selected region.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'tl-basics',
    category: 'tools-translator',
    title: 'Translator Fundamentals',
    subtitle:
      'Getting a usable translation out of the page.',
    icon: Languages,
    accentColor: 'cyan',
    difficulty: 'beginner',
    estimatedTime: '10 min',
    tags: ['translation', 'languages', 'ocr'],
    sections: [
      {
        id: 'tl-b-s1',
        title: 'Choosing the engine',
        steps: [
          {
            title: 'Services, local models or a cloud LLM',
            content:
              'The translation stage offers three families. Translation services: Google Translate needs no key, DeepL needs your own key, LibreTranslate is a self-hosted server you point at. Local models: OPUS-MT, NLLB-200, Sugoi, M2M100, Sakura, Hunyuan MT and others, downloaded on demand. Cloud LLMs: GPT-4.1 and 4.1-mini, Gemini 2.5, Claude Haiku and Sonnet, Deepseek, Grok and GLM.',
            tip:
              'Google Translate is the default because it always works without setup. The Auto option picks a model from the language pair and the VRAM you have.',
          },
          {
            title: 'Where the keys go',
            content:
              'The DeepL and LibreTranslate settings live in Settings → Integrations, under Translation services. The keys for the cloud and free providers are entered on the provider cards inside the Model Vault.',
          },
          {
            title: 'Context is what makes the difference',
            content:
              'The translation panel can send the surrounding lines, the previous and the next region, the image itself as multimodal context, and your own extra note with each request. That is usually the difference between a line that reads like English and a line that reads like a translation.',
          },
        ],
      },
      {
        id: 'tl-b-s2',
        title: 'Fixing the text by hand',
        steps: [
          {
            title: 'Edit the region, not the page',
            content:
              'Every detected region is a row in the translation panel with the recognised text and the translation. Edit in place, then move on; the render step reads the edited text.',
          },
          {
            title: 'Re-translate one region',
            content:
              'The Execute section carries Re-translate region and Re-translate image, next to Detect + Translate. Re-translating a single region is the fast way to try a different wording without redoing the page.',
          },
          {
            title: 'Take the sheet out',
            content:
              'The translation sheet can be exported as CSV or XLSX and imported back with your corrections, and the import reports what it applied, what it skipped and what it found in conflict. It is the same spreadsheet a group would hand around for proofreading.',
            tip:
              'A name that changes spelling between two regions is the first thing a reader notices. Fix it in both places before the page is rendered.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'ts-typography',
    category: 'tools-typesetter',
    title: 'Typography for Manga',
    subtitle:
      'Font, size and the fit of the text.',
    icon: Type,
    accentColor: 'rose',
    difficulty: 'intermediate',
    estimatedTime: '12 min',
    tags: ['typography', 'fonts', 'style'],
    sections: [
      {
        id: 'ts-typ-s1',
        title: 'The render style',
        steps: [
          {
            title: 'One style drives every region',
            content:
              'A render style carries the font family, the base size, the minimum and maximum size, the line spacing, the alignment, the orientation, the rotation and the stroke. Auto font size shrinks the text until it fits the region instead of letting it overflow.',
            tip:
              'Set the base size a little larger than you think you need. Auto-size only ever shrinks, so a small base size caps how large the text can be.',
          },
          {
            title: 'The typography dock',
            content:
              'The selected region opens a contextual dock with the font family, the size and the auto-fit switch, the line spacing, the alignment, bold, italic, underline and uppercase, the orientation (horizontal, vertical or circular), the rotation and the skew, the fill, the outline, the shadow, the opacity and the hyphenation.',
          },
          {
            title: 'Presets for the four voices',
            content:
              'Presets cover the cases that keep coming back: bubble dialogue, free text, sound effects and narration boxes. Apply one to the selected region, or apply the active preset to everything at once.',
          },
          {
            title: 'Shape the region, not the text',
            content:
              'Detection returns a box; the shape controls turn it into a bubble, a rounded rectangle or an ellipse. Detect or refine the shape of a region before you typeset it, so the text lands on the shape you meant.',
          },
        ],
      },
      {
        id: 'ts-typ-s2',
        title: 'Fonts',
        steps: [
          {
            title: 'The font catalog comes from the system',
            content:
              'The typesetter draws with the fonts the machine can see. The Font Catalog lists the system faces and the ones you imported; Import Font adds a file, and it only works in the desktop app. In the browser build the catalog is empty and the render style falls back to a short list of names.',
            tip:
              'Import the lettering pack once, then refresh the catalog. The Fonts tab of the Resources panel lists the packs the community uses, with the licence each one comes with.',
          },
          {
            title: 'Pick the face for the dialogue, not for the page',
            content:
              'A face drawn for shout dialogue will not read well in a narration box, and a brush face that looks great large falls apart at 14 pixels. Judge the face at the size you will actually typeset it.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'cl-cleaning-basics',
    category: 'tools-cleaner',
    title: 'Cleaning Guide (CL/RD)',
    subtitle:
      'Removing the original lettering without losing the art.',
    icon: Eraser,
    accentColor: 'emerald',
    difficulty: 'intermediate',
    estimatedTime: '15 min',
    tags: ['cleaning', 'balloons', 'redraw'],
    sections: [
      {
        id: 'cl-cb-s1',
        title: 'Three cleaning flows',
        steps: [
          {
            title: 'Assisted',
            content:
              'The local flow. It runs the OCR, the segment model and the clean model (AOT, LaMa Manga Dynamic, OpenCV LaMa or LaMa FP32 512) and gives you Mask Dilation, HD Strategy, Resize Limit, Crop Margin and Crop Trigger Size to control how the mask is built.',
            tip:
              'Mask Dilation at its default of 5 is usually enough. Raise it only when a thin stroke of the original lettering survives the clean.',
          },
          {
            title: 'Automatic AI Clean',
            content:
              'The page goes to an image-to-image model and a clean page comes back. The text regions do not enter the model as masks — they go into the prompt as text, so the model knows what to remove. It handles texture and gradients that a local clean leaves damaged.',
            tip:
              'Give the model the original text of the regions when the page has a lot of small lettering. It removes more when it knows what the words were.',
          },
          {
            title: 'AI SFX',
            content:
              'The narrow flow. It classifies the sound effects on the page and cleans only the ones it approves, which is what you want on a page where the lettering must stay.',
          },
        ],
      },
      {
        id: 'cl-cb-s2',
        title: 'Choosing a provider, and repairing the rest',
        steps: [
          {
            title: 'The protocols',
            content:
              'AI Clean speaks several image-edit protocols: OpenAI chat and image edits, Gemini, Replicate, fal, Stability and Cloudflare Workers AI. The protocol is detected from the API base, and it can be set by hand on the profile when the detection guesses wrong.',
          },
          {
            title: 'Manage the models from the panel',
            content:
              'The Models button on a stage opens the Model Vault, where the model choices live. The AI modes use the AI Model picker and the AI Custom profiles, so there is no need to leave the pipeline to set it up. The additional instructions field is sent with the request as supplementary context for the model.',
          },
          {
            title: 'Repairing what the cleaner broke',
            content:
              'Where the mask missed a stroke of text, paint over the rest with the mask brush. A leftover fragment of the original lettering is the defect a reader spots first.',
            warning:
              'Text that crossed a face, a hand or a patterned background has to be redrawn by hand with the Paint tool and the Healing brush. This is the part of cleaning that no model does for you.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'qc-review',
    category: 'tools-qc',
    title: 'Quality Review',
    subtitle:
      'The last pass before a chapter goes up.',
    icon: CheckSquare,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '8 min',
    tags: ['quality', 'review', 'qc'],
    sections: [
      {
        id: 'qc-r-s1',
        title: 'The compare review',
        steps: [
          {
            title: 'Three views of the same page',
            content:
              'The compare-review overlay, reachable from the render stage, shows two synchronised panes with a three-way switch between Original, Cleaning mask and Rendered. Ctrl with the wheel zooms and a drag pans. This is where you see a mask that leaked, or a page that was cleaned and never rendered.',
            tip:
              'Look at the Cleaning mask view before the Rendered one. A mask that covers the wrong area explains most of what looks wrong in the final page.',
          },
          {
            title: 'The proofreader checklist',
            content:
              'The Proofreader / QC panel carries five checks — untranslated text, empty bubbles, visual artifacts, text alignment and font consistency — with a Run QC button. The automatic pass is not implemented yet; the checklist is there for you to work through by hand.',
            warning:
              'Do not treat the QC run as a verdict. It reports that an analysis started, nothing more.',
          },
          {
            title: 'Three passes over the chapter',
            content:
              'Work through the chapter in this order. The last pass is the only one that catches what the export did wrong.',
            checklist: [
              {
                id: 'qc-r-c1',
                label:
                  'Read the translation against the source',
              },
              {
                id: 'qc-r-c2',
                label:
                  'Look at the page as a picture, zoomed out',
              },
              {
                id: 'qc-r-c3',
                label:
                  'Check the exported file, not the screen',
              },
            ],
          },
        ],
      },
    ],
  }),
];

export default APP_GUIDES_SETUP;
