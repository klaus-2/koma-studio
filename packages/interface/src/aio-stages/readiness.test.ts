import { afterEach, describe, expect, it } from 'vitest';

import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import type { AioStageOption } from '../models/aioStageCatalog.types';
import {
  applyStageReadinessRefusal,
  ensureStageModelReadiness,
  requireStageModelReadiness,
  resolveStageModelReadiness,
  skipStageCatalog,
  stageCatalogOption,
  type LocalModelEntry,
  type Translate,
} from './readiness';
import { resolveCleanerAiProfileReadiness } from './cleanerAiProfile';
import {
  DEFAULT_LLM_REQUEST_SETTINGS,
  withSfxTranslationSettings,
} from '../utils/customLlm';

afterEach(() => {
  setDesktopBridgeProvider(null);
});

const t: Translate = (key, params) =>
  params?.name || params?.modelName
    ? `${key}:${String(params.name ?? params.modelName)}`
    : key;

function option(overrides: Partial<AioStageOption> = {}): AioStageOption {
  return {
    key: 'model',
    name: 'Model',
    device: 'cpu',
    use_case: 'ocr',
    available: true,
    implemented: true,
    ...overrides,
  };
}

const installed: LocalModelEntry = {
  status: 'installed',
  model: { id: 'm1', name: 'Local M1' },
};

describe('resolveStageModelReadiness', () => {
  it('refuses when the catalog lookup found nothing', () => {
    const result = resolveStageModelReadiness({
      stage: 'detectText',
      stageLabel: 'Detect Text',
      modelKey: 'ghost',
      catalog: stageCatalogOption(null),
      modelEntries: {},
      t,
    });
    expect(result).toMatchObject({ ok: false, kind: 'option_missing' });
  });

  it('skips the catalog when asked', () => {
    const result = resolveStageModelReadiness({
      stage: 'detectText',
      stageLabel: 'Detect Text',
      modelKey: 'local-key',
      catalog: skipStageCatalog(),
      modelEntries: { 'local-key': installed },
      t,
    });
    expect(result).toEqual({
      ok: true,
      modelKey: 'local-key',
      useCloud: false,
      useLlmSettings: false,
      customProfile: null,
    });
  });

  it('refuses local-only stages without an installed entry and asks to open the manager', () => {
    const result = resolveStageModelReadiness({
      stage: 'cleanImage',
      stageLabel: 'Clean Image',
      modelKey: 'missing',
      catalog: skipStageCatalog(),
      modelEntries: {},
      t,
    });
    expect(result).toMatchObject({
      ok: false,
      kind: 'local_not_ready',
      openModelManager: { stage: 'cleanImage', focusedModelId: 'missing' },
    });
    expect(result.ok === false && result.message.length > 0).toBe(true);
  });

  it('refuses an uninstalled local entry', () => {
    const result = resolveStageModelReadiness({
      stage: 'segmentText',
      stageLabel: 'Segment Text',
      modelKey: 'local-key',
      catalog: skipStageCatalog(),
      modelEntries: {
        'local-key': {
          status: 'available',
          model: { id: 'm1', name: 'Local M1' },
        },
      },
      t,
    });
    expect(result).toMatchObject({
      ok: false,
      kind: 'local_not_ready',
      openModelManager: { stage: 'segmentText', focusedModelId: 'm1' },
    });
  });

  it('refuses missing Custom AI profile and API key on the cloud path', () => {
    const missingProfile = resolveStageModelReadiness({
      stage: 'recognizeText',
      stageLabel: 'Recognize Text',
      modelKey: 'custom_ocr:abc',
      catalog: stageCatalogOption(option({ key: 'custom_ocr:abc' })),
      modelEntries: {},
      customProfile: null,
      t,
    });
    expect(missingProfile).toMatchObject({
      ok: false,
      kind: 'custom_profile_missing',
    });

    const missingKey = resolveStageModelReadiness({
      stage: 'recognizeText',
      stageLabel: 'Recognize Text',
      modelKey: 'custom_ocr:abc',
      catalog: stageCatalogOption(option({ key: 'custom_ocr:abc' })),
      modelEntries: {},
      customProfile: {
        apiBase: 'https://api.groq.com/openai/v1',
        apiKey: '  ',
        model: 'm',
      },
      t,
    });
    expect(missingKey).toMatchObject({
      ok: false,
      kind: 'custom_api_key_missing',
    });
  });

  it('plans LLM settings only for cloud OCR with capabilities', () => {
    const result = resolveStageModelReadiness({
      stage: 'recognizeText',
      stageLabel: 'Recognize Text',
      modelKey: 'gpt_4o',
      catalog: stageCatalogOption(
        option({
          key: 'gpt_4o',
          llm_capabilities: {
            extra_context: true,
            image_input_enabled: true,
            temperature: true,
            top_p: true,
            max_tokens: true,
          },
        }),
      ),
      modelEntries: {},
      customProfile: null,
      t,
    });
    expect(result).toMatchObject({ ok: true, useCloud: true, useLlmSettings: true });
  });

  it('refuses an uninstalled local translation model and opens the manager', () => {
    const result = resolveStageModelReadiness({
      stage: 'getTranslations',
      stageLabel: 'Get Translations',
      modelKey: 'local-key',
      catalog: skipStageCatalog(),
      modelEntries: {
        'local-key': {
          status: 'available',
          model: { id: 'm1', name: 'Local M1' },
        },
      },
      languages: { source: 'ja', target: 'en' },
      t,
    });
    expect(result).toMatchObject({
      ok: false,
      kind: 'install_translation_model',
      openModelManager: { stage: 'getTranslations', focusedModelId: 'local-key' },
    });
  });

  it('enforces runtime restriction on local Custom AI endpoints in the browser', () => {
    setDesktopBridgeProvider({ isDesktopRuntime: () => false });
    const result = resolveStageModelReadiness({
      stage: 'getTranslations',
      stageLabel: 'Get Translations',
      modelKey: 'custom:profile-1',
      catalog: stageCatalogOption(option({ key: 'custom:profile-1' })),
      modelEntries: {},
      customProfile: {
        apiBase: 'http://127.0.0.1:11434/v1',
        apiKey: '',
        model: 'm',
      },
      languages: { source: 'ja', target: 'en' },
      t,
    });
    expect(result).toMatchObject({ ok: false, kind: 'runtime_restriction' });
  });

  it('returns a translation ready plan for cloud keys', () => {
    const result = resolveStageModelReadiness({
      stage: 'getTranslations',
      stageLabel: 'Get Translations',
      modelKey: 'gpt_4o_mini',
      catalog: stageCatalogOption(option({ key: 'gpt_4o_mini' })),
      modelEntries: {},
      languages: { source: 'ja', target: 'en' },
      t,
    });
    expect(result).toMatchObject({ ok: true, useCloud: true, modelKey: 'gpt_4o_mini' });
  });
});

describe('ensure / require / apply', () => {
  it('ensure surfaces the refusal and returns null', () => {
    const messages: string[] = [];
    const ready = ensureStageModelReadiness(
      {
        stage: 'detectText',
        stageLabel: 'Detect Text',
        modelKey: 'missing',
        catalog: skipStageCatalog(),
        modelEntries: {},
        t,
      },
      { setStatusMessage: (message) => messages.push(message) },
    );
    expect(ready).toBeNull();
    expect(messages[0]?.length).toBeGreaterThan(0);
  });

  it('require throws after opening the model manager', () => {
    const opened: unknown[] = [];
    expect(() =>
      requireStageModelReadiness(
        {
          stage: 'detectText',
          stageLabel: 'Detect Text',
          modelKey: 'm1',
          catalog: skipStageCatalog(),
          modelEntries: {
            m1: { status: 'available', model: { id: 'm1', name: 'Local M1' } },
          },
          t,
        },
        {
          openModelManagerForStage: (stage, options) => {
            opened.push([stage, options]);
          },
        },
      ),
    ).toThrow();
    expect(opened[0]).toBeDefined();
    expect((opened[0] as unknown[])[0]).toBe('detectText');
  });

  it('apply maps openModelManager intent to the sink', () => {
    const opened: unknown[] = [];
    applyStageReadinessRefusal(
      {
        ok: false,
        kind: 'local_not_ready',
        message: 'install it',
        openModelManager: {
          stage: 'detectText',
          focusedModelId: 'm1',
          language: 'ja',
        },
      },
      {
        openModelManagerForStage: (stage, options) => {
          opened.push([stage, options]);
        },
      },
    );
    expect(opened).toEqual([
      ['detectText', { focusedModelId: 'm1', language: 'ja' }],
    ]);
  });
});

describe('withSfxTranslationSettings', () => {
  it('rewrites extra_context and disables notes', () => {
    expect(
      withSfxTranslationSettings(
        {
          ...DEFAULT_LLM_REQUEST_SETTINGS,
          extra_context: 'base',
          translation_notes_enabled: true,
        },
        'sfx ctx',
      ),
    ).toMatchObject({
      extra_context: 'sfx ctx',
      translation_notes_enabled: false,
    });
  });
});

describe('resolveCleanerAiProfileReadiness', () => {
  it('passes through non-custom cleaner AI', () => {
    expect(
      resolveCleanerAiProfileReadiness({
        isCustomCleanerAi: false,
        profile: null,
      }),
    ).toEqual({ ok: true, customPayload: null });
  });

  it('refuses incomplete Custom profiles', () => {
    expect(
      resolveCleanerAiProfileReadiness({
        isCustomCleanerAi: true,
        profile: { apiBase: '', model: '', apiKey: '' },
      }),
    ).toMatchObject({ ok: false, kind: 'custom_cleaner_incomplete' });
  });

  it('builds a normalized payload when ready', () => {
    expect(
      resolveCleanerAiProfileReadiness({
        isCustomCleanerAi: true,
        profile: {
          apiBase: 'https://api.example.com/v1/',
          model: '  m  ',
          apiKey: 'k',
        },
      }),
    ).toEqual({
      ok: true,
      customPayload: {
        apiBase: 'https://api.example.com/v1',
        model: 'm',
        apiKey: 'k',
      },
    });
  });
});
