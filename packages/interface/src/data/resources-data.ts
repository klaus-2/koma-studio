/* ============================================================
   KŌMA STUDIO — Resources Data Constants
   ============================================================ */

import {
  BookOpen,
  Download,
  ExternalLink,
  Globe,
  Headphones,
  MessageSquare,
  Paintbrush,
  Palette,
  ScanLine,
  Sparkles,
  Type,
  Users,
  Wrench,
} from 'lucide-react';

import type {
  CommunityEntry,
  ExternalToolEntry,
  FontEntry,
  GlossaryEntry,
  ResourceCategoryMeta,
  SfxEntry,
} from './guides-types';

/* ---------- Category Metadata ---------- */

export const RESOURCE_CATEGORIES: ResourceCategoryMeta[] = [
  {
    id: 'fonts',
    label: 'resources.data.fontsTitle',
    icon: Type,
    description: 'resources.data.fontsDesc',
    accentColor: 'rose',
    itemCount: 18,
  },
  {
    id: 'sfx-library',
    label: 'SFX Library',
    icon: Headphones,
    description: 'resources.data.onomatopoeiaDesc',
    accentColor: 'purple',
    itemCount: 30,
  },
  {
    id: 'glossary',
    label: 'resources.data.glossaryTitle',
    icon: BookOpen,
    description: 'resources.data.glossaryDesc',
    accentColor: 'cyan',
    itemCount: 25,
  },
  {
    id: 'communities',
    label: 'Communities',
    icon: Users,
    description: 'Discord servers, subreddits and scanlation forums.',
    accentColor: 'emerald',
    itemCount: 8,
  },
  {
    id: 'tools-external',
    label: 'Tools Externas',
    icon: Wrench,
    description: 'Complementary software and useful online tools.',
    accentColor: 'amber',
    itemCount: 10,
  },
];

/* ---------- Fonts ---------- */

export const FONTS_DATA: FontEntry[] = [
  // Dialog Fonts
  {
    name: 'CC Wild Words',
    family: 'CC Wild Words',
    style: 'Regular, Bold, Italic',
    usage: 'Regular dialogue - the most popular font for manga scanlation. Good legibility at every size.',
    license: 'commercial',
    tags: ['dialogue', 'manga', 'popular'],
  },
  {
    name: 'Anime Ace 2.0',
    family: 'Anime Ace',
    style: 'Regular, Bold, Italic',
    usage: 'Regular dialogue - free alternative to CC Wild Words. Legible, with an authentic manga look.',
    license: 'free',
    downloadUrl: 'https://www.dafont.com/anime-ace-bb.font',
    links: [
      { label: 'Download', url: 'https://www.dafont.com/anime-ace-bb.font', kind: 'download' },
      { label: 'Preview', url: 'https://www.dafont.com/anime-ace-bb.font', kind: 'site' },
    ],
    tags: ['dialogue', 'manga', 'free'],
  },
  {
    name: 'Manga Temple',
    family: 'Manga Temple',
    style: 'Regular, Bold',
    usage: 'Regular dialogue - clean, modern style. Excellent for manhwa and manhua.',
    license: 'open-source',
    tags: ['dialogue', 'manhwa', 'modern'],
  },
  {
    name: 'CC Comicrazy',
    family: 'CC Comicrazy',
    style: 'Regular, Italic',
    usage: 'Thoughts and inner monologue - a subtle italic that conveys introspection.',
    license: 'commercial',
    tags: ['thought', 'italic', 'inner'],
  },
  {
    name: 'CC Meanwhile',
    family: 'CC Meanwhile',
    style: 'Regular',
    usage: 'Narration and narration boxes - formal and distinct from dialogue.',
    license: 'commercial',
    tags: ['narration', 'formal', 'box'],
  },
  // Emphasis Fonts
  {
    name: 'Badaboom BB',
    family: 'Badaboom BB',
    style: 'Regular',
    usage: 'Shouts and emphasis - bold and high impact. Ideal for onomatopoeia and exclamations.',
    license: 'free',
    tags: ['shout', 'emphasis', 'impact'],
  },
  {
    name: 'CC Astro City',
    family: 'CC Astro City',
    style: 'Regular, Bold',
    usage: 'Titles and strong emphasis - a display font with striking visual presence.',
    license: 'commercial',
    tags: ['title', 'display', 'emphasis'],
  },
  {
    name: 'Bangers',
    family: 'Bangers',
    style: 'Regular',
    usage: 'SFX and sound effects - American comic style, great for impacts and explosions.',
    license: 'open-source',
    tags: ['sfx', 'impact', 'comic'],
  },
  // Specialty fonts
  {
    name: 'Augie',
    family: 'Augie',
    style: 'Regular',
    usage: 'Notes, letters and handwritten text - simulates natural handwriting.',
    license: 'free',
    tags: ['handwritten', 'letter', 'note'],
  },
  {
    name: 'Digital Strip',
    family: 'Digital Strip',
    style: 'Regular, Bold',
    usage: 'Computer, phone and digital interface text inside the manga.',
    license: 'free',
    tags: ['digital', 'interface', 'tech'],
  },
  {
    name: 'Komika Hand',
    family: 'Komika Hand',
    style: 'Regular, Bold, Italic',
    usage: 'Versatile alternative for multiple contexts - dialogue, narration and light SFX.',
    license: 'free',
    tags: ['versatile', 'handwriting', 'alternative'],
  },
  {
    name: 'Back Issues BB',
    family: 'Back Issues BB',
    style: 'Regular, Italic',
    usage: 'Retro/vintage style - ideal for flashbacks or historical series.',
    license: 'free',
    tags: ['retro', 'vintage', 'flashback'],
  },
  // Asian-capable fonts
  {
    name: 'Noto Sans JP',
    family: 'Noto Sans JP',
    style: 'Light, Regular, Medium, Bold, Black',
    usage: 'Residual or bilingual Japanese text - full kanji, hiragana and katakana support.',
    license: 'open-source',
    downloadUrl: 'https://fonts.google.com/noto/specimen/Noto+Sans+JP',
    links: [
      { label: 'Google Fonts', url: 'https://fonts.google.com/noto/specimen/Noto+Sans+JP', kind: 'download' },
      { label: 'GitHub', url: 'https://github.com/notofonts/noto-cjk', kind: 'docs' },
    ],
    tags: ['japanese', 'CJK', 'bilingual'],
  },
  {
    name: 'Noto Sans KR',
    family: 'Noto Sans KR',
    style: 'Light, Regular, Medium, Bold, Black',
    usage: 'Residual or bilingual Korean text - full Hangul support.',
    license: 'open-source',
    downloadUrl: 'https://fonts.google.com/noto/specimen/Noto+Sans+KR',
    links: [
      { label: 'Google Fonts', url: 'https://fonts.google.com/noto/specimen/Noto+Sans+KR', kind: 'download' },
      { label: 'GitHub', url: 'https://github.com/notofonts/noto-cjk', kind: 'docs' },
    ],
    tags: ['korean', 'CJK', 'bilingual'],
  },
  {
    name: 'Source Han Sans',
    family: 'Source Han Sans',
    style: 'ExtraLight to Heavy (7 weights)',
    usage: 'Universal Pan-CJK - supports Japanese, Korean and Chinese (simplified and traditional).',
    license: 'open-source',
    downloadUrl: 'https://github.com/adobe-fonts/source-han-sans/releases',
    links: [
      { label: 'Releases', url: 'https://github.com/adobe-fonts/source-han-sans/releases', kind: 'download' },
      { label: 'Project', url: 'https://github.com/adobe-fonts/source-han-sans', kind: 'docs' },
    ],
    tags: ['CJK', 'universal', 'multilingual'],
  },
  {
    name: 'M PLUS Rounded 1c',
    family: 'M PLUS Rounded 1c',
    style: 'Regular, Bold',
    usage: 'Cute/kawaii style for shoujo or slice-of-life manga. Soft rounded edges.',
    license: 'open-source',
    tags: ['kawaii', 'rounded', 'shoujo'],
  },
  {
    name: 'Kosugi Maru',
    family: 'Kosugi Maru',
    style: 'Regular',
    usage: 'Casual, friendly Japanese text - good for informal titles.',
    license: 'open-source',
    tags: ['casual', 'japanese', 'informal'],
  },
  {
    name: 'Sawarabi Gothic',
    family: 'Sawarabi Gothic',
    style: 'Regular',
    usage: 'Light, modern Japanese gothic - excellent legibility on screens.',
    license: 'open-source',
    tags: ['gothic', 'modern', 'screen'],
  },
];

/* ---------- SFX Library ---------- */

export const SFX_DATA: SfxEntry[] = [
  // Impact
  { japanese: 'ドン', romaji: 'DON', english: 'BOOM / BAM', category: 'impact', usageNote: 'Dramatic impact, shocking reveal or a striking entrance.', commonIn: 'Battle, drama' },
  { japanese: 'バン', romaji: 'BAN', english: 'BANG', category: 'impact', usageNote: 'Slamming door, gunshot, sharp impact.', commonIn: 'Action' },
  { japanese: 'ガン', romaji: 'GAN', english: 'CLANG / WHAM', category: 'impact', usageNote: 'Metallic or strong solid impact.', commonIn: 'Battle' },
  { japanese: 'ドカ', romaji: 'DOKA', english: 'CRASH / THUD', category: 'impact', usageNote: 'Heavy impact, something falling hard.', commonIn: 'Action' },
  { japanese: 'バキ', romaji: 'BAKI', english: 'CRACK / SNAP', category: 'impact', usageNote: 'Breaking, cracking, a bone snapping.', commonIn: 'Battle, horror' },

  // Emotion
  { japanese: 'ドキドキ', romaji: 'DOKI DOKI', english: 'THUMP THUMP (heartbeat)', category: 'emotion', usageNote: 'Racing heart - nervousness, passion or fear.', commonIn: 'Romance, thriller' },
  { japanese: 'キュン', romaji: 'KYUN', english: 'FLUTTER (heart)', category: 'emotion', usageNote: 'A tightening in the chest - cute, romantic.', commonIn: 'Romance, shoujo' },
  { japanese: 'ガーン', romaji: 'GAAN', english: 'SHOCK!', category: 'emotion', usageNote: 'Comedic shock, an exaggerated surprise reaction.', commonIn: 'Comedy' },
  { japanese: 'ジーン', romaji: 'JIIN', english: '*touched* / *moved*', category: 'emotion', usageNote: 'A feeling of deep emotion, being moved by something.', commonIn: 'Drama' },
  { japanese: 'イライラ', romaji: 'IRA IRA', english: '*irritated* / *annoyed*', category: 'emotion', usageNote: 'Growing irritation, frustration.', commonIn: 'Comedy, SoL' },

  // Ambient
  { japanese: 'ザー', romaji: 'ZAA', english: 'WHOOSH (rain / waterfall)', category: 'ambient', usageNote: 'Heavy rain, a waterfall, running water.', commonIn: 'Drama, action' },
  { japanese: 'シーン', romaji: 'SHIIN', english: '*silence*', category: 'ambient', usageNote: 'Dramatic silence - the "sound" of silence.', commonIn: 'Drama, comedy' },
  { japanese: 'ゴゴゴ', romaji: 'GO GO GO', english: '*menacing rumble*', category: 'ambient', usageNote: 'Menacing aura, a sense of imminent danger.', commonIn: 'JoJo\'s, battle' },
  { japanese: 'ヒュウ', romaji: 'HYUU', english: 'WHOOO (wind)', category: 'ambient', usageNote: 'Blowing wind, a strong breeze.', commonIn: 'Any' },
  { japanese: 'パチパチ', romaji: 'PACHI PACHI', english: 'CRACKLE / CLAP', category: 'ambient', usageNote: 'Crackling fire or applause.', commonIn: 'Any' },

  // Action
  { japanese: 'ダッ', romaji: 'DAH', english: 'DASH!', category: 'action', usageNote: 'A sudden sprint, a quick exit.', commonIn: 'Action, sports' },
  { japanese: 'シュッ', romaji: 'SHUH', english: 'SWOOSH / SWIPE', category: 'action', usageNote: 'Fast movement, a sword swing, a throw.', commonIn: 'Battle' },
  { japanese: 'ビュン', romaji: 'BYUN', english: 'ZOOM / WHOOSH', category: 'action', usageNote: 'Something rushing past at high speed.', commonIn: 'Action' },
  { japanese: 'ドドド', romaji: 'DO DO DO', english: 'RUMBLE RUMBLE', category: 'action', usageNote: 'Tremor, stampede, a running crowd.', commonIn: 'Action, JoJo\'s' },
  { japanese: 'ザシュ', romaji: 'ZASHU', english: 'SLASH!', category: 'action', usageNote: 'A sword cut, a slicing blow.', commonIn: 'Battle' },

  // Voice
  { japanese: 'ハハハ', romaji: 'HA HA HA', english: 'HA HA HA (laugh)', category: 'voice', usageNote: 'Loud, open laughter.', commonIn: 'Any' },
  { japanese: 'フフフ', romaji: 'FU FU FU', english: 'HEH HEH HEH', category: 'voice', usageNote: 'Sinister, smug or mysterious laughter.', commonIn: 'Villain, mystery' },
  { japanese: 'えへへ', romaji: 'EHEHE', english: 'HEH HEH (shy laugh)', category: 'voice', usageNote: 'Embarrassed or awkward laughter.', commonIn: 'Comedy, romance' },
  { japanese: 'ゲホゲホ', romaji: 'GEHO GEHO', english: 'COUGH COUGH', category: 'voice', usageNote: 'Coughing, choking.', commonIn: 'Any' },
  { japanese: 'ため息', romaji: 'FUHH', english: '*sigh*', category: 'voice', usageNote: 'A sigh of tiredness, frustration or relief.', commonIn: 'SoL, drama' },

  // Misc
  { japanese: 'カチカチ', romaji: 'KACHI KACHI', english: 'CLICK CLICK', category: 'misc', usageNote: 'Keyboard, clock, mechanism.', commonIn: 'Any' },
  { japanese: 'ガチャ', romaji: 'GACHA', english: 'CLACK / (door opening)', category: 'misc', usageNote: 'A turning doorknob, a door opening.', commonIn: 'Any' },
  { japanese: 'ピンポン', romaji: 'PIN PON', english: 'DING DONG (doorbell)', category: 'misc', usageNote: 'A doorbell ringing.', commonIn: 'SoL' },
  { japanese: 'ブーブー', romaji: 'BUU BUU', english: 'BUZZ BUZZ (phone)', category: 'misc', usageNote: 'A vibrating phone or a horn.', commonIn: 'Any' },
  { japanese: 'カリカリ', romaji: 'KARI KARI', english: 'SCRIBBLE SCRIBBLE', category: 'misc', usageNote: 'Writing, drawing.', commonIn: 'School, SoL' },
];

/* ---------- Glossary ---------- */

export const GLOSSARY_DATA: GlossaryEntry[] = [
  // General
  { term: 'Scanlation', definition: 'The act of scanning, translating and editing unlicensed manga/manhwa for online distribution. A blend of "scan" + "translation".', category: 'general', relatedTerms: ['fansub', 'scan group'] },
  { term: 'Raw', definition: 'The original unedited image, usually in Japanese/Korean/Chinese. Can be a physical scan or a digital rip.', category: 'general', relatedTerms: ['digital raw', 'scan'] },
  { term: 'Chapter', definition: 'A single manga publication unit, usually 15-25 pages for manga and 40-80+ panels for webtoons.', category: 'general' },
  { term: 'Tankoubon', definition: 'A bound manga volume, usually containing 8-12 chapters. Tankoubon raws are higher quality than magazine raws.', category: 'general' },
  { term: 'Webtoon', definition: 'A digital Korean manhwa format published as long vertical strips optimized for reading on a phone.', category: 'general' },

  // Typesetting
  { term: 'Typesetting (TS)', definition: 'The process of placing translated text into the manga balloons and text areas, including font choice, size and positioning.', category: 'typesetting', relatedTerms: ['lettering', 'font'] },
  { term: 'SFX', definition: 'Sound Effects - manga onomatopoeia (ドン, バン, etc.). They can be translated with an overlay or kept with a footnote.', category: 'typesetting', relatedTerms: ['onomatopoeia', 'SFX translation'] },
  { term: 'Balloon', definition: 'The bounded area where dialogue text is placed. Types: speech, thought, narration, shout, whisper.', category: 'typesetting' },
  { term: 'Kerning', definition: 'Adjusting the spacing between character pairs to improve the visual appearance of the text.', category: 'typesetting' },
  { term: 'Leading', definition: 'Vertical spacing between lines of text. Also called "line-height".', category: 'typesetting' },

  // Cleaning
  { term: 'Cleaning (CL)', definition: 'The process of removing the original text and scan artifacts, and preparing the image to receive translated text.', category: 'cleaning', relatedTerms: ['redraw', 'inpainting'] },
  { term: 'Redraw (RD)', definition: 'Manually redrawing parts of the image damaged by text removal, especially over detailed artwork.', category: 'cleaning', relatedTerms: ['cleaning', 'clone stamp'] },
  { term: 'Inpainting', definition: 'An AI technique that rebuilds removed areas of the image, filling them with plausible content based on the surrounding context.', category: 'cleaning' },
  { term: 'Leveling', definition: 'Adjusting white/black levels to improve image contrast and cleanliness. Essential for physical scan raws.', category: 'cleaning' },
  { term: 'Denoising', definition: 'Removing noise/grain from the image, common in low-quality scans or photos of pages.', category: 'cleaning' },

  // Translation
  { term: 'Localization', definition: 'Adapting the translation to the local audience, including idioms, cultural references and jokes. It goes beyond literal translation.', category: 'translation' },
  { term: 'Honorifics', definition: 'Japanese suffixes such as -san, -kun, -chan, -sama. The community endlessly debates whether to keep or adapt them.', category: 'translation', relatedTerms: ['localization'] },
  { term: 'T/N', definition: 'Translator\'s Note - a note explaining cultural references, untranslatable puns or required context.', category: 'translation' },
  { term: 'MTL', definition: 'Machine Translation - automatic translation (Google Translate, DeepL, etc.). Used as a base that still needs human review.', category: 'translation' },
  { term: 'Proofreading (PR)', definition: 'Reviewing the translated text to fix grammar, consistency and naturalness issues. The last step before publishing.', category: 'translation' },

  // Technical
  { term: 'OCR', definition: 'Optical Character Recognition - technology that extracts text from images. KOMA uses models specialized in Japanese/Korean text.', category: 'technical', relatedTerms: ['text detection'] },
  { term: 'Text Detection', definition: 'Detecting text regions in the image with AI models. It identifies the position, rotation and bounds of each text block.', category: 'technical', relatedTerms: ['OCR', 'bubble detection'] },
  { term: 'Segmentation', definition: 'Splitting the image into distinct regions (text, balloons, art). Used to build precise cleaning masks.', category: 'technical' },
  { term: 'Model', definition: 'In the AI context, a neural network trained for a specific task (detection, OCR, translation, inpainting).', category: 'technical' },

  // Roles
  { term: 'Translator (TL)', definition: 'Responsible for translating the text from the source language into the target language. Requires fluency in both.', category: 'roles' },
];

/* ---------- Communities ---------- */

export const COMMUNITIES_DATA: CommunityEntry[] = [
  {
    name: 'r/scanlation',
    platform: 'reddit',
    url: 'https://reddit.com/r/scanlation',
    description: 'The main scanlation subreddit - tips, recruiting, technical discussion and work showcases.',
    language: 'English',
    memberCount: '25k+',
  },
  {
    name: 'Typesetting Community',
    platform: 'discord',
    url: '#',
    description: 'A Discord server focused on manga typesetting and lettering. Tutorials, critiques and workflows.',
    language: 'English',
    memberCount: '8k+',
  },
  {
    name: 'Scanlators Brasil',
    platform: 'discord',
    url: '#',
    description: 'A Brazilian scanlator community - Portuguese tutorials, recruiting and series discussion.',
    language: 'Portuguese',
    memberCount: '5k+',
  },
  {
    name: 'r/manga',
    platform: 'reddit',
    url: 'https://reddit.com/r/manga',
    description: 'The largest manga subreddit - news, translations, discussion and AMAs with scanlators.',
    language: 'English',
    memberCount: '3M+',
  },
  {
    name: 'MangaDex Forums',
    platform: 'forum',
    url: 'https://forums.mangadex.org',
    description: 'The official MangaDex forum - technical discussion, quality feedback and group coordination.',
    language: 'Multilingual',
  },
  {
    name: 'Webtoon Canvas Community',
    platform: 'forum',
    url: 'https://www.webtoons.com/community',
    description: 'The official Webtoon Canvas community for webcomic creators and translators.',
    language: 'Multilingual',
  },
  {
    name: 'KŌMA Studio Discord',
    platform: 'discord',
    url: '#',
    description: 'The official KOMA Studio server - support, feature requests, showcases and beta testing.',
    language: 'Multilingual',
    memberCount: '2k+',
  },
  {
    name: 'AI Manga Tools',
    platform: 'discord',
    url: '#',
    description: 'A server focused on AI tooling for scanlation - models, pipelines and automation.',
    language: 'English',
    memberCount: '12k+',
  },
];

/* ---------- External Tools ---------- */

export const EXTERNAL_TOOLS_DATA: ExternalToolEntry[] = [
  {
    name: 'Photoshop',
    description: 'Professional image editor. The industry standard for complex redraws and fine adjustments.',
    url: 'https://www.adobe.com/photoshop',
    downloadUrl: 'https://www.adobe.com/products/photoshop/free-trial-download.html',
    links: [
      { label: 'Site', url: 'https://www.adobe.com/photoshop', kind: 'site' },
      { label: 'Download', url: 'https://www.adobe.com/products/photoshop/free-trial-download.html', kind: 'download' },
    ],
    category: 'editing',
    free: false,
    icon: Paintbrush,
  },
  {
    name: 'GIMP',
    description: 'Free and open-source image editor. A solid Photoshop alternative for cleaning and editing.',
    url: 'https://www.gimp.org',
    downloadUrl: 'https://www.gimp.org/downloads/',
    links: [
      { label: 'Site', url: 'https://www.gimp.org', kind: 'site' },
      { label: 'Download', url: 'https://www.gimp.org/downloads/', kind: 'download' },
      { label: 'Docs', url: 'https://docs.gimp.org/', kind: 'docs' },
    ],
    category: 'editing',
    free: true,
    icon: Palette,
  },
  {
    name: 'Tesseract OCR',
    description: 'Google\'s open-source OCR engine. Supports 100+ languages including Japanese and Korean.',
    url: 'https://github.com/tesseract-ocr/tesseract',
    downloadUrl: 'https://github.com/tesseract-ocr/tesseract/releases',
    links: [
      { label: 'GitHub', url: 'https://github.com/tesseract-ocr/tesseract', kind: 'site' },
      { label: 'Releases', url: 'https://github.com/tesseract-ocr/tesseract/releases', kind: 'download' },
      { label: 'Docs', url: 'https://tesseract-ocr.github.io/', kind: 'docs' },
    ],
    category: 'ocr',
    free: true,
    icon: ScanLine,
  },
  {
    name: 'DeepL',
    description: 'Translator with superior quality for European language pairs. An API is available for integration.',
    url: 'https://www.deepl.com',
    downloadUrl: 'https://www.deepl.com/app/',
    links: [
      { label: 'Site', url: 'https://www.deepl.com', kind: 'site' },
      { label: 'App', url: 'https://www.deepl.com/app/', kind: 'download' },
      { label: 'API Docs', url: 'https://developers.deepl.com/docs', kind: 'docs' },
    ],
    category: 'translation',
    free: false,
    icon: Globe,
  },
  {
    name: 'Google Fonts',
    description: 'Free font library. Includes Noto Sans JP/KR/SC and other essential CJK fonts.',
    url: 'https://fonts.google.com',
    links: [
      { label: 'resources.data.catalogLabel', url: 'https://fonts.google.com', kind: 'site' },
      { label: 'Noto Collection', url: 'https://fonts.google.com/noto', kind: 'download' },
    ],
    category: 'fonts',
    free: true,
    icon: Type,
  },
  {
    name: 'DaFont',
    description: 'Free font repository. The "Comic/Cartoon" section has excellent fonts for scanlation.',
    url: 'https://www.dafont.com',
    links: [
      { label: 'Site', url: 'https://www.dafont.com', kind: 'site' },
      { label: 'Comic/Cartoon', url: 'https://www.dafont.com/theme.php?cat=102', kind: 'download' },
    ],
    category: 'fonts',
    free: true,
    icon: Download,
  },
  {
    name: 'MangaDex',
    description: 'The main platform for publishing scanlations. Free uploads with group management.',
    url: 'https://mangadex.org',
    category: 'hosting',
    free: true,
    icon: BookOpen,
  },
  {
    name: 'ImgBB',
    description: 'Free image hosting with an API. Useful for hosting individual pages.',
    url: 'https://imgbb.com',
    category: 'hosting',
    free: true,
    icon: ExternalLink,
  },
  {
    name: 'Ollama',
    description: 'Run LLMs locally on your own machine. Supports Llama 3, Qwen, Mistral and other models.',
    url: 'https://ollama.com',
    downloadUrl: 'https://ollama.com/download',
    links: [
      { label: 'Site', url: 'https://ollama.com', kind: 'site' },
      { label: 'Download', url: 'https://ollama.com/download', kind: 'download' },
      { label: 'Docs', url: 'https://github.com/ollama/ollama/blob/main/README.md', kind: 'docs' },
    ],
    category: 'utility',
    free: true,
    icon: MessageSquare,
  },
  {
    name: 'Waifu2x',
    description: 'Deep-learning image upscaler. Optimized for anime/manga style art.',
    url: 'https://waifu2x.udp.jp',
    category: 'utility',
    free: true,
    icon: Sparkles,
  },
];

interface RemoteResourceCategoryPayload {
  id: string;
  label: string;
  description: string;
  accentColor: ResourceCategoryMeta['accentColor'];
  iconName?: string;
  itemCount?: number;
  status?: string;
  sortOrder?: number;
}

interface RemoteResourceEntryPayload {
  id: string;
  categoryId: ResourceCategoryMeta['id'];
  title: string;
  subtitle: string | null;
  tags: string[];
  iconName?: string | null;
  status?: string;
  sortOrder?: number;
  payload: Record<string, unknown>;
}

const RESOURCE_ICON_MAP = {
  BookOpen,
  Download,
  ExternalLink,
  Globe,
  Headphones,
  MessageSquare,
  Paintbrush,
  Palette,
  ScanLine,
  Sparkles,
  Type,
  Users,
  Wrench,
} as const;

const RESOURCE_CATEGORY_FALLBACK_ICONS: Record<string, keyof typeof RESOURCE_ICON_MAP> = {
  fonts: 'Type',
  'sfx-library': 'Headphones',
  glossary: 'BookOpen',
  communities: 'Users',
  'tools-external': 'Wrench',
};

const resolveResourceIcon = (
  iconName: string | null | undefined,
  fallback: keyof typeof RESOURCE_ICON_MAP = 'BookOpen',
) =>
  (iconName && iconName in RESOURCE_ICON_MAP
    ? RESOURCE_ICON_MAP[iconName as keyof typeof RESOURCE_ICON_MAP]
    : RESOURCE_ICON_MAP[fallback]);

export const hydrateResourcesCatalog = (payload: {
  categories?: RemoteResourceCategoryPayload[];
  entries?: RemoteResourceEntryPayload[];
}): void => {
  if (!Array.isArray(payload.categories) || !Array.isArray(payload.entries)) {
    return;
  }

  const nextCategories: ResourceCategoryMeta[] = payload.categories
    .filter((category) => category.status !== 'draft')
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    .map((category) => ({
      id: category.id as ResourceCategoryMeta['id'],
      label: category.label,
      description: category.description,
      accentColor: category.accentColor,
      icon: resolveResourceIcon(
        category.iconName,
        RESOURCE_CATEGORY_FALLBACK_ICONS[category.id] ?? 'BookOpen',
      ),
      itemCount: typeof category.itemCount === 'number' ? category.itemCount : 0,
    }));

  const publishedEntries = payload.entries
    .filter((entry) => entry.status !== 'draft')
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

  const nextFonts = publishedEntries
    .filter((entry) => entry.categoryId === 'fonts')
    .map((entry) => entry.payload as unknown as FontEntry);

  const nextSfx = publishedEntries
    .filter((entry) => entry.categoryId === 'sfx-library')
    .map((entry) => entry.payload as unknown as SfxEntry);

  const nextGlossary = publishedEntries
    .filter((entry) => entry.categoryId === 'glossary')
    .map((entry) => entry.payload as unknown as GlossaryEntry);

  const nextCommunities = publishedEntries
    .filter((entry) => entry.categoryId === 'communities')
    .map((entry) => entry.payload as unknown as CommunityEntry);

  const nextTools = publishedEntries
    .filter((entry) => entry.categoryId === 'tools-external')
    .map((entry) => {
      const payloadValue = entry.payload as Record<string, unknown>;
      return {
        ...(payloadValue as unknown as Omit<ExternalToolEntry, 'icon'>),
        icon: resolveResourceIcon(entry.iconName ?? (typeof payloadValue.iconName === 'string' ? payloadValue.iconName : null), 'Wrench'),
      } as ExternalToolEntry;
    });

  if (nextCategories.length > 0) {
    RESOURCE_CATEGORIES.splice(0, RESOURCE_CATEGORIES.length, ...nextCategories);
  }
  if (nextFonts.length > 0) {
    FONTS_DATA.splice(0, FONTS_DATA.length, ...nextFonts);
  }
  if (nextSfx.length > 0) {
    SFX_DATA.splice(0, SFX_DATA.length, ...nextSfx);
  }
  if (nextGlossary.length > 0) {
    GLOSSARY_DATA.splice(0, GLOSSARY_DATA.length, ...nextGlossary);
  }
  if (nextCommunities.length > 0) {
    COMMUNITIES_DATA.splice(0, COMMUNITIES_DATA.length, ...nextCommunities);
  }
  if (nextTools.length > 0) {
    EXTERNAL_TOOLS_DATA.splice(0, EXTERNAL_TOOLS_DATA.length, ...nextTools);
  }
};
