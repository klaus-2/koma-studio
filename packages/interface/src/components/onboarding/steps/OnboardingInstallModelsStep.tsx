import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  HardDrive,
  RefreshCw,
  Square,
} from 'lucide-react';

import { useI18n } from '../../../i18n';
import { SOURCE_LANGUAGE_OPTIONS, TARGET_LANGUAGE_OPTIONS } from '../../../models/aioStageCatalog';
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
import { OnbSegmented } from '../onboardingChoiceControls';
import {
  OnbBadge,
  OnbCheckbox,
  OnbField,
  OnbNotice,
  OnbSection,
  OnbSelect,
  OnbToggleRow,
  cx,
} from '../onboardingPrimitives';
import { useOnbSkin } from '../onboardingSkin';

export interface OnboardingInstallModelsStepProps {
  onInstallModels?: (modelIds?: string[]) => Promise<unknown>;
  onRetryModel?: (modelId: string) => Promise<void>;
  onCancelModel?: (modelId: string) => Promise<void>;
  onCancelAllModels?: () => Promise<void>;
  onOpenModelManager?: () => void;
}

type CleanProfileId = 'lama_manga' | 'lama_fp32' | 'aot';

const NON_CLEAN_CORE_STAGES: readonly AioLocalModelStage[] = [
  'detectText',
  'recognizeText',
  'translation',
  'segmentText',
];

const CLEAN_PROFILE_OPTIONS: readonly { value: CleanProfileId; labelKey: string }[] = [
  { value: 'lama_manga', labelKey: 'onboarding.install.cleanProfile.lamaManga' },
  { value: 'lama_fp32', labelKey: 'onboarding.install.cleanProfile.lamaFp32' },
  { value: 'aot', labelKey: 'onboarding.install.cleanProfile.aot' },
];

const STAGE_LABEL_KEYS: Record<AioLocalModelStage, string> = {
  detectText: 'aio.stage.detectText',
  recognizeText: 'aio.stage.recognizeText',
  translation: 'aio.stage.getTranslations',
  segmentText: 'aio.stage.segmentText',
  cleanImage: 'aio.stage.cleanImage',
  imageEdit: 'modelManager.stage.imageEdit',
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
  const skin = useOnbSkin();
  const listTitleId = useId();
  const cleanProfileLabelId = useId();
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const deviceInfo = useAioPipelineStore((s) => s.aioDeviceInfo);
  const vramGb = deviceInfo?.vram_gb ?? null;
  const { entries, diskSpace, initialized } = useModelManagerLiveState();

  const recommendedCleanProfile: CleanProfileId =
    deviceInfo && !deviceInfo.has_gpu && Boolean(entries.lama_fp32)
      ? 'lama_fp32'
      : 'lama_manga';

  const [cleanProfile, setCleanProfile] = useState<CleanProfileId>(recommendedCleanProfile);
  const profileTouchedRef = useRef(false);
  const [includeEnhance, setIncludeEnhance] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const syncBenchmarkDefaults = useCallback(
    (profile: CleanProfileId): void => {
      const store = useAioPipelineStore.getState();
      const resolvedClean = entries[profile] ? profile : 'lama_manga';
      store.setAioStageSelection((prev) => ({
        ...prev,
        detectText: entries.font_rtdetr_v2 ? 'font_rtdetr_v2' : prev.detectText,
        segmentText: entries.ctd_text_seg ? 'ctd_text_seg' : prev.segmentText,
        cleanImage: resolvedClean,
      }));
      store.setAioHdStrategy('crop');
      store.setAioHdCropMargin(192);
      store.setAioHdCropTriggerSize(512);
      store.setAioMaskDilation(5);
    },
    [entries],
  );

  useEffect(() => {
    if (profileTouchedRef.current) return;
    setCleanProfile(recommendedCleanProfile);
  }, [recommendedCleanProfile]);

  const handleCleanProfileChange = (next: CleanProfileId): void => {
    profileTouchedRef.current = true;
    setCleanProfile(next);
    syncBenchmarkDefaults(next);
  };

  const stages = useMemo<readonly AioLocalModelStage[]>(
    () => (includeEnhance ? [...NON_CLEAN_CORE_STAGES, 'enhanceImage'] : NON_CLEAN_CORE_STAGES),
    [includeEnhance],
  );

  const resolvedCleanId = useMemo(
    () =>
      entries[cleanProfile]
        ? cleanProfile
        : entries.lama_manga
          ? 'lama_manga'
          : (getRecommendedModelIdsForStage('cleanImage', aioSrcLang, aioTgtLang)?.[0] ?? 'lama_manga'),
    [aioSrcLang, aioTgtLang, cleanProfile, entries],
  );

  const recommendedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const stage of stages) {
      for (const id of getRecommendedModelIdsForStage(stage, aioSrcLang, aioTgtLang) ?? []) {
        if (entries[id]) ids.add(id);
      }
    }
    if (entries[resolvedCleanId]) {
      ids.add(resolvedCleanId);
    }
    return [...ids];
  }, [aioSrcLang, aioTgtLang, entries, resolvedCleanId, stages]);

  const eligibleKey = useMemo(() => {
    const base = buildMultiStageInstallSummary(
      entries,
      stages,
      aioSrcLang,
      aioTgtLang,
      estimateModelRequiredDiskBytes,
    ).eligibleModelIds;
    const merged = new Set(base);
    const cleanEntry = entries[resolvedCleanId];
    if (cleanEntry && ELIGIBLE_INSTALL_STATUSES.has(cleanEntry.status)) {
      merged.add(resolvedCleanId);
    }
    return [...merged].join(',');
  }, [aioSrcLang, aioTgtLang, entries, resolvedCleanId, stages]);

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(eligibleKey ? eligibleKey.split(',') : []),
  );

  useEffect(() => {
    setSelectedIds(new Set(eligibleKey ? eligibleKey.split(',') : []));
  }, [eligibleKey]);

  const eligibleIds = recommendedIds.filter((id) => {
    const entry = entries[id];
    return Boolean(entry && ELIGIBLE_INSTALL_STATUSES.has(entry.status));
  });
  const selectedEligibleIds = eligibleIds.filter((id) => selectedIds.has(id));
  const selectedBytes = selectedEligibleIds.reduce((sum, id) => {
    const entry = entries[id];
    return entry ? sum + estimateModelRequiredDiskBytes(entry.model) : sum;
  }, 0);
  const activeCount = recommendedIds.filter((id) => {
    const entry = entries[id];
    return Boolean(entry && isActiveStatus(entry.status));
  }).length;
  const installedCount = recommendedIds.filter((id) => entries[id]?.status === 'installed').length;
  const allReady = recommendedIds.length > 0 && installedCount === recommendedIds.length;
  const notEnoughSpace = diskSpace !== null && diskSpace !== undefined && selectedBytes > diskSpace.freeBytes;

  const allSelected = eligibleIds.length > 0 && selectedEligibleIds.length === eligibleIds.length;
  const someSelected = selectedEligibleIds.length > 0 && !allSelected;

  const toggleOne = (modelId: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  };

  const toggleAll = (checked: boolean): void => {
    setSelectedIds(checked ? new Set(eligibleIds) : new Set());
  };

  const handleInstall = async (): Promise<void> => {
    if (!onInstallModels || selectedEligibleIds.length === 0) return;
    syncBenchmarkDefaults(cleanProfile);
    setActionError(null);
    setSubmitting(true);
    try {
      await onInstallModels(selectedEligibleIds);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t('modelManager.downloadError.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const srcOptions = SOURCE_LANGUAGE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }));
  const tgtOptions = TARGET_LANGUAGE_OPTIONS.map((opt) => ({ value: opt.value, label: t(opt.label) }));
  const cleanOptions = CLEAN_PROFILE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  return (
    <div className="flex flex-col gap-4">
      <OnbSection title={t('onboarding.install.pairTitle')} desc={t('onboarding.install.pairDesc')}>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <OnbField label={t('onboarding.install.sourceLangLabel')} htmlFor="koma-onb-src-lang">
            <OnbSelect id="koma-onb-src-lang" value={aioSrcLang} options={srcOptions} onChange={setAioSrcLang} />
          </OnbField>
          <ArrowRight size={16} aria-hidden="true" className={cx('hidden sm:mb-2.5 sm:block', skin.muted)} />
          <OnbField label={t('onboarding.install.targetLangLabel')} htmlFor="koma-onb-tgt-lang">
            <OnbSelect id="koma-onb-tgt-lang" value={aioTgtLang} options={tgtOptions} onChange={setAioTgtLang} />
          </OnbField>
        </div>
        <div className="mt-3">
          <OnbField
            label={t('onboarding.install.cleanProfileLabel')}
            labelId={cleanProfileLabelId}
            hint={t('onboarding.install.cleanProfileHint')}
          >
            <OnbSegmented
              labelledBy={cleanProfileLabelId}
              value={cleanProfile}
              options={cleanOptions}
              onChange={handleCleanProfileChange}
            />
          </OnbField>
        </div>
        <div className="mt-3">
          <OnbToggleRow
            title={t('onboarding.install.includeEnhance')}
            desc={t('onboarding.install.includeEnhanceDesc')}
            checked={includeEnhance}
            onChange={setIncludeEnhance}
          />
        </div>
      </OnbSection>

      <OnbSection
        icon={<HardDrive size={14} />}
        title={t('onboarding.install.packTitle')}
        desc={t('onboarding.install.sizeSummary', {
          download: formatDownloadBytes(selectedBytes),
          free: diskSpace ? formatDownloadBytes(diskSpace.freeBytes) : t('common.notAvailableShort'),
        })}
        titleId={listTitleId}
        actions={
          <OnbBadge tone={allReady ? 'success' : 'info'}>
            {t('onboarding.install.readyBadge', { installed: installedCount, total: recommendedIds.length })}
          </OnbBadge>
        }
      >
        {!initialized && recommendedIds.length === 0 ? (
          <p role="status" className={skin.muted}>{t('onboarding.install.loadingCatalog')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {eligibleIds.length > 1 ? (
              <label className={cx('flex cursor-pointer items-center gap-3 px-1', skin.label)}>
                <OnbCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                <span>{t('onboarding.install.selectAll')}</span>
              </label>
            ) : null}

            <ul aria-labelledby={listTitleId} className="flex flex-col gap-1.5">
              {recommendedIds.map((modelId) => {
                const entry = entries[modelId];
                if (!entry) return null;
                const eligible = ELIGIBLE_INSTALL_STATUSES.has(entry.status);
                const busy = isActiveStatus(entry.status);
                const installed = entry.status === 'installed';
                const checked = eligible ? selectedIds.has(modelId) : installed;
                const minVram = entry.model.minVramGb;
                const exceedsVram = typeof minVram === 'number' && (vramGb === null || minVram > vramGb);

                return (
                  <li key={modelId} className={cx(skin.item, checked && !installed ? skin.itemOn : skin.itemOff)}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <OnbCheckbox checked={checked} disabled={!eligible} onChange={() => toggleOne(modelId)} />
                        <span className="min-w-0">
                          <span className={cx('block truncate', skin.itemTitle)}>{entry.model.name}</span>
                          <span className={cx('block', skin.mono)}>
                            {t(STAGE_LABEL_KEYS[entry.model.stage])} · {formatDownloadBytes(estimateModelRequiredDiskBytes(entry.model), true)}
                          </span>
                        </span>
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {exceedsVram && typeof minVram === 'number' ? (
                          <OnbBadge tone="warn">{t('onboarding.install.vramHint', { vram: minVram })}</OnbBadge>
                        ) : null}
                        {installed ? (
                          <OnbBadge tone="success">
                            <CheckCircle2 size={11} aria-hidden="true" />
                            {t('modelManager.status.installed')}
                          </OnbBadge>
                        ) : entry.status === 'failed' ? (
                          <>
                            <OnbBadge tone="danger">
                              <AlertCircle size={11} aria-hidden="true" />
                              {t('modelManager.status.failed')}
                            </OnbBadge>
                            {onRetryModel ? (
                              <button type="button" className={skin.btnSmall} onClick={() => void onRetryModel(modelId)}>
                                <RefreshCw size={11} aria-hidden="true" />
                                <span>{t('modelManager.actions.retry')}</span>
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <OnbBadge tone={busy ? 'info' : 'neutral'}>{t(STATUS_LABEL_KEYS[entry.status])}</OnbBadge>
                        )}
                      </div>
                    </div>

                    {entry.progress && busy ? (
                      <div className="mt-2">
                        <ModelProgressBar
                          progress={entry.progress}
                          compact
                          onCancel={onCancelModel ? () => void onCancelModel(modelId) : undefined}
                        />
                      </div>
                    ) : null}

                    {entry.status === 'failed' ? (
                      <p role="alert" className={cx('mt-2', skin.notice('danger'))}>
                        {entry.errorCode
                          ? translateDynamic(`modelManager.downloadError.${entry.errorCode}`)
                          : entry.error || t('modelManager.downloadError.unknown')}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {notEnoughSpace ? (
          <div className="mt-3">
            <OnbNotice tone="warn" role="alert">{t('onboarding.install.notEnoughSpace')}</OnbNotice>
          </div>
        ) : null}
        {actionError ? (
          <div className="mt-3">
            <OnbNotice tone="danger" role="alert">{actionError}</OnbNotice>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className={cx('min-w-0 flex-1 basis-56', skin.muted)}>{t('onboarding.install.backgroundHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {onOpenModelManager ? (
              <button type="button" className={skin.btnGhost} onClick={onOpenModelManager}>
                <span>{t('onboarding.install.openManagerButton')}</span>
                <ExternalLink size={12} aria-hidden="true" />
              </button>
            ) : null}
            {activeCount > 0 && onCancelAllModels ? (
              <button type="button" className={skin.btnGhost} onClick={() => void onCancelAllModels()}>
                <Square size={12} aria-hidden="true" />
                <span>{t('onboarding.install.cancelAll')}</span>
              </button>
            ) : null}
            <button
              type="button"
              className={skin.btnPrimary}
              aria-busy={submitting}
              disabled={submitting || selectedEligibleIds.length === 0 || !onInstallModels}
              onClick={() => void handleInstall()}
            >
              <Download size={13} aria-hidden="true" />
              <span>{t('onboarding.install.installSelectedButton', { count: selectedEligibleIds.length })}</span>
            </button>
          </div>
        </div>
      </OnbSection>
    </div>
  );
}
