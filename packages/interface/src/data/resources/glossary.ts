

import type { GlossaryEntry } from '../guides-types';

export const GLOSSARY_DATA: GlossaryEntry[] = [

  {
    term: 'Scanlation',
    definition:
      'The whole pipeline of scanning, translating and editing an unlicensed manga, manhwa or manhua for online distribution. The name is a blend of "scan" and "translation".',
    category: 'general',
    relatedTerms: ['Raw', 'Release', 'Typesetting'],
  },
  {
    term: 'Raw',
    definition:
      'The unedited source image, in its original language. It may be a physical scan of a printed volume or a digital file ripped from a reading site.',
    category: 'general',
    relatedTerms: ['Physical raw', 'Digital raw', 'Tankoubon'],
  },
  {
    term: 'Physical raw',
    definition:
      'A scan of a printed book. The best quality you can get, because it has no reading-site compression on it, but it comes with dust, binding shadows and page curvature.',
    category: 'general',
    relatedTerms: ['Raw', 'Leveling'],
  },
  {
    term: 'Digital raw',
    definition:
      'A file taken straight from a reading platform. Convenient and already cut into pages, but usually compressed and often with the site watermark baked in.',
    category: 'general',
    relatedTerms: ['Raw', 'De-watermarking'],
  },
  {
    term: 'Chapter',
    definition:
      'One unit of publication. A printed manga chapter runs around 15 to 25 pages; a webtoon chapter is one long vertical strip.',
    category: 'general',
    relatedTerms: ['Volume', 'Tankoubon', 'Batch'],
  },
  {
    term: 'Volume',
    definition:
      'A bound book, called a tankoubon in Japanese, holding roughly 8 to 12 chapters. Volume scans are the most reliable source when a magazine release is missing.',
    category: 'general',
    relatedTerms: ['Chapter', 'Tankoubon'],
  },
  {
    term: 'Webtoon',
    definition:
      'The Korean vertical-scroll format published on Webtoon and WEBTOON Canvas. Every chapter is one long image that a reader scrolls through on a phone.',
    category: 'general',
    relatedTerms: ['Stitching', 'Manhwa'],
  },
  {
    term: 'Manhwa',
    definition:
      'Korean comics. Same vertical-scroll layout as a webtoon, but the term usually covers the printed and web releases alike.',
    category: 'general',
    relatedTerms: ['Webtoon', 'Stitching'],
  },
  {
    term: 'Manhua',
    definition:
      'Chinese comics, in the same scrolling layout. The source pages are often landscape, which changes how you slice them.',
    category: 'general',
    relatedTerms: ['Webtoon', 'Stitching'],
  },
  {
    term: 'Release',
    definition:
      'A finished chapter published under a group name. The release is what gets proofread and uploaded; everything before it is work in progress.',
    category: 'general',
    relatedTerms: ['Batch', 'QC'],
  },
  {
    term: 'Batch',
    definition:
      'Several chapters translated and typeset together, then released on a schedule. Working in batches spreads the cost of a slow stage across more chapters.',
    category: 'general',
    relatedTerms: ['Chapter', 'Release'],
  },

  {
    term: 'Typesetting',
    definition:
      'Placing the translated text into the balloons and text areas of the page: font, size, line breaks, alignment and position. Often shortened to TS.',
    category: 'typesetting',
    relatedTerms: ['Typesetter', 'Balloon', 'Kerning'],
  },
  {
    term: 'Typesetter',
    definition:
      'The person doing the typesetting. The letterer is the subset of that job that focuses on drawing the letters inside the balloons by hand.',
    category: 'typesetting',
    relatedTerms: ['Typesetting', 'Lettering'],
  },
  {
    term: 'Lettering',
    definition:
      'Hand-drawing the letters instead of typing them. It costs far more time and buys an authentic look, so it is reserved for series that sell on style.',
    category: 'typesetting',
    relatedTerms: ['Typesetting', 'Balloon'],
  },
  {
    term: 'Balloon',
    definition:
      'The bubble the dialogue sits in. Common shapes are speech, thought, narration, shout and whisper, and each one wants a different font weight.',
    category: 'typesetting',
    relatedTerms: ['Typesetting', 'Bubbling'],
  },
  {
    term: 'Bubbling',
    definition:
      'Reshaping a balloon so the new text fits inside it, which means redrawing the outline after every edit to the wording.',
    category: 'typesetting',
    relatedTerms: ['Balloon', 'Redraw'],
  },
  {
    term: 'Kerning',
    definition:
      'Adjusting the space between specific letter pairs to make the word look even. A font with bad kerning reads as sloppy at any size.',
    category: 'typesetting',
    relatedTerms: ['Leading', 'Typesetting'],
  },
  {
    term: 'Leading',
    definition:
      'The vertical space between two lines of text, also called line height. Too much of it makes a balloon look empty; too little makes it look crowded.',
    category: 'typesetting',
    relatedTerms: ['Kerning', 'Typesetting'],
  },
  {
    term: 'SFX',
    definition:
      'Sound effects drawn into the artwork: ドン, バン, ザシュ and the rest. They can be translated in place, kept as-is with a note, or removed.',
    category: 'typesetting',
    relatedTerms: ['Onomatopoeia', 'SFX translation'],
  },
  {
    term: 'SFX translation',
    definition:
      'Replacing the drawn sound effect with the English equivalent. It has to match the shape of the original, so some sounds are left alone on purpose.',
    category: 'typesetting',
    relatedTerms: ['SFX', 'Typesetting'],
  },
  {
    term: 'Speedlines',
    definition:
      'The radiating lines that show movement or focus. Sometimes they are part of the original art and sometimes the typesetter adds them.',
    category: 'typesetting',
    relatedTerms: ['Screentone', 'Toning'],
  },

  {
    term: 'Cleaning',
    definition:
      'Removing the original text from the page and repairing the background underneath it, so the new text has somewhere clean to go. Often shortened to CL.',
    category: 'cleaning',
    relatedTerms: ['Redraw', 'Inpainting', 'Segmentation'],
  },
  {
    term: 'Redraw',
    definition:
      'Repairing by hand the parts of the artwork the automatic cleaner damaged, usually where the text crossed a detailed drawing. Often shortened to RD.',
    category: 'cleaning',
    relatedTerms: ['Cleaning', 'Clone stamp'],
  },
  {
    term: 'Inpainting',
    definition:
      'An AI technique that fills a removed area with plausible content, inferring the background from the pixels around it.',
    category: 'cleaning',
    relatedTerms: ['Cleaning', 'Mask'],
  },
  {
    term: 'Mask',
    definition:
      'The region the cleaner is allowed to touch. A mask that missed a stroke of text leaves that stroke on the page, so masking is where most of the review time goes.',
    category: 'cleaning',
    relatedTerms: ['Inpainting', 'Segmentation'],
  },
  {
    term: 'Segmentation',
    definition:
      'Splitting the page into regions — text, balloon, artwork — so each one can be handled by the right model and the right mask.',
    category: 'cleaning',
    relatedTerms: ['Mask', 'Detection'],
  },
  {
    term: 'Leveling',
    definition:
      'Adjusting the black and white points of an image to bring back contrast. It matters most for physical scans, which are usually grey and flat.',
    category: 'cleaning',
    relatedTerms: ['Denoising', 'Physical raw'],
  },
  {
    term: 'Denoising',
    definition:
      'Removing scanner grain and JPEG noise without taking the ink lines with it. Aggressive denoising is what makes a page look plastic.',
    category: 'cleaning',
    relatedTerms: ['Leveling', 'JPEG artifacts'],
  },
  {
    term: 'Screentone',
    definition:
      'The halftone pattern that fills a shaded area. Tiling it at a non-repeating offset is what keeps a background from looking like wallpaper.',
    category: 'cleaning',
    relatedTerms: ['Toning', 'Speedlines'],
  },
  {
    term: 'Toning',
    definition:
      'Adjusting the tone of a screentone so it sits correctly over the artwork instead of glowing on top of it.',
    category: 'cleaning',
    relatedTerms: ['Screentone', 'Speedlines'],
  },

  {
    term: 'Translation',
    definition:
      'Rendering the Japanese, Korean or Chinese into the target language. For a scanlation it is only half of the translator’s job; the other half is the notes.',
    category: 'translation',
    relatedTerms: ['Localization', 'Honorifics', "Translator's note"],
  },
  {
    term: 'Localization',
    definition:
      'Adapting a translation for the target audience: idioms, jokes, food, honorifics and anything that would otherwise land flat.',
    category: 'translation',
    relatedTerms: ['Translation', 'Honorifics'],
  },
  {
    term: 'Honorifics',
    definition:
      'The Japanese suffixes — san, kun, chan, sama — and the Korean and Chinese equivalents. Keeping or dropping them is the oldest argument in the community.',
    category: 'translation',
    relatedTerms: ['Localization'],
  },
  {
    term: "Translator's note",
    definition:
      'A short note explaining a cultural reference, a pun or a word that will not survive the translation. Often abbreviated T/N.',
    category: 'translation',
    relatedTerms: ['Translation', 'Localization'],
  },
  {
    term: 'MTL',
    definition:
      'Machine translation. Fine as a first pass and as a sanity check on your own work, but it needs a human before it goes anywhere near a reader.',
    category: 'translation',
    relatedTerms: ['Translation', 'Proofreading'],
  },
  {
    term: 'Proofreading',
    definition:
      'Comparing the translation against the source and fixing grammar, consistency and naturalness. Often shortened to PR. This is the last check before a release.',
    category: 'translation',
    relatedTerms: ['QC', 'MTL'],
  },
  {
    term: 'Termbase',
    definition:
      'The agreed translation of recurring names, places and techniques for a series. Without one, a character changes spelling every chapter.',
    category: 'translation',
    relatedTerms: ['Translation', 'Proofreading'],
  },

  {
    term: 'OCR',
    definition:
      'Optical character recognition: reading the characters off the page. In scanlation it is a starting point for the translator, not the finished text.',
    category: 'technical',
    relatedTerms: ['Text detection', 'Segmentation'],
  },
  {
    term: 'Text detection',
    definition:
      'Finding where the lettering is on the page, with its position, angle and bounds. A detection model specialised for vertical Japanese text does much better here.',
    category: 'technical',
    relatedTerms: ['OCR', 'Segmentation', 'Mask'],
  },
  {
    term: 'Model',
    definition:
      'A trained network for one job: detection, recognition, translation or inpainting. Each stage of the pipeline uses a different one.',
    category: 'technical',
    relatedTerms: ['Detection', 'OCR'],
  },
  {
    term: 'Upscaling',
    definition:
      'Making a page larger without losing the line work. The manga-specific models are trained on flat black and white, which is why they beat general ones here.',
    category: 'technical',
    relatedTerms: ['ESRGAN', 'Denoising'],
  },
  {
    term: 'ESRGAN',
    definition:
      'A family of super-resolution networks that rebuild a page from a lower resolution one, with models trained for manga and for webtoon.',
    category: 'technical',
    relatedTerms: ['Upscaling'],
  },
  {
    term: 'Stitching',
    definition:
      'Joining the long vertical images of a webtoon back into page-sized pieces, and then slicing those to the size a reader expects.',
    category: 'technical',
    relatedTerms: ['Webtoon', 'Upscaling'],
  },
  {
    term: 'JPEG artifacts',
    definition:
      'The blocking and ringing that appear when a page is saved as a JPEG too many times. A quantisation-aware tool removes them without softening the lines.',
    category: 'technical',
    relatedTerms: ['Denoising', 'Leveling'],
  },

  {
    term: 'Translator',
    definition:
      'The person who turns the source language into the target one. Often shortened to TL. Needs fluency in both, and a tolerance for jokes that will not fit.',
    category: 'roles',
    relatedTerms: ['Translation', 'Proofreading'],
  },
  {
    term: 'Cleaner',
    definition:
      'The person who removes the original lettering and repairs the page. Often shortened to CL. This is the role most dependent on the raw quality.',
    category: 'roles',
    relatedTerms: ['Cleaning', 'Redraw'],
  },
  {
    term: 'Proofreader',
    definition:
      'The person who checks the translation against the source before release. Often shortened to PR.',
    category: 'roles',
    relatedTerms: ['Proofreading', 'QC'],
  },
  {
    term: 'Scanlation group',
    definition:
      'A team that produces releases together. Usually a translator, one or more typesetters, a cleaner and a proofreader, with a coordinator keeping the schedule.',
    category: 'roles',
    relatedTerms: ['Release', 'Batch'],
  },
  {
    term: 'QC',
    definition:
      'Quality control: the final pass over a finished chapter before it goes up. Translation accuracy, text fitting, leftover original text and font consistency.',
    category: 'roles',
    relatedTerms: ['Proofreading', 'Release'],
  },
  {
    term: 'Ripping',
    definition:
      'Pulling the page images out of a reading site. The tool you use decides how much compression and how many watermarks you have to deal with later.',
    category: 'roles',
    relatedTerms: ['Digital raw', 'De-watermarking'],
  },
  {
    term: 'De-watermarking',
    definition:
      'Removing the watermark a reading site stamps onto the pages. Cleaner raws have no watermark at all, which is the simplest way to avoid the work.',
    category: 'roles',
    relatedTerms: ['Digital raw', 'Ripping'],
  },
];
