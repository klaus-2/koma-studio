import { describe, expect, it } from 'vitest';

import { defaultMessages } from '@/i18n/messages';
import type { Translate } from './readiness';
import { resolveAioCleanAiReadiness } from './cleanerAiProfile';
import type { CustomLlmProfile } from '../utils/customLlm';

const t: Translate = (key) => (defaultMessages as Record<string, string>)[key] ?? key;

const profile = (overrides: Partial<CustomLlmProfile> = {}): CustomLlmProfile => ({
  id: 'profile-1',
  stage: 'clean',
  label: 'Replicate FREE',
  apiBase: 'https://api.replicate.com/v1',
  apiKey: '',
  model: 'dpakkk/image-object-removal',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('resolveAioCleanAiReadiness', () => {
  it('refuses an empty model key with the select-model message', () => {
    const result = resolveAioCleanAiReadiness({
      modelKey: '',
      profiles: [profile()],
      t,
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'aio_clean_ai_model_missing',
      message: defaultMessages['dashboard.aio.clean.aiClean.readiness.selectModel'],
    });
  });

  it('refuses a non-clean selection key (local or translation custom)', () => {
    for (const modelKey of ['aot', 'custom:legacy-id', 'custom_ocr:scan']) {
      const result = resolveAioCleanAiReadiness({
        modelKey,
        profiles: [profile()],
        t,
      });

      expect(result).toMatchObject({ ok: false, kind: 'aio_clean_ai_model_missing' });
    }
  });

  it('refuses a clean key whose profile is missing', () => {
    const result = resolveAioCleanAiReadiness({
      modelKey: 'custom_clean:ghost',
      profiles: [profile()],
      t,
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'aio_clean_ai_profile_missing',
      message: defaultMessages['dashboard.aio.clean.aiClean.readiness.profileMissing'],
    });
  });

  it('refuses when the host requires an api key and the profile has none', () => {
    const result = resolveAioCleanAiReadiness({
      modelKey: 'custom_clean:profile-1',
      profiles: [profile({ apiBase: 'https://fal.run', model: 'fal-ai/nano-banana/edit' })],
      t,
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'aio_clean_ai_api_key_missing',
      message: defaultMessages['dashboard.aio.clean.aiClean.readiness.apiKeyMissing'],
    });
  });

  it('accepts a profile whose host needs no api key even without one', () => {
    const result = resolveAioCleanAiReadiness({
      modelKey: 'custom_clean:profile-1',
      profiles: [profile({ apiBase: 'https://api.openai.com/v1', model: 'gpt-4o' })],
      t,
    });

    expect(result).toMatchObject({
      ok: true,
      modelKey: 'custom_clean:profile-1',
      customProfile: {
        apiBase: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o',
        protocol: 'auto',
      },
    });
  });

  it('returns a camelCase request profile with the derived host protocol', () => {
    const result = resolveAioCleanAiReadiness({
      modelKey: 'custom_clean:profile-1',
      profiles: [profile({ apiKey: 'r8_token' })],
      t,
    });

    expect(result).toEqual({
      ok: true,
      modelKey: 'custom_clean:profile-1',
      customProfile: {
        apiBase: 'https://api.replicate.com/v1',
        apiKey: 'r8_token',
        model: 'dpakkk/image-object-removal',
        protocol: 'replicate',
      },
    });
  });

  it('keeps an explicit profile protocol over the host-map derivation', () => {
    const result = resolveAioCleanAiReadiness({
      modelKey: 'custom_clean:profile-1',
      profiles: [
        profile({
          apiBase: 'https://fal.run',
          apiKey: 'fal_key',
          model: 'fal-ai/nano-banana/edit',
          protocol: 'openai_chat',
        }),
      ],
      t,
    });

    expect(result.ok ? result.customProfile?.protocol : null).toBe('openai_chat');
  });

  it('refuses a local HF image-edit key when the model is not installed on disk', () => {
    const result = resolveAioCleanAiReadiness({
      modelKey: 'local_image_edit:flux2_klein_4b_gguf_q4',
      profiles: [],
      modelEntries: {
        flux2_klein_4b_gguf_q4: { status: 'not_installed' },
      },
      t,
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'aio_clean_ai_local_not_installed',
    });
  });

  it('accepts an installed local HF image-edit key without a cloud custom profile', () => {
    const result = resolveAioCleanAiReadiness({
      modelKey: 'local_image_edit:flux2_klein_4b_gguf_q4',
      profiles: [],
      modelEntries: {
        flux2_klein_4b_gguf_q4: { status: 'installed' },
      },
      t,
    });

    expect(result).toEqual({
      ok: true,
      modelKey: 'local_image_edit:flux2_klein_4b_gguf_q4',
      customProfile: null,
      localModelId: 'flux2_klein_4b_gguf_q4',
    });
  });
});
