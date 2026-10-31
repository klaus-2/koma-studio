import type { LoadedImage } from '@/types/dashboard.types';

export interface AioChapterGroup {
  readonly id: string;
  readonly label: string;
  readonly images: LoadedImage[];
}

export const DIRECT_IMAGES_CHAPTER_ID = 'direct-images';

/**
 * Group the loaded images by their ingestion chapter, preserving the order in
 * which each chapter first appears. Images without a chapter (direct uploads)
 * share one group so a plain multi-image run stays a single chapter.
 */
export const groupImagesIntoAioChapters = (
  images: readonly LoadedImage[],
): AioChapterGroup[] => {
  const groups = new Map<string, AioChapterGroup>();

  for (const image of images) {
    const id = image.chapterId?.trim() || DIRECT_IMAGES_CHAPTER_ID;
    const existing = groups.get(id);
    if (existing) {
      existing.images.push(image);
      continue;
    }
    groups.set(id, {
      id,
      label: image.chapterLabel?.trim() || 'Images',
      images: [image],
    });
  }

  return [...groups.values()];
};
