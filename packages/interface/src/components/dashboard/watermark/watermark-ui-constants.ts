import type { WatermarkAnchor } from './watermarkTypes';

export const FONT_OPTIONS = [
  'Cabin',
  'Manrope',
  'Instrument Serif',
  'Georgia',
  'Times New Roman',
];

export const BLEND_OPTIONS = [
  { value: 'source-over', labelKey: 'watermark.blend.normal' },
  { value: 'multiply', labelKey: 'watermark.blend.multiply' },
  { value: 'screen', labelKey: 'watermark.blend.screen' },
  { value: 'overlay', labelKey: 'watermark.blend.overlay' },
  { value: 'soft-light', labelKey: 'watermark.blend.softLight' },
  { value: 'hard-light', labelKey: 'watermark.blend.hardLight' },
  { value: 'color-dodge', labelKey: 'watermark.blend.colorDodge' },
  { value: 'color-burn', labelKey: 'watermark.blend.colorBurn' },
] as const;

export const ANCHOR_OPTIONS: Array<{ value: WatermarkAnchor; label: string }> = [
  { value: 'top-left', label: '\u2196' },
  { value: 'top-center', label: '\u2191' },
  { value: 'top-right', label: '\u2197' },
  { value: 'center-left', label: '\u2190' },
  { value: 'center', label: '\u2022' },
  { value: 'center-right', label: '\u2192' },
  { value: 'bottom-left', label: '\u2199' },
  { value: 'bottom-center', label: '\u2193' },
  { value: 'bottom-right', label: '\u2198' },
];

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
export const ZOOM_DEFAULT = 1;
