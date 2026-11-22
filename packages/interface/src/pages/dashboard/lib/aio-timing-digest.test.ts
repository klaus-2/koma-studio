import { describe, expect, it } from 'vitest';

import type { AioStageTimingPage } from '../stores/aio-stage-timing-store';
import {
  buildAioTimingDigest,
  formatDigestSeconds,
} from './aio-timing-digest';

const makePage = (
  overrides: Partial<AioStageTimingPage> = {},
): AioStageTimingPage => ({
  key: 'batch-1:0',
  batchId: 'batch-1',
  index: 0,
  filename: 'page-1.png',
  stageSeconds: { detect: 1, ocr: 2.5 },
  ...overrides,
});

describe('buildAioTimingDigest (Fase C C4)', () => {
  it('formats seconds with one decimal', () => {
    expect(formatDigestSeconds(1)).toBe('1s');
    expect(formatDigestSeconds(2.46)).toBe('2.5s');
    expect(formatDigestSeconds(0.30000000000000004)).toBe('0.3s');
  });

  it('builds header, totals and one line per page with stages and seconds', () => {
    const digest = buildAioTimingDigest({
      pages: [
        makePage({
          stageSeconds: { detect: 1.2, ocr: 3.4, translation: 0.5 },
        }),
        makePage({
          key: 'batch-1:1',
          index: 1,
          filename: 'page-2.png',
          stageSeconds: { detect: 0.8, segment: 2 },
        }),
      ],
      totals: { detect: 2, ocr: 3.4, translation: 0, segment: 0.4, clean: 0 },
      batchId: 'batch-1',
      capturedAt: '2026-11-22T00:00:00.000Z',
    });
    const lines = digest.split('\n');

    expect(lines[0]).toBe('AIO timing report');
    expect(lines).toContain('batch: batch-1');
    expect(lines).toContain('captured: 2026-11-22T00:00:00.000Z');
    expect(lines).toContain('totals: detect 2s; ocr 3.4s; segment 0.4s');
    expect(lines[lines.length - 2]).toBe(
      'page-1.png — detect: 1.2s; ocr: 3.4s; translation: 0.5s; total: 5.1s',
    );
    expect(lines[lines.length - 1]).toBe(
      'page-2.png — detect: 0.8s; segment: 2s; total: 2.8s',
    );
    expect(digest).toContain('detect: 1.2s');
    expect(digest).toContain('ocr: 3.4s');
    expect(digest).toContain('total: 5.1s');
  });

  it('omits header fields and the totals line when unavailable', () => {
    const digest = buildAioTimingDigest({
      pages: [makePage({ stageSeconds: { ocr: 1 } })],
      totals: {},
      batchId: null,
      capturedAt: null,
    });
    const lines = digest.split('\n');

    expect(lines).toEqual([
      'AIO timing report',
      'page-1.png — ocr: 1s; total: 1s',
    ]);
  });

  it('keeps unknown stages after the canonical ones, sorted alphabetically', () => {
    const digest = buildAioTimingDigest({
      pages: [
        makePage({
          stageSeconds: { zeta_stage: 1, ocr: 2, alpha_stage: 3, detect: 4 },
        }),
      ],
      totals: {},
      batchId: null,
      capturedAt: null,
    });

    expect(digest.split('\n')[1]).toBe(
      'page-1.png — detect: 4s; ocr: 2s; alpha_stage: 3s; zeta_stage: 1s; total: 10s',
    );
  });

  it('carries no translated text, region payloads or image data', () => {
    const digest = buildAioTimingDigest({
      pages: [
        makePage({
          filename: 'page-1.png',
          stageSeconds: { ocr: 1.5 },
        }),
      ],
      totals: { ocr: 1.5 },
      batchId: 'batch-1',
      capturedAt: '2026-11-22T00:00:00.000Z',
    });

    expect(digest).not.toContain('translated_text');
    expect(digest).not.toContain('source_text');
    expect(digest).not.toContain('mask_base64');
    expect(digest).not.toContain('data:image');
    expect(digest).not.toContain('dashboard.footer.timing');
    expect(digest).not.toContain('翻訳');
    expect(digest).not.toContain('traduzido');
  });
});
