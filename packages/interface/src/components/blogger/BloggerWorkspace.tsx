import { useThemeStore } from '@koma/ui/stores/theme-store';
import BloggerWorkspaceClassic from './BloggerWorkspaceClassic';
import { BloggerWorkspaceV2 } from '../koma/cdn/BloggerWorkspaceV2';

export type { BloggerWorkspaceProps, UploadDraftItem } from './BloggerWorkspaceClassic';

export const BloggerWorkspace = (props: React.ComponentProps<typeof BloggerWorkspaceClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <BloggerWorkspaceV2 {...props} /> : <BloggerWorkspaceClassic {...props} />;
};

export default BloggerWorkspace;
