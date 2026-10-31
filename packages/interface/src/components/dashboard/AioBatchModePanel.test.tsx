// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import AioBatchModePanel from '@/components/dashboard/AioBatchModePanel';
import { I18nProvider } from '@/i18n';
import { setDesktopBridgeProvider } from '@/lib/desktop-bridge';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import type { LoadedImage } from '@/types/dashboard.types';

const stageOption = (key: string) => ({
  key,
  name: key,
  device: 'cpu',
  use_case: '',
  available: true,
  implemented: true,
});

const makeImage = (
  index: number,
  chapterId: string,
  chapterLabel: string,
): LoadedImage => ({
  id: `img-${index}`,
  file: new File([`page-${index}`], `page-${index}.png`, { type: 'image/png' }),
  url: `data:image/png;base64,AA${index}`,
  width: 40,
  height: 30,
  rotation: 0,
  filters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
    levels: { black: 0, white: 255, gamma: 1 },
    grayscale: false,
    inverted: false,
  },
  chapterId,
  chapterLabel,
});

const chapteredImages = [
  makeImage(0, 'archive:a.cbz', 'a.cbz'),
  makeImage(1, 'archive:b.cbz', 'b.cbz'),
];

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  useImageCollectionStore.setState({
    images: chapteredImages,
    activeId: chapteredImages[0]?.id ?? null,
    isExtractingUploads: false,
  });
  useUiShellStore.setState({ processing: false, progress: 0 });
  useAioPipelineStore.setState({
    aioAbortController: null,
    aioBackendRestarting: false,
    batchModeEnabled: false,
    batchChapterPresetByChapterId: {},
    aioBatchProgress: null,
    aioStageSelection: {
      detectText: 'font_rtdetr_v2',
      recognizeText: 'manga_ocr',
      getTranslations: 'google_translate',
      segmentText: 'baka_content_cc',
      cleanImage: 'aot',
    },
    aioStageOptions: {
      detectText: [stageOption('font_rtdetr_v2')],
      recognizeText: [stageOption('manga_ocr')],
      getTranslations: [stageOption('google_translate')],
      segmentText: [stageOption('baka_content_cc')],
      cleanImage: [stageOption('aot')],
    },
    aioPresetState: {
      version: 2,
      presets: [
        {
          id: 'preset-1',
          name: 'Manga default',
          description: '',
          sourceLanguage: 'ja',
          stageModels: {
            detectText: 'font_rtdetr_v2',
            recognizeText: 'manga_ocr',
            getTranslations: 'google_translate',
            segmentText: 'baka_content_cc',
            cleanImage: 'aot',
          },
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      activePresetBySourceLanguage: {},
    },
  });
});

afterEach(cleanup);

const renderPanel = () =>
  render(
    <I18nProvider>
      <AioBatchModePanel />
    </I18nProvider>,
  );

describe('AioBatchModePanel', () => {
  it('starts with Batch Mode off and persists the toggle', async () => {
    const user = userEvent.setup();
    renderPanel();

    const toggle = screen.getByLabelText('Batch Mode') as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    await user.click(toggle);

    expect(useAioPipelineStore.getState().batchModeEnabled).toBe(true);
    expect(await screen.findByText('Chapters')).toBeTruthy();
  });

  it('lists each chapter and assigns a preset to one of them', async () => {
    const user = userEvent.setup();
    useAioPipelineStore.setState({ batchModeEnabled: true });
    renderPanel();

    expect(screen.getByText('1. a.cbz (1)')).toBeTruthy();
    expect(screen.getByText('2. b.cbz (1)')).toBeTruthy();

    const chapterSelect = screen.getByLabelText('Preset for b.cbz');
    await act(async () => {
      await user.selectOptions(chapterSelect, 'preset-1');
    });

    expect(
      useAioPipelineStore.getState().batchChapterPresetByChapterId,
    ).toEqual({ 'archive:b.cbz': 'preset-1' });
  });

  it('disables the controls while an AIO run owns the shell', () => {
    useAioPipelineStore.setState({ batchModeEnabled: true });
    useUiShellStore.setState({ processing: true });
    renderPanel();

    expect(
      (screen.getByLabelText('Batch Mode') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText('Preset for a.cbz') as HTMLSelectElement).disabled,
    ).toBe(true);
  });

  it('warns when the AIO setup needs the cloud pipeline', () => {
    useAioPipelineStore.setState({
      batchModeEnabled: true,
      aioStageSelection: {
        detectText: 'font_rtdetr_v2',
        recognizeText: 'manga_ocr',
        getTranslations: 'gpt_4o_mini',
        segmentText: 'baka_content_cc',
        cleanImage: 'aot',
      },
    });
    renderPanel();

    expect(screen.getByText(/local models only/i)).toBeTruthy();
  });

  it('hides presets whose models are not installed', () => {
    useAioPipelineStore.setState({
      batchModeEnabled: true,
      aioStageOptions: {
        ...useAioPipelineStore.getState().aioStageOptions,
        recognizeText: [
          { ...stageOption('manga_ocr'), available: false },
        ],
      },
    });
    renderPanel();

    const select = screen.getByLabelText(
      'Preset for a.cbz',
    ) as HTMLSelectElement;

    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      'Use AIO setup',
    ]);
  });
});
