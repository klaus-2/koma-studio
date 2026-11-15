import { describe, expect, it } from 'vitest';

import {
  estimateAioBatchCost,
  LLM_MAX_OUTPUT_TOKENS,
  NEIGHBOR_MAX_CHARS_PER_PAGE,
  PROMPT_OVERHEAD_CHARS_PER_IMAGE,
} from './aio-cost-estimate';
import type { CostEstimateInput } from './aio-cost-estimate';

const baseInput: CostEstimateInput = {
  imageCount: 10,
  imagesWithKnownText: 0,
  knownTextChars: 0,
  rates: { ocrPerImage: 0.001, translationPer1kTokens: 0.5 },
  neighborContextEnabled: false,
  maxOutputTokens: 4096,
  cloudOcrSelected: true,
  cloudTranslationSelected: true,
};

describe('estimateAioBatchCost', () => {
  it('uses the chars/4 heuristic plus the documented prompt overhead', () => {
    const result = estimateAioBatchCost({
      ...baseInput,
      imageCount: 4,
      imagesWithKnownText: 4,
      knownTextChars: 8000,
      cloudOcrSelected: false,
    });

    expect(result.translationInputTokens).toBe(2800);
    expect(result.translationOutputTokens).toBe(4 * 4096);
  });

  it('bounds the neighbor-context adder to 2x800 chars per page', () => {
    const withNeighbors = estimateAioBatchCost({
      ...baseInput,
      imageCount: 1,
      imagesWithKnownText: 1,
      knownTextChars: 0,
      neighborContextEnabled: true,
      cloudOcrSelected: false,
    });
    const without = estimateAioBatchCost({
      ...baseInput,
      imageCount: 1,
      imagesWithKnownText: 1,
      knownTextChars: 0,
      neighborContextEnabled: false,
      cloudOcrSelected: false,
    });

    expect(
      withNeighbors.translationInputTokens - without.translationInputTokens,
    ).toBe(NEIGHBOR_MAX_CHARS_PER_PAGE / 4);
    expect(PROMPT_OVERHEAD_CHARS_PER_IMAGE).toBe(800);
  });

  it('caps output tokens by min(LLM_MAX_OUTPUT_TOKENS, user max_tokens)', () => {
    const capped = estimateAioBatchCost({
      ...baseInput,
      imageCount: 1,
      maxOutputTokens: 1000,
      cloudOcrSelected: false,
    });
    expect(capped.translationOutputTokens).toBe(1000);

    const uncapped = estimateAioBatchCost({
      ...baseInput,
      imageCount: 1,
      maxOutputTokens: 99_999,
      cloudOcrSelected: false,
    });
    expect(uncapped.translationOutputTokens).toBe(LLM_MAX_OUTPUT_TOKENS);
  });

  it('computes per-image OCR cost and per-1k-token translation cost', () => {
    const result = estimateAioBatchCost({ ...baseInput, imageCount: 10 });

    expect(result.ocrCost).toBeCloseTo(0.01, 6);
    expect(result.translationCost).toBeGreaterThan(0);
    expect(result.totalCost).toBeCloseTo(
      (result.ocrCost ?? 0) + (result.translationCost ?? 0),
      8,
    );
  });

  it('reports a text-volume range when unknown-text images exist', () => {
    const result = estimateAioBatchCost({ ...baseInput, imageCount: 5 });

    expect(result.textVolumeKnown).toBe(false);
    expect(result.knownTextCharsRange).not.toBeNull();
    expect(result.knownTextCharsRange?.[0]).toBe(
      5 * 600 + 5 * PROMPT_OVERHEAD_CHARS_PER_IMAGE,
    );
    expect(result.knownTextCharsRange?.[1]).toBe(
      5 * 2400 + 5 * PROMPT_OVERHEAD_CHARS_PER_IMAGE,
    );
  });

  it('reports known text volume when every image has known text', () => {
    const result = estimateAioBatchCost({
      ...baseInput,
      imageCount: 5,
      imagesWithKnownText: 5,
      knownTextChars: 5000,
    });

    expect(result.textVolumeKnown).toBe(true);
    expect(result.knownTextCharsRange).toBeNull();
  });

  it('returns null costs for unselected stages', () => {
    const result = estimateAioBatchCost({
      ...baseInput,
      cloudOcrSelected: false,
      cloudTranslationSelected: false,
    });

    expect(result.ocrCost).toBeNull();
    expect(result.translationCost).toBeNull();
    expect(result.totalCost).toBeNull();
  });
});
