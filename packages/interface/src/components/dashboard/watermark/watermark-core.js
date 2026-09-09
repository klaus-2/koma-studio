export const WATERMARK_PRESET_VERSION = '2026-03-koma-watermark-v1';

const DEFAULT_TIMESTAMP = () => new Date().toISOString();

export const sanitizePresetName = (value) => {
  const nextValue = String(value ?? '').trim().replace(/\s+/g, ' ');
  return nextValue || 'Untitled preset';
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const createDefaultWatermarkDraft = () => ({
  placementMode: 'single',
  anchor: 'bottom-right',
  density: 3,
  gapX: 220,
  gapY: 180,
  rotation: -24,
  padding: 28,
  offsetX: 0,
  offsetY: 0,
  blendMode: 'source-over',
  baseName: 'koma-watermark',
  avoidTextRegions: false,
  multiAnchors: [],
  textLayer: {
    enabled: true,
    text: 'KŌMA Studio',
    fontFamily: 'Cabin',
    fontSize: 40,
    color: '#f8fafc',
    opacity: 0.28,
    outlineWidth: 2,
    outlineColor: '#0b1120',
    shadowBlur: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowOffsetX: 0,
    shadowOffsetY: 8,
  },
  imageLayer: {
    enabled: false,
    opacity: 0.42,
    scalePercent: 18,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
  },
  shadowLayer: {
    enabled: false,
    blur: 12,
    color: '#000000',
    opacity: 0.4,
    offsetX: 0,
    offsetY: 4,
  },
});

const withDraftOverrides = (overrides) => ({
  ...createDefaultWatermarkDraft(),
  ...overrides,
  multiAnchors: overrides?.multiAnchors ?? createDefaultWatermarkDraft().multiAnchors,
  textLayer: {
    ...createDefaultWatermarkDraft().textLayer,
    ...overrides?.textLayer,
  },
  imageLayer: {
    ...createDefaultWatermarkDraft().imageLayer,
    ...overrides?.imageLayer,
  },
  shadowLayer: {
    ...createDefaultWatermarkDraft().shadowLayer,
    ...overrides?.shadowLayer,
  },
});

export const buildBuiltinPresets = () => [
  {
    id: 'builtin-logo-discreto',
    kind: 'builtin',
    name: 'Subtle logo',
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    settings: withDraftOverrides({
      placementMode: 'single',
      anchor: 'bottom-right',
      rotation: 0,
      padding: 32,
      textLayer: { enabled: false },
      imageLayer: { enabled: true, opacity: 0.52, scalePercent: 15 },
      baseName: 'koma-logo-discreto',
    }),
  },
  {
    id: 'builtin-copyright-editorial',
    kind: 'builtin',
    name: 'Copyright editorial',
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    settings: withDraftOverrides({
      placementMode: 'single',
      anchor: 'bottom-center',
      rotation: 0,
      padding: 18,
      blendMode: 'soft-light',
      textLayer: {
        text: '© KŌMA Studio',
        fontSize: 24,
        opacity: 0.58,
        outlineWidth: 1,
      },
      baseName: 'koma-copyright-editorial',
    }),
  },
  {
    id: 'builtin-diagonal-anti-repost',
    kind: 'builtin',
    name: 'Diagonal anti-repost',
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    settings: withDraftOverrides({
      placementMode: 'single',
      anchor: 'center',
      rotation: -28,
      blendMode: 'overlay',
      textLayer: {
        text: 'DO NOT REPOST',
        fontSize: 52,
        opacity: 0.24,
        outlineWidth: 3,
      },
      baseName: 'koma-anti-repost',
    }),
  },
  {
    id: 'builtin-tiled-soft-protection',
    kind: 'builtin',
    name: 'Tiled soft protection',
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    settings: withDraftOverrides({
      placementMode: 'tile',
      anchor: 'center',
      rotation: -24,
      gapX: 220,
      gapY: 170,
      density: 4,
      blendMode: 'soft-light',
      textLayer: {
        text: 'KŌMA STUDIO',
        fontSize: 36,
        opacity: 0.16,
      },
      baseName: 'koma-soft-protection',
    }),
  },
  {
    id: 'builtin-stamp-bold',
    kind: 'builtin',
    name: 'Stamp bold',
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    settings: withDraftOverrides({
      placementMode: 'single',
      anchor: 'top-left',
      rotation: -10,
      padding: 28,
      blendMode: 'multiply',
      textLayer: {
        text: 'APPROVED',
        fontSize: 48,
        color: '#f43f5e',
        opacity: 0.72,
        outlineWidth: 2,
        outlineColor: '#1f2937',
      },
      baseName: 'koma-stamp-bold',
    }),
  },
];

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isDraft = (value) => {
  if (!isObject(value)) return false;
  return isObject(value.textLayer) && isObject(value.imageLayer);
};

const normalizePreset = (value) => {
  if (!isObject(value) || !isDraft(value.settings)) return null;
  if (typeof value.id !== 'string') return null;

  return {
    id: value.id,
    name: sanitizePresetName(value.name),
    kind: value.kind === 'builtin' ? 'builtin' : 'user',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : DEFAULT_TIMESTAMP(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : DEFAULT_TIMESTAMP(),
    settings: withDraftOverrides(value.settings),
  };
};

export const deserializeWatermarkPresets = (rawValue) => {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!isObject(parsed) || parsed.version !== WATERMARK_PRESET_VERSION || !Array.isArray(parsed.presets)) {
      return [];
    }
    return parsed.presets
      .map(normalizePreset)
      .filter(Boolean)
      .filter((preset) => preset.kind === 'user');
  } catch {
    return [];
  }
};

export const serializeWatermarkPresets = (presets) => JSON.stringify({
  version: WATERMARK_PRESET_VERSION,
  presets: presets.filter((preset) => preset.kind === 'user'),
});

const makeCopyName = (baseName, existingNames) => {
  const taken = new Set(existingNames.map((entry) => entry.toLowerCase()));
  const initial = `${baseName} (copy)`;
  if (!taken.has(initial.toLowerCase())) return initial;
  let index = 2;
  while (taken.has(`${baseName} (copy ${index})`.toLowerCase())) {
    index += 1;
  }
  return `${baseName} (copy ${index})`;
};

export const duplicatePreset = (preset, existingNames = []) => ({
  id: `preset-user-${Math.random().toString(36).slice(2, 10)}`,
  kind: 'user',
  name: makeCopyName(sanitizePresetName(preset.name), existingNames),
  createdAt: DEFAULT_TIMESTAMP(),
  updatedAt: DEFAULT_TIMESTAMP(),
  settings: withDraftOverrides(preset.settings),
});

const luminance = (r, g, b) => (0.2126 * r) + (0.7152 * g) + (0.0722 * b);

const buildRegionScore = (pixels, width, startX, startY, sampleWidth, sampleHeight) => {
  let total = 0;
  let totalSquare = 0;
  let count = 0;

  for (let y = startY; y < startY + sampleHeight; y += 1) {
    for (let x = startX; x < startX + sampleWidth; x += 1) {
      const offset = ((y * width) + x) * 4;
      const value = luminance(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      total += value;
      totalSquare += value * value;
      count += 1;
    }
  }

  const mean = total / Math.max(count, 1);
  const variance = (totalSquare / Math.max(count, 1)) - (mean * mean);
  const distanceFromMid = Math.abs(mean - 127.5);
  const score = distanceFromMid - (variance * 0.18) + (mean * 0.08);

  return { mean, variance, score };
};

export const suggestSmartPlacement = ({ width, height, pixels }) => {
  if (!(pixels instanceof Uint8ClampedArray) || width <= 0 || height <= 0) {
    return {
      position: 'bottom-right',
      textColor: '#f8fafc',
      reason: 'Fallback applied because no analysis data was available.',
    };
  }

  const sampleWidth = clamp(Math.floor(width * 0.28), 1, width);
  const sampleHeight = clamp(Math.floor(height * 0.28), 1, height);
  const regions = [
    { position: 'top-left', x: 0, y: 0 },
    { position: 'top-right', x: width - sampleWidth, y: 0 },
    { position: 'bottom-left', x: 0, y: height - sampleHeight },
    { position: 'bottom-right', x: width - sampleWidth, y: height - sampleHeight },
  ];

  const ranked = regions
    .map((region) => ({
      ...region,
      ...buildRegionScore(pixels, width, region.x, region.y, sampleWidth, sampleHeight),
    }))
    .sort((left, right) => right.score - left.score);

  const winner = ranked[0] ?? { position: 'bottom-right', mean: 40, variance: 0 };
  const textColor = winner.mean > 144 ? '#111111' : '#f8fafc';
  const contrastLabel = winner.mean > 144 ? 'light region' : 'dark region';

  return {
    position: winner.position,
    textColor,
    reason: `Auto suggestion: ${winner.position} combines a ${contrastLabel} with less visual noise.`,
  };
};
