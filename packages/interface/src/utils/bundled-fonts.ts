import { BUNDLED_FONT_FACES, type BundledFontFace } from '@/constants/bundled-fonts';

export interface FontFaceTarget<TFace> {
  add(face: TFace): unknown;
}

export type CreateFontFace<TFace> = (entry: BundledFontFace) => TFace;

export const registerBundledFontFaces = <TFace>(
  target: FontFaceTarget<TFace>,
  createFace: CreateFontFace<TFace>,
  faces: readonly BundledFontFace[] = BUNDLED_FONT_FACES,
): number => {
  for (const entry of faces) {
    target.add(createFace(entry));
  }
  return faces.length;
};

const createBrowserFontFace: CreateFontFace<FontFace> = (entry) =>
  new FontFace(entry.family, `url(${entry.url})`, {
    weight: entry.weight,
    style: entry.style,
    display: 'swap',
  });

export const installBundledFonts = (): number => {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !('fonts' in document)) {
    return 0;
  }
  return registerBundledFontFaces(document.fonts, createBrowserFontFace);
};
