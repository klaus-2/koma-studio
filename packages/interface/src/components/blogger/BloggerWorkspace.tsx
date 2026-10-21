import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import BloggerWorkspaceClassic from './BloggerWorkspaceClassic';
import { BloggerWorkspaceV2 } from '../koma/cdn/BloggerWorkspaceV2';

export type { BloggerWorkspaceProps, UploadDraftItem } from './BloggerWorkspaceClassic';

export const BloggerWorkspace = createFamilyComponent(
  BloggerWorkspaceClassic,
  BloggerWorkspaceV2,
);

export default BloggerWorkspace;
