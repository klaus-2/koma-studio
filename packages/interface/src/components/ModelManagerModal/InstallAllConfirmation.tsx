import { useThemeStore } from '@koma/ui/stores/theme-store';
import { InstallAllConfirmationClassic } from './InstallAllConfirmationClassic';
import { InstallAllConfirmationNoir } from './noir/InstallAllConfirmationNoir';

export type { InstallAllConfirmationProps } from './InstallAllConfirmationClassic';

export const InstallAllConfirmation = (props: React.ComponentProps<typeof InstallAllConfirmationClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <InstallAllConfirmationNoir {...props} /> : <InstallAllConfirmationClassic {...props} />;
};

export default InstallAllConfirmation;
