import { describe, expect, it } from 'vitest';

import {
  ALL_AIO_STAGE_TAB_KEYS,
  resolveAioEffectiveStageState,
} from './aio-ai-stage-state';
import type { AioStepToggles } from '../stores/aio-pipeline-store.types';

const DEFAULT_STEPS: AioStepToggles = {
  detectText: true,
  recognizeText: true,
  getTranslations: false,
  segmentText: true,
  cleanImage: true,
  render: false,
};

describe('resolveAioEffectiveStageState', () => {
  it('returns saved user toggles when AIO AI is inactive', () => {
    const state = resolveAioEffectiveStageState({
      aioSteps: DEFAULT_STEPS,
      aioAiActive: false,
      executionMode: 'direct',
      cleanViaAi: false,
    });

    expect(state.enabled).toEqual(DEFAULT_STEPS);
    expect(state.disabled).toEqual({
      detectText: true,
      recognizeText: false,
      getTranslations: false,
      segmentText: false,
      cleanImage: false,
      render: false,
    });
    expect(state.visibleStageTabs).toEqual(ALL_AIO_STAGE_TAB_KEYS);
  });

  it('disables segmentText when AIO AI is inactive and pure AI Clean is enabled', () => {
    const state = resolveAioEffectiveStageState({
      aioSteps: DEFAULT_STEPS,
      aioAiActive: false,
      executionMode: 'direct',
      cleanViaAi: true,
    });

    expect(state.enabled).toEqual(DEFAULT_STEPS);
    expect(state.disabled.segmentText).toBe(true);
    expect(state.disabled.cleanImage).toBe(false);
    expect(state.visibleStageTabs).toEqual(ALL_AIO_STAGE_TAB_KEYS);
  });

  it('disables and turns off all 6 stages in direct AIO AI mode without mutating input', () => {
    const inputCopy = { ...DEFAULT_STEPS };
    const state = resolveAioEffectiveStageState({
      aioSteps: inputCopy,
      aioAiActive: true,
      executionMode: 'direct',
      cleanViaAi: false,
    });

    expect(state.enabled).toEqual({
      detectText: false,
      recognizeText: false,
      getTranslations: false,
      segmentText: false,
      cleanImage: false,
      render: false,
    });
    expect(state.disabled).toEqual({
      detectText: true,
      recognizeText: true,
      getTranslations: true,
      segmentText: true,
      cleanImage: true,
      render: true,
    });
    expect(state.visibleStageTabs).toEqual([]);
    expect(inputCopy).toEqual(DEFAULT_STEPS);
  });

  it('keeps only detectText enabled in hybrid_guided AIO AI mode', () => {
    const state = resolveAioEffectiveStageState({
      aioSteps: DEFAULT_STEPS,
      aioAiActive: true,
      executionMode: 'hybrid_guided',
      cleanViaAi: false,
    });

    expect(state.enabled).toEqual({
      detectText: true,
      recognizeText: false,
      getTranslations: false,
      segmentText: false,
      cleanImage: false,
      render: false,
    });
    expect(state.disabled).toEqual({
      detectText: true,
      recognizeText: true,
      getTranslations: true,
      segmentText: true,
      cleanImage: true,
      render: true,
    });
    expect(state.visibleStageTabs).toEqual(['detectText']);
  });

  it('keeps detectText, recognizeText, and getTranslations enabled in script_guided AIO AI mode', () => {
    const state = resolveAioEffectiveStageState({
      aioSteps: DEFAULT_STEPS,
      aioAiActive: true,
      executionMode: 'script_guided',
      cleanViaAi: false,
    });

    expect(state.enabled).toEqual({
      detectText: true,
      recognizeText: true,
      getTranslations: true,
      segmentText: false,
      cleanImage: false,
      render: false,
    });
    expect(state.disabled).toEqual({
      detectText: true,
      recognizeText: true,
      getTranslations: true,
      segmentText: true,
      cleanImage: true,
      render: true,
    });
    expect(state.visibleStageTabs).toEqual([
      'detectText',
      'recognizeText',
      'getTranslations',
    ]);
  });
});
