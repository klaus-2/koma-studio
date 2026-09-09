import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Layers, X, CheckCircle2, AlertTriangle, Sparkles, Plus } from 'lucide-react';
import { useI18n } from '../../i18n';

import {
  estimateModelRequiredDiskBytes,
  formatBytes,
} from '../../models/model-storage';
import { listRegistryLanguages } from '../../models/translation-models-registry';
import type {
  AioLocalModelStage,
  DiskSpaceInfo,
  ModelFilterState,
  ModelInstallState,
} from '../../models/types';
import { DiskSpaceIndicator } from './DiskSpaceIndicator';
import { InstallAllConfirmation } from './InstallAllConfirmation';
import { ModelCard } from './ModelCard';
import { ModelFilters } from './ModelFilters';
import { buildScopedInstallSummary } from './recommendedInstall';
import styles from './styles.module.css';

export interface ModelManagerModalProps {
  open: boolean;
  entries: Record<string, ModelInstallState>;
  diskSpace: DiskSpaceInfo | null;
  installedCount: number;
  totalCount: number;
  updatesCount: number;
  installedSizeBytes: number;
  checkingRemoteUpdates: boolean;
  lastRemoteCheckAt: number | null;
  defaultLanguageFilter: string;
  focusedModelId: string | null;
  selectedModelId: string;
  selectionStage: AioLocalModelStage;
  selectionStageLabel?: string;
  localStageFilter?: AioLocalModelStage | null;
  enableCloudCatalog?: boolean;
  initialSourceFilter?: ModelFilterState['source'];
  hideSourceToggle?: boolean;
  hideLanguageFilter?: boolean;
  hideStatusFilter?: boolean;
  hideFooter?: boolean;
  hideHeaderMeta?: boolean;
  freeProviderSection?: ReactNode;
  customProfilesSection?: ReactNode;
  batch: {
    active: boolean;
    total: number;
    completed: number;
    cancelled: boolean;
  };
  installAllSummary: {
    totalBytes: number;
    requiredBytes: number;
    eligibleModelIds: string[];
  };
  onClose: () => void;
  onSetLanguageFilter: (language: string) => void;
  onInstallModel: (modelId: string) => Promise<void>;
  onUpdateModel: (modelId: string) => Promise<void>;
  onUninstallModel: (modelId: string) => Promise<void>;
  onRetryModel: (modelId: string) => Promise<void>;
  onCancelModel: (modelId: string) => Promise<void>;
  onSelectModel: (modelKey: string) => void;
  onInstallAll: (modelIds?: string[]) => Promise<unknown>;
  onCancelAll: () => Promise<void>;
  onCheckUpdatesNow: () => Promise<void>;
}

const statusMatchesFilter = (
  entry: ModelInstallState,
  status: ModelFilterState['status'],
) => {
  if (status === 'all') return true;
  if (status === 'installed')
    return entry.status === 'installed' || entry.status === 'update_available';
  if (status === 'update_available') return entry.status === 'update_available';
  return (
    entry.status === 'not_installed' ||
    entry.status === 'failed' ||
    entry.status === 'incomplete'
  );
};

const languageMatchesFilter = (entry: ModelInstallState, lang: string) => {
  if (lang === 'all') return true;
  return (
    entry.model.sourceLanguages.includes('*') ||
    entry.model.sourceLanguages
      .map((l) => l.toLowerCase())
      .includes(lang.toLowerCase())
  );
};

export const ModelManagerModal = ({
  open,
  entries,
  diskSpace,
  installedCount,
  totalCount,
  updatesCount,
  installedSizeBytes,
  checkingRemoteUpdates,
  lastRemoteCheckAt,
  defaultLanguageFilter,
  focusedModelId,
  selectedModelId,
  selectionStage,
  selectionStageLabel,
  localStageFilter = null,
  enableCloudCatalog = true,
  initialSourceFilter,
  hideSourceToggle = false,
  hideLanguageFilter = false,
  hideStatusFilter = false,
  hideFooter = false,
  hideHeaderMeta = false,
  freeProviderSection,
  customProfilesSection,
  batch,
  installAllSummary,
  onClose,
  onSetLanguageFilter,
  onInstallModel,
  onUpdateModel,
  onUninstallModel,
  onRetryModel,
  onCancelModel,
  onSelectModel,
  onInstallAll,
  onCancelAll,
  onCheckUpdatesNow,
}: ModelManagerModalProps) => {
  const { t } = useI18n();
  const [showConfirm, setShowConfirm] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<ModelFilterState['source']>(
    initialSourceFilter ?? (enableCloudCatalog ? 'all' : 'local'),
  );
  const [statusFilter, setStatusFilter] =
    useState<ModelFilterState['status']>('all');
  const [showCustom, setShowCustom] = useState(false);

  const languageFilter = defaultLanguageFilter || 'all';
  const effectiveSource = enableCloudCatalog ? sourceFilter : 'local';
  const languageOptions = useMemo(() => listRegistryLanguages(), []);

  useEffect(() => {
    if (!enableCloudCatalog && sourceFilter !== 'local')
      setSourceFilter('local');
  }, [enableCloudCatalog, sourceFilter]);
  useEffect(() => {
    if (!open || !customProfilesSection) setShowCustom(false);
  }, [customProfilesSection, open]);

  const filteredLocal = useMemo(() => {
    if (effectiveSource === 'cloud') return [];
    return Object.values(entries).filter((e) => {
      if (localStageFilter && e.model.stage !== localStageFilter) return false;
      if (!statusMatchesFilter(e, statusFilter)) return false;
      if (!languageMatchesFilter(e, languageFilter)) return false;
      return true;
    });
  }, [
    effectiveSource,
    entries,
    languageFilter,
    localStageFilter,
    statusFilter,
  ]);

  const hasLocal = filteredLocal.length > 0;

  const scopedSummary = useMemo(() => {
    return buildScopedInstallSummary(
      entries,
      localStageFilter,
      languageFilter,
      installAllSummary,
      estimateModelRequiredDiskBytes,
    );
  }, [entries, installAllSummary, languageFilter, localStageFilter]);

  const blockedReason = useMemo(() => {
    if (!scopedSummary.eligibleModelIds.length)
      return t('modelManager.modal.noEligible');
    if (diskSpace && diskSpace.freeBytes < scopedSummary.requiredBytes)
      return t('modelManager.modal.notEnoughSpace', { space: formatBytes(scopedSummary.requiredBytes) });
    return null;
  }, [diskSpace, scopedSummary, t]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="mm-title"
      >
        {/* ═══ Header ═══ */}
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.headerIcon} aria-hidden="true">
              <Layers size={16} />
            </span>
            <div className={styles.headerText}>
              <h2 id="mm-title">{t('modelManager.modal.title')}</h2>
              <p>
                {selectionStageLabel ?? 'AIO'}
                {lastRemoteCheckAt && (
                  <>
                    {' '}
                    · {t('modelManager.modal.verified')}{' '}
                    {new Date(lastRemoteCheckAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </p>
              {!hideHeaderMeta && (
                <div className={styles.headerMeta}>
                  <span className={styles.headerChipInstalled}>
                    <CheckCircle2 size={9} /> {installedCount}/{totalCount}
                  </span>
                  {updatesCount > 0 ? (
                    <span className={styles.headerChipUpdates}>
                      <AlertTriangle size={9} /> {t('toolbar.modelSelect.updates_other', { count: updatesCount })}
                    </span>
                  ) : (
                    <span className={styles.headerChipOk}>{t('modelManager.modal.upToDate')}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('modelManager.modal.closeAria')}
          >
            <X size={14} />
          </button>
        </header>

        {/* ═══ Filters ═══ */}
        <ModelFilters
          filters={{
            source: effectiveSource,
            language: languageFilter,
            status: statusFilter,
          }}
          languages={languageOptions}
          allowCloud={enableCloudCatalog}
          hideSourceToggle={hideSourceToggle}
          hideLanguageFilter={hideLanguageFilter}
          hideStatusFilter={hideStatusFilter}
          onSourceChange={setSourceFilter}
          onLanguageChange={onSetLanguageFilter}
          onStatusChange={setStatusFilter}
        />

        {/* ═══ Body ═══ */}
        <div className={styles.body}>
          {/* ── Local Catalog ──────────────────────────────── */}
          {effectiveSource !== 'cloud' && (
            <section className={styles.catalogSection}>
              <header className={styles.catalogHeader}>
                <h3>{t('modelManager.modal.localModels')}</h3>
                <p>{t('modelManager.modal.localDesc')}</p>
              </header>

              <div className={styles.modelGrid}>
                {filteredLocal.map((entry) => (
                  <ModelCard
                    key={entry.model.id}
                    entry={entry}
                    focused={
                      focusedModelId === entry.model.id ||
                      selectedModelId === entry.model.id
                    }
                    selected={selectedModelId === entry.model.id}
                    selectable={entry.model.stage === selectionStage}
                    onInstall={onInstallModel}
                    onUpdate={onUpdateModel}
                    onUninstall={onUninstallModel}
                    onRetry={onRetryModel}
                    onCancel={onCancelModel}
                    onSelect={onSelectModel}
                  />
                ))}
              </div>

              {!hasLocal && (
                <div className={styles.emptyHint}>
                  {t('modelManager.modal.noLocal')}
                </div>
              )}
            </section>
          )}

          {/* ── Cloud Catalog ──────────────────────────────── */}
          {enableCloudCatalog && effectiveSource !== 'local' && (
            <section className={styles.catalogSection}>
              <header className={styles.catalogHeader}>
                <div className={styles.catalogHeaderActions}>
                  <div>
                    <h3>{t('modelManager.modal.cloudModels')}</h3>
                    <p>{t('modelManager.modal.cloudDesc')}</p>
                  </div>
                  <div className={styles.cloudCatalogActions}>
                    {customProfilesSection && (
                      <button
                        type="button"
                        className={styles.addCustomButton}
                        onClick={() => setShowCustom((p) => !p)}
                      >
                        <Plus size={12} />
                        {showCustom ? t('modelManager.modal.hideCustom') : t('modelManager.modal.addCustom')}
                      </button>
                    )}
                  </div>
                </div>
              </header>

              {/* Custom Profiles */}
              {showCustom && customProfilesSection && (
                <div className={styles.customProfilesWrap}>
                  {customProfilesSection}
                </div>
              )}

              {/* Free Providers */}
              {freeProviderSection && (
                <div className={styles.freeProviderSectionWrap}>
                  <div className={styles.freeProviderSectionTitle}>
                    <Sparkles size={12} />
                    <span>Cloud Providers / BYOK</span>
                  </div>
                  {freeProviderSection}
                </div>
              )}

              {!freeProviderSection && (
                <div className={styles.emptyHint}>
                  {t('modelManager.modal.noCloud')}
                </div>
              )}
            </section>
          )}
        </div>

        {/* ═══ Footer ═══ */}
        {!hideFooter && (
          <footer className={styles.footer}>
            <DiskSpaceIndicator
              diskSpace={diskSpace}
              installedCount={installedCount}
              totalCount={totalCount}
              installedSizeBytes={installedSizeBytes}
            />

            <div className={styles.footerActions}>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => void onCheckUpdatesNow()}
                disabled={checkingRemoteUpdates}
              >
                {checkingRemoteUpdates ? t('modelManager.modal.checking') : t('modelManager.modal.checkUpdates')}
              </button>

              <button
                type="button"
                className={styles.warningButton}
                onClick={() => setShowConfirm(true)}
                disabled={batch.active}
              >
                {t('modelManager.modal.installAll')}
              </button>

              {batch.active && (
                <div className={styles.batchProgressWrap}>
                  <span className={styles.batchProgressText}>
                    {batch.completed}/{batch.total}
                  </span>
                  <div className={styles.batchProgressBar}>
                    <div
                      className={styles.batchProgressFill}
                      style={{
                        width: `${batch.total > 0 ? (batch.completed / batch.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => void onCancelAll()}
                  >
                    {t('modelManager.modal.cancel')}
                  </button>
                </div>
              )}
            </div>
          </footer>
        )}
      </div>

      {!hideFooter && (
        <InstallAllConfirmation
          open={showConfirm}
          totalBytes={scopedSummary.totalBytes}
          diskSpace={diskSpace}
          blockedReason={blockedReason}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            setShowConfirm(false);
            void onInstallAll(scopedSummary.eligibleModelIds);
          }}
        />
      )}
    </div>
  );
};

export default ModelManagerModal;
