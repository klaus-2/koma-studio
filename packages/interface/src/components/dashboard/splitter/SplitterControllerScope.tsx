/**
 * Splitter controller scope — hosts the splitter controller below the page so
 * recipe/image-state ticks re-render only this scope and its context
 * consumers, never DashboardPage or the memoized layout. The provider stays
 * above the layout because the splitter sidebar toolbox lives there.
 */
import type { ReactNode } from 'react';
import { useUtilitySplitterController } from '../../../pages/dashboard/hooks/utility-workspaces';
import { useWorkspacePersistenceStore } from '../../../pages/dashboard/stores/workspace-persistence-store';
import { SplitterControllerProvider } from './SplitterControllerContext';

type SplitterControllerScopeArgs = Parameters<
  typeof useUtilitySplitterController
>[0];

export function SplitterControllerScope({
  isDesktopRuntime,
  localApiBase,
  registerDownloads,
  ensureVerifiedEmailOrNotify,
  recordProcessedPages,
  children,
}: Omit<SplitterControllerScopeArgs, 'workspaceRestoreToken'> & {
  children: ReactNode;
}): ReactNode {
  const workspaceRestoreToken = useWorkspacePersistenceStore(
    (s) => s.workspaceRestoreToken,
  );
  const { splitterController } = useUtilitySplitterController({
    workspaceRestoreToken,
    isDesktopRuntime,
    localApiBase,
    registerDownloads,
    ensureVerifiedEmailOrNotify,
    recordProcessedPages,
  });
  return (
    <SplitterControllerProvider controller={splitterController}>
      {children}
    </SplitterControllerProvider>
  );
}
