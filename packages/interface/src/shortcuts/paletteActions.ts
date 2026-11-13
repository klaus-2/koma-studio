import type { TranslationKey } from '../i18n/messages';

/** Domain a command palette action belongs to. */
export type PaletteActionCategory = 'stages' | 'tools' | 'pages' | 'styles';

export interface PaletteAction {
  id: string;
  titleKey: TranslationKey;
  category: PaletteActionCategory;
  run(): void;
}

/** A palette action resolved for display: the action plus its localized strings. */
export interface PaletteActionView {
  action: PaletteAction;
  title: string;
  detail: string;
}

export const PALETTE_CATEGORY_LABEL_KEYS: Record<PaletteActionCategory, TranslationKey> = {
  stages: 'commandPalette.category.stages',
  tools: 'commandPalette.category.tools',
  pages: 'commandPalette.category.pages',
  styles: 'commandPalette.category.styles',
};

const registry = new Map<string, PaletteAction>();
const recentIds: string[] = [];
const RECENT_IDS_LIMIT = 8;

/**
 * Additive registry keyed by action id: registering an id that already exists
 * replaces that entry in place (registration is idempotent), new ids append.
 */
export const registerPaletteActions = (actions: readonly PaletteAction[]): void => {
  actions.forEach((action) => {
    registry.set(action.id, action);
  });
};

export const getPaletteActions = (): readonly PaletteAction[] =>
  Array.from(registry.values());

export const recordPaletteActionRun = (actionId: string): void => {
  const existingIndex = recentIds.indexOf(actionId);
  if (existingIndex >= 0) {
    recentIds.splice(existingIndex, 1);
  }
  recentIds.unshift(actionId);
  if (recentIds.length > RECENT_IDS_LIMIT) {
    recentIds.length = RECENT_IDS_LIMIT;
  }
};

export const getRecentPaletteActionIds = (): readonly string[] => recentIds;

/** Substring match over localized title + category label, case-insensitive (GuideSearch convention). */
export const matchPaletteActions = (
  views: readonly PaletteActionView[],
  query: string,
): PaletteActionView[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...views];
  return views.filter((view) =>
    `${view.title} ${view.detail}`.toLowerCase().includes(normalized),
  );
};

/** Recents first (most recent run first), then the remaining actions in registry order. */
export const orderPaletteActionsByRecency = (
  views: readonly PaletteActionView[],
): PaletteActionView[] => {
  if (recentIds.length === 0) return [...views];
  const pending = new Map(views.map((view) => [view.action.id, view]));
  const ordered: PaletteActionView[] = [];
  recentIds.forEach((id) => {
    const view = pending.get(id);
    if (view) {
      ordered.push(view);
      pending.delete(id);
    }
  });
  pending.forEach((view) => ordered.push(view));
  return ordered;
};
