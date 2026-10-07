import { motion } from 'framer-motion';
import {
  Wand2,
  AlertTriangle,
  Layers,
  FolderOpen,
  Download,
  ExternalLink,
  Cpu,
  Package,
} from 'lucide-react';
import { EnhanceProfile, EnhanceScale } from '../../../types/dashboard.types';
import { desktopBridge } from "@/lib/desktop-bridge";
import { useI18n } from '../../../i18n';
import {
  NoirSection,
  NoirField,
  NoirSelect,
  NoirNote,
  Stamp,
  Segmented,
  useNoirMotion,
} from '../../noir-panels/NoirPrimitives';

interface EnhanceModelLike {
  id: string;
  name: string;
  description: string;
  installStrategy?: string;
  docsUrl?: string;
}

interface InstallStateLike {
  status: string;
}

interface EnhanceToolsPanelProps {
  isDesktopRuntime: boolean;
  enhanceScale: number;
  setEnhanceScale: (value: 2 | 4) => void;
  enhanceProfile: string;
  setEnhanceProfile: (value: string) => void;
  enhanceOutputFormat: 'png' | 'webp';
  setEnhanceOutputFormat: (value: 'png' | 'webp') => void;
  selectedEnhanceModel: EnhanceModelLike | null;
  selectedEnhanceInstallState: InstallStateLike | null;
  filteredEnhanceModels: EnhanceModelLike[];
  enhanceActionBusy: boolean;
  processing: boolean;
  imagesCount: number;
  hasQuotaForCurrentBatch: boolean;
  quotaLimitButtonTitle: string;
  setEnhanceModelId: (value: string) => void;
  setEnhanceModelManagerOpen: (value: boolean) => void;
  importSelectedEnhanceModel: () => void;
  installSelectedEnhanceModel: () => void;
  processEnhance: () => void;
  enhanceProfileLabels: Record<string, string>;
  enhanceOutputFormats: Array<{ value: 'png' | 'webp'; label: string }>;
}

export default function EnhanceToolsPanel({
  isDesktopRuntime,
  enhanceScale,
  setEnhanceScale,
  enhanceProfile,
  setEnhanceProfile,
  enhanceOutputFormat,
  setEnhanceOutputFormat,
  selectedEnhanceModel,
  selectedEnhanceInstallState,
  filteredEnhanceModels,
  enhanceActionBusy,
  processing,
  imagesCount,
  hasQuotaForCurrentBatch,
  quotaLimitButtonTitle,
  setEnhanceModelId,
  setEnhanceModelManagerOpen,
  importSelectedEnhanceModel,
  installSelectedEnhanceModel,
  processEnhance,
  enhanceProfileLabels,
  enhanceOutputFormats,
}: EnhanceToolsPanelProps) {
  const { t } = useI18n();
  const m = useNoirMotion();

  const modelReady = Boolean(
    selectedEnhanceInstallState &&
      (selectedEnhanceInstallState.status === 'installed' ||
        selectedEnhanceInstallState.status === 'update_available'),
  );

  const statusLabel = !isDesktopRuntime
    ? t('dashboard.enhance.status.desktopRequired')
    : !selectedEnhanceInstallState
      ? t('dashboard.enhance.status.selectModel')
      : modelReady
        ? t('dashboard.enhance.status.ready')
        : selectedEnhanceModel?.installStrategy === 'manual_import'
          ? t('dashboard.enhance.status.notImported')
          : t('dashboard.enhance.status.notInstalled');

  return (
    <motion.div
      variants={m.container}
      initial={m.initial}
      animate={m.animate}
      className="relative flex flex-col gap-4"
    >
      {/* Katakana decorativo vertical */}
      <span
        aria-hidden
        className="v-text pointer-events-none absolute -right-1 top-16 select-none font-display text-4xl font-black tracking-[0.3em] text-paper/[0.05]"
      >
        エンハンス
      </span>

      {/* ── Mode header ── */}
      <motion.div variants={m.item} className="flex items-center justify-between gap-3">
        <Stamp tone="crimson" blink>
          {t('dashboard.enhance.modeTag')}
        </Stamp>
        <span
          aria-hidden
          className="font-mono text-[9px] uppercase tracking-[0.3em] text-paper/30"
        >
          AI·UPSCALE — 拡大
        </span>
      </motion.div>

      {/* ── 01 · Config ── */}
      <motion.div variants={m.item}>
        <NoirSection no="01" icon={Wand2} title={t('dashboard.enhance.title')}>
          <div className="flex flex-col gap-3.5">
            <NoirNote tone={isDesktopRuntime ? 'azure' : 'gold'} icon={Cpu}>
              {isDesktopRuntime
                ? t('dashboard.enhance.localHint')
                : t('dashboard.enhance.desktopRequiredHint')}
            </NoirNote>

            <NoirField as="div" label={t('dashboard.enhance.scale')}>
              <Segmented
                value={enhanceScale as 2 | 4}
                onChange={(v) => setEnhanceScale(v as EnhanceScale)}
                options={[
                  { value: 2, label: t('dashboard.enhance.scale.2x') },
                  { value: 4, label: t('dashboard.enhance.scale.4x') },
                ]}
              />
            </NoirField>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <NoirField label={t('dashboard.enhance.profile')}>
                <NoirSelect
                  value={enhanceProfile}
                  onChange={(e) => setEnhanceProfile(e.target.value as EnhanceProfile)}
                >
                  {Object.entries(enhanceProfileLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </NoirSelect>
              </NoirField>

              <NoirField as="div" label={t('dashboard.enhance.format')}>
                <Segmented
                  value={enhanceOutputFormat}
                  onChange={(v) => setEnhanceOutputFormat(v as 'png' | 'webp')}
                  options={enhanceOutputFormats.map((o) => ({ value: o.value, label: o.label }))}
                />
              </NoirField>
            </div>

            <NoirField label={t('dashboard.enhance.model')}>
              <NoirSelect
                value={selectedEnhanceModel?.id ?? ''}
                onChange={(e) => setEnhanceModelId(e.target.value)}
                disabled={filteredEnhanceModels.length === 0}
              >
                {filteredEnhanceModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </NoirSelect>
            </NoirField>
          </div>
        </NoirSection>
      </motion.div>

      {/* ── 02 · Model status ── */}
      <motion.div variants={m.item}>
        <NoirSection no="02" icon={Layers} title={t('dashboard.enhance.status.title')}>
          {selectedEnhanceModel ? (
            <div className="flex flex-col gap-3">
              <div className="halftone panel-cut-sm border border-paper/10 bg-ink/60 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-display text-[13px] font-extrabold uppercase tracking-wide text-paper">
                      <Package size={13} className="flex-none text-crimson" aria-hidden />
                      <span className="truncate">{selectedEnhanceModel.name}</span>
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-paper/50">
                      {selectedEnhanceModel.description}
                    </p>
                  </div>
                  <Stamp
                    tone={modelReady ? 'mint' : 'crimson'}
                    blink={!modelReady && isDesktopRuntime}
                  >
                    {statusLabel}
                  </Stamp>
                </div>
              </div>

              {selectedEnhanceModel.installStrategy === 'manual_import' && (
                <NoirNote tone="gold" icon={AlertTriangle}>
                  {t('dashboard.enhance.importHint')}
                </NoirNote>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!isDesktopRuntime}
                  onClick={() => setEnhanceModelManagerOpen(true)}
                >
                  <Layers size={11} /> {t('dashboard.enhance.action.manage')}
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  disabled={
                    !isDesktopRuntime ||
                    !selectedEnhanceModel ||
                    enhanceActionBusy ||
                    (selectedEnhanceModel.installStrategy === 'manual_import'
                      ? false
                      : selectedEnhanceInstallState?.status === 'installed' ||
                        selectedEnhanceInstallState?.status === 'update_available')
                  }
                  onClick={
                    selectedEnhanceModel.installStrategy === 'manual_import'
                      ? importSelectedEnhanceModel
                      : installSelectedEnhanceModel
                  }
                >
                  {enhanceActionBusy ? (
                    <>
                      <span className="noir-spinner" style={{ width: 11, height: 11 }} /> …
                    </>
                  ) : selectedEnhanceModel.installStrategy === 'manual_import' ? (
                    <>
                      <FolderOpen size={11} /> {t('dashboard.enhance.action.import')}
                    </>
                  ) : (
                    <>
                      <Download size={11} /> {t('dashboard.enhance.action.install')}
                    </>
                  )}
                </button>

                {selectedEnhanceModel.docsUrl && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      if (desktopBridge.desktop?.openCommunityLink) {
                        void desktopBridge.desktop?.openCommunityLink(selectedEnhanceModel.docsUrl!);
                        return;
                      }
                      window.open(
                        selectedEnhanceModel.docsUrl,
                        '_blank',
                        'noopener,noreferrer',
                      );
                    }}
                  >
                    <ExternalLink size={11} /> {t('dashboard.enhance.action.source')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-paper/40">
              {t('dashboard.enhance.selectAboveHint')}
            </p>
          )}
        </NoirSection>
      </motion.div>

      {/* ── Execute ── */}
      <motion.div variants={m.item}>
        <button
          type="button"
          className="btn-primary w-full py-3.5 text-[13px]"
          disabled={
            processing ||
            imagesCount === 0 ||
            !hasQuotaForCurrentBatch ||
            !isDesktopRuntime ||
            !selectedEnhanceInstallState ||
            (selectedEnhanceInstallState.status !== 'installed' &&
              selectedEnhanceInstallState.status !== 'update_available')
          }
          title={quotaLimitButtonTitle}
          onClick={processEnhance}
          aria-busy={processing}
        >
          {processing ? (
            <>
              <span className="noir-spinner" aria-hidden />{' '}
              {t('dashboard.enhance.action.processing')}
            </>
          ) : (
            <>
              <Wand2 size={14} /> {t('dashboard.enhance.action.run')}
              <span aria-hidden className="font-accent text-[15px] normal-case italic tracking-normal opacity-70">
                実行
              </span>
            </>
          )}
        </button>
        <p
          aria-hidden
          className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-paper/25"
        >
          {imagesCount} PG · ×{enhanceScale} · {enhanceOutputFormat.toUpperCase()}
        </p>
      </motion.div>
    </motion.div>
  );
}
