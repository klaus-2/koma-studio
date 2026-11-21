import { describe, expect, it } from 'vitest';

import { buildInstallState, createMockModel } from '../../models/model-install-fixtures';
import type { AioLocalModelStage, InstallAllSummary, ModelInstallState } from '../../models/types';
import {
  ALL_AIO_LOCAL_STAGES,
  buildMultiStageInstallSummary,
  buildScopedInstallSummary,
} from './recommendedInstall';

const makeEntry = (
  id: string,
  stage: AioLocalModelStage,
  status: ModelInstallState['status'] = 'not_installed',
): ModelInstallState => buildInstallState({ ...createMockModel(id), stage }, status);

const estimateBytes = (model: { id: string }): number =>
  model.id === 'manga_ocr' ? 300 : 500;

const EMPTY_SUMMARY: InstallAllSummary = {
  totalBytes: 0,
  requiredBytes: 0,
  eligibleModelIds: [],
};

describe('buildMultiStageInstallSummary', () => {
  it('returns an empty summary when no stages are provided', () => {
    const summary = buildMultiStageInstallSummary(
      { manga_ocr: makeEntry('manga_ocr', 'recognizeText') },
      [],
      'ja',
      'en',
      estimateBytes,
    );
    expect(summary).toEqual(EMPTY_SUMMARY);
  });

  it('matches buildScopedInstallSummary for a single stage', () => {
    const entries = {
      manga_ocr: makeEntry('manga_ocr', 'recognizeText'),
      paddleocr_en_v5: makeEntry('paddleocr_en_v5', 'recognizeText'),
    };
    const multi = buildMultiStageInstallSummary(
      entries,
      ['recognizeText'],
      'ja',
      'en',
      estimateBytes,
    );
    const scoped = buildScopedInstallSummary(
      entries,
      'recognizeText',
      'ja',
      'en',
      EMPTY_SUMMARY,
      estimateBytes,
    );
    expect(multi).toEqual(scoped);
  });

  it('aggregates stages and dedupes repeated ids preserving the first occurrence', () => {
    const entries = {
      manga_ocr: makeEntry('manga_ocr', 'recognizeText'),
      font_rtdetr_v2: makeEntry('font_rtdetr_v2', 'detectText'),
      baka_content_cc: makeEntry('baka_content_cc', 'segmentText'),
      aot: makeEntry('aot', 'cleanImage'),
      paddleocr_en_v5: makeEntry('paddleocr_en_v5', 'recognizeText'),
    };
    const summary = buildMultiStageInstallSummary(
      entries,
      ['recognizeText', 'detectText', 'recognizeText', 'segmentText', 'cleanImage'],
      'ja',
      'en',
      estimateBytes,
    );

    expect(summary.eligibleModelIds).toEqual([
      'manga_ocr',
      'font_rtdetr_v2',
      'baka_content_cc',
      'aot',
    ]);
    expect(summary.totalBytes).toBe(300 + 500 + 500 + 500);
    expect(summary.requiredBytes).toBe(summary.totalBytes);
  });

  it('applies the modal language parameters to every stage', () => {
    const entries = {
      manga_ocr: makeEntry('manga_ocr', 'recognizeText'),
      paddleocr_en_v5: makeEntry('paddleocr_en_v5', 'recognizeText'),
    };

    expect(
      buildMultiStageInstallSummary(entries, ['recognizeText'], 'ja', 'en', estimateBytes)
        .eligibleModelIds,
    ).toEqual(['manga_ocr']);
    expect(
      buildMultiStageInstallSummary(entries, ['recognizeText'], 'en', 'en', estimateBytes)
        .eligibleModelIds,
    ).toEqual(['paddleocr_en_v5']);
  });

  it('installs across all six stages even when a single-stage filter would scope the modal', () => {
    const entries = {
      sugoi_v4_ja_en_ct2: makeEntry('sugoi_v4_ja_en_ct2', 'translation'),
      font_rtdetr_v2: makeEntry('font_rtdetr_v2', 'detectText'),
      manga_ocr: makeEntry('manga_ocr', 'recognizeText'),
      baka_content_cc: makeEntry('baka_content_cc', 'segmentText'),
      aot: makeEntry('aot', 'cleanImage'),
      waifu2x_mock: makeEntry('waifu2x_mock', 'enhanceImage'),
    };

    const scopedToRecognize = buildScopedInstallSummary(
      entries,
      'recognizeText',
      'ja',
      'en',
      EMPTY_SUMMARY,
      estimateBytes,
    );
    expect(scopedToRecognize.eligibleModelIds).toEqual(['manga_ocr']);

    const multi = buildMultiStageInstallSummary(
      entries,
      ALL_AIO_LOCAL_STAGES,
      'ja',
      'en',
      estimateBytes,
    );

    expect(multi.eligibleModelIds).toEqual([
      'sugoi_v4_ja_en_ct2',
      'font_rtdetr_v2',
      'manga_ocr',
      'baka_content_cc',
      'aot',
      'waifu2x_mock',
    ]);
    expect(multi.totalBytes).toBe(300 + 500 + 500 + 500 + 500 + 500);
    expect(multi.requiredBytes).toBe(multi.totalBytes);
  });

  it('excludes ineligible statuses but keeps uncurated stages eligible', () => {
    const entries = {
      installed_ocr: makeEntry('manga_ocr', 'recognizeText', 'installed'),
      waifu2x_mock: makeEntry('waifu2x_mock', 'enhanceImage'),
    };
    const summary = buildMultiStageInstallSummary(
      entries,
      ['recognizeText', 'enhanceImage'],
      'ja',
      'en',
      estimateBytes,
    );

    expect(summary.eligibleModelIds).toEqual(['waifu2x_mock']);
    expect(summary.totalBytes).toBe(500);
  });

  it('exposes the six selectable AIO stages in pipeline order', () => {
    expect(ALL_AIO_LOCAL_STAGES).toEqual([
      'translation',
      'detectText',
      'recognizeText',
      'segmentText',
      'cleanImage',
      'enhanceImage',
    ]);
  });
});
