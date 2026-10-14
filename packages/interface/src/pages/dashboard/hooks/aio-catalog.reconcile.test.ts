import { describe, expect, it } from 'vitest';

import { buildAioStageCatalog } from '@/models/aioStageCatalog';
import type { AioStageOption } from '@/models/aioStageCatalog';
import {
  equalCatalogData,
  reconcileCatalog,
  reconcileStageSelection,
} from '@/pages/dashboard/hooks/aio-catalog.reconcile';

function option(
  key: string,
  available: boolean,
  implemented = true,
): AioStageOption {
  return {
    key,
    name: key,
    device: 'cloud',
    use_case: 'Translation',
    available,
    implemented,
  };
}

describe('catalog reconciliation', () => {
  it('compares objects independently of property insertion order', () => {
    expect(
      equalCatalogData(
        { key: 'model', available: true },
        { available: true, key: 'model' },
      ),
    ).toBe(true);
  });

  it('preserves the entire catalog identity when content is unchanged', () => {
    const previous = buildAioStageCatalog({ sourceLanguage: 'ja' });
    const incoming = buildAioStageCatalog({ sourceLanguage: 'ja' });

    expect(reconcileCatalog(previous, incoming)).toBe(previous);
  });

  it('preserves unrelated stage identities', () => {
    const previous = buildAioStageCatalog({ sourceLanguage: 'ja' });
    const incoming = {
      ...buildAioStageCatalog({ sourceLanguage: 'ja' }),
      cleanImage: [option('new-cleaner', false)],
    };
    const next = reconcileCatalog(previous, incoming);

    expect(next).not.toBe(previous);
    expect(next.detectText).toBe(previous.detectText);
    expect(next.recognizeText).toBe(previous.recognizeText);
    expect(next.cleanImage).not.toBe(previous.cleanImage);
  });

  it('retains an existing selection while it requires configuration', () => {
    expect(
      reconcileStageSelection(
        'configured-later',
        [option('configured-later', false), option('ready', true)],
        {},
      ),
    ).toBe('configured-later');
  });

  it('prefers selectable options over roadmap entries', () => {
    expect(
      reconcileStageSelection(
        'removed',
        [
          option('roadmap', true, false),
          option('not-ready', false),
          option('ready', true),
        ],
        {},
      ),
    ).toBe('ready');
  });

  it('clears a stale key when no options remain', () => {
    expect(reconcileStageSelection('removed', [], {})).toBe('');
  });
});
