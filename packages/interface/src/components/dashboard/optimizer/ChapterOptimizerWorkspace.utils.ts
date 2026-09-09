export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
export const MIN_ZOOM_LEVEL = 0.25;
export const MAX_ZOOM_LEVEL = 3;
export const ROTATION_OPTIONS = [0, 90, 180, 270] as const;

export const savingsPercent = (original: number, optimized: number): number => {
  if (original <= 0) return 0;
  return Math.round(((original - optimized) / original) * 100);
};

export const savingsColor = (pct: number): string => {
  if (pct >= 60) return 'var(--optim-savings-great)';
  if (pct >= 30) return 'var(--optim-savings-good)';
  if (pct > 0) return 'var(--optim-savings-ok)';
  return 'var(--auth-text-muted)';
};
