import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AREA_LAB_SPEC,
  HEALING_LAB_SPEC,
  REFINE_LAB_SPEC,
} from '../../assets/onboarding-labs';
import { installJsdomBrowserStubs } from '../dashboard/renderTextPreviewTestSetup';
import { I18nProvider } from '../../i18n';
import { enMessages } from '../../i18n/langs/en';
import { setDesktopBridgeProvider } from '../../lib/desktop-bridge';
import { modelStore } from '../../stores/model-store';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import { buildInstallState, createMockModel } from '../../models/model-install-fixtures';
import { useAioPipelineStore } from '../../pages/dashboard/stores/aio-pipeline-store';
import { OnboardingModal } from './OnboardingModal';
import {
  clearOnboardingState,
  readOnboardingState,
  shouldAutoOpenOnboarding,
} from './onboardingStorage';
import { KOMA_GITHUB_REPO_URL } from './onboardingSteps';

class MockPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = init.pointerId ?? 1;
  }
}

const mockRenderOverlayMetrics = (width: number, height: number): HTMLElement => {
  const overlay = document.body.querySelector('.koma-render-overlay');
  if (!(overlay instanceof HTMLElement)) {
    throw new Error('Expected .koma-render-overlay to exist');
  }
  Object.defineProperty(overlay, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(overlay, 'clientHeight', { configurable: true, value: height });
  overlay.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  overlay.setPointerCapture = () => undefined;
  overlay.releasePointerCapture = () => undefined;
  overlay.hasPointerCapture = () => false;
  return overlay;
};

const completeInteractiveToolsLabs = (): void => {
  fireEvent.click(screen.getByTestId('healing-lab-brush-btn'));
  const healingCanvas = screen.getByTestId('healing-lab-canvas');
  const { x1: hx1, y1: hy1, x2: hx2, y2: hy2 } = HEALING_LAB_SPEC.defectRect;
  const hMidX = Math.round((hx1 + hx2) / 2);
  const hTopY = Math.round(hy1 + (hy2 - hy1) * 0.3);
  const hBotY = Math.round(hy1 + (hy2 - hy1) * 0.72);
  fireEvent.pointerDown(healingCanvas, { clientX: hx1 + 18, clientY: hTopY, pointerId: 1 });
  fireEvent.pointerMove(healingCanvas, { clientX: hMidX, clientY: hTopY, pointerId: 1 });
  fireEvent.pointerMove(healingCanvas, { clientX: hx2 - 16, clientY: hTopY, pointerId: 1 });
  fireEvent.pointerMove(healingCanvas, { clientX: hMidX, clientY: hBotY, pointerId: 1 });
  fireEvent.pointerMove(healingCanvas, { clientX: hx1 + 20, clientY: hBotY, pointerId: 1 });
  fireEvent.pointerUp(healingCanvas, { clientX: hx1 + 20, clientY: hBotY, pointerId: 1 });

  const textTab = document.body.querySelector('[data-onb-mission-tab="text"]');
  expect(textTab).toBeTruthy();
  if (textTab) {
    fireEvent.click(textTab);
  }
  const refineOverlay = mockRenderOverlayMetrics(REFINE_LAB_SPEC.width, REFINE_LAB_SPEC.height);
  const [bx1, by1, bx2, by2] = REFINE_LAB_SPEC.bubbleBox;
  fireEvent.pointerDown(refineOverlay, {
    clientX: Math.round((bx1 + bx2) / 2),
    clientY: Math.round((by1 + by2) / 2),
    pointerId: 1,
  });
  fireEvent.click(screen.getByRole('button', { name: enMessages['renderPreview.refine'] }));

  const selectionTab = document.body.querySelector('[data-onb-mission-tab="selection"]');
  expect(selectionTab).toBeTruthy();
  if (selectionTab) {
    fireEvent.click(selectionTab);
  }
  const areaOverlay = mockRenderOverlayMetrics(AREA_LAB_SPEC.width, AREA_LAB_SPEC.height);
  fireEvent.click(screen.getByTestId('area-lab-select-tool'));
  const { x1: ax1, y1: ay1, x2: ax2, y2: ay2 } = AREA_LAB_SPEC.missedBox;
  fireEvent.pointerDown(areaOverlay, { clientX: ax1 + 4, clientY: ay1 + 4, pointerId: 2 });
  fireEvent.pointerMove(areaOverlay, { clientX: ax2 - 4, clientY: ay2 - 4, pointerId: 2 });
  fireEvent.pointerUp(areaOverlay, { clientX: ax2 - 4, clientY: ay2 - 4, pointerId: 2 });
  const textbox = screen.getByRole('textbox');
  textbox.textContent = 'NOW I UNDERSTAND THE ORACLE!';
  Object.defineProperty(textbox, 'innerText', {
    configurable: true,
    get: () => textbox.textContent ?? '',
  });
  fireEvent.input(textbox);
  fireEvent.blur(textbox);
};

describe('OnboardingModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('koma-studio.locale.v1', 'en');
    useThemeStore.setState({ family: 'noir', theme: 'dark' });
    useAioPipelineStore.setState({ aioDeviceInfo: null });
    setDesktopBridgeProvider({ isDesktopRuntime: () => false });
    installJsdomBrowserStubs();
    vi.stubGlobal('PointerEvent', MockPointerEvent);
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
        ctd_text_seg: buildInstallState(
          { ...createMockModel('ctd_text_seg'), stage: 'segmentText', name: 'CTD Text Mask (ONNX)' },
          'not_installed',
        ),
        lama_manga: buildInstallState(
          { ...createMockModel('lama_manga'), stage: 'cleanImage', name: 'LaMa Manga Dynamic' },
          'not_installed',
        ),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(screen.getByText(enMessages['onboarding.aio.modeAuto.title'])).toBeTruthy();
    expect(screen.getByText(enMessages['onboarding.aio.modeManual.title'])).toBeTruthy();
    expect(screen.getByText(enMessages['onboarding.aio.modeAioAi.title'])).toBeTruthy();
    expect(screen.getByText(enMessages['onboarding.aio.modeAuto.body'])).toBeTruthy();
    expect(screen.getByText(enMessages['onboarding.aio.modeManual.body'])).toBeTruthy();
    expect(screen.getByText(enMessages['onboarding.aio.modeAioAi.body'])).toBeTruthy();

    fireEvent.click(screen.getByText(nextText));
    expect(screen.getByText('5 / 7')).toBeTruthy();
    expect(screen.getByTestId('healing-lab-sandbox')).toBeTruthy();
    expect(screen.getByTestId('onboarding-next-locked-hint')).toBeTruthy();

    const nextBtn = screen.getByText(nextText).closest('button');
    expect(nextBtn).toBeTruthy();
    expect(nextBtn?.disabled).toBe(true);
    if (nextBtn) {
      fireEvent.click(nextBtn);
    }
    const settingsRailBtn = document.body.querySelector('[data-onb-step="settings"]');
    if (settingsRailBtn) {
      fireEvent.click(settingsRailBtn);
    }
    expect(screen.getByText('5 / 7')).toBeTruthy();

    completeInteractiveToolsLabs();
    expect(screen.queryByTestId('onboarding-next-locked-hint')).toBeNull();
    expect(nextBtn?.disabled).toBe(false);

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

  it('persists dismissed status when skipped (review mode) and respects shouldAutoOpenOnboarding gating', () => {
    const onClose = vi.fn();
    clearOnboardingState('user-77');
    expect(shouldAutoOpenOnboarding('user-77', false)).toBe(true);
    expect(shouldAutoOpenOnboarding('user-77', true)).toBe(false);

    render(
      <I18nProvider>
        <OnboardingModal
          open
          isReviewing
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

  it('cannot be closed, skipped, or escaped on the mandatory first-run flow', () => {
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <OnboardingModal
          open
          userId="user-mandatory"
          onClose={onClose}
          onStartTour={vi.fn()}
          onOpenSettingsTab={vi.fn()}
          onOpenExternalUrl={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.queryByText(enMessages['onboarding.actions.skip'])).toBeNull();
    expect(screen.getByLabelText(enMessages['onboarding.actions.closeAria'])).not.toBeVisible();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
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
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByText(nextText));
    }
    expect(screen.getByText('5 / 7')).toBeTruthy();
    completeInteractiveToolsLabs();
    fireEvent.click(screen.getByText(nextText));
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

      const railButtons = document.body.querySelectorAll('[data-onb-step]');
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
      expect(document.body.querySelector('[data-testid="healing-lab-sandbox"]')).toBeTruthy();

      const referenceToggle = screen.getByTestId('tools-reference-toggle');
      fireEvent.click(referenceToggle);
      expect(document.body.querySelector('[data-preview-kind="healing"]')).toBeTruthy();
      expect(document.body.querySelector('[data-preview-kind="magic-wand"]')).toBeTruthy();

      unmount();
    }
  });

  it('defaults to LaMa FP32 on CPU-only hardware and syncs benchmark pipeline settings', () => {
    const onInstallModels = vi.fn().mockResolvedValue({});
    modelStore.setState((prev) => ({
      ...prev,
      entries: {
        ...prev.entries,
        lama_fp32: buildInstallState(
          { ...createMockModel('lama_fp32'), stage: 'cleanImage', name: 'LaMa FP32 512' },
          'not_installed',
        ),
        aot: buildInstallState(
          { ...createMockModel('aot'), stage: 'cleanImage', name: 'AOT' },
          'not_installed',
        ),
      },
    }));
    useAioPipelineStore.setState({
      aioDeviceInfo: {
        name: 'CPU Only',
        has_gpu: false,
        provider: 'CPUExecutionProvider',
        vram_gb: null,
      },
    });

    render(
      <I18nProvider>
        <OnboardingModal
          open
          userId="user-cpu"
          onClose={vi.fn()}
          onStartTour={vi.fn()}
          onOpenSettingsTab={vi.fn()}
          onOpenExternalUrl={vi.fn()}
          onInstallModels={onInstallModels}
        />
      </I18nProvider>,
    );

    const nextText = enMessages['onboarding.actions.next'];
    fireEvent.click(screen.getByText(nextText));
    fireEvent.click(screen.getByText(nextText));
    expect(screen.getByText('3 / 7')).toBeTruthy();

    const fp32Radio = screen.getByRole('radio', {
      name: enMessages['onboarding.install.cleanProfile.lamaFp32'],
    });
    expect(fp32Radio.getAttribute('aria-checked')).toBe('true');

    const aotRadio = screen.getByRole('radio', {
      name: enMessages['onboarding.install.cleanProfile.aot'],
    });
    fireEvent.click(aotRadio);
    expect(useAioPipelineStore.getState().aioStageSelection.cleanImage).toBe('aot');

    fireEvent.click(fp32Radio);
    fireEvent.click(
      screen.getByRole('button', {
        name: /Install Selected/i,
      }),
    );

    const state = useAioPipelineStore.getState();
    expect(state.aioStageSelection.detectText).toBe('font_rtdetr_v2');
    expect(state.aioStageSelection.segmentText).toBe('ctd_text_seg');
    expect(state.aioStageSelection.cleanImage).toBe('lama_fp32');
    expect(state.aioHdStrategy).toBe('crop');
    expect(state.aioHdCropMargin).toBe(192);
    expect(state.aioHdCropTriggerSize).toBe(512);
    expect(state.aioMaskDilation).toBe(5);
  });
});

const renderAtFinish = (onClose = vi.fn(), onStartTour = vi.fn()) => {
  render(
    <I18nProvider>
      <OnboardingModal
        open
        isReviewing
        userId="user-finish"
        onClose={onClose}
        onStartTour={onStartTour}
        onOpenSettingsTab={vi.fn()}
        onOpenExternalUrl={vi.fn()}
      />
    </I18nProvider>,
  );
  const finishStep = document.body.querySelector('[data-onb-step="finish"]');
  if (finishStep) fireEvent.click(finishStep);
  return { onClose, onStartTour };
};

describe('OnboardingModal finish step', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('koma-studio.locale.v1', 'en');
    useThemeStore.setState({ family: 'noir', theme: 'dark' });
    useAioPipelineStore.setState({ aioDeviceInfo: null });
    setDesktopBridgeProvider({});
  });

  it('enters the studio without the tour when the tour checkbox is cleared', () => {
    vi.useFakeTimers();
    const { onClose, onStartTour } = renderAtFinish();
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(enMessages['onboarding.finish.tourCheckbox']) }));
    fireEvent.click(screen.getByText(enMessages['onboarding.finish.enterStudioButton']));
    vi.advanceTimersByTime(100);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onStartTour).not.toHaveBeenCalled();
    expect(readOnboardingState('user-finish')?.status).toBe('completed');
    vi.useRealTimers();
  });

  it('jumps back to the step that owns a summary row', () => {
    renderAtFinish();
    expect(screen.getByText('7 / 7')).toBeTruthy();
    const [firstEdit] = screen.getAllByRole('button', { name: /^Edit / });
    expect(firstEdit).toBeTruthy();
    if (firstEdit) fireEvent.click(firstEdit);
    expect(screen.getByText('1 / 7')).toBeTruthy();
  });

  it('moves the theme family radio with arrow keys', () => {
    renderAtFinish();
    const welcome = document.body.querySelector('[data-onb-step="welcome"]');
    if (welcome) fireEvent.click(welcome);
    const noirRadio = screen.getByRole('radio', { checked: true, name: /Noir/i });
    fireEvent.keyDown(noirRadio, { key: 'ArrowLeft' });
    expect(useThemeStore.getState().family).toBe('classic');
  });
});
