export const DEFAULT_NOIR_ACCENT_DARK = '#ff2e63';
export const DEFAULT_NOIR_ACCENT_LIGHT = '#c9143f';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface NoirAccentPreset {
  id: string;
  hex: string;
  labelKey:
    | 'crimson'
    | 'gold'
    | 'azure'
    | 'mint'
    | 'amber'
    | 'violet'
    | 'cobalt'
    | 'ivory';
}

export const NOIR_ACCENT_PRESETS: readonly NoirAccentPreset[] = [
  { id: 'crimson', hex: '#ff2e63', labelKey: 'crimson' },
  { id: 'gold', hex: '#ffc857', labelKey: 'gold' },
  { id: 'azure', hex: '#4dc9ff', labelKey: 'azure' },
  { id: 'mint', hex: '#3ef2b0', labelKey: 'mint' },
  { id: 'amber', hex: '#ff7a2e', labelKey: 'amber' },
  { id: 'violet', hex: '#b366ff', labelKey: 'violet' },
  { id: 'cobalt', hex: '#3b82f6', labelKey: 'cobalt' },
  { id: 'ivory', hex: '#f2ede3', labelKey: 'ivory' },
] as const;

const HEX6_RE = /^#([0-9a-f]{6})$/i;
const HEX3_RE = /^#([0-9a-f]{3})$/i;

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

  const match6 = HEX6_RE.exec(withHash);
  const fullHex = match6?.[1];
  if (fullHex) {
    return `#${fullHex.toLowerCase()}`;
  }

  const match3 = HEX3_RE.exec(withHash);
  const shortHex = match3?.[1];
  if (shortHex && shortHex.length === 3) {
    const [r, g, b] = shortHex.toLowerCase().split('');
    if (r && g && b) {
      return `#${r}${r}${g}${g}${b}${b}`;
    }
  }

  return null;
}

export function clampChannel(channel: number): number {
  if (!Number.isFinite(channel)) return 0;
  return Math.max(0, Math.min(255, Math.round(channel)));
}

export function hexToRgb(hex: string): RgbColor | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return { r, g, b };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toPart = (n: number) => clampChannel(n).toString(16).padStart(2, '0');
  return `#${toPart(r)}${toPart(g)}${toPart(b)}`;
}
