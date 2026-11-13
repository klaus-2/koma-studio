import BugReportModal from '../BugReportModal';
import ShortcutCenterModal from '../ShortcutCenterModal';
import CommandPalette from '../CommandPalette';

import type { KeyboardShortcutConfigV2 } from '../../shortcuts/keyboardShortcuts';
import type { ToolMode } from '../../types/dashboard.types';
import { useUiShellStore } from '../../pages/dashboard/stores/ui-shell-store';
import { lazy, memo, Suspense } from 'react';

// Compare review pulls the render-canvas pipeline; the chunk loads only when
// the overlay is opened.
const CompareReviewOverlay = lazy(() => import('./CompareReviewOverlay'));

interface DashboardOverlaysProps {
  shortcutCenterOpen: boolean;
  keyboardShortcutConfig: KeyboardShortcutConfigV2;
  handleKeyboardShortcutConfigChange: (config: KeyboardShortcutConfigV2) => void;
  closeShortcutCenter: () => void;
  bugReportModalOpen: boolean;
  setBugReportModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mode: ToolMode;
  statusMessage: string;
  userEmail: string;
}

export default memo(function DashboardOverlays({
  shortcutCenterOpen,
  keyboardShortcutConfig,
  handleKeyboardShortcutConfigChange,
  closeShortcutCenter,
  bugReportModalOpen,
  setBugReportModalOpen,
  mode,
  statusMessage,
  userEmail,
}: DashboardOverlaysProps) {
  const commandPaletteOpen = useUiShellStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useUiShellStore((s) => s.setCommandPaletteOpen);
  const compareReviewOpen = useUiShellStore((s) => s.compareReviewOpen);
  const setCompareReviewOpen = useUiShellStore(
    (s) => s.setCompareReviewOpen,
  );
  return (
    <>
      {commandPaletteOpen && (
        <CommandPalette onClose={() => setCommandPaletteOpen(false)} />
      )}
      {compareReviewOpen && (
        <Suspense fallback={null}>
          <CompareReviewOverlay onClose={() => setCompareReviewOpen(false)} />
        </Suspense>
      )}
      {shortcutCenterOpen && (
        <ShortcutCenterModal
          open={shortcutCenterOpen}
          config={keyboardShortcutConfig}
          onConfigChange={handleKeyboardShortcutConfigChange}
          onClose={closeShortcutCenter}
        />
      )}
      {bugReportModalOpen && (
        <BugReportModal
          open={bugReportModalOpen}
          onClose={() => setBugReportModalOpen(false)}
          context={{
            mode,
            statusMessage,
            route:
              typeof window !== 'undefined'
                ? `${window.location.pathname}${window.location.search}${window.location.hash}`
                : '',
            userEmail,
          }}
        />
      )}
    </>
  );
});
