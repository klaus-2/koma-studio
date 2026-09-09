import React from 'react';
import { ChevronLeft, ChevronRight, PanelRightClose, Settings, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import { cn } from '../../utils/dashboard.utils';

interface DashboardRightSidebarProps {
  mobileToolsOpen: boolean;
  isCompactViewport: boolean;
  toolsPanelCollapsed: boolean;
  rightSidebarWidth: number;
  modeLabel: string;
  desktopToolsToggleRef: React.RefObject<HTMLButtonElement | null>;
  setMobileToolsOpen: (value: boolean) => void;
  setToolsPanelCollapsed: (value: boolean) => void;
  toggleDesktopToolsPanel: (animate: boolean) => void;
  startSidebarResize: (side: 'left' | 'right', clientX: number) => void;
  resetRightSidebarWidth: () => void;
  resizeRightSidebarBy: (delta: number) => void;
  sidebarResizeStep: number;
  children: React.ReactNode;
}

export default function DashboardRightSidebar({
  mobileToolsOpen,
  isCompactViewport,
  toolsPanelCollapsed,
  rightSidebarWidth,
  modeLabel,
  desktopToolsToggleRef,
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
      className={cn(
        'koma-dash__tools custom-scrollbar',
        mobileToolsOpen && 'koma-dash__tools--open',
        !isCompactViewport && toolsPanelCollapsed && 'koma-dash__tools--collapsed',
      )}
      data-tour="dashboard-tools-panel"
      style={!isCompactViewport && !toolsPanelCollapsed ? { width: rightSidebarWidth } : undefined}
    >
      <div className="koma-tools__header">
        <Settings size={16} />
        <span>{modeLabel}</span>
        {!isCompactViewport && (
          <button
            type="button"
            ref={desktopToolsToggleRef as React.LegacyRef<HTMLButtonElement>}
            className="koma-iconbtn koma-iconbtn--xs koma-desktop-tools-toggle"
            onClick={() => toggleDesktopToolsPanel(true)}
            title={t('dashboard.sidebar.right.hide')}
            aria-label={t('dashboard.sidebar.right.hide')}
          >
            <PanelRightClose size={16} />
          </button>
        )}
        <button
          type="button"
          className="koma-iconbtn koma-iconbtn--xs koma-mobile-close-tools"
          onClick={() => (isCompactViewport ? setMobileToolsOpen(false) : setToolsPanelCollapsed(true))}
          title={t('dashboard.sidebar.right.close')}
        >
          <X size={16} />
        </button>
      </div>
      {!isCompactViewport && !toolsPanelCollapsed && (
        <button
          type="button"
          className="koma-sidebar-resize-handle koma-sidebar-resize-handle--left"
          onMouseDown={(event) => {
            event.preventDefault();
            startSidebarResize('right', event.clientX);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            resetRightSidebarWidth();
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              resizeRightSidebarBy(sidebarResizeStep);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              resizeRightSidebarBy(-sidebarResizeStep);
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              resetRightSidebarWidth();
            }
          }}
          aria-label={t('dashboard.sidebar.right.resizeAria')}
          title={t('dashboard.sidebar.right.resizeTitle')}
        >
          <span className="koma-sidebar-resize-handle__inner" aria-hidden="true">
            <ChevronLeft size={11} />
            <ChevronRight size={11} />
          </span>
        </button>
      )}

      <div className="koma-tools__body">{children}</div>
    </aside>
  );
}
