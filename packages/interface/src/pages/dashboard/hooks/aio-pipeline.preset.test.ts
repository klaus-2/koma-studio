import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AioStageOption } from '@/models/aioStageCatalog';
import { useAioPresetEditor } from '@/pages/dashboard/hooks/aio-pipeline.preset';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';

vi.mock('@/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string): string => key }),
  };
});

const stageOption = (key: string): AioStageOption => ({
  key,
  name: key,
  device: 'local',
  use_case: '',
  available: true,
  implemented: true,
});

const setStatusMessage = vi.fn();

const args = {
  availableDetectStageOptions: [stageOption('font_rtdetr_v2')],
  availableOcrStageOptions: [stageOption('manga_ocr')],
  availableTranslationStageOptions: [stageOption('google_translate')],
  availableSegmentStageOptions: [stageOption('baka_content_cc')],
  availableCleanStageOptions: [stageOption('aot')],
  setStatusMessage,
};

describe('useAioPresetEditor save path', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setStatusMessage.mockClear();
    useUiShellStore.setState({ processing: false });
    useAioPipelineStore.setState({
      aioSrcLang: 'ja',
      aioAbortController: null,
      aioBackendRestarting: false,
      aioOptionsLoading: false,
      aioPresetState: {
        version: 2,
        presets: [],
        activePresetBySourceLanguage: {},
      },
    });
  });

  it('saves the draft written to the store after the editor opened', () => {
    const { result } = renderHook(() => useAioPresetEditor(args));

    act(() => {
      result.current.openCreatePresetEditor();
    });
    expect(result.current.aioPresetEditorOpen).toBe(true);

    act(() => {
      useAioPipelineStore.getState().setAioPresetEditorDraft((previous) => ({
        ...previous,
        name: 'Store-backed preset',
      }));
    });

    act(() => {
      result.current.handleSavePresetEditor();
    });

    expect(result.current.aioPresetEditorOpen).toBe(false);
    expect(setStatusMessage).toHaveBeenCalledWith('dashboard.status.preset.saved');

    const state = useAioPipelineStore.getState();
    const saved = state.aioPresetState.presets.find(
      (preset) => preset.name === 'Store-backed preset',
    );
    expect(saved).toBeDefined();
    expect(state.aioPresetState.activePresetBySourceLanguage.ja).toBe(saved?.id);
  });
});
