import { useThemeStore } from '@koma/ui/stores/theme-store';
import ImgurWorkspaceClassic from './ImgurWorkspaceClassic';
import { ImgurWorkspaceV2 } from '../koma/cdn/ImgurWorkspaceV2';

export type { ImgurWorkspaceProps } from './ImgurWorkspaceClassic';

export const ImgurWorkspace = (props: React.ComponentProps<typeof ImgurWorkspaceClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ImgurWorkspaceV2 {...props} /> : <ImgurWorkspaceClassic {...props} />;
};

export default ImgurWorkspace;
