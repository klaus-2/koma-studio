import type {
  WatermarkAnchor,
  WatermarkDraft,
  WatermarkPresetV1,
} from './watermarkTypes';

export const WATERMARK_PRESET_VERSION: string;

export function sanitizePresetName(value: unknown): string;

export function createDefaultWatermarkDraft(): WatermarkDraft;

export function buildBuiltinPresets(): WatermarkPresetV1[];

export function deserializeWatermarkPresets(
  rawValue: string | null | undefined,
): WatermarkPresetV1[];

export function serializeWatermarkPresets(
  presets: WatermarkPresetV1[],
): string;

export function duplicatePreset(
  preset: WatermarkPresetV1,
  existingNames?: string[],
): WatermarkPresetV1;

export function suggestSmartPlacement(input: {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}): {
  position: WatermarkAnchor;
  textColor: string;
  reason: string;
};
