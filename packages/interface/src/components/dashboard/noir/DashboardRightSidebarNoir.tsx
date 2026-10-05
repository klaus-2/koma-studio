import React from 'react';
import { ChevronLeft, ChevronRight, PanelRightClose, Settings, X } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { cn } from '../../../utils/dashboard.utils';

interface DashboardRightSidebarProps {
  mobileToolsOpen: boolean;
  isCompactViewport: boolean;
  toolsPanelCollapsed: boolean;
  rightSidebarWidth: number;
  modeLabel: string;
  desktopToolsToggleRef: React.RefObject<HTMLButtonElement | null>;
  sidebarRef?: React.RefObject<HTMLElement | null>;
  setMobileToolsOpen: (value: boolean) => void;
  setToolsPanelCollapsed: (value: boolean) => void;
  toggleDesktopToolsPanel: (animate: boolean) => void;
  startSidebarResize: (side: 'left' | 'right', clientX: number) => void;
  resetRightSidebarWidth: () => void;
  resizeRightSidebarBy: (delta: number) => void;
  sidebarResizeStep: number;
  children: React.ReactNode;
}

export default function DashboardRightSidebarNoir({
  mobileToolsOpen,
  isCompactViewport,
  toolsPanelCollapsed,
  rightSidebarWidth,
  modeLabel,
  desktopToolsToggleRef,
  sidebarRef,
  setMobileToolsOpen,
  setToolsPanelCollapsed,
  toggleDesktopToolsPanel,
  startSidebarResize,
  resetRightSidebarWidth,
  resizeRightSidebarBy,
  sidebarResizeStep,
  children,
}: DashboardRightSidebarProps) {
  const { t } = useI18n();

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'relative flex h-full flex-col overflow-hidden border-l-2 border-azure/25 bg-ink-2/90 backdrop-blur-xl transition-transform',
        mobileToolsOpen && 'z-50 translate-x-0',
        isCompactViewport && !mobileToolsOpen && 'translate-x-full',
        !isCompactViewport && toolsPanelCollapsed && 'w-0 translate-x-full border-0',
      )}
      data-tour="dashboard-tools-panel"
      style={!isCompactViewport && !toolsPanelCollapsed ? { width: rightSidebarWidth } : undefined}
    >
      <div className="halftone pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />

      <div className="relative flex shrink-0 items-center gap-2 border-b-2 border-azure/25 p-3">
        <span className="panel-cut-sm grid h-7 w-7 place-items-center bg-azure/15 text-azure">
          <Settings size={14} />
        </span>
        <span className="flex-1 truncate font-display text-sm font-black uppercase tracking-tight text-paper">{modeLabel}</span>
        {!isCompactViewport && (
          <button
            type="button"
            ref={desktopToolsToggleRef as React.LegacyRef<HTMLButtonElement>}
            onClick={() => toggleDesktopToolsPanel(true)}
            title={t('dashboard.sidebar.right.hide')}
            aria-label={t('dashboard.sidebar.right.hide')}
            className="panel-cut-sm grid h-7 w-7 place-items-center bg-ink-3 text-paper-dim transition-colors hover:bg-azure hover:text-ink"
          >
            <PanelRightClose size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={() => (isCompactViewport ? setMobileToolsOpen(false) : setToolsPanelCollapsed(true))}
          title={t('dashboard.sidebar.right.close')}
          className="panel-cut-sm grid h-7 w-7 place-items-center bg-ink-3 text-paper-dim transition-colors hover:bg-crimson hover:text-ink"
        >
          <X size={15} />
        </button>
      </div>

      {!isCompactViewport && !toolsPanelCollapsed && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); startSidebarResize('right', e.clientX); }}
          onDoubleClick={(e) => { e.preventDefault(); resetRightSidebarWidth(); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); resizeRightSidebarBy(sidebarResizeStep); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); resizeRightSidebarBy(-sidebarResizeStep); }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resetRightSidebarWidth(); }
          }}
          aria-label={t('dashboard.sidebar.right.resizeAria')}
          title={t('dashboard.sidebar.right.resizeTitle')}
          className="group absolute left-0 top-0 z-30 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-azure/10"
        >
          <span className="flex flex-col text-paper-dim opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
            <ChevronLeft size={10} />
            <ChevronRight size={10} />
          </span>
        </button>
      )}

      <div className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </aside>
  );
}
