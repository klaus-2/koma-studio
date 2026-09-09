import {
  Wand2,
  AlertTriangle,
  Layers,
  FolderOpen,
  Download,
  ExternalLink,
} from 'lucide-react';
import { AioSection } from '../../pages/AioSection';
import { EnhanceProfile, EnhanceScale } from '../../types/dashboard.types';
import { cn } from '../../utils/dashboard.utils';
import { useI18n } from '../../i18n';

import { desktopBridge } from "@/lib/desktop-bridge";
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
  setEnhanceModelId,
  setEnhanceModelManagerOpen,
  importSelectedEnhanceModel,
  installSelectedEnhanceModel,
  processEnhance,
  enhanceProfileLabels,
  enhanceOutputFormats,
}: EnhanceToolsPanelProps) {
  const { t } = useI18n();
  return (
    <div className="koma-mode-tools">
      <span className="koma-mode-tag" aria-hidden="true">
        <span className="koma-mode-tag__dot" />
        {t('dashboard.enhance.modeTag')}
      </span>

      {/* ═══ Config ═══ */}
      <AioSection icon={Wand2} title={t('dashboard.enhance.title')}>
        <div className="koma-info-note koma-info-note--info" aria-hidden="true">
          <Wand2 size={11} className="koma-info-note__icon" />
          <span>
            {isDesktopRuntime
              ? t('dashboard.enhance.localHint')
              : t('dashboard.enhance.desktopRequiredHint')}
          </span>
        </div>

        <div className="koma-dual-row">
          <div className="koma-field">
            <label className="koma-field__label">{t('dashboard.enhance.scale')}</label>
            <select
              value={enhanceScale}
              onChange={(e) =>
                setEnhanceScale(parseInt(e.target.value, 10) as EnhanceScale)
              }
              className="koma-select"
            >
              <option value={2}>{t('dashboard.enhance.scale.2x')}</option>
              <option value={4}>{t('dashboard.enhance.scale.4x')}</option>
            </select>
          </div>
          <div className="koma-field">
            <label className="koma-field__label">{t('dashboard.enhance.profile')}</label>
            <select
              value={enhanceProfile}
              onChange={(e) =>
                setEnhanceProfile(e.target.value as EnhanceProfile)
              }
              className="koma-select"
            >
              {Object.entries(enhanceProfileLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="koma-dual-row">
          <div className="koma-field">
            <label className="koma-field__label">{t('dashboard.enhance.model')}</label>
            <select
              value={selectedEnhanceModel?.id ?? ''}
              onChange={(e) => setEnhanceModelId(e.target.value)}
              className="koma-select"
              disabled={filteredEnhanceModels.length === 0}
            >
              {filteredEnhanceModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="koma-field">
            <label className="koma-field__label">{t('dashboard.enhance.format')}</label>
            <select
              value={enhanceOutputFormat}
              onChange={(e) =>
                setEnhanceOutputFormat(e.target.value as 'png' | 'webp')
              }
              className="koma-select"
            >
              {enhanceOutputFormats.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AioSection>

      {/* ═══ Model Status ═══ */}
      <AioSection icon={Layers} title={t('dashboard.enhance.status.title')} defaultOpen={true}>
        {selectedEnhanceModel ? (
          <div className="koma-enhance-model">
            <span className="koma-enhance-model__name">
              📦 {selectedEnhanceModel.name}
            </span>
            <span className="koma-enhance-model__desc">
              {selectedEnhanceModel.description}
            </span>
            <span
              className={cn(
                'koma-enhance-model__status',
                !isDesktopRuntime || !selectedEnhanceInstallState
                  ? 'koma-enhance-model__status--missing'
                  : selectedEnhanceInstallState.status === 'installed' ||
                      selectedEnhanceInstallState.status === 'update_available'
                    ? 'koma-enhance-model__status--ready'
                    : 'koma-enhance-model__status--missing',
              )}
            >
              {!isDesktopRuntime
                ? t('dashboard.enhance.status.desktopRequired')
                : !selectedEnhanceInstallState
                  ? t('dashboard.enhance.status.selectModel')
                  : selectedEnhanceInstallState.status === 'installed' ||
                      selectedEnhanceInstallState.status === 'update_available'
                    ? t('dashboard.enhance.status.ready')
                    : selectedEnhanceModel.installStrategy === 'manual_import'
                      ? t('dashboard.enhance.status.notImported')
                      : t('dashboard.enhance.status.notInstalled')}
            </span>

            {selectedEnhanceModel.installStrategy === 'manual_import' && (
              <div className="koma-info-note koma-info-note--warning">
                <AlertTriangle size={10} className="koma-info-note__icon" />
                <span>
                  {t('dashboard.enhance.importHint')}
                </span>
              </div>
            )}

            <div className="koma-enhance-model__actions">
              <button
                type="button"
                className="koma-btn koma-btn--ghost"
                disabled={!isDesktopRuntime}
                onClick={() => setEnhanceModelManagerOpen(true)}
              >
                <Layers size={11} /> {t('dashboard.enhance.action.manage')}
              </button>
              <button
                type="button"
                className="koma-btn koma-btn--ghost"
                disabled={
                  !isDesktopRuntime ||
                  !selectedEnhanceModel ||
                  enhanceActionBusy ||
                  (selectedEnhanceModel.installStrategy === 'manual_import'
                    ? false
                    : selectedEnhanceInstallState?.status === 'installed' ||
                      selectedEnhanceInstallState?.status ===
                        'update_available')
                }
                onClick={
                  selectedEnhanceModel.installStrategy === 'manual_import'
                    ? importSelectedEnhanceModel
                    : installSelectedEnhanceModel
                }
              >
                {enhanceActionBusy ? (
                  <>
                    <span
                      className="auth-spinner"
                      style={{ width: 11, height: 11 }}
                    />{' '}
                    …
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
                  className="koma-btn koma-btn--ghost"
                  onClick={() => {
                    if (desktopBridge.desktop?.openCommunityLink) {
                      void desktopBridge.desktop.openCommunityLink(
                        selectedEnhanceModel.docsUrl!,
                      );
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
          <p className="koma-tools-hint">{t('dashboard.enhance.selectAboveHint')}</p>
        )}
      </AioSection>

      {/* ═══ Execute ═══ */}
      <div className="koma-execute-bar">
        <button
          type="button"
          className={cn(
            'koma-execute-bar__btn',
            processing && 'koma-execute-bar__btn--processing',
          )}
          disabled={
            processing ||
            imagesCount === 0 ||
            !isDesktopRuntime ||
            !selectedEnhanceInstallState ||
            (selectedEnhanceInstallState.status !== 'installed' &&
              selectedEnhanceInstallState.status !== 'update_available')
          }
          onClick={processEnhance}
          aria-busy={processing}
        >
          {processing ? (
            <>
              <span
                className="auth-spinner"
                style={{ width: 13, height: 13 }}
                aria-hidden="true"
              />{' '}
              {t('dashboard.enhance.action.processing')}
            </>
          ) : (
            <>
              <Wand2 size={13} /> {t('dashboard.enhance.action.run')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
