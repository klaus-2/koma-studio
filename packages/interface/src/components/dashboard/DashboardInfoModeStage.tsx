import BloggerWorkspace from '../blogger/BloggerWorkspace';
import GuidesPage from '../guides/GuidesPage';
import ImgurWorkspace from '../imgur/ImgurWorkspace';
import ResourcesPage from '../resources/ResourcesPage';

interface DashboardInfoModeStageProps {
  mode: string;
  onOpenSettings: () => void;
}

export default function DashboardInfoModeStage({
  mode,
  onOpenSettings,
}: DashboardInfoModeStageProps) {
  if (mode === 'guides') {
    return <GuidesPage />;
  }

  if (mode === 'resources') {
    return <ResourcesPage />;
  }

  if (mode === 'blogger') {
    return <BloggerWorkspace onOpenSettings={onOpenSettings} />;
  }

  if (mode === 'imgur') {
    return <ImgurWorkspace onOpenSettings={onOpenSettings} />;
  }

  return null;
}
