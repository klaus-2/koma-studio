import { describe, expect, it } from 'vitest';

import { RESOURCE_ICONS } from '@/assets/resources';
import {
  COMMUNITIES_DATA,
  FONT_COLLECTIONS_DATA,
  FONTS_DATA,
  GLOSSARY_DATA,
  RESOURCE_CATEGORIES,
  SFX_DATA,
  TOOLBOX_ENTRIES,
  TOOLBOX_STAGE_ORDER,
} from '@/data/resources-data';
import {
  APP_GUIDES,
  COMMUNITY_GUIDES,
  GUIDE_CATEGORIES,
  GUIDES,
} from '@/data/guides-data';

const isLiveUrl = (url: string): boolean => {
  if (!url.startsWith('https://')) return false;
  if (url.includes('example.com')) return false;
  if (url.includes('localhost')) return false;
  return true;
};

describe('resource catalog integrity', () => {
  it('gives every toolbox entry a unique id and a live URL', () => {
    const ids = new Set<string>();

    for (const entry of TOOLBOX_ENTRIES) {
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);

      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.description.trim().length).toBeGreaterThan(20);
      expect(isLiveUrl(entry.url)).toBe(true);
      expect(TOOLBOX_STAGE_ORDER).toContain(entry.stage);
    }
  });

  it('gives every toolbox link a live URL', () => {
    for (const entry of TOOLBOX_ENTRIES) {
      for (const link of entry.links ?? []) {
        expect(isLiveUrl(link.url)).toBe(true);
        expect(link.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves every packaged image slug to a file that ships with the app', () => {
    const slugs = new Set([
      ...TOOLBOX_ENTRIES.map((entry) => entry.image),
      ...FONT_COLLECTIONS_DATA.map((entry) => entry.image),
      ...FONTS_DATA.map((entry) => entry.image),
      ...COMMUNITIES_DATA.map((entry) => entry.image),
    ]);

    for (const slug of slugs) {
      if (!slug) continue;
      expect(RESOURCE_ICONS[slug]).toBeDefined();
    }
  });

  it('keeps every community and font collection pointing at a live URL', () => {
    for (const community of COMMUNITIES_DATA) {
      expect(isLiveUrl(community.url)).toBe(true);
      expect(community.description.trim().length).toBeGreaterThan(20);
    }

    for (const collection of FONT_COLLECTIONS_DATA) {
      expect(isLiveUrl(collection.url)).toBe(true);
      expect(collection.familyCount).toBeGreaterThan(0);
      expect(collection.fileCount).toBeGreaterThan(0);
      expect(collection.licenseNote.trim().length).toBeGreaterThan(20);
    }
  });

  it('keeps every font family inside a collection that exists', () => {
    const collectionIds = new Set(
      FONT_COLLECTIONS_DATA.map((entry) => entry.id),
    );

    for (const font of FONTS_DATA) {
      if (!font.collectionId) continue;
      expect(collectionIds.has(font.collectionId)).toBe(true);
    }
  });

  it('fills the glossary and the SFX library', () => {
    expect(GLOSSARY_DATA.length).toBeGreaterThan(40);
    expect(SFX_DATA.length).toBeGreaterThan(40);

    for (const term of GLOSSARY_DATA) {
      expect(term.term.trim().length).toBeGreaterThan(0);
      expect(term.definition.trim().length).toBeGreaterThan(20);
    }

    for (const entry of SFX_DATA) {
      expect(entry.japanese.trim().length).toBeGreaterThan(0);
      expect(entry.romaji.trim().length).toBeGreaterThan(0);
      expect(entry.english.trim().length).toBeGreaterThan(0);
    }
  });

  it('derives the category counts from the data', () => {
    const toolboxCategory = RESOURCE_CATEGORIES.find(
      (category) => category.id === 'toolbox',
    );

    expect(toolboxCategory?.itemCount).toBe(TOOLBOX_ENTRIES.length);
    expect(
      RESOURCE_CATEGORIES.map((category) => category.id),
    ).toEqual([
      'fonts',
      'sfx-library',
      'glossary',
      'communities',
      'toolbox',
    ]);
  });
});

describe('guide catalog integrity', () => {
  it('gives every guide a category that exists', () => {
    const categoryIds = new Set(
      GUIDE_CATEGORIES.map((category) => category.id),
    );

    for (const guide of GUIDES) {
      expect(categoryIds.has(guide.category)).toBe(true);
      expect(guide.title.trim().length).toBeGreaterThan(0);
      expect(guide.subtitle.trim().length).toBeGreaterThan(0);
      expect(guide.estimatedTime.trim().length).toBeGreaterThan(0);
      expect(guide.sections.length).toBeGreaterThan(0);
    }
  });

  it('gives every step an id, a type and a body', () => {
    const stepIds = new Set<string>();

    for (const guide of GUIDES) {
      for (const section of guide.sections) {
        expect(section.steps.length).toBeGreaterThan(0);

        for (const step of section.steps) {
          expect(step.id).toMatch(/^[a-z0-9-]+$/);
          expect(stepIds.has(step.id)).toBe(false);
          stepIds.add(step.id);

          expect(step.type.length).toBeGreaterThan(0);
          expect(step.content.trim().length).toBeGreaterThan(0);

          for (const link of step.links ?? []) {
            expect(isLiveUrl(link.url)).toBe(true);
          }
        }
      }
    }
  });

  it('keeps the app guides and the community tutorials apart', () => {
    expect(APP_GUIDES.length).toBe(12);
    expect(COMMUNITY_GUIDES.length).toBeGreaterThanOrEqual(5);

    for (const guide of APP_GUIDES) {
      expect(guide.origin).toBe('app');
      expect(guide.sourceUrl).toBeUndefined();
    }

    for (const guide of COMMUNITY_GUIDES) {
      expect(guide.origin).toBe('community');
      expect(guide.category).toBe('community-tutorials');
      expect(isLiveUrl(guide.sourceUrl ?? '')).toBe(true);
      expect(guide.sourceLabel?.trim().length).toBeGreaterThan(0);
    }
  });
});
