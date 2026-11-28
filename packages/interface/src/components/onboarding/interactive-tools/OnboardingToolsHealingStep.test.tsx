import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from '@koma/ui/stores/theme-store';

import {
  AREA_LAB_SPEC,
  HEALING_LAB_SPEC,
  REFINE_LAB_SPEC,
} from '../../../assets/onboarding-labs';
import { I18nProvider } from '../../../i18n';
import { enMessages } from '../../../i18n/langs/en';
import { setDesktopBridgeProvider } from '../../../lib/desktop-bridge';
import { useUiShellStore } from '../../../pages/dashboard/stores/ui-shell-store';
import { installJsdomBrowserStubs } from '../../dashboard/renderTextPreviewTestSetup';
import { OnboardingToolsHealingStep } from '../steps/OnboardingToolsHealingStep';
import { AreaCanvasLabSandbox } from './AreaCanvasLabSandbox';
import { HealingLabSandbox } from './HealingLabSandbox';
import { RefineTextLabSandbox } from './RefineTextLabSandbox';

class MockPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = init.pointerId ?? 1;
  }
}

const mockOverlayMetrics = (width: number, height: number): HTMLElement => {
  const overlay = document.querySelector('.koma-render-overlay');
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

const paintHealingDefectStroke = (canvas: HTMLElement): void => {
  const { x1, y1, x2, y2 } = HEALING_LAB_SPEC.defectRect;
  const midX = Math.round((x1 + x2) / 2);
  const topY = Math.round(y1 + (y2 - y1) * 0.3);
  const botY = Math.round(y1 + (y2 - y1) * 0.72);
  fireEvent.pointerDown(canvas, { clientX: x1 + 18, clientY: topY, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: midX, clientY: topY, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: x2 - 16, clientY: topY, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: midX, clientY: botY, pointerId: 1 });
  fireEvent.pointerMove(canvas, { clientX: x1 + 20, clientY: botY, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: x1 + 20, clientY: botY, pointerId: 1 });
};

const dragAreaMissedBox = (overlay: HTMLElement): void => {
  const { x1, y1, x2, y2 } = AREA_LAB_SPEC.missedBox;
  fireEvent.pointerDown(overlay, { clientX: x1 + 4, clientY: y1 + 4, pointerId: 2 });
  fireEvent.pointerMove(overlay, { clientX: x2 - 4, clientY: y2 - 4, pointerId: 2 });
  fireEvent.pointerUp(overlay, { clientX: x2 - 4, clientY: y2 - 4, pointerId: 2 });
};

const insertAreaBubbleText = (copy: string): void => {
  const textbox = screen.getByRole('textbox');
  textbox.textContent = copy;
  Object.defineProperty(textbox, 'innerText', {
    configurable: true,
    get: () => textbox.textContent ?? '',
  });
  fireEvent.input(textbox);
  fireEvent.blur(textbox);
};

describe('Phase 05 Interactive Product Tour sandboxes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('koma-studio.locale.v1', 'en');
    useThemeStore.setState({ family: 'noir', theme: 'dark' });
    useUiShellStore.setState({ holdOriginalActive: false });
    setDesktopBridgeProvider({ desktop: null, isDesktopRuntime: () => false });
    installJsdomBrowserStubs();
    vi.stubGlobal('PointerEvent', MockPointerEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['noir', 'classic'] as const)(
    'renders mission tabs, active healing lab, and collapsed visual reference in %s theme',
    (family) => {
      useThemeStore.setState({ family, theme: 'dark' });
      const { unmount } = render(
        <I18nProvider>
          <OnboardingToolsHealingStep />
        </I18nProvider>,
      );

      expect(screen.getByTestId('healing-lab-sandbox')).toBeTruthy();
      expect(document.querySelector('[data-onb-mission-tab="healing"]')).toBeTruthy();
      expect(document.querySelector('[data-onb-mission-tab="text"]')).toBeTruthy();
      expect(document.querySelector('[data-onb-mission-tab="selection"]')).toBeTruthy();

      const toggleBtn = screen.getByTestId('tools-reference-toggle');
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
      expect(document.querySelector('[data-preview-kind="magic-wand"]')).toBeNull();

      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
      expect(document.querySelector('[data-preview-kind="healing"]')).toBeTruthy();
      expect(document.querySelector('[data-preview-kind="magic-wand"]')).toBeTruthy();
      unmount();
    },
  );

  it('auto-applies Healing Brush on stroke release with no Apply button and enforces target defect coverage', () => {
    const onComplete = vi.fn();
    render(
      <I18nProvider>
        <HealingLabSandbox completed={false} onComplete={onComplete} />
      </I18nProvider>,
    );

    const canvas = screen.getByTestId('healing-lab-canvas');
    expect(screen.queryByTestId('healing-lab-apply-btn')).toBeNull();

    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 160, pointerId: 1 });
    expect(screen.getByRole('alert').textContent).toContain(
      enMessages['onboarding.tools.lab.healing.step1Hint'],
    );
    expect(screen.getByTestId('healing-coverage').textContent).toBe('0%');
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('healing-lab-brush-btn'));
    fireEvent.pointerDown(canvas, { clientX: 460, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 460, clientY: 60, pointerId: 1 });
    expect(screen.getByTestId('healing-coverage').textContent).toBe('0%');
    expect(screen.getByRole('alert').textContent).toContain(
      enMessages['onboarding.tools.lab.healing.step2Error'],
    );
    expect(onComplete).not.toHaveBeenCalled();

    paintHealingDefectStroke(canvas);
    expect(screen.getByTestId('healing-coverage').textContent).toBe('100%');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(enMessages['onboarding.tools.lab.healing.doneTitle'])).toBeTruthy();
  });

  it('supports real Magic Wand selection -> Apply Healing to Selection workflow', () => {
    const onComplete = vi.fn();
    render(
      <I18nProvider>
        <HealingLabSandbox completed={false} onComplete={onComplete} />
      </I18nProvider>,
    );

    const canvas = screen.getByTestId('healing-lab-canvas');
    fireEvent.click(screen.getByTestId('healing-lab-wand-btn'));

    const applyBtn = screen.getByTestId('healing-lab-wand-apply-btn') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);

    fireEvent.pointerDown(canvas, { clientX: 460, clientY: 60, pointerId: 1 });
    expect(screen.queryByTestId('healing-lab-wand-selection')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(
      enMessages['onboarding.tools.lab.healing.wandMissError'],
    );
    expect(onComplete).not.toHaveBeenCalled();

    const { x1, y1, x2, y2 } = HEALING_LAB_SPEC.defectRect;
    fireEvent.pointerDown(canvas, {
      clientX: Math.round((x1 + x2) / 2),
      clientY: Math.round((y1 + y2) / 2),
      pointerId: 1,
    });
    expect(screen.getByTestId('healing-lab-wand-selection')).toBeTruthy();
    expect(applyBtn.disabled).toBe(false);

    fireEvent.click(applyBtn);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(enMessages['onboarding.tools.lab.healing.doneTitle'])).toBeTruthy();
  });

  it('uses real RenderTextPreview + floating TypeDock Refine without fake size/bold tools in RefineTextLabSandbox', () => {
    const onComplete = vi.fn();
    render(
      <I18nProvider>
        <RefineTextLabSandbox completed={false} onComplete={onComplete} />
      </I18nProvider>,
    );

    expect(screen.queryByTestId('refine-lab-size-inc')).toBeNull();
    expect(screen.queryByTestId('refine-lab-bold-btn')).toBeNull();

    const overlay = mockOverlayMetrics(REFINE_LAB_SPEC.width, REFINE_LAB_SPEC.height);
    const [bx1, by1, bx2, by2] = REFINE_LAB_SPEC.bubbleBox;
    fireEvent.pointerDown(overlay, {
      clientX: Math.round((bx1 + bx2) / 2),
      clientY: Math.round((by1 + by2) / 2),
      pointerId: 1,
    });

    const refineBtn = screen.getByRole('button', {
      name: enMessages['renderPreview.refine'],
    });
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(refineBtn);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(enMessages['onboarding.tools.lab.text.doneTitle'])).toBeTruthy();
  });

  it('requires Area Select -> drag over clean bubble -> type dialogue in spawned RenderTextPreview editor', () => {
    const onComplete = vi.fn();
    render(
      <I18nProvider>
        <AreaCanvasLabSandbox active completed={false} onComplete={onComplete} />
      </I18nProvider>,
    );

    const overlay = mockOverlayMetrics(AREA_LAB_SPEC.width, AREA_LAB_SPEC.height);

    fireEvent.pointerDown(overlay, { clientX: 80, clientY: 260, pointerId: 1 });
    expect(screen.getByRole('alert').textContent).toContain(
      enMessages['onboarding.tools.lab.selection.step1Hint'],
    );
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('area-lab-select-tool'));

    fireEvent.pointerDown(overlay, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 60, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 60, clientY: 60, pointerId: 1 });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain(
      enMessages['onboarding.tools.lab.selection.step2Error'],
    );
    expect(onComplete).not.toHaveBeenCalled();

    dragAreaMissedBox(overlay);
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    insertAreaBubbleText('NOW I UNDERSTAND THE ORACLE!');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(enMessages['onboarding.tools.lab.selection.doneTitle'])).toBeTruthy();

    fireEvent.click(screen.getByTestId('area-lab-peek-btn'));
    expect(useUiShellStore.getState().holdOriginalActive).toBe(true);
  });

  it('reports progressive completion across all 3 labs and fires onCompletionChange(3, true)', () => {
    const onCompletionChange = vi.fn();
    render(
      <I18nProvider>
        <OnboardingToolsHealingStep onCompletionChange={onCompletionChange} />
      </I18nProvider>,
    );

    expect(onCompletionChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('healing-lab-brush-btn'));
    paintHealingDefectStroke(screen.getByTestId('healing-lab-canvas'));
    expect(onCompletionChange).toHaveBeenCalledWith(1, false);

    const textTab = document.querySelector('[data-onb-mission-tab="text"]');
    expect(textTab).toBeTruthy();
    if (textTab) fireEvent.click(textTab);

    const refineOverlay = mockOverlayMetrics(REFINE_LAB_SPEC.width, REFINE_LAB_SPEC.height);
    const [bx1, by1, bx2, by2] = REFINE_LAB_SPEC.bubbleBox;
    fireEvent.pointerDown(refineOverlay, {
      clientX: Math.round((bx1 + bx2) / 2),
      clientY: Math.round((by1 + by2) / 2),
      pointerId: 1,
    });
    fireEvent.click(screen.getByRole('button', { name: enMessages['renderPreview.refine'] }));
    expect(onCompletionChange).toHaveBeenCalledWith(2, false);

    const selectionTab = document.querySelector('[data-onb-mission-tab="selection"]');
    expect(selectionTab).toBeTruthy();
    if (selectionTab) fireEvent.click(selectionTab);

    const areaOverlay = mockOverlayMetrics(AREA_LAB_SPEC.width, AREA_LAB_SPEC.height);
    fireEvent.click(screen.getByTestId('area-lab-select-tool'));
    dragAreaMissedBox(areaOverlay);
    insertAreaBubbleText('NOW I UNDERSTAND THE ORACLE!');

    expect(onCompletionChange).toHaveBeenLastCalledWith(3, true);
    expect(screen.getByText(enMessages['onboarding.tools.allDoneTitle'])).toBeTruthy();
  });
});
