/* ============================================================
   KŌMA STUDIO — Resources Catalog
   ============================================================ */

import {
  BookOpen,
  Headphones,
  Type,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import type {
  ResourceCategoryMeta,
  ToolboxEntry,
  ToolboxStage,
} from './guides-types';

import {
  COMMUNITIES_DATA,
  FONTS_DATA,
  GLOSSARY_DATA,
  SFX_DATA,
  TOOLBOX_ASSETS,
  TOOLBOX_CLEANING,
  TOOLBOX_PUBLISHING,
  TOOLBOX_REFERENCE,
  TOOLBOX_RIPPERS,
  TOOLBOX_TRANSLATION,
  TOOLBOX_TYPESETTING,
  TOOLBOX_UPSCALING,
  TOOLBOX_UTILITIES,
} from './resources';

export {
  COMMUNITIES_DATA,
  FONT_COLLECTIONS_DATA,
  FONTS_DATA,
  GLOSSARY_DATA,
  SFX_DATA,
} from './resources';

export const RESOURCE_CATEGORIES: ResourceCategoryMeta[] = [
  {
    id: 'fonts',
    label: 'resources.category.fonts.label',
    icon: Type,
    description: 'resources.category.fonts.description',
    accentColor: 'rose',
    itemCount: FONTS_DATA.length,
  },
  {
    id: 'sfx-library',
    label: 'resources.category.sfx-library.label',
    icon: Headphones,
    description: 'resources.category.sfx-library.description',
    accentColor: 'purple',
    itemCount: SFX_DATA.length,
  },
  {
    id: 'glossary',
    label: 'resources.category.glossary.label',
    icon: BookOpen,
    description: 'resources.category.glossary.description',
    accentColor: 'cyan',
    itemCount: GLOSSARY_DATA.length,
  },
  {
    id: 'communities',
    label: 'resources.category.communities.label',
    icon: Users,
    description: 'resources.category.communities.description',
    accentColor: 'emerald',
    itemCount: COMMUNITIES_DATA.length,
  },
  {
    id: 'toolbox',
    label: 'resources.category.toolbox.label',
    icon: Wrench,
    description: 'resources.category.toolbox.description',
    accentColor: 'amber',
    itemCount: 0,
  },
];

export const TOOLBOX_STAGES: Record<ToolboxStage, ToolboxEntry[]> = {
  rippers: TOOLBOX_RIPPERS,
  cleaning: TOOLBOX_CLEANING,
  upscaling: TOOLBOX_UPSCALING,
  typesetting: TOOLBOX_TYPESETTING,
  assets: TOOLBOX_ASSETS,
  publishing: TOOLBOX_PUBLISHING,
  translation: TOOLBOX_TRANSLATION,
  reference: TOOLBOX_REFERENCE,
  utilities: TOOLBOX_UTILITIES,
};

export const TOOLBOX_STAGE_ORDER: ToolboxStage[] = [
  'rippers',
  'cleaning',
  'upscaling',
  'typesetting',
  'assets',
  'publishing',
  'translation',
  'reference',
  'utilities',
];

export const TOOLBOX_ENTRIES: ToolboxEntry[] = TOOLBOX_STAGE_ORDER.flatMap(
  (stage) => TOOLBOX_STAGES[stage],
);

RESOURCE_CATEGORIES.forEach((category) => {
  if (category.id === 'toolbox') {
    category.itemCount = TOOLBOX_ENTRIES.length;
  }
});

export const RESOURCE_ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Headphones,
  Type,
  Users,
  Wrench,
};
