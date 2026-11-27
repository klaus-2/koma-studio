import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n';
import { enMessages } from '../../i18n/langs/en';
import { setDesktopBridgeProvider } from '../../lib/desktop-bridge';
import { modelStore } from '../../stores/model-store';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { buildInstallState, createMockModel } from '../../models/model-install-fixtures';
import { OnboardingModal } from './OnboardingModal';
import {
  clearOnboardingState,
  readOnboardingState,
  shouldAutoOpenOnboarding,
} from './onboardingStorage';
import { KOMA_GITHUB_REPO_URL } from './onboardingSteps';

describe('OnboardingModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('koma-studio.locale.v1', 'en');
    useThemeStore.setState({ family: 'noir', theme: 'dark' });
    setDesktopBridgeProvider({});
    modelStore.setState({
      initialized: true,
      loading: false,
      diskSpace: {
        freeBytes: 25 * 1024 ** 3,
        totalBytes: 100 * 1024 ** 3,
        path: 'C:\\models',
      },
      entries: {
        font_rtdetr_v2: buildInstallState(
          { ...createMockModel('font_rtdetr_v2'), stage: 'detectText', name: 'RT-DETR v2' },
          'not_installed',
        ),
        manga_ocr: buildInstallState(
          { ...createMockModel('manga_ocr'), stage: 'recognizeText', name: 'Manga OCR' },
          'not_installed',
        ),
        opus_ja_en: buildInstallState(
          {
            ...createMockModel('opus_ja_en'),
            stage: 'translation',
            name: 'OPUS JA-EN',
            sourceLanguages: ['ja'],
            targetLanguages: ['en'],
          },
          'not_installed',
        ),
        aot: buildInstallState(
          { ...createMockModel('aot'), stage: 'cleanImage', name: 'AOT' },
          'not_installed',
        ),
      },
    });
  });

  it('walks through all 7 steps, triggers installAll, opens settings tab, stars GitHub, and starts tour on completion', () => {
    const onClose = vi.fn();
    const onStartTour = vi.fn();
    const onOpenSettingsTab = vi.fn();
    const onOpenExternalUrl = vi.fn();
    const onInstallModels = vi.fn().mockResolvedValue({});

    vi.useFakeTimers();

    render(
      <I18nProvider>
        <OnboardingModal
          open
          userId="user-42"
          onClose={onClose}
          onStartTour={onStartTour}
          onOpenSettingsTab={onOpenSettingsTab}
          onOpenExternalUrl={onOpenExternalUrl}
          onInstallModels={onInstallModels}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('1 / 7')).toBeTruthy();

    const nextText = enMessages['onboarding.actions.next'];

    fireEvent.click(screen.getByText(nextText));
    expect(screen.getByText('2 / 7')).toBeTruthy();
    expect(screen.getByText(enMessages['onboarding.modelsGuide.principleTitle'])).toBeTruthy();

    fireEvent.click(screen.getByText(nextText));
    expect(screen.getByText('3 / 7')).toBeTruthy();
    expect(screen.getByText('RT-DETR v2')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', {
        name: /Install Selected/i,
      }),
    );
    expect(onInstallModels).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText(nextText));
    expect(screen.getByText('4 / 7')).toBeTruthy();
    expect(screen.getByText(enMessages['onboarding.aio.clean.hdCropTitle'])).toBeTruthy();

    fireEvent.click(screen.getByText(nextText));
    expect(screen.getByText('5 / 7')).toBeTruthy();
    expect(screen.getByText(enMessages['onboarding.tools.healingFlow.title'])).toBeTruthy();

    fireEvent.click(screen.getByText(nextText));
    expect(screen.getByText('6 / 7')).toBeTruthy();
    const openTabButtons = screen.getAllByText(enMessages['onboarding.settings.openTabButton']);
    expect(openTabButtons.length).toBeGreaterThanOrEqual(6);

    fireEvent.click(screen.getByText(nextText));
    expect(screen.getByText('7 / 7')).toBeTruthy();

    const starLink = screen.getByRole('link', {
      name: enMessages['onboarding.finish.github.ctaButton'],
    });
    expect(starLink.getAttribute('href')).toBe(KOMA_GITHUB_REPO_URL);
    fireEvent.click(starLink);
    expect(onOpenExternalUrl).toHaveBeenCalledWith(expect.anything(), KOMA_GITHUB_REPO_URL);

    fireEvent.click(screen.getByText(enMessages['onboarding.finish.startTourButton']));
    expect(readOnboardingState('user-42')?.status).toBe('completed');
    expect(onClose).toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onStartTour).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('persists dismissed status when skipped and respects shouldAutoOpenOnboarding gating', () => {
    const onClose = vi.fn();
    clearOnboardingState('user-77');
    expect(shouldAutoOpenOnboarding('user-77', false)).toBe(true);
    expect(shouldAutoOpenOnboarding('user-77', true)).toBe(false);

    render(
      <I18nProvider>
        <OnboardingModal
          open
          userId="user-77"
          onClose={onClose}
          onStartTour={vi.fn()}
          onOpenSettingsTab={vi.fn()}
          onOpenExternalUrl={vi.fn()}
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByText(enMessages['onboarding.actions.skip']));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(readOnboardingState('user-77')?.status).toBe('dismissed');
    expect(shouldAutoOpenOnboarding('user-77', false)).toBe(false);
  });

  it('navigates directly to a Settings tab from Step 6 and dismisses onboarding safely', () => {
    const onClose = vi.fn();
    const onOpenSettingsTab = vi.fn();

    render(
      <I18nProvider>
        <OnboardingModal
          open
          userId="user-88"
          onClose={onClose}
          onStartTour={vi.fn()}
          onOpenSettingsTab={onOpenSettingsTab}
          onOpenExternalUrl={vi.fn()}
        />
      </I18nProvider>,
    );

    const nextText = enMessages['onboarding.actions.next'];
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByText(nextText));
    }
    expect(screen.getByText('6 / 7')).toBeTruthy();

    const openTabButtons = screen.getAllByText(enMessages['onboarding.settings.openTabButton']);
    const firstOpenTabButton = openTabButtons[0];
    expect(firstOpenTabButton).toBeTruthy();
    if (firstOpenTabButton) {
      fireEvent.click(firstOpenTabButton);
    }
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenSettingsTab).toHaveBeenCalledWith('general');
    expect(readOnboardingState('user-88')?.lastStepId).toBe('settings');
  });

  it('renders dedicated Noir and Classic theme shells with Koma Neeko and interactive previews', () => {
    for (const family of ['noir', 'classic'] as const) {
      useThemeStore.setState({ family, theme: 'dark' });
      const { unmount } = render(
        <I18nProvider>
          <OnboardingModal
            open
            userId={`user-theme-${family}`}
            onClose={vi.fn()}
            onStartTour={vi.fn()}
            onOpenSettingsTab={vi.fn()}
            onOpenExternalUrl={vi.fn()}
          />
        </I18nProvider>,
      );

      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog?.getAttribute('data-onboarding-theme')).toBe(family);
      expect(document.body.querySelector('[data-koma-pose]')).not.toBeNull();

      const railButtons = document.body.querySelectorAll('.koma-onb-railItem');
      const step4Btn = railButtons[3];
      expect(step4Btn).toBeTruthy();
      if (step4Btn) {
        fireEvent.click(step4Btn);
      }
      expect(document.body.querySelector('[data-stage-preview="cleanImage"]')).not.toBeNull();

      const step5Btn = railButtons[4];
      expect(step5Btn).toBeTruthy();
      if (step5Btn) {
        fireEvent.click(step5Btn);
      }
      const spotlightBefore = document.body.querySelector('.koma-onb-spotlight [data-preview-kind]');
      expect(spotlightBefore?.getAttribute('data-preview-kind')).toBe('healing');

      const magicWandCard = document.body
        .querySelector('[data-preview-kind="magic-wand"]')
        ?.closest('button');
      expect(magicWandCard).toBeTruthy();
      if (magicWandCard) {
        fireEvent.click(magicWandCard);
      }
      const spotlightAfter = document.body.querySelector('.koma-onb-spotlight [data-preview-kind]');
      expect(spotlightAfter?.getAttribute('data-preview-kind')).toBe('magic-wand');

      unmount();
    }
  });
});
