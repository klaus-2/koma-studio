import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  HardDrive,
  RefreshCw,
  Square,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import {
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
} from '../../../models/aioStageCatalog';
import { estimateModelRequiredDiskBytes } from '../../../models/model-storage';
import type {
  AioLocalModelStage,
  ModelInstallLifecycleStatus,
  ModelInstallState,
} from '../../../models/types';
import { useModelManagerLiveState } from '../../../hooks/useModelManager';
import { useAioPipelineStore } from '../../../pages/dashboard/stores/aio-pipeline-store';
import { ModelProgressBar } from '../../ModelManagerModal/ModelProgressBar';
import { formatDownloadBytes } from '../../ModelManagerModal/progressFormat';
import {
  ELIGIBLE_INSTALL_STATUSES,
  buildMultiStageInstallSummary,
  getRecommendedModelIdsForStage,
} from '../../ModelManagerModal/recommendedInstall';
import { OnboardingBadge, OnboardingSectionCard } from '../onboardingPrimitives';

export interface OnboardingInstallModelsStepProps {
  onInstallModels?: (modelIds?: string[]) => Promise<unknown>;
  onRetryModel?: (modelId: string) => Promise<void>;
  onCancelModel?: (modelId: string) => Promise<void>;
  onCancelAllModels?: () => Promise<void>;
  onOpenModelManager?: () => void;
}

const CORE_ONBOARDING_STAGES: readonly AioLocalModelStage[] = [
  'detectText',
  'recognizeText',
  'translation',
  'segmentText',
  'cleanImage',
];

const STAGE_LABEL_KEYS: Record<AioLocalModelStage, string> = {
  detectText: 'aio.stage.detectText',
  recognizeText: 'aio.stage.recognizeText',
  translation: 'aio.stage.getTranslations',
  segmentText: 'aio.stage.segmentText',
  cleanImage: 'aio.stage.cleanImage',
  enhanceImage: 'dashboard.mode.enhance',
};

const STATUS_LABEL_KEYS: Record<ModelInstallLifecycleStatus, string> = {
  not_installed: 'modelManager.status.notInstalled',
  queued: 'modelManager.status.queued',
  downloading: 'modelManager.status.downloading',
  verifying: 'modelManager.status.verifying',
  installed: 'modelManager.status.installed',
  update_available: 'modelManager.status.updateAvailable',
  failed: 'modelManager.status.failed',
  cancelled: 'modelManager.status.cancelled',
  incomplete: 'modelManager.status.incomplete',
};

const isActiveStatus = (status: ModelInstallState['status']): boolean =>
  status === 'downloading' || status === 'queued' || status === 'verifying';

export function OnboardingInstallModelsStep({
  onInstallModels,
  onRetryModel,
  onCancelModel,
  onCancelAllModels,
  onOpenModelManager,
}: OnboardingInstallModelsStepProps) {
  const { t, translateDynamic } = useI18n();
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const deviceInfo = useAioPipelineStore((s) => s.aioDeviceInfo);

  const { entries, diskSpace, initialized } = useModelManagerLiveState();
  const [includeEnhance, setIncludeEnhance] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const stages = useMemo<readonly AioLocalModelStage[]>(
    () =>
      includeEnhance
        ? [...CORE_ONBOARDING_STAGES, 'enhanceImage']
        : CORE_ONBOARDING_STAGES,
    [includeEnhance],
  );

  const recommendedIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const stage of stages) {
      const stageIds = getRecommendedModelIdsForStage(stage, aioSrcLang, aioTgtLang) ?? [];
      for (const id of stageIds) {
        if (!seen.has(id) && entries[id]) {
          seen.add(id);
          ids.push(id);
        }
      }
    }
    return ids;
  }, [aioSrcLang, aioTgtLang, entries, stages]);

  const multiSummary = useMemo(
    () =>
      buildMultiStageInstallSummary(
        entries,
        stages,
        aioSrcLang,
        aioTgtLang,
        estimateModelRequiredDiskBytes,
      ),
    [aioSrcLang, aioTgtLang, entries, stages],
  );

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(multiSummary.eligibleModelIds),
  );

  useEffect(() => {
    setSelectedIds(new Set(multiSummary.eligibleModelIds));
  }, [aioSrcLang, aioTgtLang, includeEnhance, multiSummary.eligibleModelIds.join(',')]);

  const selectedEligibleIds = useMemo(
    () =>
      recommendedIds.filter((id) => {
        const entry = entries[id];
        return Boolean(entry && selectedIds.has(id) && ELIGIBLE_INSTALL_STATUSES.has(entry.status));
      }),
    [entries, recommendedIds, selectedIds],
  );

  const selectedBytes = useMemo(
    () =>
      selectedEligibleIds.reduce((sum, id) => {
        const entry = entries[id];
        return entry ? sum + estimateModelRequiredDiskBytes(entry.model) : sum;
      }, 0),
    [entries, selectedEligibleIds],
  );

  const activeDownloadsCount = useMemo(
    () =>
      recommendedIds.filter((id) => {
        const entry = entries[id];
        return Boolean(entry && isActiveStatus(entry.status));
      }).length,
    [entries, recommendedIds],
  );

  const installedCount = useMemo(
    () =>
      recommendedIds.filter((id) => entries[id]?.status === 'installed').length,
    [entries, recommendedIds],
  );

  const toggleModelSelection = (modelId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const handleInstallSelected = async (): Promise<void> => {
    if (!onInstallModels || selectedEligibleIds.length === 0) {
      return;
    }
    setActionError(null);
    setBatchSubmitting(true);
    try {
      await onInstallModels(selectedEligibleIds);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t('modelManager.downloadError.unknown'),
      );
    } finally {
      setBatchSubmitting(false);
    }
  };

  const vramGb = deviceInfo?.vram_gb ?? null;

  return (
    <div className="koma-onb-stepStack">
      <div className="koma-onb-grid2">
        <OnboardingSectionCard>
          <label htmlFor="koma-onb-src-lang" className="koma-onb-cardTitle">
            {t('onboarding.install.sourceLangLabel')}
          </label>
          <select
            id="koma-onb-src-lang"
            className="koma-onb-select"
            value={aioSrcLang}
            onChange={(e) => setAioSrcLang(e.target.value)}
          >
            {SOURCE_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </OnboardingSectionCard>

        <OnboardingSectionCard>
          <label htmlFor="koma-onb-tgt-lang" className="koma-onb-cardTitle">
            {t('onboarding.install.targetLangLabel')}
          </label>
          <select
            id="koma-onb-tgt-lang"
            className="koma-onb-select"
            value={aioTgtLang}
            onChange={(e) => setAioTgtLang(e.target.value)}
          >
            {TARGET_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </OnboardingSectionCard>
      </div>

      <OnboardingSectionCard tone="info">
        <div className="koma-onb-installBar">
          <div>
            <div className="koma-onb-cardHead">
              <HardDrive size={15} />
              <strong className="koma-onb-cardTitle">
                {t('onboarding.install.packTitle')}
              </strong>
              <OnboardingBadge tone="success">
                {t('onboarding.install.readyBadge', {
                  installed: installedCount,
                  total: recommendedIds.length,
                })}
              </OnboardingBadge>
            </div>
            <p className="koma-onb-muted">
              {t('onboarding.install.sizeSummary', {
                download: formatDownloadBytes(selectedBytes),
                free: diskSpace
                  ? formatDownloadBytes(diskSpace.freeBytes)
                  : t('common.notAvailableShort'),
              })}
            </p>
          </div>

          <div className="koma-onb-modelRow__meta">
            <label className="koma-onb-modelRow__selectLabel">
              <input
                type="checkbox"
                checked={includeEnhance}
                onChange={(e) => setIncludeEnhance(e.target.checked)}
              />
              <span>{t('onboarding.install.includeEnhance')}</span>
            </label>

            {activeDownloadsCount > 0 && onCancelAllModels ? (
              <button
                type="button"
                className="koma-onb-btn koma-onb-btn--ghost koma-onb-btn--sm"
                onClick={() => void onCancelAllModels()}
              >
                <Square size={12} />
                <span>{t('onboarding.install.cancelAll')}</span>
              </button>
            ) : null}

            <button
              type="button"
              className="koma-onb-btn koma-onb-btn--primary"
              disabled={batchSubmitting || selectedEligibleIds.length === 0 || !onInstallModels}
              onClick={() => void handleInstallSelected()}
            >
              <Download size={14} />
              <span>
                {t('onboarding.install.installSelectedButton', {
                  count: selectedEligibleIds.length,
                })}
              </span>
            </button>

            {onOpenModelManager ? (
              <button
                type="button"
                className="koma-onb-btn koma-onb-btn--ghost koma-onb-btn--sm"
                onClick={onOpenModelManager}
              >
                <span>{t('onboarding.install.openManagerButton')}</span>
                <ExternalLink size={12} />
              </button>
            ) : null}
          </div>
        </div>

        <p className="koma-onb-muted">{t('onboarding.install.backgroundHint')}</p>
        {actionError ? (
          <p className="koma-onb-errorText" role="alert">
            {actionError}
          </p>
        ) : null}
      </OnboardingSectionCard>

      {!initialized && recommendedIds.length === 0 ? (
        <OnboardingSectionCard>
          <p className="koma-onb-muted">{t('onboarding.install.loadingCatalog')}</p>
        </OnboardingSectionCard>
      ) : (
        <div className="koma-onb-modelList">
          {recommendedIds.map((modelId) => {
            const entry = entries[modelId];
            if (!entry) return null;
            const eligible = ELIGIBLE_INSTALL_STATUSES.has(entry.status);
            const isBusy = isActiveStatus(entry.status);
            const sizeEstimate = formatDownloadBytes(
              estimateModelRequiredDiskBytes(entry.model),
              true,
            );
            const exceedsVram =
              typeof entry.model.minVramGb === 'number' &&
              (vramGb === null || entry.model.minVramGb > vramGb);

            return (
              <div key={modelId} className="koma-onb-modelRow">
                <div className="koma-onb-modelRow__top">
                  <label className="koma-onb-modelRow__selectLabel">
                    <input
                      type="checkbox"
                      checked={eligible ? selectedIds.has(modelId) : entry.status === 'installed'}
                      disabled={!eligible}
                      onChange={() => toggleModelSelection(modelId)}
                    />
                    <strong>{entry.model.name}</strong>
                    <OnboardingBadge tone="neutral">
                      {t(STAGE_LABEL_KEYS[entry.model.stage])}
                    </OnboardingBadge>
                    <span className="koma-onb-muted">{sizeEstimate}</span>
                  </label>

                  <div className="koma-onb-modelRow__meta">
                    {exceedsVram && typeof entry.model.minVramGb === 'number' ? (
                      <OnboardingBadge tone="warn">
                        {t('onboarding.install.vramHint', { vram: entry.model.minVramGb })}
                      </OnboardingBadge>
                    ) : null}

                    {entry.status === 'installed' ? (
                      <OnboardingBadge tone="success">
                        <CheckCircle2 size={11} />
                        {t('modelManager.status.installed')}
                      </OnboardingBadge>
                    ) : entry.status === 'failed' ? (
                      <>
                        <OnboardingBadge tone="accent">
                          <AlertCircle size={11} />
                          {t('modelManager.status.failed')}
                        </OnboardingBadge>
                        {onRetryModel ? (
                          <button
                            type="button"
                            className="koma-onb-btn koma-onb-btn--ghost koma-onb-btn--sm"
                            onClick={() => void onRetryModel(modelId)}
                          >
                            <RefreshCw size={12} />
                            <span>{t('modelManager.actions.retry')}</span>
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <OnboardingBadge tone={isBusy ? 'info' : 'neutral'}>
                        {t(STATUS_LABEL_KEYS[entry.status])}
                      </OnboardingBadge>
                    )}
                  </div>
                </div>

                {entry.progress && isBusy ? (
                  <ModelProgressBar
                    progress={entry.progress}
                    compact
                    onCancel={
                      onCancelModel ? () => void onCancelModel(modelId) : undefined
                    }
                  />
                ) : null}

                {entry.status === 'failed' ? (
                  <p className="koma-onb-errorText" role="alert">
                    {entry.errorCode
                      ? translateDynamic(`modelManager.downloadError.${entry.errorCode}`)
                      : entry.error || t('modelManager.downloadError.unknown')}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
