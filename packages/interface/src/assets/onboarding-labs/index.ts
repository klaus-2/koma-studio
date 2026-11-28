import areaCleanedUrl from './area-cleaned.webp';
import areaOriginalUrl from './area-original.webp';
import healingCleanUrl from './healing-clean.webp';
import healingFlawedUrl from './healing-flawed.webp';
import refineCleanUrl from './refine-clean.webp';

export const ONBOARDING_LAB_ASSETS = {
  healingClean: healingCleanUrl,
  healingFlawed: healingFlawedUrl,
  refineClean: refineCleanUrl,
  areaOriginal: areaOriginalUrl,
  areaCleaned: areaCleanedUrl,
} as const;

export interface LabRect {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export const HEALING_LAB_SPEC = {
  width: 560,
  height: 380,
  defectRect: {
    x1: 6,
    y1: 102,
    x2: 146,
    y2: 282,
  } satisfies LabRect,
  wandContourPath:
    'M 18 118 Q 82 96 138 142 Q 152 212 128 274 Q 68 286 14 268 Q 6 196 18 118 Z',
  defaultBrushRadius: 30,
  defaultWandTolerance: 32,
  requiredCoverage: 0.35,
} as const;

export const REFINE_LAB_SPEC = {
  width: 560,
  height: 395,
  bubbleBox: [158, 12, 404, 194] as const,
  bubbleEllipse: {
    cx: 280,
    cy: 101,
    rx: 94,
    ry: 66,
  },
} as const;

export const AREA_LAB_SPEC = {
  width: 560,
  height: 367,
  detectedBox: {
    x1: 113,
    y1: 25,
    x2: 513,
    y2: 218,
  } satisfies LabRect,
  missedBox: {
    x1: 10,
    y1: 178,
    x2: 248,
    y2: 359,
  } satisfies LabRect,
} as const;
