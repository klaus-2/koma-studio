import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, RefreshCcw, ScanText, ZoomIn, ZoomOut } from 'lucide-react';

import {
  AREA_LAB_SPEC,
  ONBOARDING_LAB_ASSETS,
  type LabRect,
} from '../../../assets/onboarding-labs';
import { DEFAULT_RENDER_STYLE } from '../../../constants/dashboard.constants';
import { useI18n } from '../../../i18n';
import { useUiShellStore } from '../../../pages/dashboard/stores/ui-shell-store';
import type { AioTextRegion } from '../../../types/dashboard.types';
import { rebuildRegionShapeForRefinement } from '../../../utils/dashboard.region.utils';
import { cloneRenderStyle } from '../../../utils/dashboard.utils';
import { OnbBadge, cx } from '../onboardingPrimitives';
import { useOnbSkin } from '../onboardingSkin';
import { GuidedStepBanner, TourTargetRing } from './InteractiveTourChrome';
import {
  OnboardingRenderPreview,
  createLabLoadedImage,
} from './onboardingRenderPreviewHelper';

const LAB_W = AREA_LAB_SPEC.width;
const LAB_H = AREA_LAB_SPEC.height;
const DETECTED_BOX = AREA_LAB_SPEC.detectedBox;
const TARGET_BOX: LabRect = AREA_LAB_SPEC.missedBox;
const HUD_REGION_ID = 'onb-area-hud';

const matchesMissedBubble = (bbox: readonly [number, number, number, number]): boolean => {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  if (w < 28 || h < 24) return false;
  const ix1 = Math.max(x1, TARGET_BOX.x1);
  const iy1 = Math.max(y1, TARGET_BOX.y1);
  const ix2 = Math.min(x2, TARGET_BOX.x2);
  const iy2 = Math.min(y2, TARGET_BOX.y2);
  if (ix2 <= ix1 || iy2 <= iy1) return false;
  const inter = (ix2 - ix1) * (iy2 - iy1);
  const targetArea = (TARGET_BOX.x2 - TARGET_BOX.x1) * (TARGET_BOX.y2 - TARGET_BOX.y1);
  const drawnArea = w * h;
  return inter / targetArea >= 0.35 && inter / drawnArea >= 0.2;
};

const buildInitialRegions = (hudText: string): AioTextRegion[] => {
  const hudBbox: [number, number, number, number] = [
    DETECTED_BOX.x1,
    DETECTED_BOX.y1,
    DETECTED_BOX.x2,
    DETECTED_BOX.y2,
  ];
  const base: AioTextRegion = {
    id: HUD_REGION_ID,
    bbox: hudBbox,
    score: 0.94,
    source: 'model',
    modelKey: 'font_rtdetr_v2',
    detectorModelKey: 'font_rtdetr_v2',
    detectedRenderMode: 'text_narration',
    renderMode: 'auto',
    renderText: hudText,
    renderStyle: {
      ...DEFAULT_RENDER_STYLE,
      autoFontSize: true,
      alignment: 'center',
      color: '#ffffff',
      fillCssValue: '#ffffff',
      outlineColor: '#075985',
      outlineWidth: 3,
      bold: true,
    },
    stylePresetId: null,
    queueIndex: null,
    hidden: false,
    locked: false,
  };
  return [rebuildRegionShapeForRefinement(base, 'square', 'refined')];
};

export interface AreaCanvasLabSandboxProps {
  active: boolean;
  completed: boolean;
  onComplete: () => void;
}

export function AreaCanvasLabSandbox({
  active,
  completed,
  onComplete,
}: AreaCanvasLabSandboxProps) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const hudCopy = t('onboarding.tools.lab.selection.existingHudText');
  const seqRef = useRef(0);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const [overlayFrame, setOverlayFrame] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const labImage = useMemo(
    () =>
      createLabLoadedImage({
        id: 'onb-area-page',
        name: 'manhwa-panel.webp',
        url: ONBOARDING_LAB_ASSETS.areaOriginal,
        width: LAB_W,
        height: LAB_H,
      }),
    [],
  );

  const [areaToolOn, setAreaToolOn] = useState(false);
  const [shapeKind, setShapeKind] = useState<'rounded' | 'square'>('rounded');
  const [regions, setRegions] = useState<AioTextRegion[]>(() =>
    buildInitialRegions(hudCopy),
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [createdRegionId, setCreatedRegionId] = useState<string | null>(null);
  const [inlineEditorRequestKey, setInlineEditorRequestKey] = useState<string | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [textInserted, setTextInserted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const peekActive = useUiShellStore((s) => s.holdOriginalActive);

  const currentStep = useMemo(() => {
    if (completed || textInserted) return 4;
    if (!areaToolOn && !createdRegionId) return 1;
    if (!createdRegionId) return 2;
    return 3;
  }, [areaToolOn, completed, createdRegionId, textInserted]);

  useEffect(() => {
    const wrap = previewWrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const updateOverlayFrame = (): void => {
      const overlay = wrap.querySelector('.koma-render-overlay');
      if (!(overlay instanceof HTMLElement)) return;
      const wrapRect = wrap.getBoundingClientRect();
      const ovRect = overlay.getBoundingClientRect();
      if (ovRect.width <= 0 || ovRect.height <= 0) return;
      setOverlayFrame({
        left: ovRect.left - wrapRect.left,
        top: ovRect.top - wrapRect.top,
        width: ovRect.width,
        height: ovRect.height,
      });
    };
    updateOverlayFrame();
    const observer = new ResizeObserver(updateOverlayFrame);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [zoomPercent, areaToolOn, createdRegionId]);

  useEffect(() => {
    return () => {
      useUiShellStore.getState().setHoldOriginalActive(false);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      useUiShellStore.getState().setHoldOriginalActive(false);
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        const curr = useUiShellStore.getState().holdOriginalActive;
        useUiShellStore.getState().setHoldOriginalActive(!curr);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  const handleReset = useCallback((): void => {
    useUiShellStore.getState().setHoldOriginalActive(false);
    setAreaToolOn(false);
    setShapeKind('rounded');
    setRegions(buildInitialRegions(hudCopy));
    setSelectedRegionId(null);
    setCreatedRegionId(null);
    setInlineEditorRequestKey(null);
    setZoomPercent(100);
    setTextInserted(false);
    setErrorMessage(null);
  }, [hudCopy]);

  const handleToggleAreaTool = (): void => {
    setAreaToolOn(true);
    setSelectedRegionId(null);
    setErrorMessage(null);
  };

  const handleRegionsChange = useCallback(
    (next: AioTextRegion[], selectedRegionIdOverride?: string | null): void => {
      const prevIds = new Set(regions.map((region) => region.id));
      const added = next.find(
        (region) => !prevIds.has(region.id) && region.source === 'manual',
      );

      if (added) {
        if (!matchesMissedBubble(added.bbox)) {
          setErrorMessage(t('onboarding.tools.lab.selection.step2Error'));
          return;
        }
        const enriched = rebuildRegionShapeForRefinement(
          {
            ...added,
            renderStyle: {
              ...DEFAULT_RENDER_STYLE,
              autoFontSize: true,
              alignment: 'center',
              color: '#111111',
              fillCssValue: '#111111',
              outlineColor: '#ffffff',
              outlineWidth: 2,
            },
          },
          shapeKind,
          'refined',
        );
        seqRef.current += 1;
        setRegions([...regions, enriched]);
        setCreatedRegionId(enriched.id);
        setSelectedRegionId(enriched.id);
        setInlineEditorRequestKey(`${enriched.id}::${seqRef.current}`);
        setErrorMessage(null);
        return;
      }

      setRegions(next);
      if (selectedRegionIdOverride !== undefined) {
        setSelectedRegionId(selectedRegionIdOverride);
      }
      if (createdRegionId) {
        const updatedCreated = next.find((region) => region.id === createdRegionId);
        if (updatedCreated && (updatedCreated.renderText ?? '').trim().length > 0) {
          setErrorMessage(null);
          setTextInserted(true);
          onComplete();
        } else if (!updatedCreated) {
          setCreatedRegionId(null);
          setInlineEditorRequestKey(null);
        }
      }
    },
    [createdRegionId, onComplete, regions, shapeKind, t],
  );

  const handleRequestRefineRegion = useCallback((): void => {
    if (!selectedRegionId) return;
    setRegions((prev) =>
      prev.map((region) => {
        if (region.id !== selectedRegionId) return region;
        const refined = rebuildRegionShapeForRefinement(region, shapeKind, 'refined');
        return {
          ...refined,
          renderStyle: {
            ...cloneRenderStyle(refined.renderStyle ?? DEFAULT_RENDER_STYLE),
            alignment: 'center',
            autoFontSize: true,
            fontSize: DEFAULT_RENDER_STYLE.fontSize,
            minFontSize: DEFAULT_RENDER_STYLE.minFontSize,
          },
        };
      }),
    );
  }, [selectedRegionId, shapeKind]);

  const handlePreviewPointerDownCapture = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (areaToolOn || createdRegionId) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('.koma-render-overlay')) {
      setErrorMessage(t('onboarding.tools.lab.selection.step1Hint'));
    }
  };

  const bannerCopy = (() => {
    if (currentStep >= 4) {
      return {
        stepNumber: 3,
        title: t('onboarding.tools.lab.selection.doneTitle'),
        hint: t('onboarding.tools.lab.selection.doneHint'),
      };
    }
    if (currentStep === 1) {
      return {
        stepNumber: 1,
        title: t('onboarding.tools.lab.selection.step1Title'),
        hint: t('onboarding.tools.lab.selection.step1Hint'),
      };
    }
    if (currentStep === 2) {
      return {
        stepNumber: 2,
        title: t('onboarding.tools.lab.selection.step2Title'),
        hint: t('onboarding.tools.lab.selection.step2Hint'),
      };
    }
    return {
      stepNumber: 3,
      title: t('onboarding.tools.lab.selection.step3Title'),
      hint: t('onboarding.tools.lab.selection.step3Hint'),
    };
  })();

  const handlePeekToggle = (): void => {
    useUiShellStore.getState().setHoldOriginalActive(!peekActive);
  };

  const handleZoomDelta = (delta: number): void => {
    setZoomPercent((prev) => Math.max(85, Math.min(130, prev + delta)));
  };

  return (
    <div className="flex flex-col gap-3" data-testid="area-lab-sandbox">
      <GuidedStepBanner
        stepNumber={bannerCopy.stepNumber}
        totalSteps={3}
        title={bannerCopy.title}
        hint={bannerCopy.hint}
        completed={textInserted}
        errorMessage={errorMessage}
        onReplay={handleReset}
      />

      <div className={cx('grid gap-3 md:grid-cols-[minmax(0,1fr)_206px]', skin.item, skin.itemOff)}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="area-lab-peek-btn"
              aria-pressed={peekActive}
              onClick={handlePeekToggle}
              className={peekActive ? skin.btnPrimary : skin.btnSmall}
            >
              <Eye size={11} aria-hidden="true" />
              <span>{t('onboarding.tools.lab.selection.peekBtn')}</span>
            </button>
            <button
              type="button"
              data-testid="area-lab-zoom-out"
              aria-label={t('onboarding.tools.lab.selection.zoomOutAria')}
              onClick={() => handleZoomDelta(-10)}
              className={skin.btnSmall}
            >
              <ZoomOut size={11} aria-hidden="true" />
            </button>
            <OnbBadge tone="neutral">{zoomPercent}%</OnbBadge>
            <button
              type="button"
              data-testid="area-lab-zoom-in"
              aria-label={t('onboarding.tools.lab.selection.zoomInAria')}
              onClick={() => handleZoomDelta(10)}
              className={skin.btnSmall}
            >
              <ZoomIn size={11} aria-hidden="true" />
            </button>
          </div>

          <div
            data-testid="area-lab-canvas"
            onPointerDownCapture={handlePreviewPointerDownCapture}
            className="relative overflow-x-auto"
          >
            <div ref={previewWrapRef} className="relative inline-block max-w-full">
              <OnboardingRenderPreview
                label={t('onboarding.tools.lab.selection.title')}
                image={labImage}
                previewSrc={ONBOARDING_LAB_ASSETS.areaCleaned}
                zoom={zoomPercent / 100}
                regions={regions}
                selectedRegionId={selectedRegionId}
                areaSelectionEnabled={areaToolOn}
                allowRegionCreation={createdRegionId === null}
                newRegionShapeKind={shapeKind}
                inlineEditorRequestKey={inlineEditorRequestKey}
                onSelectRegion={setSelectedRegionId}
                onRegionsChange={handleRegionsChange}
                onRequestRefineRegion={handleRequestRefineRegion}
              />

              {!createdRegionId && !peekActive && overlayFrame ? (
                <div
                  aria-hidden="true"
                  className={cx(
                    'pointer-events-none absolute border-2 border-dashed border-amber-400 bg-amber-400/10',
                    currentStep === 2 && 'koma-onb-tour-beacon',
                  )}
                  style={{
                    left: `${overlayFrame.left + (TARGET_BOX.x1 / LAB_W) * overlayFrame.width}px`,
                    top: `${overlayFrame.top + (TARGET_BOX.y1 / LAB_H) * overlayFrame.height}px`,
                    width: `${((TARGET_BOX.x2 - TARGET_BOX.x1) / LAB_W) * overlayFrame.width}px`,
                    height: `${((TARGET_BOX.y2 - TARGET_BOX.y1) / LAB_H) * overlayFrame.height}px`,
                    borderRadius: shapeKind === 'square' ? '2px' : '12px',
                  }}
                >
                  <span className="inline-block rounded-br bg-amber-400 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-slate-950">
                    {t('onboarding.tools.lab.selection.missedHintTag')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside
          aria-label={t('onboarding.tools.card.areaSelectTitle')}
          className={cx(
            'flex flex-col justify-between gap-2.5 p-2.5',
            skin.noir ? 'panel-cut-sm border border-paper/15 bg-ink/80' : 'rounded-xl border border-purple-400/20 bg-[#0b1020]',
          )}
        >
          <div className="flex flex-col gap-2">
            <span className={skin.label}>{t('onboarding.tools.tab.selection')}</span>

            <TourTargetRing active={currentStep === 1} className="w-full">
              <button
                type="button"
                data-testid="area-lab-select-tool"
                aria-pressed={areaToolOn}
                onClick={handleToggleAreaTool}
                className={cx('w-full justify-center', areaToolOn ? skin.btnPrimary : skin.btnSmall)}
              >
                <ScanText size={13} aria-hidden="true" />
                <span>{t('onboarding.tools.card.areaSelectTitle')}</span>
              </button>
            </TourTargetRing>

            <div className="flex flex-wrap gap-1 pt-1">
              {(['rounded', 'square'] as const).map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => setShapeKind(shape)}
                  className={shapeKind === shape ? skin.btnPrimary : skin.btnSmall}
                >
                  {shape}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            data-testid="area-lab-reset-btn"
            onClick={handleReset}
            className={cx('w-full justify-center', skin.btnSmall)}
          >
            <RefreshCcw size={12} aria-hidden="true" />
            <span>{t('onboarding.tools.lab.healing.resetBtn')}</span>
          </button>
        </aside>
      </div>
    </div>
  );
}
