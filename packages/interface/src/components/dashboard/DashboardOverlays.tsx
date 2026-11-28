import { lazy, memo, Suspense, type MouseEvent } from 'react';

import BugReportModal from '../BugReportModal';
import ShortcutCenterModal from '../ShortcutCenterModal';
import CommandPalette from '../CommandPalette';

import type { SettingsTab } from '../../pages/settings/settings.types';
import type { KeyboardShortcutConfigV2 } from '../../shortcuts/keyboardShortcuts';
import type { ToolMode } from '../../types/dashboard.types';
import { useUiShellStore } from '../../pages/dashboard/stores/ui-shell-store';

const CompareReviewOverlay = lazy(() => import('./CompareReviewOverlay'));
const OnboardingModal = lazy(() => import('../onboarding/OnboardingModal'));

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
  onboardingOpen: boolean;
  onboardingIsReviewing: boolean;
  userId: string | null;
  githubUrl: string;
  onCloseOnboarding: () => void;
  onStartTour: () => void;
  onOpenSettingsTab: (tab: SettingsTab) => void;
  onOpenExternalUrl: (event: MouseEvent<HTMLElement>, url: string) => void | Promise<void>;
  onOpenModelManager: () => void;
  onInstallModels: (modelIds?: string[]) => Promise<unknown>;
  onRetryModel: (modelId: string) => Promise<void>;
  onCancelModel: (modelId: string) => Promise<void>;
  onCancelAllModels: () => Promise<void>;
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
  onboardingOpen,
  onboardingIsReviewing,
  userId,
  githubUrl,
  onCloseOnboarding,
  onStartTour,
  onOpenSettingsTab,
  onOpenExternalUrl,
  onOpenModelManager,
  onInstallModels,
  onRetryModel,
  onCancelModel,
  onCancelAllModels,
}: DashboardOverlaysProps) {
  const commandPaletteOpen = useUiShellStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useUiShellStore((s) => s.setCommandPaletteOpen);
  const compareReviewOpen = useUiShellStore((s) => s.compareReviewOpen);
  const setCompareReviewOpen = useUiShellStore(
    (s) => s.setCompareReviewOpen,
  );
  return (
    <>
      {onboardingOpen && (
        <Suspense fallback={null}>
          <OnboardingModal
            open={onboardingOpen}
            isReviewing={onboardingIsReviewing}
            userId={userId}
            githubUrl={githubUrl}
            onClose={onCloseOnboarding}
            onStartTour={onStartTour}
            onOpenSettingsTab={onOpenSettingsTab}
            onOpenExternalUrl={onOpenExternalUrl}
            onOpenModelManager={onOpenModelManager}
            onInstallModels={onInstallModels}
            onRetryModel={onRetryModel}
            onCancelModel={onCancelModel}
            onCancelAllModels={onCancelAllModels}
          />
        </Suspense>
      )}
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
