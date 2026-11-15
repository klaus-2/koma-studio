import { Suspense, lazy } from 'react';

import DashboardLazyFallback from './DashboardLazyFallback';
import { memoLoad } from '../../utils/lazyModule';

interface DashboardInfoModeStageProps {
  mode: string;
  openSettingsOnIntegrationsTab: () => void;
}

const loadBloggerWorkspace = memoLoad(() => import('../blogger/BloggerWorkspace'));
const loadGuidesPage = memoLoad(() => import('../guides/GuidesPage'));
const loadImgurWorkspace = memoLoad(() => import('../imgur/ImgurWorkspace'));
const loadResourcesPage = memoLoad(() => import('../resources/ResourcesPage'));

const BloggerWorkspace = lazy(loadBloggerWorkspace);
const GuidesPage = lazy(loadGuidesPage);
const ImgurWorkspace = lazy(loadImgurWorkspace);
const ResourcesPage = lazy(loadResourcesPage);

/** Fire-and-forget warmup of the info-mode pages (called at browser idle). */
export function preloadInfoModeModules() {
  void loadBloggerWorkspace().catch(() => { });
  void loadGuidesPage().catch(() => { });
  void loadImgurWorkspace().catch(() => { });
  void loadResourcesPage().catch(() => { });
}

export default function DashboardInfoModeStage({
  mode,
  openSettingsOnIntegrationsTab,
}: DashboardInfoModeStageProps) {
  return (
    <Suspense fallback={<DashboardLazyFallback />}>
      <DashboardInfoModeStageInner mode={mode} openSettingsOnIntegrationsTab={openSettingsOnIntegrationsTab} />
    </Suspense>
  );
}

function DashboardInfoModeStageInner({
  mode,
  openSettingsOnIntegrationsTab,
}: DashboardInfoModeStageProps) {
  if (mode === 'guides') {
    return <GuidesPage />;
  }

  if (mode === 'resources') {
    return <ResourcesPage />;
  }

  if (mode === 'blogger') {
    return <BloggerWorkspace openSettingsOnIntegrationsTab={openSettingsOnIntegrationsTab} />;
  }

  if (mode === 'imgur') {
    return <ImgurWorkspace openSettingsOnIntegrationsTab={openSettingsOnIntegrationsTab} />;
  }

  return null;
}
