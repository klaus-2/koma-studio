import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WATERMARK_PRESET_VERSION,
  buildBuiltinPresets,
  createDefaultWatermarkDraft,
  deserializeWatermarkPresets,
  duplicatePreset,
  sanitizePresetName,
  suggestSmartPlacement,
} from './watermark-core.js';

test('builtin presets expose the expected professional quick presets', () => {
  const presets = buildBuiltinPresets();
  const labels = presets.map((preset) => preset.name);

  assert.equal(presets.length, 5);
  assert.deepEqual(labels, [
    'Logo discreto',
    'Copyright editorial',
    'Diagonal anti-repost',
    'Tiled soft protection',
    'Stamp bold',
  ]);
});

test('deserializeWatermarkPresets returns fallback defaults for invalid payloads', () => {
  const presets = deserializeWatermarkPresets('{"version":"old","presets":"invalid"}');

  assert.deepEqual(presets, []);
});

test('deserializeWatermarkPresets keeps only compatible user presets', () => {
  const raw = JSON.stringify({
    version: WATERMARK_PRESET_VERSION,
    presets: [
      {
        id: 'preset-user-1',
        name: 'Studio Batch',
        kind: 'user',
        createdAt: '2026-03-11T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z',
        settings: createDefaultWatermarkDraft(),
      },
      {
        id: 12,
        name: '',
      },
    ],
  });

  const presets = deserializeWatermarkPresets(raw);

  assert.equal(presets.length, 1);
  assert.equal(presets[0].name, 'Studio Batch');
  assert.equal(presets[0].kind, 'user');
});

test('duplicatePreset creates a user copy with deduplicated naming', () => {
  const original = {
    id: 'preset-user-1',
    name: 'Studio Batch',
    kind: 'user',
    createdAt: '2026-03-11T00:00:00.000Z',
    updatedAt: '2026-03-11T00:00:00.000Z',
    settings: createDefaultWatermarkDraft(),
  };

  const copy = duplicatePreset(original, ['Studio Batch', 'Studio Batch (copy)']);

  assert.notEqual(copy.id, original.id);
  assert.equal(copy.name, 'Studio Batch (copy 2)');
  assert.equal(copy.kind, 'user');
  assert.deepEqual(copy.settings, original.settings);
});

test('sanitizePresetName normalizes empty labels', () => {
  assert.equal(sanitizePresetName('   '), 'Preset sem nome');
  assert.equal(sanitizePresetName('  Meu preset  '), 'Meu preset');
});

test('suggestSmartPlacement favors less noisy corners with legible contrast', () => {
  const width = 4;
  const height = 4;
  const pixels = new Uint8ClampedArray([
    245, 245, 245, 255, 247, 247, 247, 255, 240, 240, 240, 255, 242, 242, 242, 255,
    244, 244, 244, 255, 246, 246, 246, 255, 100, 100, 100, 255, 90, 90, 90, 255,
    80, 80, 80, 255, 75, 75, 75, 255, 30, 30, 30, 255, 20, 20, 20, 255,
    78, 78, 78, 255, 70, 70, 70, 255, 25, 25, 25, 255, 10, 10, 10, 255,
  ]);

  const suggestion = suggestSmartPlacement({
    width,
    height,
    pixels,
  });

  assert.equal(suggestion.position, 'top-left');
  assert.equal(suggestion.textColor, '#111111');
  assert.ok(suggestion.reason.length > 0);
});
