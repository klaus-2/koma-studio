

import {
  BookOpen,
  Compass,
  Eraser,
  ShieldCheck,
  Type,
} from 'lucide-react';

import type {
  GuideEntry,
  GuideEntryDraft,
} from '../guides-types';

import {
  normalizeGuideSections,
} from './normalize';

type CommunityGuideDraft = Omit<
  GuideEntryDraft,
  'origin' | 'sourceUrl' | 'sourceLabel' | 'category'
> & {
  sourceUrl: string;
  sourceLabel: string;
};

const toGuide = (draft: CommunityGuideDraft): GuideEntry => ({
  id: draft.id,
  category: 'community-tutorials',
  title: draft.title,
  subtitle: draft.subtitle,
  icon: draft.icon,
  accentColor: draft.accentColor,
  difficulty: draft.difficulty,
  estimatedTime: draft.estimatedTime,
  tags: draft.tags,
  origin: 'community',
  sourceUrl: draft.sourceUrl,
  sourceLabel: draft.sourceLabel,
  sections: normalizeGuideSections(
    draft.id,
    draft.sections,
  ),
});

export const COMMUNITY_GUIDES: GuideEntry[] = [
  toGuide({
    id: 'ct-raw-preparation',
    title: 'Choosing a raw and preparing the page',
    subtitle:
      'Get the cleanest source you can before you touch a single balloon.',
    icon: Compass,
    accentColor: 'cyan',
    difficulty: 'beginner',
    estimatedTime: '12 min',
    tags: ['raws', 'preparation', 'stitching', 'compression'],
    sourceUrl: 'https://yuri-project.net/wiki/Physical_Raws',
    sourceLabel: 'Yuri Project Wiki',
    sections: [
      {
        id: 'ct-rp-s1',
        title: 'Where the pages come from',
        steps: [
          {
            title: 'A physical scan is the best you will get',
            content:
              'A scan of the printed volume has no reading-site compression on it, so the lines stay crisp and the screentones stay even. It also gives you dust, binding shadows and the curve of the page near the spine. Every one of those is fixable; lost detail is not.',
            links: [
              {
                label: 'Yuri Project: Physical Raws',
                url: 'https://yuri-project.net/wiki/Physical_Raws',
                kind: 'docs',
              },
            ],
          },
          {
            title: 'A digital raw is faster, and it comes with work',
            content:
              'Pulling pages straight from a reading site gives you a clean cut and no scanning, but the files are compressed, the pages often carry a watermark and the resolution is whatever the site decided to serve. If you go this way, budget time for the cleanup below.',
            tip:
              'Read the compression page before you choose a format to save in. Saving a cleaned page as a high-quality JPEG once is very different from saving it eight times.',
            links: [
              {
                label: 'Yuri Project: Image Compression',
                url: 'https://yuri-project.net/wiki/Image_Compression',
                kind: 'docs',
              },
              {
                label: 'Alex’s Raw Downloader',
                url: 'https://raws.cunny.cloud/',
                kind: 'site',
              },
              {
                label: 'mangadex-downloader',
                url: 'https://mangadex-dl.mansuf.link/en/stable/installation.html',
                kind: 'docs',
              },
            ],
          },
        ],
      },
      {
        id: 'ct-rp-s2',
        title: 'Undoing what the download did to the page',
        steps: [
          {
            title: 'Watermarks first',
            content:
              'A watermark sits on top of the art, so everything you do afterwards fights it. Remove it before anything else. If a page came from a site that stamps its mark across the art, you will have to repair the artwork underneath anyway.',
            links: [
              {
                label: 'Watermark Application',
                url: 'https://github.com/souldret/Watermark-Application',
                kind: 'site',
              },
            ],
          },
          {
            title: 'JPEG artifacts next',
            content:
              'Every generation of JPEG leaves a little ringing around the lines. A quantisation-aware tool removes it by rebuilding the file from the original compression tables instead of resampling, so the ink stays where it was instead of spreading.',
            links: [
              {
                label: 'jpeg-quantsmooth',
                url: 'https://github.com/ilyakurdyukov/jpeg-quantsmooth',
                kind: 'site',
              },
              {
                label: 'Yuri Project: Denoising',
                url: 'https://yuri-project.net/wiki/Denoising',
                kind: 'docs',
              },
            ],
          },
        ],
      },
      {
        id: 'ct-rp-s3',
        title: 'Putting the pages back in order',
        steps: [
          {
            title: 'Webtoons arrive as one long strip',
            content:
              'A Korean chapter is usually a single tall image. You have to cut it into the page height your reader expects, and the seams have to land where the panel borders are or the artwork gets sliced in half.',
            tip:
              'Stitch and slice in one pass when you can. Working out the right panel height on the whole strip first saves redoing every page afterwards.',
            links: [
              {
                label: 'SmartStitch',
                url: 'https://github.com/MechTechnology/SmartStitch',
                kind: 'site',
              },
              {
                label: 'StitchTool',
                url: 'https://github.com/Aeonss/StitchTool',
                kind: 'site',
              },
              {
                label: 'Official WEBTOON tutorial',
                url: 'https://www.webtoons.com/en/canvas/ikous-tutorials/creating-and-slicing-vertical-comics/viewer?title_no=9019&episode_no=1',
                kind: 'docs',
              },
            ],
          },
          {
            title: 'Check the order before you start work',
            content:
              'Number the pages as they come in and read them through once. A missing page in the middle of a chapter is much easier to find now than after a full translation pass.',
            checklist: [
              { id: 'ct-rp-c1', label: 'Every page is present and in sequence' },
              { id: 'ct-rp-c2', label: 'Pages are upright, not rotated' },
              { id: 'ct-rp-c3', label: 'No watermark is left on the artwork' },
              { id: 'ct-rp-c4', label: 'The file format matches how you will publish' },
            ],
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'ct-translation-workflow',
    title: 'From image to English text',
    subtitle:
      'Getting the words off the page, and knowing when to trust them.',
    icon: BookOpen,
    accentColor: 'amber',
    difficulty: 'beginner',
    estimatedTime: '15 min',
    tags: ['ocr', 'translation', 'lookup', 'mokuro'],
    sourceUrl: 'https://github.com/zyddnys/manga-image-translator',
    sourceLabel: 'manga-image-translator',
    sections: [
      {
        id: 'ct-tw-s1',
        title: 'Get the text off the page',
        steps: [
          {
            title: 'Treat OCR as a draft, not an answer',
            content:
              'Recognition models read vertical Japanese well and vertical Korean well, but they still confuse similar characters, drop small hiragana and never know which kanji the author meant. Whatever comes out is a first draft for a human to fix.',
            tip:
              'If the OCR output looks clean enough to trust, that is usually a sign the model was reading hiragana it had already been taught rather than the text itself. Check the first line of every page by eye.',
          },
          {
            title: 'Tools that put the OCR next to the page',
            content:
              'A reader that shows the image and the extracted text side by side makes the fixing work much faster than a list of strings, because you can see the balloon you are correcting.',
            links: [
              {
                label: 'Mokuro',
                url: 'https://github.com/kha-white/mokuro',
                kind: 'site',
              },
              {
                label: 'yuki',
                url: 'https://github.com/c-sig/yuki',
                kind: 'site',
              },
              {
                label: 'Capture2Text',
                url: 'https://capture2text.sourceforge.net/',
                kind: 'site',
              },
            ],
          },
          {
            title: 'Or translate straight onto the page',
            content:
              'End-to-end tools detect the text, translate it, remove the original and render the translation back onto the image. That is a fast first pass for a whole chapter, and it leaves you a page to clean and typeset.',
            links: [
              {
                label: 'manga-image-translator',
                url: 'https://github.com/zyddnys/manga-image-translator',
                kind: 'site',
              },
            ],
          },
        ],
      },
      {
        id: 'ct-tw-s2',
        title: 'Look up what you do not know',
        steps: [
          {
            title: 'A general dictionary first, a niche one second',
            content:
              'For a plain word, Jisho or Weblio will do. When the word is a name, a place or a four-character idiom, the specialist dictionaries are the ones that will actually have it.',
            links: [
              {
                label: 'Jisho',
                url: 'https://jisho.org/',
                kind: 'site',
              },
              {
                label: 'Kotobank',
                url: 'https://kotobank.jp/',
                kind: 'site',
              },
              {
                label: 'Jitenon (four-character idioms)',
                url: 'https://yoji.jitenon.jp/',
                kind: 'site',
              },
              {
                label: 'Niconico Dictionary',
                url: 'https://dic.nicovideo.jp/',
                kind: 'site',
              },
            ],
          },
          {
            title: 'Look up the sounds, not just the words',
            content:
              'A large part of what makes a Japanese line hard is the sound of it. The National Institute for Japanese Language publishes a map of the sound system that covers the guttural stops a beginner literally cannot hear.',
            links: [
              {
                label: 'Gaj map',
                url: 'https://www.ninjal.ac.jp/publication/catalogue/gaj_map/',
                kind: 'docs',
              },
              {
                label: 'Guide to Japanese grammar',
                url: 'https://www.guidetojapanese.org/learn/grammar',
                kind: 'docs',
              },
              {
                label: 'Korean sound words',
                url: 'https://kellymoon.tistory.com/m/entry/%EC%98%81%EC%96%B4-%EC%9D%98%EC%84%B1%EC%96%B4-%EB%AA%A8%EC%9D%8C-sound-words',
                kind: 'site',
              },
            ],
          },
        ],
      },
      {
        id: 'ct-tw-s3',
        title: 'Machine translation is a draft',
        steps: [
          {
            title: 'Use it for speed, not for the final line',
            content:
              'A machine translation gives you a whole chapter in minutes and a reasonable first reading of most lines. It gets register wrong, drops the joke and confidently mistranslates anything that depends on context. Every line has to be read by a person before it ships.',
            warning:
              'Never publish an unreviewed machine translation. The errors are not random noise — they are plausible sentences that mean something else, which is the hardest kind of mistake for a reader to catch.',
          },
          {
            title: 'Keep a termbase',
            content:
              'Write down how you translate each recurring name, place and technique, and stick to it. A character who changes spelling every chapter reads as a mistake even when the meaning is right.',
            checklist: [
              { id: 'ct-tw-c1', label: 'Character names are consistent across the chapter' },
              { id: 'ct-tw-c2', label: 'Techniques and items use one translation each' },
              { id: 'ct-tw-c3', label: 'Honorifics are handled the same way in every line' },
              { id: 'ct-tw-c4', label: 'Every machine-translated line has been read by a person' },
            ],
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'ct-cleaning-redrawing',
    title: 'Cleaning and redrawing without losing the art',
    subtitle:
      'What the machines handle well, what they break, and how to put it back.',
    icon: Eraser,
    accentColor: 'emerald',
    difficulty: 'intermediate',
    estimatedTime: '18 min',
    tags: ['cleaning', 'redraw', 'inpainting', 'screentone'],
    sourceUrl: 'https://yuri-project.net/wiki/Redrawing',
    sourceLabel: 'Yuri Project Wiki',
    sections: [
      {
        id: 'ct-cr-s1',
        title: 'Let the machine do the easy pages',
        steps: [
          {
            title: 'The classic automatic cleaner',
            content:
              'SickZil is the tool most groups learned on: it finds the lettering, removes it and rebuilds the background under it. On a page with flat colour behind the text it is very hard to beat, and it has been the reference implementation for years.',
            links: [
              {
                label: 'SickZil-Machine',
                url: 'https://github.com/KUR-creative/SickZil-Machine',
                kind: 'site',
              },
            ],
          },
          {
            title: 'AI inpainting for the pages it cannot do',
            content:
              'An inpainting model reconstructs the area from the pixels around it, which means it handles texture and gradients far better than a fixed background fill. It also invents things that were never there, so review every result.',
            tip:
              'Run the AI cleaner on a copy of the page. When it invents a detail you liked, you want the original underneath to compare against.',
            links: [
              {
                label: 'Bear',
                url: 'https://github.com/k-omiq/Bear',
                kind: 'site',
              },
              {
                label: 'PanelCleaner',
                url: 'https://github.com/VoxelCubes/PanelCleaner',
                kind: 'site',
              },
              {
                label: 'IOPaint (LaMa) in the browser',
                url: 'https://huggingface.co/spaces/Sanster/iopaint-lama',
                kind: 'site',
              },
            ],
          },
        ],
      },
      {
        id: 'ct-cr-s2',
        title: 'Repair by hand what the machine broke',
        steps: [
          {
            title: 'Know when to stop and redraw',
            content:
              'Text that crossed a face, a hand or a patterned background is where automatic cleaning falls apart. The usual repair is a clone stamp that copies nearby texture into the gap, plus a healing brush to blend the seam. It is slower, but it is the only thing that keeps the art intact.',
            links: [
              {
                label: 'Yuri Project: Redrawing',
                url: 'https://yuri-project.net/wiki/Redrawing',
                kind: 'docs',
              },
              {
                label: 'Photopea',
                url: 'https://www.photopea.com/',
                kind: 'site',
              },
            ],
          },
          {
            title: 'Keep the texture continuous',
            content:
              'A screentone that was tiled at a repeating offset is the most common giveaway on a finished page. Tiling it by hand across the panel, at an angle that does not match the grid, hides the repeat.',
            links: [
              {
                label: 'Yuri Project: screentone tiling',
                url: 'https://yuri-project.net/tools/tiling',
                kind: 'site',
              },
              {
                label: 'Screentone library',
                url: 'https://psychobob.xepher.net/screentonez',
                kind: 'site',
              },
              {
                label: 'Adobe halftone brushes',
                url: 'https://download.adobe.com/pub/adobe/photoshop/brushes/halftones_and_screentones.abr',
                kind: 'download',
              },
            ],
          },
        ],
      },
      {
        id: 'ct-cr-s3',
        title: 'A page you can defend',
        steps: [
          {
            title: 'Look at the page before you look at the text',
            content:
              'Zoom out. A cleaned page fails when the eye catches a smudge, a hard edge or a tone that does not match, not when a single pixel is off. Most of those are visible only at full page size, which is how your reader will see it.',
            checklist: [
              { id: 'ct-cr-c1', label: 'No fragment of the original text is left' },
              { id: 'ct-cr-c2', label: 'Balloon borders are intact and unbroken' },
              { id: 'ct-cr-c3', label: 'Inpainted areas match the surrounding tone' },
              { id: 'ct-cr-c4', label: 'Screentones do not repeat at a visible interval' },
              { id: 'ct-cr-c5', label: 'The page holds up when zoomed out' },
            ],
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'ct-typesetting-lettering',
    title: 'Typesetting and lettering that reads right',
    subtitle:
      'Picking the face, fitting the text, and handling the sound effects.',
    icon: Type,
    accentColor: 'rose',
    difficulty: 'intermediate',
    estimatedTime: '20 min',
    tags: ['typesetting', 'lettering', 'fonts', 'sfx'],
    sourceUrl: 'https://mangafonts.carrd.co/',
    sourceLabel: 'Manga Fonts Directory',
    sections: [
      {
        id: 'ct-ts-s1',
        title: 'Pick the face before you pick the size',
        steps: [
          {
            title: 'Match the face to the dialogue, not to the page',
            content:
              'The directory below classifies lettering fonts by the kind of speech they were drawn for: main dialogue, phone and radio text, narration, thoughts, asides and sound effects. That classification is more useful than a list of family names, because it tells you which face will fit which balloon.',
            links: [
              {
                label: 'Manga Fonts Directory',
                url: 'https://mangafonts.carrd.co/',
                kind: 'site',
              },
              {
                label: 'Comicraft specimen catalogue',
                url: 'https://www.comicbookfonts.com/v/vspfiles/images/ComicBookFontsCatalog.pdf',
                kind: 'download',
              },
            ],
          },
          {
            title: 'Judge a font at the size you will use it',
            content:
              'A face that looks good at 48 pixels usually falls apart at 18, and the other way around. Preview it at the real size before you commit a whole chapter to it, and check that it has the characters your translation needs.',
            tip:
              'If the font is missing an accent or a curly quote, you will find out on page three. Preview the actual English text, not a pangram.',
          },
        ],
      },
      {
        id: 'ct-ts-s2',
        title: 'Let the tool place the text, then fix it',
        steps: [
          {
            title: 'Automatic placement is a starting point',
            content:
              'The typesetting extensions clean the bubble, paste the text, pick a font, size the text to fit and centre it visually. That removes the tedious part. What is left for you is the part that needs taste: where the line breaks fall and whether the emphasis is right.',
            links: [
              {
                label: 'TypeR',
                url: 'https://typer.hayasaku.fr/',
                kind: 'site',
              },
              {
                label: 'TyperTools',
                url: 'https://github.com/Swirt/typertools',
                kind: 'site',
              },
              {
                label: 'Pear',
                url: 'https://github.com/k-omiq/Pear',
                kind: 'site',
              },
            ],
          },
          {
            title: 'Shape the text to the balloon',
            content:
              'A bubble that is curved or slanted needs the text shaped along the same path, or the letters will sit wrong against the border. Shaping tools predict the bubble outline and set the text path to match it.',
            links: [
              {
                label: 'Kitsu Text Shaper',
                url: 'https://github.com/Kitsui-mizukawa/Kitsui-Text-Shaper',
                kind: 'site',
              },
              {
                label: 'Manga Bubble Shaper',
                url: 'https://github.com/jgsunga/manga-bubble-shaper',
                kind: 'site',
              },
            ],
          },
        ],
      },
      {
        id: 'ct-ts-s3',
        title: 'Stop the text from floating',
        steps: [
          {
            title: 'Break the lines where a human would',
            content:
              'A justified block with a loose line leaves a visible gap running down the paragraph. Hyphenation lets the words break across lines instead of stretching, which closes the gap and keeps the type size up.',
            links: [
              {
                label: 'CarbonScans hyphenation tool',
                url: 'https://tools.carbonscans.com/hyphenate',
                kind: 'site',
              },
            ],
          },
          {
            title: 'Sound effects are lettering too',
            content:
              'A drawn sound effect has to match the style of the dialogue next to it. The SFX helper finds a font that matches what is already on the page, and the onomatopoeia dictionaries give you the English that fits the shape of the original.',
            links: [
              {
                label: 'SFX Helper',
                url: 'https://github.com/valle3011/SFX-Helper',
                kind: 'site',
              },
              {
                label: 'Otologic',
                url: 'https://otologic.jp/',
                kind: 'site',
              },
              {
                label: 'Jaded Network SFX list',
                url: 'https://thejadednetwork.com/sfx/',
                kind: 'site',
              },
            ],
          },
        ],
      },
      {
        id: 'ct-ts-s4',
        title: 'A page you can defend',
        steps: [
          {
            title: 'Read the page, not the text',
            content:
              'Read the typeset page with your eyes, not with your translation. You are looking for anything that pulls the eye away from the words: a line that breaks badly, a size that jumps between balloons, a font that does not match the rest of the chapter.',
            checklist: [
              { id: 'ct-ts-c1', label: 'Every text sits inside its balloon' },
              { id: 'ct-ts-c2', label: 'Line breaks fall at natural points' },
              { id: 'ct-ts-c3', label: 'One font and one size per dialogue style' },
              { id: 'ct-ts-c4', label: 'Sound effects match the page style' },
              { id: 'ct-ts-c5', label: 'No text was left in the source language' },
            ],
          },
        ],
      },
    ],
  }),

  toGuide({
    id: 'ct-quality-release',
    title: 'Quality control and release',
    subtitle:
      'The last pass before the chapter goes up, and how to ship it.',
    icon: ShieldCheck,
    accentColor: 'amber',
    difficulty: 'intermediate',
    estimatedTime: '14 min',
    tags: ['qc', 'proofreading', 'publishing', 'workflow'],
    sourceUrl: 'https://yuri-project.net/wiki/Quality_Control',
    sourceLabel: 'Yuri Project Wiki',
    sections: [
      {
        id: 'ct-qr-s1',
        title: 'Check the translation against the source',
        steps: [
          {
            title: 'Compare side by side, page by page',
            content:
              'Open the source and the typeset page next to each other and read them together. It catches the three things that matter: a line that was dropped, a line that means something different, and a term that changed halfway through the chapter.',
            tip:
              'Read the English first without the source. Whatever sounds wrong to you is worth checking. Then read it again with the source open.',
          },
          {
            title: 'Look for the errors a reader cannot report',
            content:
              'A missing character or a duplicated line reads as broken to anyone who speaks the language, but it is invisible to a reader who does not. When in doubt, re-read the source for that balloon rather than assuming the OCR was right.',
          },
        ],
      },
      {
        id: 'ct-qr-s2',
        title: 'Name the files so they survive',
        steps: [
          {
            title: 'Use a scheme, not a habit',
            content:
              'The folder a group uses two years from now will not be the folder they remember. A naming scheme with the series, the chapter and the language in a fixed order means an archive stays readable even when nobody from the original team is around to explain it.',
            links: [
              {
                label: 'Daiz Manga Naming Scheme',
                url: 'https://github.com/Daiz/manga-naming-scheme',
                kind: 'site',
              },
            ],
          },
          {
            title: 'Keep the raw, the work and the release apart',
            content:
              'Three folders, three purposes: the raw stays untouched, the working files hold the typeset pages, and the release folder holds what actually goes up. Mixing them is how a finished page gets overwritten by a broken pass.',
          },
        ],
      },
      {
        id: 'ct-qr-s3',
        title: 'Ship it',
        steps: [
          {
            title: 'Upload the whole chapter in one go',
            content:
              'A chapter uploader that creates the post, sets the cover and pushes every page removes the most common source of a broken release: a page that was forgotten. It also keeps the upload consistent with the last one.',
            links: [
              {
                label: 'Chapter Uploader',
                url: 'https://github.com/turanbagtur/chapter-uploader',
                kind: 'site',
              },
            ],
          },
          {
            title: 'Track the queue somewhere you will look at it',
            content:
              'A board with one card per chapter is enough. The card holds the translator, the deadline and the status, and it is the only thing that tells you which chapter is blocking the next batch.',
            links: [
              {
                label: 'Trello',
                url: 'https://trello.com/',
                kind: 'site',
              },
              {
                label: 'MangaDex Forums',
                url: 'https://forums.mangadex.org',
                kind: 'community',
              },
            ],
          },
          {
            title: 'Before you call it done',
            content:
              'One last pass over the whole chapter as a reader would see it: the pages in order, the text fitting, the fonts consistent, the first and last page not cropped.',
            checklist: [
              { id: 'ct-qr-c1', label: 'Every page is present and in order' },
              { id: 'ct-qr-c2', label: 'The translation was checked against the source' },
              { id: 'ct-qr-c3', label: 'No leftover text from the source language' },
              { id: 'ct-qr-c4', label: 'Fonts and sizes are consistent across the chapter' },
              { id: 'ct-qr-c5', label: 'The release files are named and filed correctly' },
            ],
          },
        ],
      },
    ],
  }),
];

export default COMMUNITY_GUIDES;
