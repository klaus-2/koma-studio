import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Layers, X, CheckCircle2, AlertTriangle, Sparkles, Plus } from 'lucide-react';
import { useI18n } from '../../../i18n';

import {
  estimateModelRequiredDiskBytes,
  formatBytes,
} from '../../../models/model-storage';
import {
  listRegistryLanguages,
} from '../../../models/translation-models-registry';
import type {
  AioLocalModelStage,
  DiskSpaceInfo,
  ModelFilterState,
  ModelInstallState,
} from '../../../models/types';
import { DiskSpaceIndicator } from '../DiskSpaceIndicator';
import { InstallAllConfirmation } from '../InstallAllConfirmation';
import { ModelCard } from '../ModelCard';
import { ModelFilters } from '../ModelFilters';
import { buildScopedInstallSummary } from '../recommendedInstall';

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

const EASE = [0.22, 1, 0.36, 1] as const;

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

const CatalogHeader = ({ index, title, desc, children }: {
  index: string; title: ReactNode; desc: string; children?: ReactNode;
}) => (
  <header className="relative mb-4 flex items-end justify-between gap-3">
    <span aria-hidden className="text-outline pointer-events-none absolute -top-3 right-0 select-none font-display text-5xl font-black leading-none">
      {index}
    </span>
    <div>
      <h3 className="font-display text-base font-black uppercase tracking-tight text-paper">{title}</h3>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-paper/40">{desc}</p>
    </div>
    {children && <div className="relative z-10">{children}</div>}
  </header>
);

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

export const ModelManagerModalNoir = ({
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
    if (!enableCloudCatalog && sourceFilter !== 'local') setSourceFilter('local');
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

  const cardProps = {
    onInstall: onInstallModel,
    onUpdate: onUpdateModel,
    onUninstall: onUninstallModel,
    onRetry: onRetryModel,
    onCancel: onCancelModel,
    onSelect: onSelectModel,
  };

  const ghostBtn =
    'panel-cut-sm hard-hover border border-paper/20 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/70 hover:text-paper disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/85 p-3 backdrop-blur-md sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="mm-title"
            className="glass panel-cut halftone relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.45, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Decorações ── */}
            <span aria-hidden className="absolute left-0 top-0 z-10 h-[3px] w-full bg-gradient-to-r from-crimson via-crimson/50 to-transparent" />
            <span aria-hidden className="v-text pointer-events-none absolute bottom-6 right-2 z-0 select-none font-display text-xl font-black tracking-widest text-paper/[0.06]">
              モデル管理 — KOMA
            </span>

            {/* ═══ HEADER ═══ */}
            <header className="relative flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
              <div className="flex items-start gap-3.5">
                <motion.span
                  aria-hidden
                  initial={{ rotate: -8, scale: 0.8, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.15 }}
                  className="panel-cut-sm flex h-11 w-11 items-center justify-center border-2 border-crimson bg-crimson/10 text-crimson"
                >
                  <Layers size={18} strokeWidth={2.5} />
                </motion.span>

                <div>
                  <p className="kicker">// MODEL VAULT</p>
                  <h2 id="mm-title" className="font-display text-xl font-black uppercase leading-tight tracking-tight text-paper sm:text-2xl">
                    {t('modelManager.modal.title').split(' ').map((word, i, arr) =>
                      i === arr.length - 1
                        ? <em key={i} className="font-accent font-normal normal-case italic text-crimson"> {word}</em>
                        : <span key={i}>{word} </span>
                    )}
                  </h2>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-paper/40">
                    {selectionStageLabel ?? 'AIO'}
                    {lastRemoteCheckAt && (
                      <> <span aria-hidden className="text-crimson/60">/</span> {t('modelManager.modal.verified')}{' '}
                        {new Date(lastRemoteCheckAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </>
                    )}
                  </p>

                  {!hideHeaderMeta && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 border border-mint/40 bg-mint/10 px-2 py-0.5 font-mono text-[9px] tracking-wider text-mint">
                        <CheckCircle2 size={9} /> {installedCount}/{totalCount}
                      </span>
                      {updatesCount > 0 ? (
                        <span className="blink inline-flex items-center gap-1 border border-gold/50 bg-gold/10 px-2 py-0.5 font-mono text-[9px] tracking-wider text-gold">
                          <AlertTriangle size={9} /> {t('toolbar.modelSelect.updates_other', { count: updatesCount })}
                        </span>
                      ) : (
                        <span className="border border-paper/15 px-2 py-0.5 font-mono text-[9px] tracking-wider text-paper/40">
                          {t('modelManager.modal.upToDate')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button type="button" onClick={onClose} aria-label={t('modelManager.modal.closeAria')}
                className="panel-cut-sm hard-hover mr-3 border border-paper/15 p-2 text-paper/50 hover:border-crimson/50 hover:text-crimson focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson">
                <X size={15} />
              </button>
            </header>

            {/* ═══ FILTERS ═══ */}
            <ModelFilters
              filters={{ source: effectiveSource, language: languageFilter, status: statusFilter }}
              languages={languageOptions}
              allowCloud={enableCloudCatalog}
              hideSourceToggle={hideSourceToggle}
              hideLanguageFilter={hideLanguageFilter}
              hideStatusFilter={hideStatusFilter}
              onSourceChange={setSourceFilter}
              onLanguageChange={onSetLanguageFilter}
              onStatusChange={setStatusFilter}
            />

            {/* ═══ BODY ═══ */}
            <div className="relative flex-1 space-y-8 overflow-y-auto px-5 py-5 sm:px-6">
              {/* ── LOCAL ── */}
              {effectiveSource !== 'cloud' && (
                <section>
                  <CatalogHeader index="01"
                    title={<>{t('modelManager.modal.localModels')}</>}
                    desc={t('modelManager.modal.localDesc')} />

                  <motion.div variants={stagger} initial="hidden" animate="show"
                    className="grid gap-3 md:grid-cols-2">
                    {filteredLocal.map((entry) => (
                      <ModelCard key={entry.model.id} entry={entry}
                        focused={focusedModelId === entry.model.id || selectedModelId === entry.model.id}
                        selected={selectedModelId === entry.model.id}
                        selectable={entry.model.stage === selectionStage}
                        {...cardProps} />
                    ))}
                  </motion.div>

                  {!hasLocal && (
                    <div className="panel-cut-sm border border-dashed border-paper/15 p-8 text-center font-mono text-[11px] uppercase tracking-wider text-paper/35">
                      {t('modelManager.modal.noLocal')}
                    </div>
                  )}
                </section>
              )}

              {/* ── CLOUD ── */}
              {enableCloudCatalog && effectiveSource !== 'local' && (
                <section>
                  <CatalogHeader index="02"
                    title={<>{t('modelManager.modal.cloudModels')}</>}
                    desc={t('modelManager.modal.cloudDesc')}>
                    {customProfilesSection && (
                      <button type="button" onClick={() => setShowCustom((p) => !p)}
                        className="panel-cut-sm hard-hover inline-flex items-center gap-1.5 border border-azure/40 bg-azure/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-azure">
                        <Plus size={11} />
                        {showCustom ? t('modelManager.modal.hideCustom') : t('modelManager.modal.addCustom')}
                      </button>
                    )}
                  </CatalogHeader>

                  <AnimatePresence>
                    {showCustom && customProfilesSection && (
                      <motion.div
                        initial={{ opacity: 0, scaleY: 0.96 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.96 }}
                        transition={{ duration: 0.35, ease: EASE }}
                        style={{ transformOrigin: 'top' }}
                        className="mb-4 overflow-hidden">
                        {customProfilesSection}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {freeProviderSection && (
                    <div className="mb-5">
                      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-mint">
                        <Sparkles size={11} />
                        <span>Cloud Providers / BYOK</span>
                        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-mint/25 to-transparent" />
                      </div>
                      {freeProviderSection}
                    </div>
                  )}

                  {!freeProviderSection && (
                    <div className="panel-cut-sm border border-dashed border-paper/15 p-8 text-center font-mono text-[11px] uppercase tracking-wider text-paper/35">
                      {t('modelManager.modal.noCloud')}
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* ═══ FOOTER ═══ */}
            {!hideFooter && (
              <footer className="relative flex flex-wrap items-center gap-4 border-t border-paper/10 bg-ink/70 px-5 py-4 sm:px-6">
                <DiskSpaceIndicator diskSpace={diskSpace} installedCount={installedCount}
                  totalCount={totalCount} installedSizeBytes={installedSizeBytes} />

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={ghostBtn}
                    onClick={() => void onCheckUpdatesNow()} disabled={checkingRemoteUpdates}>
                    {checkingRemoteUpdates
                      ? <span className="blink">{t('modelManager.modal.checking')}</span>
                      : t('modelManager.modal.checkUpdates')}
                  </button>

                  <button
                    type="button"
                    disabled={batch.active || scopedSummary.eligibleModelIds.length === 0}
                    onClick={() => setShowConfirm(true)}
                    className="panel-cut-sm hard-hover bg-crimson px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink disabled:cursor-not-allowed disabled:opacity-40">
                    {t('modelManager.modal.installAll')}
                  </button>

                  {batch.active && (
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[10px] font-bold text-crimson">
                        {batch.completed}<span className="text-paper/40">/{batch.total}</span>
                      </span>
                      <div className="panel-cut-sm h-1.5 w-24 overflow-hidden border border-paper/10 bg-ink" aria-hidden>
                        <motion.div
                          className="stripes-anim h-full w-full origin-left bg-crimson bg-[repeating-linear-gradient(-45deg,rgba(7,7,12,0.3)_0_6px,transparent_6px_12px)] bg-[length:17px_17px]"
                          animate={{
                            scaleX:
                              batch.total > 0
                                ? Math.max(0, Math.min(1, batch.completed / batch.total))
                                : 0,
                          }}
                          transition={{ type: 'spring', stiffness: 90, damping: 22 }} />
                      </div>
                      <button type="button" className={ghostBtn} onClick={() => void onCancelAll()}>
                        {t('modelManager.modal.cancel')}
                      </button>
                    </div>
                  )}
                </div>
              </footer>
            )}
          </motion.div>

          {!hideFooter && (
            <InstallAllConfirmation
              open={showConfirm}
              totalBytes={scopedSummary.totalBytes}
              diskSpace={diskSpace}
              blockedReason={blockedReason}
              onCancel={() => setShowConfirm(false)}
              onConfirm={() => { setShowConfirm(false); void onInstallAll(scopedSummary.eligibleModelIds); }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModelManagerModalNoir;
