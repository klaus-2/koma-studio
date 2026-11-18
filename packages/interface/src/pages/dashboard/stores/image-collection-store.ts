import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { LoadedImage } from '../../../types/dashboard.types';

interface ImageCollectionStore {
  /* ── Loaded pages ── */
  images: LoadedImage[];

  /* ── Active image ── */
  activeId: string | null;

  /* ── Upload spinner ── */
  isExtractingUploads: boolean;

  setImages: (images: LoadedImage[]) => void;
  setActiveId: (activeId: string | null) => void;
  setIsExtractingUploads: (isExtractingUploads: boolean) => void;
  addImages: (newImages: LoadedImage[]) => void;
  removeImageById: (id: string) => void;
  assignChapterToImages: (
    imageIds: readonly string[],
    chapter: { id: string; label: string } | null,
  ) => void;
  renameChapter: (chapterId: string, label: string) => void;
  clearChapter: (chapterId: string) => void;
  moveImage: (index: number, direction: 'up' | 'down') => void;
  rotateImage: (id: string) => void;
  updateImageDimensions: (
    imageId: string,
    dimensions: { width: number; height: number },
  ) => void;
  updateImageUrl: (imageId: string, url: string) => void;
  updateImageUrls: (updates: ReadonlyMap<string, string>) => void;
  evictPageUrl: (imageId: string) => void;
}

const withoutChapter = (image: LoadedImage): LoadedImage => {
  const next = { ...image };
  delete next.chapterId;
  delete next.chapterLabel;
  return next;
};

export const useImageCollectionStore = create<ImageCollectionStore>()(
  devtools(
    (set) => ({
      images: [],
      activeId: null,
      isExtractingUploads: false,

      setImages: (images) => set({ images }),
      setActiveId: (activeId) =>
        set((state) => (state.activeId === activeId ? state : { activeId })),
      setIsExtractingUploads: (isExtractingUploads) =>
        set({ isExtractingUploads }),
      addImages: (newImages) =>
        set((state) => ({ images: [...state.images, ...newImages] })),
      removeImageById: (id) =>
        set((state) => ({
          images: state.images.filter((img) => img.id !== id),
        })),
      assignChapterToImages: (imageIds, chapter) =>
        set((state) => {
          const selected = new Set(imageIds);
          let changed = false;
          const images = state.images.map((img) => {
            if (!selected.has(img.id)) return img;
            const next = chapter
              ? { ...img, chapterId: chapter.id, chapterLabel: chapter.label }
              : withoutChapter(img);
            if (
              next.chapterId === img.chapterId &&
              next.chapterLabel === img.chapterLabel
            ) {
              return img;
            }
            changed = true;
            return next;
          });

          return changed ? { images } : state;
        }),
      renameChapter: (chapterId, label) =>
        set((state) => {
          const nextLabel = label.trim();

          if (!nextLabel) {
            return state;
          }

          let changed = false;
          const images = state.images.map((img) => {
            if (img.chapterId !== chapterId || img.chapterLabel === nextLabel) {
              return img;
            }
            changed = true;
            return { ...img, chapterLabel: nextLabel };
          });

          return changed ? { images } : state;
        }),
      clearChapter: (chapterId) =>
        set((state) => {
          let changed = false;
          const images = state.images.map((img) => {
            if (img.chapterId !== chapterId) {
              return img;
            }
            changed = true;
            return withoutChapter(img);
          });

          return changed ? { images } : state;
        }),
      // Same guards as the original hook callback: returns the state untouched
      // (no new array, no notification) when the swap is out of bounds.
      moveImage: (index, direction) =>
        set((state) => {
          if (direction === 'up' && index === 0) {
            return state;
          }
          if (direction === 'down' && index === state.images.length - 1) {
            return state;
          }
          const next = [...state.images];
          const targetIndex = direction === 'up' ? index - 1 : index + 1;
          const current = next[index];
          const target = next[targetIndex];
          if (!current || !target) {
            return state;
          }
          [next[index], next[targetIndex]] = [target, current];
          return { images: next };
        }),
      rotateImage: (id) =>
        set((state) => ({
          images: state.images.map((img) =>
            img.id === id
              ? { ...img, rotation: (img.rotation + 90) % 360 }
              : img,
          ),
        })),
      updateImageDimensions: (imageId, dimensions) =>
        set((state) => {
          if (dimensions.width <= 0 || dimensions.height <= 0) {
            return state;
          }
          const target = state.images.find((img) => img.id === imageId);
          if (!target) {
            return state;
          }
          if (
            target.width === dimensions.width &&
            target.height === dimensions.height
          ) {
            return state;
          }
          return {
            images: state.images.map((img) =>
              img.id === imageId
                ? {
                    ...img,
                    width: dimensions.width,
                    height: dimensions.height,
                  }
                : img,
            ),
          };
        }),
      updateImageUrl: (imageId, url) =>
        set((state) => {
          const target = state.images.find((img) => img.id === imageId);
          if (!target || target.url === url) {
            return state;
          }
          return {
            images: state.images.map((img) =>
              img.id === imageId ? { ...img, url } : img,
            ),
          };
        }),
      updateImageUrls: (updates) =>
        set((state) => {
          if (updates.size === 0) return state;
          let changed = false;
          const images = state.images.map((img) => {
            const nextUrl = updates.get(img.id);
            if (nextUrl === undefined || img.url === nextUrl) {
              return img;
            }
            changed = true;
            return { ...img, url: nextUrl };
          });
          return changed ? { images } : state;
        }),
      // Eviction must drop a thumbnail that aliases the revoked URL in the
      // same pass: leaving it pointing at a dead blob breaks every preview
      // that prefers thumbnailUrl.
      evictPageUrl: (imageId) =>
        set((state) => {
          const target = state.images.find((img) => img.id === imageId);
          if (!target || target.url === '') {
            return state;
          }
          return {
            images: state.images.map((img) => {
              if (img.id !== imageId) return img;
              const next: LoadedImage = { ...img, url: '' };
              if (img.thumbnailUrl === img.url) delete next.thumbnailUrl;
              return next;
            }),
          };
        }),
    }),
    { name: 'image-collection-store' },
  ),
);
