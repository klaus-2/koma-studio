import { describe, expect, it } from 'vitest';

import {
  getPaletteActions,
  getRecentPaletteActionIds,
  matchPaletteActions,
  orderPaletteActionsByRecency,
  recordPaletteActionRun,
  registerPaletteActions,
  type PaletteAction,
  type PaletteActionView,
} from '@/shortcuts/paletteActions';

const makeAction = (id: string, titleKey: PaletteAction['titleKey']): PaletteAction => ({
  id,
  titleKey,
  category: 'tools',
  run: () => undefined,
});

const makeView = (id: string, title: string, detail: string): PaletteActionView => ({
  action: makeAction(id, 'commandPalette.dialogAria'),
  title,
  detail,
});

describe('registerPaletteActions / getPaletteActions', () => {
  it('appends newly registered actions in registration order', () => {
    registerPaletteActions([
      makeAction('test.alpha', 'commandPalette.category.stages'),
      makeAction('test.beta', 'commandPalette.category.tools'),
    ]);

    const ids = getPaletteActions().map((action) => action.id);
    expect(ids).toContain('test.alpha');
    expect(ids).toContain('test.beta');
    expect(ids.indexOf('test.alpha')).toBeLessThan(ids.indexOf('test.beta'));
  });

  it('replaces an existing id in place instead of duplicating it', () => {
    const replacement = makeAction('test.replace', 'commandPalette.category.pages');
    registerPaletteActions([makeAction('test.replace', 'commandPalette.category.pages')]);
    registerPaletteActions([replacement]);

    const matching = getPaletteActions().filter((action) => action.id === 'test.replace');
    expect(matching).toHaveLength(1);
    expect(matching[0]).toBe(replacement);
  });
});

describe('matchPaletteActions', () => {
  const views = [
    makeView('view.render', 'Render', 'Stages'),
    makeView('view.cleaner', 'Cleaner / Redrawer mode', 'Tools'),
    makeView('view.shortcuts', 'Open shortcut center', 'Tools'),
  ];

  it('returns every view for an empty query', () => {
    expect(matchPaletteActions(views, '')).toEqual(views);
    expect(matchPaletteActions(views, '   ')).toEqual(views);
  });

  it('matches a case-insensitive substring of the title', () => {
    const ids = matchPaletteActions(views, 'SHORT').map((view) => view.action.id);
    expect(ids).toEqual(['view.shortcuts']);
  });

  it('matches a case-insensitive substring of the category detail', () => {
    const ids = matchPaletteActions(views, 'stages').map((view) => view.action.id);
    expect(ids).toEqual(['view.render']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(matchPaletteActions(views, 'nonexistent')).toEqual([]);
  });
});

describe('run recency', () => {
  it('records the most recent run first and deduplicates re-runs', () => {
    recordPaletteActionRun('recency.a');
    recordPaletteActionRun('recency.b');
    recordPaletteActionRun('recency.a');

    const recent = getRecentPaletteActionIds();
    expect(recent[0]).toBe('recency.a');
    expect(recent[1]).toBe('recency.b');
    expect(recent.filter((id) => id === 'recency.a')).toHaveLength(1);
  });

  it('caps the recents list at the 8 most recent actions', () => {
    for (let i = 1; i <= 9; i += 1) {
      recordPaletteActionRun(`recency.cap.${i}`);
    }
    const recent = getRecentPaletteActionIds();
    expect(recent).toHaveLength(8);
    expect(recent[0]).toBe('recency.cap.9');
    expect(recent).not.toContain('recency.cap.1');
  });

  it('orders recents first (most recent first), remaining views in input order', () => {
    recordPaletteActionRun('order.cleaner');
    recordPaletteActionRun('order.render');

    const ordered = orderPaletteActionsByRecency([
      makeView('order.render', 'Render', 'Stages'),
      makeView('order.cleaner', 'Cleaner', 'Tools'),
      makeView('order.other', 'Other', 'Pages'),
    ]);
    expect(ordered.map((view) => view.action.id)).toEqual([
      'order.render',
      'order.cleaner',
      'order.other',
    ]);
  });

  it('keeps input order for views with no recorded runs', () => {
    const ordered = orderPaletteActionsByRecency([
      makeView('plain.first', 'First', 'Stages'),
      makeView('plain.second', 'Second', 'Tools'),
    ]);
    expect(ordered.map((view) => view.action.id)).toEqual(['plain.first', 'plain.second']);
  });
});
