import React, { MouseEvent, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Bug, Cpu, Globe, Rocket, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@koma/ui/components/tooltip';
import type { DesktopMiniBackendRuntimeState } from '../../../types';
import { useI18n } from '../../../i18n';
import type { TranslationKey } from '../../../i18n/messages';
import type { RuntimeExecutionNotice, StatusMessageTone } from '../../../types/dashboard.types';
import type { AioDeviceInfo } from '../../../models/aioStageCatalog';
import { cn } from '../../../utils/dashboard.utils';

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
  openProjectExternalLink: (event: MouseEvent<HTMLElement>, url: string) => void | Promise<void>;
  projectDiscordUrl: string;
  projectWebsiteUrl: string;
  runtimeExecutionNotice?: RuntimeExecutionNotice | null;
}

const TONE_TEXT: Record<string, string> = {
  info: 'text-paper', success: 'text-mint', error: 'text-crimson',
  warning: 'text-gold', progress: 'text-azure',
};
const WS_TONE: Record<string, string> = {
  idle: 'text-paper-dim border-paper/20', saving: 'text-azure border-azure/40',
  saved: 'text-mint border-mint/40', error: 'text-crimson border-crimson/40',
};
const RT_TONE: Record<string, string> = {
  tensorrt: 'text-crimson border-crimson/40', cuda: 'text-mint border-mint/40',
  legacy: 'text-gold border-gold/40', openvino: 'text-azure border-azure/40',
  cpu: 'text-paper-dim border-paper/20', fallback: 'text-gold border-gold/40',
  error: 'text-crimson border-crimson/40', progress: 'text-azure border-azure/40',
};

const DashboardFooterNoir: React.FC<DashboardFooterProps> = ({
  statusMessage, statusMessageTone = 'info', processingLabel, workspaceStatus,
  workspaceStatusDetail, workspaceLastSavedAt, miniBackendRuntimeState, aioDeviceInfo,
  processing, progress, openBugReportModal, openProjectExternalLink,
  projectDiscordUrl, projectWebsiteUrl, runtimeExecutionNotice,
}) => {
  const { t } = useI18n();
  const [runtimeTooltipOpen, setRuntimeTooltipOpen] = useState(false);

  const normalizeMessage = (message?: string | null) => {
    if (!message) return message ?? '';
    if (message.includes('.')) {
      const translated = t(message as TranslationKey);
      if (translated !== message) return translated;
    }
    return message;
  };

  const footerMessage = processing && processingLabel ? processingLabel : normalizeMessage(statusMessage);
  const lastSavedLabel = workspaceLastSavedAt
    ? new Date(workspaceLastSavedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : t('dashboard.footer.lastSave.never');

  const runtimeSourceLabel = (source: DesktopMiniBackendRuntimeState['source']) =>
    source === 'downloaded-runtime' ? t('dashboard.footer.runtime.downloaded') : t('dashboard.footer.runtime.embedded');

  const gpuInfoLabel = (() => {
    const gpuName = miniBackendRuntimeState?.gpuName ?? aioDeviceInfo?.name;
    const vramGb = miniBackendRuntimeState?.vramGb ?? aioDeviceInfo?.vram_gb;
    const activeProfile = miniBackendRuntimeState?.activeProfile;
    if (!gpuName && !activeProfile) return null;
    if (gpuName) return vramGb ? `${gpuName} (${vramGb} GB VRAM)` : gpuName;
    if (activeProfile && activeProfile !== 'cpu') {
      const names: Record<string, string> = {
        'nvidia-cuda': 'NVIDIA CUDA', 'nvidia-cuda-legacy': 'NVIDIA CUDA Legacy',
        'nvidia-tensorrt': 'NVIDIA TensorRT', 'amd-rocm': 'AMD ROCm',
        'intel-openvino': 'Intel OpenVINO', 'apple-mps': 'Apple Silicon GPU',
      };
      return names[activeProfile] ?? activeProfile;
    }
    return 'CPU';
  })();

  const formatProfileLabel = (p: string) => ({
    'nvidia-cuda': 'CUDA', 'nvidia-cuda-legacy': 'CUDA Legacy', 'nvidia-tensorrt': 'TensorRT',
    'intel-openvino': 'OpenVINO', cpu: 'CPU',
  }[p] ?? 'CPU');

  const formatRuntimeBytes = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value, i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i += 1; }
    return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const runtimeBadge = (() => {
    if (!miniBackendRuntimeState) return null;
    const s = miniBackendRuntimeState.status;
    if (['resolving', 'checking', 'downloading', 'verifying', 'extracting'].includes(s)) {
      const progressLabel = s === 'downloading' && miniBackendRuntimeState.progress
        ? ` ${Math.round(miniBackendRuntimeState.progress.percent)}%` : '';
      return {
        label: `Runtime${progressLabel}`, tone: 'progress' as const, title: 'Preparing local runtime',
        detail: normalizeMessage(miniBackendRuntimeState.statusMessage) ?? 'Preparing local runtime.', icon: Rocket
      };
    }
    const hasFallback = s === 'fallback' || miniBackendRuntimeState.requestedProfile !== miniBackendRuntimeState.activeProfile;
    if (s === 'error') {
      return {
        label: 'Runtime error', tone: 'error' as const, title: 'Runtime startup failed',
        detail: normalizeMessage(miniBackendRuntimeState.statusMessage) ?? miniBackendRuntimeState.lastError ?? 'The local runtime failed to start.', icon: AlertTriangle
      };
    }
    if (hasFallback) {
      return {
        label: t('dashboard.footer.runtime.fallback.label'), tone: 'fallback' as const,
        title: t('dashboard.footer.runtime.fallback.title'),
        detail: t('dashboard.footer.runtime.fallback.detail', {
          requested: formatProfileLabel(miniBackendRuntimeState.requestedProfile),
          active: formatProfileLabel(miniBackendRuntimeState.activeProfile),
        }), icon: AlertTriangle
      };
    }
    switch (miniBackendRuntimeState.activeProfile) {
      case 'nvidia-tensorrt': return { label: 'TensorRT', tone: 'tensorrt' as const, title: t('dashboard.footer.runtime.tensorrt.title'), detail: t('dashboard.footer.runtime.tensorrt.detail'), icon: Rocket };
      case 'nvidia-cuda': return { label: 'CUDA', tone: 'cuda' as const, title: t('dashboard.footer.runtime.cuda.title'), detail: t('dashboard.footer.runtime.cuda.detail'), icon: Zap };
      case 'nvidia-cuda-legacy': return { label: t('dashboard.footer.runtime.legacy.label'), tone: 'legacy' as const, title: t('dashboard.footer.runtime.legacy.title'), detail: t('dashboard.footer.runtime.legacy.detail'), icon: Cpu };
      case 'intel-openvino': return { label: 'OpenVINO', tone: 'openvino' as const, title: t('dashboard.footer.runtime.openvino.title'), detail: t('dashboard.footer.runtime.openvino.detail'), icon: Cpu };
      default: return { label: 'CPU', tone: 'cpu' as const, title: t('dashboard.footer.runtime.cpu.title'), detail: t('dashboard.footer.runtime.cpu.detail'), icon: Cpu };
    }
  })();

  useEffect(() => { setRuntimeTooltipOpen(!!runtimeExecutionNotice); }, [runtimeExecutionNotice]);
  const handleRuntimeTooltipOpenChange = (next: boolean) => setRuntimeTooltipOpen(runtimeExecutionNotice ? true : next);

  return (
    <footer className="relative flex h-9 shrink-0 items-center gap-3 border-t-2 border-crimson/25 bg-ink-2/90 px-3 backdrop-blur-xl">
      <div className="halftone pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />

      <div className="relative flex min-w-0 flex-1 items-center gap-2">
        <span className={cn('h-1.5 w-1.5 shrink-0', processing ? 'bg-azure blink-noir' : statusMessageTone === 'error' ? 'bg-crimson blink-noir' : 'bg-mint')} aria-hidden="true" />
        <span
          role={statusMessageTone === 'error' ? 'alert' : 'status'}
          className={cn('truncate font-mono text-[11px]', processing && processingLabel ? 'text-azure' : TONE_TEXT[statusMessageTone] ?? 'text-paper')}
        >
          {footerMessage}
        </span>
      </div>

      <div className="relative flex shrink-0 items-center gap-2">
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div role="status" aria-live="polite"
                className={cn('panel-cut-sm flex items-center gap-1.5 border bg-ink-3/60 px-2 py-1', WS_TONE[workspaceStatus])}>
                <span className={cn('h-1.5 w-1.5', workspaceStatus === 'saving' && 'blink-noir', {
                  idle: 'bg-paper-dim', saving: 'bg-azure', saved: 'bg-mint', error: 'bg-crimson',
                }[workspaceStatus])} aria-hidden="true" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">
                  {workspaceStatus === 'saving' ? t('dashboard.footer.workspace.saving')
                    : workspaceStatus === 'saved' ? t('dashboard.footer.workspace.saved')
                      : workspaceStatus === 'error' ? t('dashboard.footer.workspace.error')
                        : t('dashboard.footer.workspace.pending')}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="glass panel-cut-sm border-crimson/30 max-w-xs">
              <div className="kicker mb-1">{t('dashboard.footer.workspace.title')}</div>
              <p className="font-mono text-[11px] text-paper-dim">{workspaceStatusDetail}</p>
              <p className="font-mono text-[11px] text-paper-dim">{t('dashboard.footer.lastSave.label', { time: lastSavedLabel })}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {runtimeBadge && (
          <TooltipProvider delayDuration={120}>
            <Tooltip open={runtimeTooltipOpen} onOpenChange={handleRuntimeTooltipOpenChange}>
              <TooltipTrigger asChild>
                <div role="status" aria-live="polite"
                  className={cn('panel-cut-sm flex items-center gap-1.5 border bg-ink-3/60 px-2 py-1', RT_TONE[runtimeExecutionNotice?.tone ?? runtimeBadge.tone])}>
                  <runtimeBadge.icon size={11} aria-hidden="true" />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">{runtimeBadge.label}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" sideOffset={4} className="glass panel-cut-sm border-crimson/30 max-w-xs">
                <div className="kicker mb-1">{runtimeBadge.title}</div>
                {runtimeExecutionNotice && (
                  <>
                    <p className="font-mono text-[11px] font-bold text-paper">{runtimeExecutionNotice.title}</p>
                    <p className="font-mono text-[11px] text-paper-dim">{runtimeExecutionNotice.detail}</p>
                    <div className="my-1 border-t border-paper/10" />
                  </>
                )}
                {gpuInfoLabel && <p className="font-mono text-[11px] font-medium text-azure">{gpuInfoLabel}</p>}
                <p className="font-mono text-[11px] text-paper-dim">{runtimeBadge.detail}</p>
                {miniBackendRuntimeState && <p className="font-mono text-[10px] text-paper-dim">{t('dashboard.footer.runtime.source', { value: runtimeSourceLabel(miniBackendRuntimeState.source) })}</p>}
                {miniBackendRuntimeState?.runtimeArchiveUrl && <p className="font-mono text-[10px] text-paper-dim">{t('dashboard.footer.runtime.remoteAvailable')}</p>}
                {miniBackendRuntimeState?.lastError && <p className="font-mono text-[10px] text-crimson">{t('dashboard.footer.runtime.errorReason', { value: miniBackendRuntimeState.lastError })}</p>}
                {miniBackendRuntimeState?.progress && (
                  <p className="font-mono text-[10px] text-azure">
                    {`${Math.round(miniBackendRuntimeState.progress.percent)}% · ${formatRuntimeBytes(miniBackendRuntimeState.progress.transferredBytes)} / ${formatRuntimeBytes(miniBackendRuntimeState.progress.totalBytes)}`}
                  </p>
                )}
                {miniBackendRuntimeState && miniBackendRuntimeState.maxAttempts > 1 && miniBackendRuntimeState.attempt > 0 && (
                  <p className="font-mono text-[10px] text-paper-dim">{`Attempt ${miniBackendRuntimeState.attempt}/${miniBackendRuntimeState.maxAttempts}`}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {processing && (
          <div className="panel-cut-sm relative flex h-4 w-28 items-center overflow-hidden bg-ink-3">
            <motion.div
              className="halftone-red absolute inset-y-0 left-0 bg-crimson"
              initial={false}
              animate={{ width: `${Math.round(progress)}%` }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
            <span className="relative z-10 w-full text-center font-mono text-[9px] font-bold text-paper mix-blend-difference">{Math.round(progress)}%</span>
          </div>
        )}
        <span aria-hidden className="mx-0.5 select-none font-mono text-[10px] text-paper-faint">/</span>
        <TooltipProvider delayDuration={120}>
          <div className="flex items-center gap-1" aria-label={t('dashboard.footer.quickLinks')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <FooterAction onClick={openBugReportModal} aria-label={t('dashboard.footer.bugReport.title')} hoverColor="hover:bg-gold">
                  <Bug size={13} />
                </FooterAction>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="glass panel-cut-sm border-gold/30">
                <div className="kicker !text-gold mb-1">{t('dashboard.footer.bugReport.title')}</div>
                <p className="font-mono text-[11px] text-paper-dim">{t('dashboard.footer.bugReport.desc')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <FooterAction onClick={(e) => void openProjectExternalLink(e, projectDiscordUrl)} aria-label={t('dashboard.footer.discord.aria')} hoverColor="hover:bg-azure">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </FooterAction>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="glass panel-cut-sm border-azure/30">
                <div className="kicker !text-azure mb-1">{t('dashboard.footer.discord.title')}</div>
                <p className="font-mono text-[11px] text-paper-dim">{t('dashboard.footer.discord.desc')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <FooterAction onClick={(e) => void openProjectExternalLink(e, projectWebsiteUrl)} aria-label={t('dashboard.footer.website.aria')} hoverColor="hover:bg-crimson">
                  <Globe size={13} />
                </FooterAction>
              </TooltipTrigger>
              <TooltipContent side="top" align="end" className="glass panel-cut-sm border-crimson/30">
                <div className="kicker mb-1">{t('dashboard.footer.website.title')}</div>
                <p className="font-mono text-[11px] text-paper-dim">{t('dashboard.footer.website.desc')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </footer>
  );
};

const FooterAction = React.forwardRef<HTMLButtonElement, {
  children: React.ReactNode; onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  'aria-label': string; hoverColor: string;
}>(({ children, onClick, hoverColor, ...rest }, ref) => (
  <button
    ref={ref} type="button" onClick={onClick} {...rest}
    className={cn('panel-cut-sm grid h-6 w-6 place-items-center bg-ink-3/60 text-paper-dim transition-colors hover:text-ink', hoverColor)}
  >
    {children}
  </button>
));
FooterAction.displayName = 'FooterAction';

export default DashboardFooterNoir;