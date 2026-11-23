

import {
  AlertTriangle,
  Bot,
  Keyboard,
  Repeat,
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

export const APP_GUIDES_PRODUCTION: GuideEntry[] = [
  toGuide({
    id: 'ai-model-setup',
    category: 'ai-models',
    title: 'Configuring AI Models',
    subtitle:
      'Local models, cloud providers and the runtime.',
    icon: Bot,
    accentColor: 'purple',
    difficulty: 'advanced',
    estimatedTime: '20 min',
    tags: ['ai', 'models', 'setup'],
    sections: [
      {
        id: 'ai-ms-s1',
        title: 'The Model Vault',
        steps: [
          {
            title: 'One window for everything',
            content:
              'The Model Vault splits into a Local Catalog and a Cloud Catalog. Filters narrow it by catalog, by language, and by status — installed, not installed, update available, available in cloud, needs setup. There is also a disk-space indicator and an Install Recommended action that fetches the whole set.',
            tip:
              'Local models are downloaded from Hugging Face through the desktop bridge. The status moves through queued, downloading, verifying and then installed.',
          },
          {
            title: 'The models the pipeline needs',
            content:
              'Detection: RT-DETR v2, Comic Text Detector and PP-DocLayout V3. Segmentation: Baka Content CC. Recognition and translation: the local translation models and the cloud models. Each card shows the VRAM it needs.',
          },
          {
            title: 'The runtime has to be up',
            content:
              'The mini-backend runtime does the heavy work. It is installed and updated from Settings → Updates & runtime, and the footer shows whether it is serving. A model that needs the runtime cannot work while the runtime is down, and the Model Vault refuses to install while it is not.',
            warning:
              'The VRAM requirement is per model, from 6 GB for the small ones to 14 GB for the large ones. A model above the VRAM of your card gets an "above your hardware" badge and falls back to the CPU — which is the difference between a minute and an hour.',
          },
        ],
      },
      {
        id: 'ai-ms-s2',
        title: 'Cloud providers',
        steps: [
          {
            title: 'Key, base URL and model',
            content:
              'A custom profile carries an API key, an API base and a model name. The base URL decides which protocol is used, and the protocol can be set by hand when the automatic detection is wrong. There is a local Ollama preset that points at http://127.0.0.1:11434/v1.',
          },
          {
            title: 'Test before you trust it',
            content:
              'The Model Vault can test a key against the provider before you run a chapter. A key that is wrong is much easier to find there than in the middle of a batch.',
            tip:
              'The service keys live in two places: the provider cards in the Model Vault, and Settings → Integrations for the translation services.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'kb-shortcuts',
    category: 'keyboard-shortcuts',
    title: 'Essential Shortcuts',
    subtitle:
      'The bindings that actually exist, as shipped.',
    icon: Keyboard,
    accentColor: 'cyan',
    difficulty: 'beginner',
    estimatedTime: '5 min',
    tags: ['shortcuts', 'keyboard', 'productivity'],
    sections: [
      {
        id: 'kb-es-s1',
        title: 'Global',
        steps: [
          {
            title: 'The ones you will use every day',
            content:
              'H opens the shortcut centre, where any binding can be changed, and Ctrl+K opens the command palette. Alt+T shows and hides the tools panel. Alt+O peeks at the original page. Ctrl+S saves the workspace, Ctrl+Z and Ctrl+Shift+Z undo and redo it, and Ctrl+= and Ctrl+- zoom.',
            shortcuts: [
              {
                keys: ['H'],
                description:
                  'Open the shortcut centre',
              },
              {
                keys: ['Ctrl', 'K'],
                description:
                  'Open the command palette',
              },
              {
                keys: ['Alt', 'T'],
                description:
                  'Show or hide the tools panel',
              },
              {
                keys: ['Alt', 'O'],
                description:
                  'Peek at the original page',
              },
              {
                keys: ['Alt', 'R'],
                description:
                  'Rotate the active image',
              },
              {
                keys: ['Ctrl', 'S'],
                description:
                  'Save the local workspace',
              },
              {
                keys: ['Ctrl', 'Z'],
                description: 'Undo',
              },
              {
                keys: [
                  'Ctrl',
                  'Shift',
                  'Z',
                ],
                description: 'Redo',
              },
              {
                keys: ['Ctrl', '='],
                description: 'Zoom in',
              },
              {
                keys: ['Ctrl', '-'],
                description: 'Zoom out',
              },
              {
                keys: ['Alt', '1'],
                description:
                  'Paginated view',
              },
              {
                keys: ['Alt', '2'],
                description:
                  'Long strip view',
              },
            ],
          },
        ],
      },
      {
        id: 'kb-es-s2',
        title: 'Modes',
        steps: [
          {
            title: 'Every mode has a combination',
            content:
              'Alt+Shift plus a letter jumps straight to a mode. The letters are not the ones you would guess, which is exactly why they are worth learning once.',
            shortcuts: [
              {
                keys: ['Alt', 'Shift', 'A'],
                description: 'AIO mode',
              },
              {
                keys: ['Alt', 'Shift', 'D'],
                description: 'Translator mode',
              },
              {
                keys: ['Alt', 'Shift', 'L'],
                description:
                  'Cleaner / Redrawer mode',
              },
              {
                keys: ['Alt', 'Shift', 'T'],
                description: 'Typesetter mode',
              },
              {
                keys: ['Alt', 'Shift', 'Q'],
                description:
                  'Proofreader / QC mode',
              },
              {
                keys: ['Alt', 'Shift', 'R'],
                description:
                  'Raw Provider mode',
              },
              {
                keys: ['Alt', 'Shift', 'C'],
                description: 'Stitch mode',
              },
              {
                keys: ['Alt', 'Shift', 'X'],
                description: 'Smart Split mode',
              },
              {
                keys: ['Alt', 'Shift', 'W'],
                description: 'Watermark mode',
              },
              {
                keys: ['Alt', 'Shift', 'E'],
                description:
                  'Enhance Image mode',
              },
              {
                keys: ['Alt', 'Shift', 'G'],
                description: 'Guides mode',
              },
              {
                keys: ['Alt', 'Shift', 'U'],
                description: 'Resources mode',
              },
            ],
          },
        ],
      },
      {
        id: 'kb-es-s3',
        title: 'Typesetting and regions',
        steps: [
          {
            title: 'Working on a selected region',
            content:
              'These only work in the manual path of AIO or in the Typesetter mode, and the ones that act on a region need a region selected.',
            shortcuts: [
              {
                keys: ['Ctrl', 'Enter'],
                description: 'Apply the text',
              },
              {
                keys: ['Ctrl', 'Tab'],
                description:
                  'Select the next region',
              },
              {
                keys: [
                  'Ctrl',
                  'Shift',
                  'Tab',
                ],
                description:
                  'Select the previous region',
              },
              {
                keys: ['Ctrl', 'Alt', 'M'],
                description:
                  'Toggle the multi-bubble mode',
              },
              {
                keys: [
                  'Ctrl',
                  'Shift',
                  'S',
                ],
                description: 'Save a snapshot',
              },
              {
                keys: ['R'],
                description:
                  'Detect or refine the shape of the selected region',
              },
              {
                keys: ['Ctrl', 'Alt', 'P'],
                description:
                  'Apply the active preset',
              },
              {
                keys: ['Enter'],
                description:
                  'Open inline editing of the selected region',
              },
              {
                keys: ['Delete'],
                description:
                  'Remove the selected region',
              },
              {
                keys: ['Ctrl', 'D'],
                description:
                  'Duplicate the selected region',
              },
              {
                keys: ['Ctrl', 'Alt', 'A'],
                description:
                  'Apply the automatic shape',
              },
              {
                keys: ['Ctrl', 'Alt', 'S'],
                description:
                  'Convert the shape to a rectangle',
              },
              {
                keys: ['Ctrl', 'Alt', 'O'],
                description:
                  'Convert the shape to an ellipse',
              },
              {
                keys: [
                  'Ctrl',
                  'Alt',
                  '1',
                ],
                description:
                  'Apply the bubble dialogue preset',
              },
              {
                keys: [
                  'Ctrl',
                  'Alt',
                  '2',
                ],
                description:
                  'Apply the free text preset',
              },
              {
                keys: [
                  'Ctrl',
                  'Alt',
                  '3',
                ],
                description:
                  'Apply the sound effect preset',
              },
              {
                keys: [
                  'Ctrl',
                  'Alt',
                  '4',
                ],
                description:
                  'Apply the narration preset',
              },
            ],
          },
        ],
      },
      {
        id: 'kb-es-s4',
        title: 'The manual dock',
        steps: [
          {
            title: 'Single-key editing tools',
            content:
              'In the manual path of AIO and in the Cleaner mode, the dock tools have single-key bindings.',
            shortcuts: [
              {
                keys: ['Alt', 'C'],
                description:
                  'Toggle the configuration panel',
              },
              {
                keys: ['Q'],
                description: 'Select an area',
              },
              {
                keys: ['B'],
                description: 'Segment brush',
              },
              {
                keys: ['E'],
                description: 'Segment eraser',
              },
              {
                keys: ['P'],
                description: 'Paint',
              },
              {
                keys: ['Alt', 'E'],
                description: 'Paint eraser',
              },
              {
                keys: ['W'],
                description: 'Magic wand',
              },
              {
                keys: ['Alt', 'H'],
                description: 'Healing brush',
              },
              {
                keys: [
                  'Ctrl',
                  'Shift',
                  'Delete',
                ],
                description:
                  'Clear all regions on the page',
              },
              {
                keys: [
                  'Ctrl',
                  'Shift',
                  'P',
                ],
                description: 'Clear the paint',
              },
              {
                keys: [
                  'Ctrl',
                  'Shift',
                  'R',
                ],
                description: 'Reset the edits',
              },
            ],
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'auto-batch',
    category: 'automation',
    title: 'Batch Processing',
    subtitle:
      'Queue chapters and let them run.',
    icon: Repeat,
    accentColor: 'rose',
    difficulty: 'advanced',
    estimatedTime: '15 min',
    tags: ['batch', 'automation', 'queue'],
    sections: [
      {
        id: 'auto-b-s1',
        title: 'How a batch is built',
        steps: [
          {
            title: 'A chapter is a group of pages',
            content:
              'A ZIP or a CBZ becomes a chapter in the browser, and a dropped folder becomes one chapter as well. A CB7, a PDF or a PSD is extracted by the runtime and becomes a chapter when the ingest manifest reports one. Loose images share a single chapter until you group them.',
          },
          {
            title: 'Group the loose pages',
            content:
              'Use Select images in the Files header to tick the pages that belong together, then create a chapter and give it a name. Clearing the chapter removes the grouping and leaves the pages in the list.',
          },
          {
            title: 'Run the queue',
            content:
              'Turn on Batch Mode in the pipeline panel of the automatic path and start. It needs at least two chapters, runs them one at a time in list order, and gives each chapter its own preset, which defaults to the AIO setup.',
            tip:
              'Batch mode is disabled when the chapter runs on a cloud OCR or translation service, because those are already parallel.',
          },
          {
            title: 'Keep an eye on it',
            content:
              'The footer shows the chapter you are on and an estimate of the time left. The parallel thread control in the top bar sets how many pages inside a chapter run in parallel, from one to thirty-two.',
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'ts-common-issues',
    category: 'troubleshooting',
    title: 'Common Problems',
    subtitle:
      'What usually goes wrong, and what to do about it.',
    icon: AlertTriangle,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '10 min',
    tags: ['problems', 'errors', 'fixes'],
    sections: [
      {
        id: 'ts-ci-s1',
        title: 'Models and providers',
        steps: [
          {
            title: 'A stage refuses to run',
            content:
              'The readiness check names the problem: a model that is not installed, a model that needs to be selected first, a model that is still on the roadmap, one that needs a key, or one that does not support the language pair you picked. The fix is on the card the message points at.',
            tip:
              'Open the Model Vault from that stage and install what is missing. The stage tells you which one it wants.',
          },
          {
            title: 'The key is rejected',
            content:
              'Test the key from the Model Vault before you run a chapter. A key with a stray space, an expired key and an account with no credit all look the same from the outside.',
          },
          {
            title: 'The engine is busy',
            content:
              'The local engine handles one job at a time per model. When it is already working on something, the page waits. Lower the parallel thread count or wait for the other job to finish.',
          },
        ],
      },
      {
        id: 'ts-ci-s2',
        title: 'Speed and stability',
        steps: [
          {
            title: 'It is much slower than expected',
            content:
              'The most common reason is a model that fell back to the CPU because it did not fit in the VRAM of your card. The card in the Model Vault shows the VRAM each model needs, and carries an "above your hardware" badge when the card is not enough.',
            tip:
              'Close the other heavy applications. The runtime shares the card with everything else that is running.',
          },
          {
            title: 'The runtime is not serving',
            content:
              'The footer shows the runtime state. Open Settings → Updates & runtime to install or update it. Nothing that needs the runtime will work until it is back, and the Model Vault refuses to install while it is down.',
          },
          {
            title: 'Out of disk space',
            content:
              'The Model Vault shows the space it needs before it starts a download, and refuses the install when there is not enough room. The cache manager under Settings → Performance is where the runtime cache is cleared.',
          },
        ],
      },
      {
        id: 'ts-ci-s3',
        title: 'The batch',
        steps: [
          {
            title: 'Batch mode will not start',
            content:
              'It needs at least two chapters, and it is disabled when the run goes through a cloud OCR or translation service. Group the loose pages into chapters first.',
          },
          {
            title: 'A page failed in the middle of a run',
            content:
              'The status line names the stage that failed. Re-run that stage once the cause is fixed — the stages before it keep their result, so you do not pay for the whole chapter again.',
          },
        ],
      },
    ],
  })
];

export default APP_GUIDES_PRODUCTION;
