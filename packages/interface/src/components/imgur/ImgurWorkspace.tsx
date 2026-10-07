import { useThemeStore } from '@koma/ui/stores/theme-store';
import ImgurWorkspaceClassic from './ImgurWorkspaceClassic';
import ImgurWorkspaceNoir from './noir/ImgurWorkspaceNoir';

export type { ImgurWorkspaceProps } from './ImgurWorkspaceClassic';

export const ImgurWorkspace = (props: React.ComponentProps<typeof ImgurWorkspaceClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ImgurWorkspaceNoir {...props} /> : <ImgurWorkspaceClassic {...props} />;
};

export default ImgurWorkspace;
