// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n';
import { setDesktopBridgeProvider } from '../../lib/desktop-bridge';
import { buildInstallState, createMockModel } from '../../models/model-install-fixtures';
import type { AioLocalModelStage, ModelInstallState } from '../../models/types';
import { ModelManagerModalClassic } from './ModelManagerModalClassic';

const MIB = 1024 * 1024;

const entry = (id: string, stage: AioLocalModelStage): ModelInstallState =>
  buildInstallState({ ...createMockModel(id), stage }, 'not_installed');

const asyncNoop = async (): Promise<void> => undefined;

const renderModal = (
  entries: Record<string, ModelInstallState>,
  onInstallAll: (modelIds?: string[]) => Promise<unknown>,
): void => {
  render(
    <I18nProvider>
      <ModelManagerModalClassic
        open
        entries={entries}
        diskSpace={{ freeBytes: 10 * 1024 * MIB, totalBytes: 20 * 1024 * MIB, path: 'mock' }}
        installedCount={0}
        totalCount={Object.keys(entries).length}
        updatesCount={0}
        installedSizeBytes={0}
        checkingRemoteUpdates={false}
        lastRemoteCheckAt={null}
        defaultLanguageFilter="ja"
        defaultTargetLanguage="en"
        focusedModelId={null}
        selectedModelId=""
        selectionStage="translation"
        localStageFilter="translation"
        batch={{ active: false, total: 0, completed: 0, cancelled: false }}
        onClose={() => undefined}
        onSetLanguageFilter={() => undefined}
        onInstallModel={asyncNoop}
        onUpdateModel={asyncNoop}
        onUninstallModel={asyncNoop}
        onRetryModel={asyncNoop}
        onCancelModel={asyncNoop}
        onSelectModel={() => undefined}
        onInstallAll={onInstallAll}
        onCancelAll={asyncNoop}
        onCheckUpdatesNow={asyncNoop}
      />
    </I18nProvider>,
  );
};

beforeAll(() => {
  setDesktopBridgeProvider({ desktop: null });
});

beforeEach(() => {
  window.localStorage.setItem('koma-studio.locale.v1', 'en');
});

describe('ModelManagerModalClassic multi-stage install-all', () => {
  it('passes the union of eligible ids across stages to the existing installAll API', () => {
    const onInstallAll = vi.fn(async (): Promise<void> => undefined);
    renderModal(
      {
        font_rtdetr_v2: entry('font_rtdetr_v2', 'detectText'),
        manga_ocr: entry('manga_ocr', 'recognizeText'),
        installed_ocr: buildInstallState(
          { ...createMockModel('paddleocr_en_v5'), stage: 'recognizeText' },
          'installed',
        ),
      },
      onInstallAll,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Install recommended (all AIO stages)' }));
    expect(screen.getByText('Stages: Detect Text, Recognize Text')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Download', hidden: true }));
    expect(onInstallAll).toHaveBeenCalledTimes(1);
    expect(onInstallAll).toHaveBeenCalledWith(['font_rtdetr_v2', 'manga_ocr']);
  });

  it('keeps the single-stage button label when only one stage is eligible', () => {
    renderModal({ manga_ocr: entry('manga_ocr', 'recognizeText') }, async () => undefined);

    expect(screen.getByRole('button', { name: 'Install Recommended' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Install recommended (all AIO stages)' })).toBeNull();
  });
});
