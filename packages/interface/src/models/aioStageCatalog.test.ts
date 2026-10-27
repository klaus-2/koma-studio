import { describe, expect, it } from 'vitest';

import {
  buildAioStageCatalog,
  isStageOptionSelectable,
  mergeStageOptions,
  ocrStageOptionSupportsLanguage,
} from '@/models/aioStageCatalog';
import type {
  AioStageOption,
  LocalModelEntries,
} from '@/models/aioStageCatalog';
import { getTranslationModelById } from '@/models/translation-models-registry';
import type { ModelInstallState } from '@/models/types';

const NLLB_LOCAL_IDS = [
  'nllb-200-600m-int8',
  'nllb-200-1.3b',
  'nllb-200-1.3b-int8-ct2',
] as const;

function createOption(
  overrides: Partial<AioStageOption> = {},
): AioStageOption {
  return {
    key: 'cloud-model',
    name: 'Cloud model',
    device: 'cloud',
    use_case: 'OCR',
    available: true,
    implemented: true,
    ...overrides,
  };
}

describe('ocrStageOptionSupportsLanguage', () => {
  it.each([
    [['ja'], 'ja', true],
    [['ja'], 'en', false],
    [['multi'], 'en', true],
    [[], 'en', true],
    [['ZH_CN'], ' zh ', true],
    [['zh'], 'ZH_TW', true],
    [['zh-cn'], 'zh-tw', false],
    [['pt'], 'PT_BR', true],
    [['pt-br'], 'pt', false],
  ])(
    'languages=%j source=%s supported=%s',
    (languages, source, expected) => {
      expect(
        ocrStageOptionSupportsLanguage(
          createOption({ languages }),
          source,
        ),
      ).toBe(expected);
    },
  );
});

describe('mergeStageOptions', () => {
  it('deduplicates by key and keeps deterministic order', () => {
    const result = mergeStageOptions(
      [
        createOption({ key: 'first', name: 'Original' }),
        createOption({ key: 'second' }),
      ],
      [
        createOption({ key: 'first', name: 'Updated' }),
        createOption({ key: 'third' }),
      ],
    );

    expect(result.map((option) => option.key)).toEqual([
      'first',
      'second',
      'third',
    ]);
    expect(result[0]?.name).toBe('Updated');
  });

  it('does not share mutable language arrays with inputs', () => {
    const original = createOption({ languages: ['ja'] });
    const merged = mergeStageOptions([original], []);

    merged[0]?.languages?.push('en');

    expect(original.languages).toEqual(['ja']);
  });
});

describe('isStageOptionSelectable', () => {
  const entries: LocalModelEntries = {
    manga_ocr: {
      status: 'installed',
      model: { id: 'manga_ocr', name: 'Manga OCR' },
    },
    aot: {
      status: 'update_available',
      model: { id: 'aot', name: 'AOT' },
    },
  };

  it('rejects placeholders and missing options', () => {
    expect(isStageOptionSelectable(null, entries)).toBe(false);
    expect(
      isStageOptionSelectable(createOption({ key: 'custom' }), entries),
    ).toBe(false);
    expect(
      isStageOptionSelectable(createOption({ key: 'custom_ocr' }), entries),
    ).toBe(false);
  });

  it('does not make unimplemented local models executable', () => {
    expect(
      isStageOptionSelectable(
        createOption({ key: 'manga_ocr', implemented: false }),
        entries,
      ),
    ).toBe(false);
  });

  it('accepts installed models and models with updates available', () => {
    expect(
      isStageOptionSelectable(
        createOption({ key: 'manga_ocr', available: false }),
        entries,
      ),
    ).toBe(true);
    expect(
      isStageOptionSelectable(createOption({ key: 'aot' }), entries),
    ).toBe(true);
  });

  it('rejects known local models when install state has not hydrated', () => {
    expect(
      isStageOptionSelectable(createOption({ key: 'manga_ocr' }), {}),
    ).toBe(false);
  });

  it('preserves cloud availability gating', () => {
    expect(
      isStageOptionSelectable(createOption({ available: false }), {}),
    ).toBe(false);
  });
});

describe('buildAioStageCatalog', () => {
  it('does not advertise missing local installations as available', () => {
    const catalog = buildAioStageCatalog({ sourceLanguage: 'ja' });

    expect(
      catalog.detectText.find((option) => option.key === 'font_rtdetr_v2')
        ?.available,
    ).toBe(false);
    expect(
      catalog.recognizeText.find((option) => option.key === 'manga_ocr')
        ?.available,
    ).toBe(false);
  });

  it('filters incompatible OCR without falling back to incompatible models', () => {
    const catalog = buildAioStageCatalog({ sourceLanguage: 'en' });

    expect(
      catalog.recognizeText.some((option) => option.key === 'manga_ocr'),
    ).toBe(false);
    expect(
      catalog.recognizeText.every((option) =>
        ocrStageOptionSupportsLanguage(option, 'en'),
      ),
    ).toBe(true);
  });

  it('does not leak mutations between builds', () => {
    const first = buildAioStageCatalog({ sourceLanguage: 'ja' });
    const option = first.recognizeText.find(
      (candidate) => candidate.key === 'manga_ocr',
    );
    option?.languages?.push('en');

    const second = buildAioStageCatalog({ sourceLanguage: 'ja' });

    expect(
      second.recognizeText.find(
        (candidate) => candidate.key === 'manga_ocr',
      )?.languages,
    ).toEqual(['ja']);
  });
});

describe('managed NLLB translation entries', () => {
  it('offers them as implemented local options', () => {
    const catalog = buildAioStageCatalog({ sourceLanguage: 'ja' });

    for (const modelId of NLLB_LOCAL_IDS) {
      const option = catalog.getTranslations.find(
        (candidate) => candidate.key === modelId,
      );

      expect(option).toBeDefined();
      expect(option?.implemented).toBe(true);
      expect(option?.available).toBe(false);
      expect(option?.use_case).not.toContain('Download only');
    }
  });

  it('makes them selectable once installed and not before', () => {
    const installedEntry = (modelId: string): ModelInstallState => {
      const model = getTranslationModelById(modelId);
      if (!model) {
        throw new Error(`Unknown test model: ${modelId}`);
      }

      return {
        model,
        status: 'installed',
        installedVersion: model.version,
        availableVersion: model.version,
        installedAt: null,
        checksumSHA256: null,
        updateAvailable: false,
        error: null,
        errorCode: null,
        progress: null,
        incomplete: false,
      };
    };
    const entries: Record<string, ModelInstallState> = {
      'nllb-200-600m-int8': installedEntry('nllb-200-600m-int8'),
      'nllb-200-1.3b': installedEntry('nllb-200-1.3b'),
      'nllb-200-1.3b-int8-ct2': installedEntry('nllb-200-1.3b-int8-ct2'),
    };
    const installedCatalog = buildAioStageCatalog({
      sourceLanguage: 'ja',
      localModelEntries: entries,
    });
    const emptyCatalog = buildAioStageCatalog({ sourceLanguage: 'ja' });

    for (const modelId of NLLB_LOCAL_IDS) {
      const installedOption = installedCatalog.getTranslations.find(
        (candidate) => candidate.key === modelId,
      );
      const notInstalledOption = emptyCatalog.getTranslations.find(
        (candidate) => candidate.key === modelId,
      );
      expect(isStageOptionSelectable(installedOption, entries)).toBe(true);
      expect(isStageOptionSelectable(notInstalledOption, {})).toBe(false);
    }
  });

  it('keeps the default translation model selectable', () => {
    const catalog = buildAioStageCatalog({ sourceLanguage: 'ja' });
    const option = catalog.getTranslations.find(
      (candidate) => candidate.key === 'google_translate',
    );

    expect(option?.implemented).toBe(true);
    expect(isStageOptionSelectable(option, {})).toBe(true);
  });
});
