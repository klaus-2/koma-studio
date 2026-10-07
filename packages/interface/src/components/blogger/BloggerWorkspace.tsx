import { useThemeStore } from '@koma/ui/stores/theme-store';
import BloggerWorkspaceClassic from './BloggerWorkspaceClassic';
import BloggerWorkspaceNoir from './noir/BloggerWorkspaceNoir';

export type { BloggerWorkspaceProps, UploadDraftItem } from './BloggerWorkspaceClassic';

export const BloggerWorkspace = (props: React.ComponentProps<typeof BloggerWorkspaceClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <BloggerWorkspaceNoir {...props} /> : <BloggerWorkspaceClassic {...props} />;
};

export default BloggerWorkspace;
