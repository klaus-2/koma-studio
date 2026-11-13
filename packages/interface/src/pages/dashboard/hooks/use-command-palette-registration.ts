import { useEffect } from 'react';

import { registerPaletteActions, type PaletteAction } from '../../../shortcuts/paletteActions';
import type { TranslationKey } from '../../../i18n/messages';
import type { StageTabKey } from '../../AioStageTabBar.types';
import type { ToolMode } from '../../../types/dashboard.types';
import { useUiShellStore } from '../stores/ui-shell-store';

/** Static palette wiring: stage navigation (same store setter the stage tab bar uses). */
const STAGE_PALETTE_ACTIONS: ReadonlyArray<{
  id: string;
  titleKey: TranslationKey;
  tab: StageTabKey;
}> = [
  { id: 'stage.detectText', titleKey: 'aio.stage.detectText', tab: 'detectText' },
  { id: 'stage.recognizeText', titleKey: 'aio.stage.recognizeText', tab: 'recognizeText' },
  { id: 'stage.getTranslations', titleKey: 'aio.stage.getTranslations', tab: 'getTranslations' },
  { id: 'stage.segmentText', titleKey: 'aio.stage.segmentText', tab: 'segmentText' },
  { id: 'stage.cleanImage', titleKey: 'aio.stage.cleanImage', tab: 'cleanImage' },
  { id: 'stage.render', titleKey: 'aio.stage.render', tab: 'render' },
];

/** Tool switches backed by the keyboard dispatch's setMode* handlers (handleModeChange). */
const TOOL_MODE_PALETTE_ACTIONS: ReadonlyArray<{
  id: string;
  titleKey: TranslationKey;
  mode: ToolMode;
}> = [
  { id: 'mode.aio', titleKey: 'shortcuts.setModeAio.label', mode: 'aio' },
  { id: 'mode.cleaner', titleKey: 'shortcuts.setModeCleaner.label', mode: 'cleaner' },
  { id: 'mode.typesetter', titleKey: 'shortcuts.setModeTypesetter.label', mode: 'typesetter' },
  { id: 'mode.translator', titleKey: 'shortcuts.setModeTranslator.label', mode: 'translator' },
  { id: 'mode.raw', titleKey: 'shortcuts.setModeRaw.label', mode: 'raw' },
  { id: 'mode.proofreader', titleKey: 'shortcuts.setModeProofreader.label', mode: 'proofreader' },
  { id: 'mode.stitch', titleKey: 'shortcuts.setModeStitch.label', mode: 'stitch' },
  { id: 'mode.split', titleKey: 'shortcuts.setModeSplit.label', mode: 'split' },
  { id: 'mode.watermark', titleKey: 'shortcuts.setModeWatermark.label', mode: 'watermark' },
  { id: 'mode.enhance', titleKey: 'shortcuts.setModeEnhance.label', mode: 'enhance' },
  { id: 'mode.guides', titleKey: 'shortcuts.setModeGuides.label', mode: 'guides' },
  { id: 'mode.resources', titleKey: 'shortcuts.setModeResources.label', mode: 'resources' },
];

export interface UseCommandPaletteRegistrationArgs {
  handleModeChange: (newMode: ToolMode) => void;
  handleToolsToggle: () => void;
  openShortcutCenter: () => void;
}

/**
 * Registers the static command palette actions (stages, tools, pages) with the
 * same handlers the keyboard dispatch uses; idempotent upsert on handler change.
 */
export function useCommandPaletteRegistration({
  handleModeChange,
  handleToolsToggle,
  openShortcutCenter,
}: UseCommandPaletteRegistrationArgs): void {
  const setActiveStageTab = useUiShellStore((s) => s.setActiveStageTab);
  const setViewMode = useUiShellStore((s) => s.setViewMode);

  useEffect(() => {
    const actions: PaletteAction[] = [
      ...STAGE_PALETTE_ACTIONS.map(
        (entry): PaletteAction => ({
          id: entry.id,
          titleKey: entry.titleKey,
          category: 'stages',
          run: () => setActiveStageTab(entry.tab),
        }),
      ),
      ...TOOL_MODE_PALETTE_ACTIONS.map(
        (entry): PaletteAction => ({
          id: entry.id,
          titleKey: entry.titleKey,
          category: 'tools',
          run: () => handleModeChange(entry.mode),
        }),
      ),
      {
        id: 'openShortcutCenter',
        titleKey: 'shortcuts.openShortcutModal.label',
        category: 'tools',
        run: openShortcutCenter,
      },
      {
        id: 'toggleToolsPanel',
        titleKey: 'shortcuts.toggleToolsPanel.label',
        category: 'tools',
        run: handleToolsToggle,
      },
      {
        id: 'viewPaginated',
        titleKey: 'shortcuts.setViewPaginated.label',
        category: 'pages',
        run: () => setViewMode('paginated'),
      },
      {
        id: 'viewLongStrip',
        titleKey: 'shortcuts.setViewLongStrip.label',
        category: 'pages',
        run: () => setViewMode('long_strip'),
      },
    ];
    registerPaletteActions(actions);
  }, [
    handleModeChange,
    handleToolsToggle,
    openShortcutCenter,
    setActiveStageTab,
    setViewMode,
  ]);
}
