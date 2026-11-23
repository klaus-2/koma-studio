/* ============================================================
   KŌMA STUDIO — Guides Catalog
   ============================================================ */

import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckSquare,
  Eraser,
  Keyboard,
  Languages,
  Layers,
  RefreshCw,
  Repeat,
  Sparkles,
  Type,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type {
  GuideCategoryMeta,
  GuideEntry,
  GuideSectionDraft,
} from './guides-types';

import {
  APP_GUIDES_PRODUCTION,
  APP_GUIDES_SETUP,
} from './guides';
import { COMMUNITY_GUIDES } from './guides/community-guides';
import {
  normalizeGuideSections,
} from './guides/normalize';

export {
  APP_GUIDES_PRODUCTION,
  APP_GUIDES_SETUP,
  COMMUNITY_GUIDES,
} from './guides';

export const APP_GUIDES = [
  ...APP_GUIDES_SETUP,
  ...APP_GUIDES_PRODUCTION,
];

export const GUIDE_CATEGORIES: GuideCategoryMeta[] = [
  {
    id: 'quick-start',
    label: 'Quick Start',
    icon: Zap,
    description: 'Start using KOMA Studio in minutes.',
    accentColor: 'amber',
  },
  {
    id: 'workflows',
    label: 'Workflows & Pipelines',
    icon: Layers,
    description: 'Workflows optimized for scanlation.',
    accentColor: 'purple',
  },
  {
    id: 'tools-translator',
    label: 'Translator',
    icon: Languages,
    description: 'Integrated translation tools and techniques.',
    accentColor: 'cyan',
  },
  {
    id: 'tools-typesetter',
    label: 'Typesetter',
    icon: Type,
    description: 'Text placement, typography and fonts.',
    accentColor: 'rose',
  },
  {
    id: 'tools-cleaner',
    label: 'Cleaner / Redrawer',
    icon: Eraser,
    description: 'Balloon cleaning and area redrawing.',
    accentColor: 'emerald',
  },
  {
    id: 'tools-qc',
    label: 'Quality Checker',
    icon: CheckSquare,
    description: 'Quality review and final verification.',
    accentColor: 'amber',
  },
  {
    id: 'ai-models',
    label: 'AI Models',
    icon: Bot,
    description: 'Configuring and using artificial intelligence models.',
    accentColor: 'purple',
  },
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard Shortcuts',
    icon: Keyboard,
    description: 'Master the shortcuts for maximum productivity.',
    accentColor: 'cyan',
  },
  {
    id: 'automation',
    label: 'Automation & Batch',
    icon: Repeat,
    description: 'Batch processing and advanced automation.',
    accentColor: 'rose',
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    icon: AlertTriangle,
    description: 'Diagnosing and fixing common errors.',
    accentColor: 'amber',
  },
  {
    id: 'community-tutorials',
    label: 'Community Tutorials',
    icon: BookOpen,
    description:
      'Walkthroughs published by the scanlation community, with the source linked.',
    accentColor: 'emerald',
  },
];

export const GUIDES: GuideEntry[] = [
  ...APP_GUIDES,
  ...COMMUNITY_GUIDES,
].map((guide) => ({
  ...guide,
  sections: normalizeGuideSections(
    guide.id,
    guide.sections as GuideSectionDraft[],
  ),
}));

export const GUIDE_ICON_MAP: Record<string, LucideIcon> = {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckSquare,
  Eraser,
  Keyboard,
  Languages,
  Layers,
  RefreshCw,
  Repeat,
  Sparkles,
  Type,
  Zap,
};
