import { useCallback, useEffect, useState, type MutableRefObject } from 'react';

import {
  LEFT_SIDEBAR_DEFAULT_WIDTH,
  LEFT_SIDEBAR_MAX_WIDTH,
  LEFT_SIDEBAR_MIN_WIDTH,
  RIGHT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_SIDEBAR_MAX_WIDTH,
  RIGHT_SIDEBAR_MIN_WIDTH,
  TOOLS_PANEL_COMPACT_BREAKPOINT,
} from '../constants/dashboard.constants';

import { desktopBridge } from "@/lib/desktop-bridge";
type SidebarToggleButtonRef = MutableRefObject<HTMLButtonElement | null>;

const COMPACT_VIEWPORT_HYSTERESIS = 32;

function getResponsiveViewportWidth(): number {
  if (typeof window === 'undefined') {
    return TOOLS_PANEL_COMPACT_BREAKPOINT;
  }

  if (desktopBridge.desktop && Number.isFinite(window.outerWidth) && window.outerWidth > 0) {
    return window.outerWidth;
  }

  return window.innerWidth;
}

function resolveCompactViewport(width: number, previous: boolean | null): boolean {
  if (previous === null) {
    return width <= TOOLS_PANEL_COMPACT_BREAKPOINT;
  }

  if (previous) {
    return width < TOOLS_PANEL_COMPACT_BREAKPOINT + COMPACT_VIEWPORT_HYSTERESIS;
  }

  return width <= TOOLS_PANEL_COMPACT_BREAKPOINT - COMPACT_VIEWPORT_HYSTERESIS;
}

interface UseDashboardShellLayoutArgs {
  desktopSidebarToggleRef: SidebarToggleButtonRef;
  topbarSidebarRevealRef: SidebarToggleButtonRef;
  desktopToolsToggleRef: SidebarToggleButtonRef;
  topbarToolsRevealRef: SidebarToggleButtonRef;
  animateSidebarToggle: (fromEl: HTMLElement | null, toEl: HTMLElement | null) => void;
}

export function useDashboardShellLayout({
  desktopSidebarToggleRef,
  topbarSidebarRevealRef,
  desktopToolsToggleRef,
  topbarToolsRevealRef,
  animateSidebarToggle,
}: UseDashboardShellLayoutArgs) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [toolsPanelCollapsed, setToolsPanelCollapsed] = useState(false);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(LEFT_SIDEBAR_DEFAULT_WIDTH);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(RIGHT_SIDEBAR_DEFAULT_WIDTH);
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? resolveCompactViewport(getResponsiveViewportWidth(), null)
      : false,
  );

  const toggleDesktopSidebar = useCallback((nextCollapsed?: boolean) => {
    if (isCompactViewport) {
      return;
    }

    const collapse = nextCollapsed ?? !desktopSidebarCollapsed;
    const sourceEl = collapse ? desktopSidebarToggleRef.current : topbarSidebarRevealRef.current;

    setDesktopSidebarCollapsed(collapse);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const targetEl = collapse ? topbarSidebarRevealRef.current : desktopSidebarToggleRef.current;
        animateSidebarToggle(sourceEl, targetEl);
      });
    });
  }, [
    animateSidebarToggle,
    desktopSidebarCollapsed,
    desktopSidebarToggleRef,
    isCompactViewport,
    topbarSidebarRevealRef,
  ]);

  useEffect(() => {
    if (isCompactViewport && desktopSidebarCollapsed) {
      setDesktopSidebarCollapsed(false);
    }
  }, [desktopSidebarCollapsed, isCompactViewport]);

  const toggleDesktopToolsPanel = useCallback((nextCollapsed?: boolean) => {
    if (isCompactViewport) {
      return;
    }

    const collapse = nextCollapsed ?? !toolsPanelCollapsed;
    const sourceEl = collapse ? desktopToolsToggleRef.current : topbarToolsRevealRef.current;

    setToolsPanelCollapsed(collapse);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const targetEl = collapse ? topbarToolsRevealRef.current : desktopToolsToggleRef.current;
        animateSidebarToggle(sourceEl, targetEl);
      });
    });
  }, [
    animateSidebarToggle,
    desktopToolsToggleRef,
    isCompactViewport,
    toolsPanelCollapsed,
    topbarToolsRevealRef,
  ]);

  const startSidebarResize = useCallback((side: 'left' | 'right', startX: number) => {
    if (isCompactViewport) {
      return;
    }

    const startWidth = side === 'left' ? leftSidebarWidth : rightSidebarWidth;

    const handlePointerMove = (event: globalThis.MouseEvent) => {
      const deltaX = event.clientX - startX;
      if (side === 'left') {
        setLeftSidebarWidth(
          Math.max(
            LEFT_SIDEBAR_MIN_WIDTH,
            Math.min(LEFT_SIDEBAR_MAX_WIDTH, startWidth + deltaX),
          ),
        );
        return;
      }

      setRightSidebarWidth(
        Math.max(
          RIGHT_SIDEBAR_MIN_WIDTH,
          Math.min(RIGHT_SIDEBAR_MAX_WIDTH, startWidth - deltaX),
        ),
      );
    };

    const stopResize = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResize);
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResize);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isCompactViewport, leftSidebarWidth, rightSidebarWidth]);

  const resizeLeftSidebarBy = useCallback((delta: number) => {
    setLeftSidebarWidth((prev) =>
      Math.max(LEFT_SIDEBAR_MIN_WIDTH, Math.min(LEFT_SIDEBAR_MAX_WIDTH, prev + delta)),
    );
  }, []);

  const resizeRightSidebarBy = useCallback((delta: number) => {
    setRightSidebarWidth((prev) =>
      Math.max(RIGHT_SIDEBAR_MIN_WIDTH, Math.min(RIGHT_SIDEBAR_MAX_WIDTH, prev + delta)),
    );
  }, []);

  const resetLeftSidebarWidth = useCallback(() => {
    setLeftSidebarWidth(LEFT_SIDEBAR_DEFAULT_WIDTH);
  }, []);

  const resetRightSidebarWidth = useCallback(() => {
    setRightSidebarWidth(RIGHT_SIDEBAR_DEFAULT_WIDTH);
  }, []);

  const handleToolsToggle = useCallback(() => {
    if (isCompactViewport) {
      setMobileToolsOpen((prev) => !prev);
      return;
    }
    toggleDesktopToolsPanel();
  }, [isCompactViewport, toggleDesktopToolsPanel]);

  const setToolsPanelVisible = useCallback((visible: boolean) => {
    if (isCompactViewport) {
      setMobileToolsOpen(visible);
      return;
    }
    setToolsPanelCollapsed(!visible);
  }, [isCompactViewport]);

  useEffect(() => {
    const handleViewportModeChange = () => {
      const compact = resolveCompactViewport(
        getResponsiveViewportWidth(),
        isCompactViewport,
      );
      setIsCompactViewport((prev) => (prev === compact ? prev : compact));

      if (!compact) {
        setMobileNavOpen(false);
        setMobileSidebarOpen(false);
        setMobileToolsOpen(false);
      }
    };

    handleViewportModeChange();
    window.addEventListener('resize', handleViewportModeChange);
    return () => window.removeEventListener('resize', handleViewportModeChange);
  }, [isCompactViewport]);

  const toolsPanelVisible = isCompactViewport ? mobileToolsOpen : !toolsPanelCollapsed;

  return {
    mobileNavOpen,
    setMobileNavOpen,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    mobileToolsOpen,
    setMobileToolsOpen,
    desktopSidebarCollapsed,
    setDesktopSidebarCollapsed,
    toolsPanelCollapsed,
    setToolsPanelCollapsed,
    leftSidebarWidth,
    rightSidebarWidth,
    isCompactViewport,
    toolsPanelVisible,
    toggleDesktopSidebar,
    toggleDesktopToolsPanel,
    startSidebarResize,
    resizeLeftSidebarBy,
    resizeRightSidebarBy,
    resetLeftSidebarWidth,
    resetRightSidebarWidth,
    handleToolsToggle,
    setToolsPanelVisible,
  };
}
