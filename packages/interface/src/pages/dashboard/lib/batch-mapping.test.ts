import { describe, expect, it } from 'vitest';

import type {
  PipelineBatchItemResult,
  PipelineBatchReport,
  PipelineBatchStages,
} from '@/types/dashboard.types';
import {
  applyDetectedGradientToStyle,
  cloneRenderStyle,
} from '@/utils/dashboard.utils';
import { BatchMappingError, mapBatchReportToAioResults, type BatchMappingAioSteps, type BatchMappingImage } from './batch-mapping';

const steps: BatchMappingAioSteps = {
  recognizeText: true,
  getTranslations: true,
  segmentText: true,
  cleanImage: true,
  render: true,
};

const stages: PipelineBatchStages = {
  detect: true,
  ocr: true,
  translation: true,
  segment: true,
  clean: true,
};

const makeImage = (index: number): BatchMappingImage => ({
  id: `image-${index}`,
  file: new File([new Uint8Array([index])], `page-${index}.png`, {
    type: 'image/png',
  }),
  width: 400,
  height: 300,
});

const detectPayload = (): NonNullable<PipelineBatchItemResult['detect']> => ({
  regions_count: 2,
  model_used: 'detector',
  image_width: 400,
  image_height: 300,
  detections: [
    {
      id: 'r1',
      bbox: [10, 10, 110, 60],
      score: 0.9,
      label: 'text_bubble',
      source: 'model',
      model_key: 'detector',
    },
    {
      id: 'r2',
      bbox: [20, 120, 120, 170],
      score: 0.9,
      label: 'text_bubble',
      source: 'model',
      model_key: 'detector',
    },
  ],
});

const ocrPayload = (): NonNullable<PipelineBatchItemResult['ocr']> => ({
  regions_count: 2,
  model_used: 'ocr',
  image_width: 400,
  image_height: 300,
  regions: [
    {
      id: 'r2',
      bbox: [20, 120, 120, 170],
      text: 'two',
      score: 0.8,
      source: 'model',
      detector_model_key: 'detector',
      ocr_model_key: 'ocr',
    },
    {
      id: 'r1',
      bbox: [10, 10, 110, 60],
      text: 'one',
      score: 0.9,
      source: 'model',
      detector_model_key: 'detector',
      ocr_model_key: 'ocr',
    },
  ],
});

const translationPayload = (): NonNullable<
  PipelineBatchItemResult['translation']
> => ({
  regions_count: 2,
  model_used: 'translator',
  source_language: 'ja',
  target_language: 'en',
  regions: [
    {
      id: 'r2',
      source_text: 'two-src',
      translated_text: 'TWO',
      source: 'model',
      detector_model_key: 'detector',
      ocr_model_key: 'ocr',
      translator_model_key: 'translator',
    },
    {
      id: 'r1',
      source_text: 'one-src',
      translated_text: 'ONE',
      source: 'model',
      detector_model_key: 'detector',
      ocr_model_key: 'ocr',
      translator_model_key: 'translator',
    },
  ],
});

const segmentPayload = (
  mask: string | null,
): NonNullable<PipelineBatchItemResult['segment']> => ({
  regions_count: 2,
  model_used: 'segmenter',
  image_width: 400,
  image_height: 300,
  regions: [
    {
      id: 'r1',
      bbox: [10, 10, 110, 60],
      segment_boxes: [[10, 10, 110, 60]],
      merged_boxes: [[10, 10, 110, 60]],
      source: 'model',
      detector_model_key: 'detector',
      ocr_model_key: 'ocr',
      translator_model_key: 'translator',
      segment_model_key: 'segmenter',
      mask_base64: mask,
    },
    {
      id: 'r2',
      bbox: [20, 120, 120, 170],
      segment_boxes: [[20, 120, 120, 170]],
      merged_boxes: [[20, 120, 120, 170]],
      source: 'model',
      detector_model_key: 'detector',
      ocr_model_key: 'ocr',
      translator_model_key: 'translator',
      segment_model_key: 'segmenter',
      mask_base64: null,
    },
  ],
});

const makeResult = (
  index: number,
  overrides: Partial<PipelineBatchItemResult> = {},
): PipelineBatchItemResult => ({
  index,
  filename: `page-${index}.png`,
  status: 'success',
  detect: detectPayload(),
  ocr: ocrPayload(),
  translation: translationPayload(),
  segment: segmentPayload('mask-r1'),
  clean: {
    output_file: `cleaned/${String(index).padStart(3, '0')}-page-${index}.png`,
    model_used: 'cleaner',
  },
  errors: [],
  ...overrides,
});

const makeReport = (results: PipelineBatchItemResult[]): PipelineBatchReport => ({
  batch_id: 'batch-1',
  total_images: results.length,
  succeeded: results.filter((result) => result.status === 'success').length,
  partial: results.filter((result) => result.status === 'partial').length,
  failed: results.filter((result) => result.status === 'failed').length,
  stages,
  results,
  requested_concurrency: 4,
  effective_concurrency: 4,
  concurrency_note: null,
});

const readBlobBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error('Expected the blob to be read as an ArrayBuffer.'));
        return;
      }
      resolve(new Uint8Array(result));
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Could not read the blob.'));
    });
    reader.readAsArrayBuffer(blob);
  });

const baseInput = (results: PipelineBatchItemResult[]) => ({
  report: makeReport(results),
  aioSteps: steps,
  targetLanguage: 'en',
  renderDefaultStyle: cloneRenderStyle(),
  applyDetectedGradientToStyle,
  minRegionSize: 4,
});

describe('mapBatchReportToAioResults', () => {
  it('binds cleaned output by output_file, never by array position', async () => {
    const images = [makeImage(0), makeImage(1)];
    const results = [
      makeResult(0, { clean: { output_file: 'cleaned/009-shared.png' } }),
      makeResult(1, { clean: { output_file: 'cleaned/002-other.png' } }),
    ];
    const zipEntries: Record<string, Uint8Array> = {
      'cleaned/002-other.png': new Uint8Array([1, 2, 3]),
      'cleaned/009-shared.png': new Uint8Array([9, 9, 9]),
    };

    const mapped = mapBatchReportToAioResults({
      ...baseInput(results),
      images,
      zipEntries,
    });

    expect(mapped).toHaveLength(2);
    expect(mapped[0]?.imageId).toBe('image-0');
    expect(mapped[1]?.imageId).toBe('image-1');
    expect(mapped[0]?.cleanedDownload?.fileName).toBe(
      'koma-studio-aio-clean-page-0.png.png',
    );
    expect(mapped[1]?.cleanedDownload?.fileName).toBe(
      'koma-studio-aio-clean-page-1.png.png',
    );

    const firstBlob = mapped[0]?.cleanedDownload?.blob;
    const secondBlob = mapped[1]?.cleanedDownload?.blob;
    if (!firstBlob || !secondBlob) {
      throw new Error('Expected both cleaned downloads to exist.');
    }
    expect([...(await readBlobBytes(firstBlob))]).toEqual([9, 9, 9]);
    expect([...(await readBlobBytes(secondBlob))]).toEqual([1, 2, 3]);
    expect(mapped[0]?.countAsProcessed).toBe(true);
  });

  it('merges OCR, translation and segment payloads by region id', () => {
    const images = [makeImage(0)];
    const zipEntries: Record<string, Uint8Array> = {
      'cleaned/000-page-0.png': new Uint8Array([4, 5, 6]),
    };

    const mapped = mapBatchReportToAioResults({
      ...baseInput([makeResult(0)]),
      images,
      zipEntries,
    });
    const image = mapped[0];

    expect(image?.ocrDetections.map((region) => region.id)).toEqual(['r1', 'r2']);
    expect(image?.ocrDetections[0]?.recognizedText).toBe('one');
    expect(image?.ocrDetections[1]?.recognizedText).toBe('two');
    expect(image?.translationDetections[0]?.translatedText).toBe('ONE');
    expect(image?.translationDetections[1]?.translatedText).toBe('TWO');
    expect(image?.segmentDetections[0]?.maskBase64).toBe('mask-r1');
    expect(image?.segmentDetections[1]?.maskBase64).toBeUndefined();
    expect(image?.renderDetections[0]?.renderText).toBe('ONE');
    expect(image?.renderDetections[0]?.renderStyle).toBeDefined();
  });

  it('turns a failed report item into empty arrays without reading the zip', () => {
    const images = [makeImage(0)];
    const failed: PipelineBatchItemResult = makeResult(0, {
      status: 'failed',
      errors: [{ stage: 'ocr', message: 'OCR exploded' }],
    });

    const mapped = mapBatchReportToAioResults({
      ...baseInput([failed]),
      images,
      zipEntries: null,
    });

    expect(mapped[0]).toEqual({
      imageId: 'image-0',
      detectDetections: [],
      ocrDetections: [],
      translationDetections: [],
      segmentDetections: [],
      cleanDetections: [],
      renderDetections: [],
      cleanedDownload: null,
      countAsProcessed: false,
      executionNotices: ['ocr: OCR exploded'],
    });
  });

  it('keeps a backend stage error visible on a partial item', () => {
    const images = [makeImage(0)];
    const partial = makeResult(0, {
      status: 'partial',
      errors: [
        { stage: 'translation', message: 'custom: Custom AI requires api_base and model.' },
      ],
    });

    const mapped = mapBatchReportToAioResults({
      ...baseInput([partial]),
      images,
      zipEntries: { 'cleaned/000-page-0.png': new Uint8Array([7]) },
    });

    expect(mapped[0]?.countAsProcessed).toBe(true);
    expect(mapped[0]?.executionNotices).toContain(
      'translation: custom: Custom AI requires api_base and model.',
    );
  });

  it('fails the item when the report names a cleaned file the zip does not contain', () => {
    const images = [makeImage(0)];
    const results = [
      makeResult(0, { clean: { output_file: 'cleaned/missing.png' } }),
    ];

    const mapped = mapBatchReportToAioResults({
      ...baseInput(results),
      images,
      zipEntries: {
        'cleaned/000-page-0.png': new Uint8Array([7]),
      },
    });

    expect(mapped[0]?.countAsProcessed).toBe(false);
    expect(mapped[0]?.cleanedDownload).toBeNull();
    expect(mapped[0]?.detectDetections).toEqual([]);
    expect(mapped[0]?.ocrDetections).toEqual([]);
    expect(mapped[0]?.executionNotices).toEqual([
      'The batch report lists cleaned output "cleaned/missing.png" for "page-0.png" but the archive does not contain it.',
    ]);
  });

  it('adds one vram_to_cpu notice per fallback payload', () => {
    const images = [makeImage(0)];
    const results = [
      makeResult(0, {
        ocr: {
          ...ocrPayload(),
          model_used: 'got_ocr2',
          fell_back_to_cpu: true,
          fallback_reason: 'vram_to_cpu',
        },
      }),
    ];
    const zipEntries: Record<string, Uint8Array> = {
      'cleaned/000-page-0.png': new Uint8Array([1]),
    };

    const mapped = mapBatchReportToAioResults({
      ...baseInput(results),
      images,
      zipEntries,
    });

    const notices = mapped[0]?.executionNotices ?? [];
    expect(notices).toHaveLength(1);
    expect(notices[0]).toBe(
      'Model "got_ocr2" ran on CPU because free VRAM was below the model\'s declared requirement (decided before load) during the "Recognize Text" stage. Processing may be slower.',
    );
  });

  it('emits no notice for an item that did not fall back', () => {
    const images = [makeImage(0), makeImage(1)];
    const results = [
      makeResult(0, {
        ocr: {
          ...ocrPayload(),
          model_used: 'got_ocr2',
          fell_back_to_cpu: true,
          fallback_reason: 'vram_to_cpu',
        },
      }),
      makeResult(1),
    ];
    const zipEntries: Record<string, Uint8Array> = {
      'cleaned/000-page-0.png': new Uint8Array([1]),
      'cleaned/001-page-1.png': new Uint8Array([2]),
    };

    const mapped = mapBatchReportToAioResults({
      ...baseInput(results),
      images,
      zipEntries,
    });

    expect(mapped[0]?.executionNotices).toHaveLength(1);
    expect(mapped[1]?.executionNotices ?? []).toHaveLength(0);
  });

  it('throws when a report result matches no queued image', () => {
    const images = [makeImage(0)];
    const results = [makeResult(5)];

    expect(() =>
      mapBatchReportToAioResults({
        ...baseInput(results),
        images,
        zipEntries: null,
      }),
    ).toThrow(BatchMappingError);
  });
});
