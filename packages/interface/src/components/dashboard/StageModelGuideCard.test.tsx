import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { I18nProvider } from '../../i18n';
import { setDesktopBridgeProvider } from '../../lib/desktop-bridge';
import StageModelGuideCard, { type GuideStage } from './StageModelGuideCard';

const STAGES: readonly GuideStage[] = ['detectText', 'segmentText', 'cleanImage'];

describe('StageModelGuideCard', () => {
  beforeEach(() => {
    window.localStorage.setItem('koma-studio.locale.v1', 'en');
    setDesktopBridgeProvider({});
  });

  it.each(STAGES)('expands and collapses comparative model rows for %s in English', (stage) => {
    render(
      <I18nProvider>
        <StageModelGuideCard stage={stage} compact />
      </I18nProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Which model should I choose?' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const bodyText = screen.getByTestId(`stage-model-guide-${stage}`).textContent ?? '';
    expect(bodyText).not.toContain('dashboard.stageModelGuide.');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders pt-BR localized titles and cleanImage comparisons cleanly', async () => {
    window.localStorage.setItem('koma-studio.locale.v1', 'pt-br');

    render(
      <I18nProvider>
        <StageModelGuideCard stage="cleanImage" noir defaultOpen />
      </I18nProvider>,
    );

    const trigger = await screen.findByRole('button', { name: 'Qual modelo escolher?' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    const card = screen.getByTestId('stage-model-guide-cleanImage');
    expect(card.textContent).toContain('LaMa Manga Dynamic');
    expect(card.textContent).toContain('LaMa FP32 512');
    expect(card.textContent).not.toContain('dashboard.stageModelGuide.');
  });
});
