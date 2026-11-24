import bangersRegular from '@/assets/fonts/bangers/Bangers-Regular.ttf';
import bobaDateRegular from '@/assets/fonts/boba-date/Boba-Date.otf';
import cdxAmraamRegular from '@/assets/fonts/cdx-amraam/CDXAmraam-Regular.otf';
import cdxStarstreakRegular from '@/assets/fonts/cdx-starstreak/CDXStarstreak-Regular.otf';
import comicNeueBold from '@/assets/fonts/comic-neue/ComicNeue-Bold.ttf';
import comicNeueBoldItalic from '@/assets/fonts/comic-neue/ComicNeue-BoldItalic.ttf';
import comicNeueItalic from '@/assets/fonts/comic-neue/ComicNeue-Italic.ttf';
import comicNeueRegular from '@/assets/fonts/comic-neue/ComicNeue-Regular.ttf';
import comicReliefBold from '@/assets/fonts/comic-relief/ComicRelief-Bold.ttf';
import comicReliefRegular from '@/assets/fonts/comic-relief/ComicRelief-Regular.ttf';
import creepsterRegular from '@/assets/fonts/creepster/Creepster-Regular.ttf';
import luckiestGuyRegular from '@/assets/fonts/luckiest-guy/LuckiestGuy-Regular.ttf';
import patrickHandRegular from '@/assets/fonts/patrick-hand/PatrickHand-Regular.ttf';
import rosehipBold from '@/assets/fonts/rosehip/SS-Rosehip-Bold.otf';
import rosehipBoldItalic from '@/assets/fonts/rosehip/SS-Rosehip-BoldItalic.otf';
import rosehipItalic from '@/assets/fonts/rosehip/SS-Rosehip-Italic.otf';
import rosehipRegular from '@/assets/fonts/rosehip/SS-Rosehip.otf';
import spicyNoodlesBold from '@/assets/fonts/spicy-noodles-2/SSSpicyNoodles2-Bold.otf';
import spicyNoodlesBoldItalic from '@/assets/fonts/spicy-noodles-2/SSSpicyNoodles2-BoldItalic.otf';
import spicyNoodlesItalic from '@/assets/fonts/spicy-noodles-2/SSSpicyNoodles2-Italic.otf';
import spicyNoodlesRegular from '@/assets/fonts/spicy-noodles-2/SSSpicyNoodles2-Regular.otf';
import tekoBold from '@/assets/fonts/teko/Teko-Bold.ttf';
import tekoRegular from '@/assets/fonts/teko/Teko-Regular.ttf';
import yourHighschoolCrushRegular from '@/assets/fonts/your-highschool-crush/YourHighschoolCrush-Regular.otf';

export interface BundledFontFace {
  readonly family: string;
  readonly url: string;
  readonly weight: '400' | '700';
  readonly style: 'normal' | 'italic';
}

const face = (
  family: string,
  url: string,
  weight: BundledFontFace['weight'] = '400',
  style: BundledFontFace['style'] = 'normal',
): BundledFontFace => ({ family, url, weight, style });

export const BUNDLED_FONT_FACES: readonly BundledFontFace[] = [
  face('Comic Neue', comicNeueRegular),
  face('Comic Neue', comicNeueBold, '700'),
  face('Comic Neue', comicNeueItalic, '400', 'italic'),
  face('Comic Neue', comicNeueBoldItalic, '700', 'italic'),
  face('Patrick Hand', patrickHandRegular),
  face('Comic Relief', comicReliefRegular),
  face('Comic Relief', comicReliefBold, '700'),
  face('Bangers', bangersRegular),
  face('Luckiest Guy', luckiestGuyRegular),
  face('Teko', tekoRegular),
  face('Teko', tekoBold, '700'),
  face('SS Rosehip', rosehipRegular),
  face('SS Rosehip', rosehipBold, '700'),
  face('SS Rosehip', rosehipItalic, '400', 'italic'),
  face('SS Rosehip', rosehipBoldItalic, '700', 'italic'),
  face('SS Spicy Noodles 2', spicyNoodlesRegular),
  face('SS Spicy Noodles 2', spicyNoodlesBold, '700'),
  face('SS Spicy Noodles 2', spicyNoodlesItalic, '400', 'italic'),
  face('SS Spicy Noodles 2', spicyNoodlesBoldItalic, '700', 'italic'),
  face('Creepster', creepsterRegular),
  face('SS Boba Date', bobaDateRegular),
  face('Your Highschool Crush', yourHighschoolCrushRegular),
  face('CDX Amraam', cdxAmraamRegular),
  face('CDX Starstreak', cdxStarstreakRegular),
];

export const BUNDLED_FONT_FAMILIES: readonly string[] = [
  ...new Set(BUNDLED_FONT_FACES.map((entry) => entry.family)),
];
