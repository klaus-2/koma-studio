import { useThemeStore } from '@koma/ui/stores/theme-store';
import { RuntimeProfileSectionClassic } from './RuntimeProfileSectionClassic';
import { RuntimeProfileSectionNoir } from './noir/RuntimeProfileSectionNoir';

export const RuntimeProfileSection = (props: React.ComponentProps<typeof RuntimeProfileSectionClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <RuntimeProfileSectionNoir {...props} /> : <RuntimeProfileSectionClassic {...props} />;
};

export default RuntimeProfileSection;
