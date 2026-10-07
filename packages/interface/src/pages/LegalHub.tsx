import { useThemeStore } from '@koma/ui/stores/theme-store';
import LegalHubPageClassic from './LegalHubClassic';
import { LegalHubPage as LegalHubPageNoir } from './noir/LegalHubNoir';

export const LegalHubPage = (props: React.ComponentProps<typeof LegalHubPageClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <LegalHubPageNoir {...props} /> : <LegalHubPageClassic {...props} />;
};

export default LegalHubPage;
