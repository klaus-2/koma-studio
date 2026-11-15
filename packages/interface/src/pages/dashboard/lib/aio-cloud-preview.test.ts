import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomLlmProfile } from '@/utils/customLlm';
import {
  isCloudPreviewSuppressed,
  resolveCloudPreviewGate,
  setAskCloudPreview,
  shouldAskCloudPreview,
  skipCloudPreviewForProvider,
} from './aio-cloud-preview';

vi.mock('@/lib/desktop-bridge', () => ({
  desktopBridge: {
    isDesktopRuntime: (): boolean => true,
  },
}));

const customProfile = (apiBase: string): CustomLlmProfile => ({
  id: 'profile-1',
  stage: 'translation',
  label: 'My LLM',
  apiBase,
  apiKey: 'key',
  model: 'model-x',
  createdAt: '2026-11-14T00:00:00.000Z',
  updatedAt: '2026-11-14T00:00:00.000Z',
});

const resetStorage = (): void => {
  localStorage.clear();
  setAskCloudPreview(true);
};

beforeEach(resetStorage);

afterEach(resetStorage);

describe('resolveCloudPreviewGate', () => {
  it('fires for cloud OCR and cloud translation selections', () => {
    const gate = resolveCloudPreviewGate({
      aioSteps: { recognizeText: true, getTranslations: true },
      ocrModelKey: 'google_cloud_vision',
      translationModelKey: 'gpt_4_1',
      customTranslationProfile: null,
      customOcrProfile: null,
    });

    expect(gate.required).toBe(true);
    expect(gate.ocr?.stage).toBe('ocr');
    expect(gate.ocr?.source).toBe('builtin');
    expect(gate.translation?.stage).toBe('translation');
    expect(gate.translation?.source).toBe('builtin');
  });

  it('fires for a REMOTE custom translation profile (local batch form trap)', () => {
    const gate = resolveCloudPreviewGate({
      aioSteps: { recognizeText: false, getTranslations: true },
      ocrModelKey: null,
      translationModelKey: 'custom:profile-1',
      customTranslationProfile: customProfile('https://api.example.com/v1'),
      customOcrProfile: null,
    });

    expect(gate.required).toBe(true);
    expect(gate.translation?.source).toBe('custom');
    expect(gate.translation?.provider).toBe('profile-1');
    expect(gate.translation?.apiBase).toBe('https://api.example.com/v1');
    expect(gate.ocr).toBeNull();
  });

  it('resolves a REMOTE custom OCR profile to its human destination', () => {
    const gate = resolveCloudPreviewGate({
      aioSteps: { recognizeText: true, getTranslations: false },
      ocrModelKey: 'custom_ocr:profile-9',
      translationModelKey: null,
      customTranslationProfile: null,
      customOcrProfile: {
        id: 'profile-9',
        stage: 'ocr',
        label: 'My Vision API',
        apiBase: 'https://vision.example.com/v1',
        apiKey: 'k',
        model: 'vision-x',
        createdAt: '',
        updatedAt: '',
      },
    });

    expect(gate.required).toBe(true);
    expect(gate.ocr?.source).toBe('custom');
    expect(gate.ocr?.provider).toBe('profile-9');
    expect(gate.ocr?.providerLabel).toBe('My Vision API');
    expect(gate.ocr?.apiBase).toBe('https://vision.example.com/v1');
    expect(gate.translation).toBeNull();
  });

  it('exempts a loopback custom profile on desktop (localhost-as-local)', () => {
    const gate = resolveCloudPreviewGate({
      aioSteps: { recognizeText: false, getTranslations: true },
      ocrModelKey: null,
      translationModelKey: 'custom:profile-1',
      customTranslationProfile: customProfile('http://127.0.0.1:11434/v1'),
      customOcrProfile: null,
    });

    expect(gate.required).toBe(false);
    expect(gate.translation).toBeNull();
  });

  it('bypasses entirely for local-only runs', () => {
    const gate = resolveCloudPreviewGate({
      aioSteps: { recognizeText: true, getTranslations: true },
      ocrModelKey: 'local_ocr_model',
      translationModelKey: 'sugoi_v4_ja_en_ct2',
      customTranslationProfile: null,
      customOcrProfile: null,
    });

    expect(gate.required).toBe(false);
    expect(gate.ocr).toBeNull();
    expect(gate.translation).toBeNull();
  });

  it('does not fire for unselected stages', () => {
    const gate = resolveCloudPreviewGate({
      aioSteps: { recognizeText: false, getTranslations: false },
      ocrModelKey: 'google_cloud_vision',
      translationModelKey: 'gpt_4_1',
      customTranslationProfile: null,
      customOcrProfile: null,
    });

    expect(gate.required).toBe(false);
  });
});

describe('cloud preview suppression persistence', () => {
  it('defaults to asking', () => {
    expect(shouldAskCloudPreview()).toBe(true);
    expect(isCloudPreviewSuppressed(['openai'])).toBe(false);
  });

  it('suppresses per provider once dont-ask-again is recorded', () => {
    skipCloudPreviewForProvider('gpt_4_1');

    expect(isCloudPreviewSuppressed(['gpt_4_1'])).toBe(true);
    expect(isCloudPreviewSuppressed(['gpt_4_1', 'google_cloud_vision'])).toBe(
      false,
    );
  });

  it('suppresses everything when the global ask setting is off', () => {
    setAskCloudPreview(false);

    expect(isCloudPreviewSuppressed(['anything'])).toBe(true);
  });
});
