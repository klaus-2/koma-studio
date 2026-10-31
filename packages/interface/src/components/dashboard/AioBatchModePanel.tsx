import { memo, useMemo } from 'react';
import { useThemeStore } from '@koma/ui/stores/theme-store';

import { useI18n } from '../../i18n';
import { isChapterPresetRunnable } from '@/pages/dashboard/lib/aio-chapter-options';
import { groupImagesIntoAioChapters } from '@/pages/dashboard/lib/aio-chapters';
import {
  AioChecklistOption,
  aioPanelClasses,
} from '@/pages/dashboard/sections/AioRightPanel.skin';
import { useAioPipelineStore } from '@/pages/dashboard/stores/aio-pipeline-store';
import { useImageCollectionStore } from '@/pages/dashboard/stores/image-collection-store';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';
import {
  isCloudOcrModelKey,
  isCloudTranslationModelKey,
} from '@/utils/customLlm';
import { cn, normalizePresetLanguage } from '@/utils/dashboard.utils';

/**
 * Batch Mode switch and the per-chapter preset queue. Reads the collection and
 * pipeline stores directly so the surrounding panel only renders it.
 */
export default memo(function AioBatchModePanel() {
  const { t } = useI18n();
  const noir = useThemeStore((s) => s.family === 'noir');
  const skin = aioPanelClasses(noir);
  const images = useImageCollectionStore((s) => s.images);
  const batchModeEnabled = useAioPipelineStore((s) => s.batchModeEnabled);
  const setBatchModeEnabled = useAioPipelineStore(
    (s) => s.setBatchModeEnabled,
  );
  const assignmentByChapterId = useAioPipelineStore(
    (s) => s.batchChapterPresetByChapterId,
  );
  const setAssignmentByChapterId = useAioPipelineStore(
    (s) => s.setBatchChapterPresetByChapterId,
  );
  const presetState = useAioPipelineStore((s) => s.aioPresetState);
  const sourceLanguage = useAioPipelineStore((s) => s.aioSrcLang);
  const stageOptions = useAioPipelineStore((s) => s.aioStageOptions);
  const aioSteps = useAioPipelineStore((s) => s.aioSteps);
  const selection = useAioPipelineStore((s) => s.aioStageSelection);
  const executing = useAioPipelineStore((s) => s.aioAbortController !== null);
  const processing = useUiShellStore((s) => s.processing);
  const disabled = processing || executing;

  const chapters = useMemo(() => groupImagesIntoAioChapters(images), [images]);

  const usablePresets = useMemo(() => {
    const language = normalizePresetLanguage(sourceLanguage);

    return presetState.presets.filter(
      (preset) =>
        normalizePresetLanguage(preset.sourceLanguage) === language &&
        isChapterPresetRunnable(preset, stageOptions),
    );
  }, [presetState.presets, sourceLanguage, stageOptions]);

  const usesCloudPipeline =
    (aioSteps.recognizeText && isCloudOcrModelKey(selection.recognizeText)) ||
    (aioSteps.getTranslations &&
      isCloudTranslationModelKey(selection.getTranslations));

  return (
    <section className="mt-2 flex flex-col gap-2" data-tour="dashboard-aio-batch-mode">
      <AioChecklistOption
        noir={noir}
        checked={batchModeEnabled}
        disabled={disabled}
        label={t('dashboard.batchMode.title')}
        onChange={(checked) => setBatchModeEnabled(checked)}
      />
      <p className={skin.hint}>{t('dashboard.batchMode.hint')}</p>

      {batchModeEnabled ? (
        <p className={skin.hint}>{t('dashboard.batchMode.chapterExplainer')}</p>
      ) : null}

      {batchModeEnabled && usesCloudPipeline ? (
        <p className={skin.hint}>{t('dashboard.batchMode.localOnly')}</p>
      ) : null}

      {batchModeEnabled && chapters.length <= 1 ? (
        <p className={skin.hint}>{t('dashboard.batchMode.needChapters')}</p>
      ) : null}

      {batchModeEnabled && chapters.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <span className={skin.label}>{t('dashboard.batchMode.chapters')}</span>
          <ul className="flex flex-col gap-1.5">
            {chapters.map((chapter, index) => {
              const assignedPresetId =
                assignmentByChapterId[chapter.id] ?? '';
              const selectedPresetId = usablePresets.some(
                (preset) => preset.id === assignedPresetId,
              )
                ? assignedPresetId
                : '';

              return (
                <li key={chapter.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[10px]">
                    {index + 1}. {chapter.label} ({chapter.images.length})
                  </span>
                  <select
                    value={selectedPresetId}
                    disabled={disabled}
                    aria-label={t('dashboard.batchMode.chapterAria', {
                      chapter: chapter.label,
                    })}
                    onChange={(event) => {
                      const presetId = event.target.value;

                      setAssignmentByChapterId((previous) => {
                        const next = { ...previous };

                        if (presetId) {
                          next[chapter.id] = presetId;
                        } else {
                          delete next[chapter.id];
                        }

                        return next;
                      });
                    }}
                    className={cn(skin.select, 'max-w-[140px]')}
                  >
                    <option value="">
                      {t('dashboard.batchMode.followSetup')}
                    </option>
                    {usablePresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
});
