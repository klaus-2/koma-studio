import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import ImgurWorkspaceClassic from './ImgurWorkspaceClassic';
import { ImgurWorkspaceV2 } from '../koma/cdn/ImgurWorkspaceV2';

export type { ImgurWorkspaceProps } from './ImgurWorkspaceClassic';

export const ImgurWorkspace = createFamilyComponent(
  ImgurWorkspaceClassic,
  ImgurWorkspaceV2,
);

export default ImgurWorkspace;
