import BugReportModal from '../BugReportModal';
import ShortcutCenterModal from '../ShortcutCenterModal';

import type { KeyboardShortcutConfigV2 } from '../../shortcuts/keyboardShortcuts';
import type { ToolMode } from '../../types/dashboard.types';

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

export default function DashboardOverlays({
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
  return (
    <>
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
}
