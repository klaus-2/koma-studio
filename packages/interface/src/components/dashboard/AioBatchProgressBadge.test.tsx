// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import AioBatchProgressBadge from '@/components/dashboard/AioBatchProgressBadge';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import type { AioBatchProgress } from '@/pages/dashboard/lib/aio-batch-progress';

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

afterEach(cleanup);

const renderBadge = (progress: AioBatchProgress) =>
  render(
    <I18nProvider>
      <AioBatchProgressBadge progress={progress} className="meta" />
    </I18nProvider>,
  );

describe('AioBatchProgressBadge', () => {
  it('renders chapter, stage and ETA through the translation catalog', () => {
    renderBadge({
      chapterIndex: 2,
      chapterCount: 3,
      chapterLabel: 'b.cbz',
      stageLabel: 'Translating text',
      etaSeconds: 200,
    });

    expect(
      screen.getByText('ch 2/3 · Translating text · ~3m 20s'),
    ).toBeTruthy();
    expect(screen.getByTitle('b.cbz')).toBeTruthy();
  });

  it('omits the stage and ETA parts when they are not available yet', () => {
    renderBadge({
      chapterIndex: 1,
      chapterCount: 2,
      chapterLabel: 'a.cbz',
      stageLabel: null,
      etaSeconds: null,
    });

    expect(screen.getByText('ch 1/2')).toBeTruthy();
  });
});
