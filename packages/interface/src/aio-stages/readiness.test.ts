import { afterEach, describe, expect, it, vi } from 'vitest';

import { setDesktopBridgeProvider } from '../lib/desktop-bridge';
import type { AioStageOption } from '../models/aioStageCatalog.types';
import {
  resolveCleanerAiProfileReadiness,
  resolveGetTranslationsReadiness,
  resolveLocalStageModelReadiness,
  resolveRecognizeTextReadiness,
  type LocalModelEntry,
  type Translate,
} from './readiness';

afterEach(() => {
  setDesktopBridgeProvider(null);
});

const t: Translate = (key, params) =>
  params?.name ? `${key}:${String(params.name)}` : key;

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

describe('resolveLocalStageModelReadiness', () => {
  it('refuses when the catalog option is missing', () => {
    const result = resolveLocalStageModelReadiness({
      stage: 'detectText',
      stageLabel: 'Detect Text',
      modelKey: 'ghost',
      options: [option({ key: 'other' })],
      ensureLocalModelReady: () => true,
      invalidSelection: 'pick detect',
    });
    expect(result).toMatchObject({ ok: false, kind: 'option_missing', message: 'pick detect' });
  });

  it('returns a local ready plan when the install gate passes', () => {
    const ensure = vi.fn(() => true);
    const result = resolveLocalStageModelReadiness({
      stage: 'cleanImage',
      stageLabel: 'Clean Image',
      modelKey: 'model',
      options: [option()],
      ensureLocalModelReady: ensure,
      invalidSelection: 'pick clean',
    });
    expect(result).toEqual({
      ok: true,
      modelKey: 'model',
      useCloud: false,
      useLlmSettings: false,
      customProfile: null,
    });
    expect(ensure).toHaveBeenCalledWith('cleanImage', 'Clean Image', 'model');
  });

  it('returns local_not_ready with empty message when the gate already spoke', () => {
    const result = resolveLocalStageModelReadiness({
      stage: 'segmentText',
      stageLabel: 'Segment Text',
      modelKey: 'model',
      ensureLocalModelReady: () => false,
      invalidSelection: 'pick segment',
    });
    expect(result).toEqual({ ok: false, kind: 'local_not_ready', message: '' });
  });
});

describe('resolveRecognizeTextReadiness', () => {
  const messages = {
    invalidSelection: 'pick ocr',
    selectCustomProfile: 'pick profile',
    requiresApiKey: 'need key',
  };

  it('uses the local install gate when a local entry exists', () => {
    const result = resolveRecognizeTextReadiness({
      modelKey: 'local-key',
      stageLabel: 'Recognize Text',
      options: [option({ key: 'local-key' })],
      modelEntries: { 'local-key': installed },
      customProfile: null,
      ensureLocalModelReady: () => true,
      messages,
      t,
    });
    expect(result).toMatchObject({ ok: true, useCloud: false, useLlmSettings: false });
  });

  it('refuses missing Custom AI profile and API key', () => {
    const missingProfile = resolveRecognizeTextReadiness({
      modelKey: 'custom_ocr:abc',
      stageLabel: 'Recognize Text',
      options: [option({ key: 'custom_ocr:abc', implemented: true, available: true })],
      modelEntries: {},
      customProfile: null,
      ensureLocalModelReady: () => true,
      messages,
      t,
    });
    expect(missingProfile).toMatchObject({
      ok: false,
      kind: 'custom_profile_missing',
      message: 'pick profile',
    });

    const missingKey = resolveRecognizeTextReadiness({
      modelKey: 'custom_ocr:abc',
      stageLabel: 'Recognize Text',
      options: [option({ key: 'custom_ocr:abc' })],
      modelEntries: {},
      customProfile: {
        apiBase: 'https://api.groq.com/openai/v1',
        apiKey: '  ',
        model: 'm',
      },
      ensureLocalModelReady: () => true,
      messages,
      t,
    });
    expect(missingKey).toMatchObject({
      ok: false,
      kind: 'custom_api_key_missing',
      message: 'need key',
    });
  });

  it('plans LLM settings only for cloud OCR with capabilities', () => {
    const result = resolveRecognizeTextReadiness({
      modelKey: 'gpt_4o',
      stageLabel: 'Recognize Text',
      options: [
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
      ],
      modelEntries: {},
      customProfile: null,
      ensureLocalModelReady: () => true,
      messages,
      t,
    });
    expect(result).toMatchObject({
      ok: true,
      useCloud: true,
      useLlmSettings: true,
    });
  });
});

describe('resolveGetTranslationsReadiness', () => {
  const messages = {
    invalidSelection: 'pick translation',
    selectCustomProfile: 'pick profile',
    requiresApiKey: 'need key',
    installTranslationModel: 'install model',
    incompatibleLanguage: 'bad languages',
  };

  it('refuses an uninstalled local translation model', () => {
    const result = resolveGetTranslationsReadiness({
      modelKey: 'local-key',
      options: [option({ key: 'local-key' })],
      modelEntries: {
        'local-key': {
          status: 'available',
          model: { id: 'm1', name: 'Local M1' },
        },
      },
      customProfile: null,
      sourceLanguage: 'ja',
      targetLanguage: 'en',
      messages,
      t,
    });
    expect(result).toMatchObject({
      ok: false,
      kind: 'install_translation_model',
      message: 'install model',
    });
  });

  it('enforces runtime restriction on local Custom AI endpoints in the browser', () => {
    setDesktopBridgeProvider({ isDesktopRuntime: () => false });
    const result = resolveGetTranslationsReadiness({
      modelKey: 'custom:profile-1',
      options: [option({ key: 'custom:profile-1' })],
      modelEntries: {},
      customProfile: {
        apiBase: 'http://127.0.0.1:11434/v1',
        apiKey: '',
        model: 'm',
      },
      sourceLanguage: 'ja',
      targetLanguage: 'en',
      messages,
      t,
    });
    expect(result).toMatchObject({
      ok: false,
      kind: 'runtime_restriction',
    });
  });

  it('returns a translation ready plan for cloud keys', () => {
    const result = resolveGetTranslationsReadiness({
      modelKey: 'gpt_4o_mini',
      options: [option({ key: 'gpt_4o_mini' })],
      modelEntries: {},
      customProfile: null,
      sourceLanguage: 'ja',
      targetLanguage: 'en',
      messages,
      t,
    });
    expect(result).toMatchObject({
      ok: true,
      useCloud: true,
      modelKey: 'gpt_4o_mini',
    });
  });
});

describe('resolveCleanerAiProfileReadiness', () => {
  const messages = {
    incomplete: 'fill api base and model',
    requiresApiKey: 'need key',
  };

  it('passes through non-custom cleaner AI', () => {
    expect(
      resolveCleanerAiProfileReadiness({
        isCustomCleanerAi: false,
        profile: null,
        messages,
      }),
    ).toEqual({ ok: true, customPayload: null });
  });

  it('refuses incomplete Custom profiles', () => {
    expect(
      resolveCleanerAiProfileReadiness({
        isCustomCleanerAi: true,
        profile: { apiBase: '', model: '', apiKey: '' },
        messages,
      }),
    ).toMatchObject({ ok: false, kind: 'custom_cleaner_incomplete' });
  });

  it('builds a normalized payload when ready', () => {
    const result = resolveCleanerAiProfileReadiness({
      isCustomCleanerAi: true,
      profile: {
        apiBase: 'https://api.example.com/v1/',
        model: '  m  ',
        apiKey: 'k',
      },
      messages,
    });
    expect(result).toEqual({
      ok: true,
      customPayload: {
        api_base: 'https://api.example.com/v1',
        model: 'm',
        api_key: 'k',
      },
    });
  });
});
