import React, { MouseEvent, useState } from 'react';
import { AlertTriangle, Bug, Cpu, Globe, Rocket, Zap } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";
import type { DesktopMiniBackendRuntimeState } from '../../types';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/messages';
import type { RuntimeExecutionNotice, StatusMessageTone } from '../../types/dashboard.types';
import type { AioDeviceInfo } from '../../models/aioStageCatalog';

interface DashboardFooterProps {
  statusMessage: string;
  statusMessageTone?: StatusMessageTone;
  processingLabel?: string | null;
  workspaceStatus: 'idle' | 'saving' | 'saved' | 'error';
  workspaceStatusDetail: string;
  workspaceLastSavedAt: number | null;
  miniBackendRuntimeState?: DesktopMiniBackendRuntimeState | null;
  aioDeviceInfo?: AioDeviceInfo | null;
  processing: boolean;
  progress: number;
  openBugReportModal: (event: MouseEvent<HTMLElement>) => void;
  openProjectExternalLink: (
    event: MouseEvent<HTMLElement>,
    url: string
  ) => void | Promise<void>;
  projectDiscordUrl: string;
  projectWebsiteUrl: string;
  runtimeExecutionNotice?: RuntimeExecutionNotice | null;
}

const DashboardFooter: React.FC<DashboardFooterProps> = ({
  statusMessage,
  statusMessageTone = 'info',
  processingLabel,
  workspaceStatus,
  workspaceStatusDetail,
  workspaceLastSavedAt,
  miniBackendRuntimeState,
  aioDeviceInfo,
  processing,
  progress,
  openBugReportModal,
  openProjectExternalLink,
  projectDiscordUrl,
  projectWebsiteUrl,
  runtimeExecutionNotice,
}) => {
  const { t } = useI18n();
  const [runtimeTooltipOpen, setRuntimeTooltipOpen] = useState(false);
  const normalizeMessage = (message?: string | null) => {
    if (!message) return message ?? '';
    if (message.includes('.')) {
      const translated = t(message as TranslationKey);
      if (translated !== message) {
        return translated;
      }
    }
    return message;
  };
  const footerMessage = processing && processingLabel ? processingLabel : normalizeMessage(statusMessage);
  const lastSavedLabel = workspaceLastSavedAt
    ? new Date(workspaceLastSavedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : t('dashboard.footer.lastSave.never');

  const runtimeSourceLabel = (source: DesktopMiniBackendRuntimeState['source']) =>
    source === 'downloaded-runtime'
      ? t('dashboard.footer.runtime.downloaded')
      : t('dashboard.footer.runtime.embedded');

  const gpuInfoLabel = (() => {
    const runtimeGpuName = miniBackendRuntimeState?.gpuName;
    const runtimeVramGb = miniBackendRuntimeState?.vramGb;
    const activeProfile = miniBackendRuntimeState?.activeProfile;
    const fallbackGpuName = aioDeviceInfo?.name;
    const fallbackVramGb = aioDeviceInfo?.vram_gb;
    const gpuName = runtimeGpuName ?? fallbackGpuName;
    const vramGb = runtimeVramGb ?? fallbackVramGb;

    if (!gpuName && !activeProfile) return null;
    if (gpuName) {
      return vramGb ? `${gpuName} (${vramGb} GB VRAM)` : gpuName;
    }
    if (activeProfile && activeProfile !== 'cpu') {
      const profileNames: Record<string, string> = {
        'nvidia-cuda': 'NVIDIA CUDA',
        'nvidia-cuda-legacy': 'NVIDIA CUDA Legacy',
        'nvidia-tensorrt': 'NVIDIA TensorRT',
        'amd-rocm': 'AMD ROCm',
        'intel-openvino': 'Intel OpenVINO',
        'apple-mps': 'Apple Silicon GPU',
      };
      return profileNames[activeProfile] ?? activeProfile;
    }
    return 'CPU';
  })();

  const formatProfileLabel = (profile: string) => {
    switch (profile) {
      case 'nvidia-cuda':
        return 'CUDA';
      case 'nvidia-cuda-legacy':
        return 'CUDA Legacy';
      case 'nvidia-tensorrt':
        return 'TensorRT';
      case 'intel-openvino':
        return 'OpenVINO';
      case 'cpu':
      default:
        return 'CPU';
    }
  };

  const formatRuntimeBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const runtimeBadge = (() => {
    if (!miniBackendRuntimeState) {
      return null;
    }

    if (
      miniBackendRuntimeState.status === 'resolving' ||
      miniBackendRuntimeState.status === 'checking' ||
      miniBackendRuntimeState.status === 'downloading' ||
      miniBackendRuntimeState.status === 'verifying' ||
      miniBackendRuntimeState.status === 'extracting'
    ) {
      const progressLabel =
        miniBackendRuntimeState.status === 'downloading' && miniBackendRuntimeState.progress
          ? ` ${Math.round(miniBackendRuntimeState.progress.percent)}%`
          : '';
      const warmupWithoutBytes =
        (miniBackendRuntimeState.status === 'resolving' ||
          miniBackendRuntimeState.status === 'checking') &&
        !miniBackendRuntimeState.progress;
      return {
        label: `Runtime${progressLabel}`,
        tone: 'progress' as const,
        title: 'Preparing local runtime',
        detail: warmupWithoutBytes
          ? 'Starting local runtime — the first start may take a few minutes.'
          : normalizeMessage(miniBackendRuntimeState.statusMessage) ?? 'Preparing local runtime.',
        icon: Rocket,
      };
    }

    const hasFallback =
      miniBackendRuntimeState.status === 'fallback' ||
      miniBackendRuntimeState.requestedProfile !== miniBackendRuntimeState.activeProfile;

    if (miniBackendRuntimeState.status === 'error') {
      return {
        label: 'Runtime error',
        tone: 'error' as const,
        title: 'Runtime startup failed',
        detail:
          normalizeMessage(miniBackendRuntimeState.statusMessage) ??
          miniBackendRuntimeState.lastError ??
          'The local runtime failed to start.',
        icon: AlertTriangle,
      };
    }

    if (hasFallback) {
      return {
        label: t('dashboard.footer.runtime.fallback.label'),
        tone: 'fallback' as const,
        title: t('dashboard.footer.runtime.fallback.title'),
        detail: t('dashboard.footer.runtime.fallback.detail', {
          requested: formatProfileLabel(miniBackendRuntimeState.requestedProfile),
          active: formatProfileLabel(miniBackendRuntimeState.activeProfile),
        }),
        icon: AlertTriangle,
      };
    }

    switch (miniBackendRuntimeState.activeProfile) {
      case 'nvidia-tensorrt':
        return {
          label: 'TensorRT',
          tone: 'tensorrt' as const,
          title: t('dashboard.footer.runtime.tensorrt.title'),
          detail: t('dashboard.footer.runtime.tensorrt.detail'),
          icon: Rocket,
        };
      case 'nvidia-cuda':
        return {
          label: 'CUDA',
          tone: 'cuda' as const,
          title: t('dashboard.footer.runtime.cuda.title'),
          detail: t('dashboard.footer.runtime.cuda.detail'),
          icon: Zap,
        };
      case 'nvidia-cuda-legacy':
        return {
          label: t('dashboard.footer.runtime.legacy.label'),
          tone: 'legacy' as const,
          title: t('dashboard.footer.runtime.legacy.title'),
          detail: t('dashboard.footer.runtime.legacy.detail'),
          icon: Cpu,
        };
      case 'intel-openvino':
        return {
          label: 'OpenVINO',
          tone: 'openvino' as const,
          title: t('dashboard.footer.runtime.openvino.title'),
          detail: t('dashboard.footer.runtime.openvino.detail'),
          icon: Cpu,
        };
      case 'cpu':
      default:
        return {
          label: 'CPU',
          tone: 'cpu' as const,
          title: t('dashboard.footer.runtime.cpu.title'),
          detail: t('dashboard.footer.runtime.cpu.detail'),
          icon: Cpu,
        };
    }
  })();

  // While a runtime notice is up the tooltip is forced open; once it clears,
  // reset the user-controlled open state during render so the tooltip closes
  // with the notice (no post-commit flash of stale state).
  const [prevNotice, setPrevNotice] = useState(runtimeExecutionNotice);
  if (prevNotice !== runtimeExecutionNotice) {
    setPrevNotice(runtimeExecutionNotice);
    if (!runtimeExecutionNotice) setRuntimeTooltipOpen(false);
  }
  const tooltipOpen = runtimeExecutionNotice
    ? true
    : runtimeTooltipOpen;

  const handleRuntimeTooltipOpenChange = (nextOpen: boolean) => {
    if (runtimeExecutionNotice) {
      return;
    }
    setRuntimeTooltipOpen(nextOpen);
  };

  return (
    <footer className="koma-footerbar">
      <span
        className={`koma-footerbar__msg ${processing && processingLabel ? 'koma-footerbar__msg--processing' : `koma-footerbar__msg--${statusMessageTone}`}`}
        role={statusMessageTone === 'error' ? 'alert' : 'status'}
      >
        {footerMessage}
      </span>
      <div className="koma-footerbar__right">
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`koma-footerbar__workspace koma-footerbar__workspace--${workspaceStatus}`}
                role="status"
                aria-live="polite"
              >
                <span className="koma-footerbar__workspaceDot" aria-hidden="true" />
                <span className="koma-footerbar__workspaceLabel">
                  {workspaceStatus === 'saving'
                    ? t('dashboard.footer.workspace.saving')
                    : workspaceStatus === 'saved'
                      ? t('dashboard.footer.workspace.saved')
                      : workspaceStatus === 'error'
                        ? t('dashboard.footer.workspace.error')
                        : t('dashboard.footer.workspace.pending')}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              className="koma-footerbar__tooltip"
            >
              <div className="koma-footerbar__tooltipTitle">
                {t('dashboard.footer.workspace.title')}
              </div>
              <p>{workspaceStatusDetail}</p>
              <p>{t('dashboard.footer.lastSave.label', { time: lastSavedLabel })}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {runtimeBadge && (
          <TooltipProvider delayDuration={120}>
            <Tooltip
              open={tooltipOpen}
              onOpenChange={handleRuntimeTooltipOpenChange}
            >
              <TooltipTrigger asChild>
                <div
                  className={`koma-footerbar__workspace koma-footerbar__runtime koma-footerbar__runtime--${runtimeExecutionNotice?.tone ?? runtimeBadge.tone}`}
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="koma-footerbar__runtimeIcon"
                    aria-hidden="true"
                  >
                    <runtimeBadge.icon size={12} />
                  </span>
                  <span className="koma-footerbar__workspaceLabel">
                    {runtimeBadge.label}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                sideOffset={4}
                className="koma-footerbar__tooltip"
              >
                <div className="koma-footerbar__tooltipTitle">{runtimeBadge.title}</div>
                {runtimeExecutionNotice ? (
                  <>
                    <p style={{ fontWeight: 700 }}>{runtimeExecutionNotice.title}</p>
                    <p>{runtimeExecutionNotice.detail}</p>
                    <div className="koma-footerbar__tooltipDivider" />
                  </>
                ) : null}
                {gpuInfoLabel && <p style={{ fontWeight: 500 }}>{gpuInfoLabel}</p>}
                <p>{runtimeBadge.detail}</p>
                {miniBackendRuntimeState ? (
                  <p>{t('dashboard.footer.runtime.source', { value: runtimeSourceLabel(miniBackendRuntimeState.source) })}</p>
                ) : null}
                {miniBackendRuntimeState?.runtimeArchiveUrl && (
                  <p>{t('dashboard.footer.runtime.remoteAvailable')}</p>
                )}
                {miniBackendRuntimeState?.lastError && (
                  <p>{t('dashboard.footer.runtime.errorReason', { value: miniBackendRuntimeState.lastError })}</p>
                )}
                {miniBackendRuntimeState?.progress && (
                  <p>
                    {`${Math.round(miniBackendRuntimeState.progress.percent)}% · ${formatRuntimeBytes(miniBackendRuntimeState.progress.transferredBytes)} / ${formatRuntimeBytes(miniBackendRuntimeState.progress.totalBytes)}`}
                  </p>
                )}
                {miniBackendRuntimeState && miniBackendRuntimeState.maxAttempts > 1 && miniBackendRuntimeState.attempt > 0 && (
                  <p>{`Attempt ${miniBackendRuntimeState.attempt}/${miniBackendRuntimeState.maxAttempts}`}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {processing && (
          <div className="koma-footerbar__progress">
            <div
              className="koma-footerbar__progressBar"
              style={{ width: `${Math.round(progress)}%` }}
            />
            <span className="koma-footerbar__meta">{Math.round(progress)}%</span>
          </div>
        )}
        <TooltipProvider delayDuration={120}>
          <div className="koma-footerbar__actions" aria-label={t('dashboard.footer.quickLinks')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="koma-footerbar__link koma-footerbar__action koma-footerbar__action--bug koma-iconbtn koma-iconbtn--xs"
                  onClick={openBugReportModal}
                  aria-label={t('dashboard.footer.bugReport.title')}
                >
                  <Bug size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="koma-footerbar__tooltip"
              >
                <div className="koma-footerbar__tooltipTitle">{t('dashboard.footer.bugReport.title')}</div>
                <p>{t('dashboard.footer.bugReport.desc')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="koma-footerbar__link koma-footerbar__action koma-footerbar__action--discord koma-iconbtn koma-iconbtn--xs"
                  onClick={(event) =>
                    void openProjectExternalLink(event, projectDiscordUrl)
                  }
                  aria-label={t('dashboard.footer.discord.aria')}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="koma-footerbar__tooltip"
              >
                <div className="koma-footerbar__tooltipTitle">
                  {t('dashboard.footer.discord.title')}
                </div>
                <p>{t('dashboard.footer.discord.desc')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="koma-footerbar__link koma-footerbar__action koma-footerbar__action--website koma-iconbtn koma-iconbtn--xs"
                  onClick={(event) =>
                    void openProjectExternalLink(event, projectWebsiteUrl)
                  }
                  aria-label={t('dashboard.footer.website.aria')}
                >
                  <Globe size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="koma-footerbar__tooltip"
              >
                <div className="koma-footerbar__tooltipTitle">
                  {t('dashboard.footer.website.title')}
                </div>
                <p>{t('dashboard.footer.website.desc')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </footer>
  );
};

export default DashboardFooter;
