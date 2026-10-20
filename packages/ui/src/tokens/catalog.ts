/* ============================================================
   KŌMA STUDIO — Typed design-token catalog
   Complements styles/tokens.css so TS callers can share one
   typed scale instead of scattering magic numbers.
   ============================================================ */

export const spacing = {
  '0': '0',
  '1': '0.25rem',
  '2': '0.5rem',
  '3': '0.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '8': '2rem',
  '10': '2.5rem',
  '12': '3rem',
  '16': '4rem',
} as const;

export type SpacingToken = keyof typeof spacing;

export const typography = {
  fontFamily: {
    body: "var(--auth-font-body, 'Manrope', 'Segoe UI', system-ui, sans-serif)",
    heading: "var(--auth-font-heading, 'Cabin', 'Segoe UI', system-ui, sans-serif)",
    display: "var(--auth-font-display, 'Instrument Serif', 'Times New Roman', serif)",
    mono: "ui-monospace, 'Cascadia Code', 'JetBrains Mono', Menlo, monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.15',
    snug: '1.35',
    normal: '1.5',
    relaxed: '1.65',
  },
} as const;

export type FontSizeToken = keyof typeof typography.fontSize;

export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgb(0 0 0 / 0.25)',
  md: '0 4px 12px rgb(0 0 0 / 0.28)',
  lg: '0 12px 32px rgb(0 0 0 / 0.32)',
} as const;

export type ShadowToken = keyof typeof shadows;

export const motion = {
  duration: {
    instant: '80ms',
    fast: '140ms',
    base: '220ms',
    slow: '360ms',
    deliberate: '560ms',
  },
  ease: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
    exit: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

export type MotionDurationToken = keyof typeof motion.duration;

export const radius = {
  sharp: '2px',
  control: '6px',
  surface: '10px',
  canvas: '16px',
  pill: '999px',
} as const;

export type RadiusToken = keyof typeof radius;

export const tokens = {
  spacing,
  typography,
  shadows,
  motion,
  radius,
} as const;

export type DesignTokens = typeof tokens;
