import { useMemo, useRef, useState } from 'react';
import { RefreshCcw, Sparkles, Wand2 } from 'lucide-react';

import {
  HEALING_LAB_SPEC,
  ONBOARDING_LAB_ASSETS,
} from '../../../assets/onboarding-labs';
import { useI18n } from '../../../i18n';
import { OnbBadge, cx } from '../onboardingPrimitives';
import { useOnbSkin } from '../onboardingSkin';
import { GuidedStepBanner, TourTargetRing } from './InteractiveTourChrome';

const LAB_W = HEALING_LAB_SPEC.width;
const LAB_H = HEALING_LAB_SPEC.height;
const DEFECT_RECT = HEALING_LAB_SPEC.defectRect;
const GRID_COLS = 8;
const GRID_ROWS = 6;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;

interface LabPoint {
  readonly x: number;
  readonly y: number;
}

interface HealedStroke {
  readonly points: readonly LabPoint[];
  readonly radius: number;
}

type HealTool = 'none' | 'healing_brush' | 'magic_wand';

const clamp = (val: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, val));

const getCanvasPoint = (
  clientX: number,
  clientY: number,
  element: HTMLElement,
): LabPoint => {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return {
      x: clamp(clientX, 0, LAB_W),
      y: clamp(clientY, 0, LAB_H),
    };
  }
  return {
    x: clamp(((clientX - rect.left) / rect.width) * LAB_W, 0, LAB_W),
    y: clamp(((clientY - rect.top) / rect.height) * LAB_H, 0, LAB_H),
  };
};

const sampleCellsAlongSegment = (
  from: LabPoint,
  to: LabPoint,
  radius: number,
  current: Set<number>,
): Set<number> => {
  const next = new Set(current);
  const cellW = (DEFECT_RECT.x2 - DEFECT_RECT.x1) / GRID_COLS;
  const cellH = (DEFECT_RECT.y2 - DEFECT_RECT.y1) / GRID_ROWS;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(dist / 6));

  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const px = from.x + (to.x - from.x) * t;
    const py = from.y + (to.y - from.y) * t;

    for (let r = 0; r < GRID_ROWS; r += 1) {
      const cy = DEFECT_RECT.y1 + (r + 0.5) * cellH;
      for (let c = 0; c < GRID_COLS; c += 1) {
        const cxCell = DEFECT_RECT.x1 + (c + 0.5) * cellW;
        if (Math.hypot(px - cxCell, py - cy) <= radius) {
          next.add(r * GRID_COLS + c);
        }
      }
    }
  }
  return next;
};

const isPointNearDefect = (pt: LabPoint, tolerance: number): boolean => {
  const pad = clamp(Math.round(tolerance * 0.4), 10, 26);
  return (
    pt.x >= DEFECT_RECT.x1 - pad &&
    pt.x <= DEFECT_RECT.x2 + pad &&
    pt.y >= DEFECT_RECT.y1 - pad &&
    pt.y <= DEFECT_RECT.y2 + pad
  );
};

const toPolylinePoints = (points: readonly LabPoint[]): string =>
  points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');

export interface HealingLabSandboxProps {
  completed: boolean;
  onComplete: () => void;
  onNextMission?: () => void;
  nextMissionLabel?: string;
}

export function HealingLabSandbox({
  completed,
  onComplete,
  onNextMission,
  nextMissionLabel,
}: HealingLabSandboxProps) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<LabPoint | null>(null);

  const [activeTool, setActiveTool] = useState<HealTool>('none');
  const [brushRadius, setBrushRadius] = useState<number>(HEALING_LAB_SPEC.defaultBrushRadius);
  const [wandTolerance, setWandTolerance] = useState<number>(HEALING_LAB_SPEC.defaultWandTolerance);
  const [liveStroke, setLiveStroke] = useState<LabPoint[]>([]);
  const [healedStrokes, setHealedStrokes] = useState<HealedStroke[]>([]);
  const [coveredCells, setCoveredCells] = useState<Set<number>>(() => new Set());
  const [wandMaskActive, setWandMaskActive] = useState(false);
  const [healingApplied, setHealingApplied] = useState(false);
  const [healingSweeping, setHealingSweeping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const coverageRatio = coveredCells.size / TOTAL_CELLS;
  const coveragePercent = Math.min(
    100,
    Math.round((coverageRatio / HEALING_LAB_SPEC.requiredCoverage) * 100),
  );

  const triggerSweep = (): void => {
    setHealingSweeping(true);
    window.setTimeout(() => {
      setHealingSweeping(false);
    }, 550);
  };

  const handleReset = (): void => {
    drawingRef.current = false;
    lastPointRef.current = null;
    setActiveTool('none');
    setBrushRadius(HEALING_LAB_SPEC.defaultBrushRadius);
    setWandTolerance(HEALING_LAB_SPEC.defaultWandTolerance);
    setLiveStroke([]);
    setHealedStrokes([]);
    setCoveredCells(new Set());
    setWandMaskActive(false);
    setHealingApplied(false);
    setHealingSweeping(false);
    setErrorMessage(null);
  };

  const handleSelectHealingBrush = (): void => {
    if (healingApplied) return;
    setActiveTool('healing_brush');
    setWandMaskActive(false);
    setErrorMessage(null);
  };

  const handleSelectWand = (): void => {
    if (healingApplied) return;
    setActiveTool('magic_wand');
    setErrorMessage(null);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (healingApplied || !surfaceRef.current) return;
    const pt = getCanvasPoint(event.clientX, event.clientY, surfaceRef.current);

    if (activeTool === 'magic_wand') {
      if (isPointNearDefect(pt, wandTolerance)) {
        setWandMaskActive(true);
        setErrorMessage(null);
      } else {
        setWandMaskActive(false);
        setErrorMessage(t('onboarding.tools.lab.healing.wandMissError'));
      }
      return;
    }

    if (activeTool !== 'healing_brush') {
      setErrorMessage(t('onboarding.tools.lab.healing.step1Hint'));
      return;
    }

    drawingRef.current = true;
    lastPointRef.current = pt;
    setErrorMessage(null);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
    }

    setLiveStroke([pt]);
    setCoveredCells((prev) => sampleCellsAlongSegment(pt, pt, brushRadius, prev));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!drawingRef.current || healingApplied || !surfaceRef.current) return;
    const pt = getCanvasPoint(event.clientX, event.clientY, surfaceRef.current);
    const prevPt = lastPointRef.current ?? pt;
    lastPointRef.current = pt;

    setLiveStroke((prev) => [...prev, pt]);
    setCoveredCells((prev) => sampleCellsAlongSegment(prevPt, pt, brushRadius, prev));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
    }

    const pt = surfaceRef.current
      ? getCanvasPoint(event.clientX, event.clientY, surfaceRef.current)
      : liveStroke[liveStroke.length - 1];
    const strokePoints = pt && liveStroke.length > 0 ? [...liveStroke, pt] : liveStroke;
    if (strokePoints.length > 0) {
      setHealedStrokes((prev) => [...prev, { points: strokePoints, radius: brushRadius }]);
      triggerSweep();
    }
    setLiveStroke([]);

    const ratio = coveredCells.size / TOTAL_CELLS;
    if (ratio >= HEALING_LAB_SPEC.requiredCoverage) {
      setHealingApplied(true);
      setErrorMessage(null);
      onComplete();
    } else {
      setErrorMessage(t('onboarding.tools.lab.healing.step2Error'));
    }
  };

  const handleApplyWandHealing = (): void => {
    if (healingApplied || !wandMaskActive) return;
    setErrorMessage(null);
    setWandMaskActive(false);
    setHealingApplied(true);
    triggerSweep();
    onComplete();
  };

  const handleClearWandSelection = (): void => {
    setWandMaskActive(false);
    setErrorMessage(null);
  };

  const bannerCopy = useMemo(() => {
    const totalSteps = activeTool === 'magic_wand' ? 3 : 2;
    if (completed || healingApplied) {
      return {
        stepNumber: totalSteps,
        totalSteps,
        title: t('onboarding.tools.lab.healing.doneTitle'),
        hint: t('onboarding.tools.lab.healing.doneHint'),
      };
    }
    if (activeTool === 'magic_wand') {
      if (!wandMaskActive) {
        return {
          stepNumber: 2,
          totalSteps: 3,
          title: t('onboarding.tools.lab.healing.wandStep2Title'),
          hint: t('onboarding.tools.lab.healing.wandStep2Hint'),
        };
      }
      return {
        stepNumber: 3,
        totalSteps: 3,
        title: t('onboarding.tools.lab.healing.wandStep3Title'),
        hint: t('onboarding.tools.lab.healing.wandStep3Hint'),
      };
    }
    if (activeTool === 'healing_brush') {
      return {
        stepNumber: 2,
        totalSteps: 2,
        title: t('onboarding.tools.lab.healing.step2Title'),
        hint: t('onboarding.tools.lab.healing.step2Hint'),
      };
    }
    return {
      stepNumber: 1,
      totalSteps: 2,
      title: t('onboarding.tools.lab.healing.step1Title'),
      hint: t('onboarding.tools.lab.healing.step1Hint'),
    };
  }, [activeTool, completed, healingApplied, t, wandMaskActive]);

  const defectW = DEFECT_RECT.x2 - DEFECT_RECT.x1;
  const defectH = DEFECT_RECT.y2 - DEFECT_RECT.y1;

  return (
    <div className="flex flex-col gap-3" data-testid="healing-lab-sandbox">
      <GuidedStepBanner
        stepNumber={bannerCopy.stepNumber}
        totalSteps={bannerCopy.totalSteps}
        title={bannerCopy.title}
        hint={bannerCopy.hint}
        completed={healingApplied}
        errorMessage={errorMessage}
        onReplay={handleReset}
        onNextMission={onNextMission}
        nextMissionLabel={nextMissionLabel}
      />

      <div className={cx('grid gap-3 md:grid-cols-[minmax(0,1fr)_206px]', skin.item, skin.itemOff)}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className={skin.mono}>{t('onboarding.tools.lab.healing.coverageLabel')}</span>
            <OnbBadge tone={healingApplied ? 'success' : 'neutral'}>
              <span data-testid="healing-coverage">{healingApplied ? 100 : coveragePercent}%</span>
            </OnbBadge>
          </div>

          <div
            ref={surfaceRef}
            role="application"
            aria-label={t('onboarding.tools.lab.healing.title')}
            data-testid="healing-lab-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={cx(
              'relative aspect-[560/380] w-full select-none overflow-hidden border touch-none',
              skin.noir ? 'panel-cut-sm border-paper/20 bg-[#12131c]' : 'rounded-xl border-purple-400/25 bg-[#0b1020]',
              activeTool !== 'none' && !healingApplied ? 'cursor-crosshair' : 'cursor-pointer',
            )}
          >
            <img
              src={ONBOARDING_LAB_ASSETS.healingFlawed}
              alt=""
              draggable={false}
              aria-hidden="true"
              className="pointer-events-none block h-full w-full select-none object-cover"
            />

            <svg
              viewBox={`0 0 ${LAB_W} ${LAB_H}`}
              className="pointer-events-none absolute inset-0 block h-full w-full"
            >
              <defs>
                <mask id="koma-onb-healing-mask">
                  <rect x="0" y="0" width={LAB_W} height={LAB_H} fill="black" />
                  {healingApplied ? (
                    <rect x="0" y="0" width={LAB_W} height={LAB_H} fill="white" />
                  ) : (
                    healedStrokes.map((stroke, idx) =>
                      stroke.points.length === 1 && stroke.points[0] ? (
                        <circle
                          key={`hs-${idx}`}
                          cx={stroke.points[0].x}
                          cy={stroke.points[0].y}
                          r={stroke.radius}
                          fill="white"
                        />
                      ) : (
                        <polyline
                          key={`hs-${idx}`}
                          points={toPolylinePoints(stroke.points)}
                          fill="none"
                          stroke="white"
                          strokeWidth={stroke.radius * 2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ),
                    )
                  )}
                </mask>
              </defs>

              <image
                href={ONBOARDING_LAB_ASSETS.healingClean}
                x="0"
                y="0"
                width={LAB_W}
                height={LAB_H}
                preserveAspectRatio="none"
                mask="url(#koma-onb-healing-mask)"
              />

              {!healingApplied && !wandMaskActive ? (
                <rect
                  x={DEFECT_RECT.x1}
                  y={DEFECT_RECT.y1}
                  width={defectW}
                  height={defectH}
                  rx="10"
                  fill="none"
                  stroke={skin.noir ? 'rgba(255, 46, 99, 0.72)' : 'rgba(245, 158, 11, 0.78)'}
                  strokeWidth="1.75"
                  strokeDasharray="6 4"
                  className={activeTool !== 'none' ? 'koma-onb-tour-beacon' : undefined}
                />
              ) : null}

              {wandMaskActive && !healingApplied ? (
                <path
                  data-testid="healing-lab-wand-selection"
                  d={HEALING_LAB_SPEC.wandContourPath}
                  fill="rgba(56, 189, 248, 0.2)"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeDasharray="6 4"
                  className="animate-pulse"
                />
              ) : null}

              {liveStroke.length > 0 ? (
                liveStroke.length === 1 && liveStroke[0] ? (
                  <circle
                    cx={liveStroke[0].x}
                    cy={liveStroke[0].y}
                    r={brushRadius}
                    fill="rgba(248, 113, 113, 0.55)"
                    stroke="rgba(248, 113, 113, 0.95)"
                    strokeWidth="1.5"
                  />
                ) : (
                  <polyline
                    points={toPolylinePoints(liveStroke)}
                    fill="none"
                    stroke="rgba(248, 113, 113, 0.72)"
                    strokeWidth={brushRadius * 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )
              ) : null}
            </svg>

            {healingSweeping ? (
              <div aria-hidden="true" className="koma-onb-heal-sweep pointer-events-none absolute inset-0" />
            ) : null}
          </div>
        </div>

        <aside
          aria-label={t('onboarding.tools.healingFlow.title')}
          className={cx(
            'flex flex-col justify-between gap-2.5 p-2.5',
            skin.noir ? 'panel-cut-sm border border-paper/15 bg-ink/80' : 'rounded-xl border border-purple-400/20 bg-[#0b1020]',
          )}
        >
          <div className="flex flex-col gap-2">
            <span className={skin.label}>{t('onboarding.tools.tab.healing')}</span>

            <TourTargetRing active={activeTool === 'none' && !healingApplied} className="w-full">
              <div className="flex w-full items-center gap-1.5">
                <button
                  type="button"
                  data-testid="healing-lab-brush-btn"
                  aria-pressed={activeTool === 'healing_brush'}
                  onClick={handleSelectHealingBrush}
                  title={t('onboarding.tools.card.healingTitle')}
                  className={cx(
                    'flex-1 justify-center',
                    activeTool === 'healing_brush' ? skin.btnPrimary : skin.btnSmall,
                  )}
                >
                  <Sparkles size={13} aria-hidden="true" />
                  <span>{t('onboarding.tools.card.healingTitle')}</span>
                </button>
              </div>
            </TourTargetRing>

            <button
              type="button"
              data-testid="healing-lab-wand-btn"
              aria-pressed={activeTool === 'magic_wand'}
              onClick={handleSelectWand}
              title={t('onboarding.tools.card.magicWandTitle')}
              className={cx(
                'w-full justify-center',
                activeTool === 'magic_wand' ? skin.btnPrimary : skin.btnSmall,
              )}
            >
              <Wand2 size={13} aria-hidden="true" />
              <span>{t('onboarding.tools.card.magicWandTitle')}</span>
            </button>

            {activeTool === 'healing_brush' && !healingApplied ? (
              <div className={cx('flex flex-col gap-1.5 border-t pt-2', skin.noir ? 'border-paper/15' : 'border-white/10')}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={skin.mono}>{t('onboarding.tools.lab.healing.brushSizeLabel')}</span>
                  <span className={skin.mono}>{brushRadius}px</span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={48}
                  value={brushRadius}
                  aria-label={t('onboarding.tools.lab.healing.brushSizeLabel')}
                  onChange={(e) => setBrushRadius(Number(e.target.value))}
                  className="h-1.5 w-full accent-crimson"
                />
                <p className={skin.muted}>{t('onboarding.tools.lab.healing.autoApplyNote')}</p>
              </div>
            ) : null}

            {activeTool === 'magic_wand' && !healingApplied ? (
              <div className={cx('flex flex-col gap-2 border-t pt-2', skin.noir ? 'border-paper/15' : 'border-white/10')}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className={skin.mono}>{t('onboarding.tools.lab.healing.wandToleranceLabel')}</span>
                  <span className={skin.mono}>{wandTolerance}</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={80}
                  value={wandTolerance}
                  aria-label={t('onboarding.tools.lab.healing.wandToleranceLabel')}
                  onChange={(e) => setWandTolerance(Number(e.target.value))}
                  className="h-1.5 w-full accent-cyan-400"
                />
                <TourTargetRing active={wandMaskActive && !healingApplied} className="w-full">
                  <button
                    type="button"
                    data-testid="healing-lab-wand-apply-btn"
                    disabled={!wandMaskActive}
                    onClick={handleApplyWandHealing}
                    className={cx('w-full justify-center', wandMaskActive ? skin.btnPrimary : skin.btnSmall)}
                  >
                    <Sparkles size={12} aria-hidden="true" />
                    <span>{t('onboarding.tools.lab.healing.wandApplyBtn')}</span>
                  </button>
                </TourTargetRing>
                <button
                  type="button"
                  data-testid="healing-lab-wand-clear-btn"
                  disabled={!wandMaskActive}
                  onClick={handleClearWandSelection}
                  className={cx('w-full justify-center', skin.btnSmall)}
                >
                  <span>{t('onboarding.tools.lab.healing.wandClearBtn')}</span>
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            data-testid="healing-lab-reset-btn"
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
