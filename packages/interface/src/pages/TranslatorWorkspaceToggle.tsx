import { useThemeStore } from '@koma/ui/stores/theme-store';
import TranslatorWorkspaceToggleClassic from './TranslatorWorkspaceToggleClassic';
import { TranslatorWorkspaceToggleNoir } from './noir/TranslatorWorkspaceToggleNoir';

export function TranslatorWorkspaceToggle(props: React.ComponentProps<typeof TranslatorWorkspaceToggleClassic>) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <TranslatorWorkspaceToggleNoir {...props} /> : <TranslatorWorkspaceToggleClassic {...props} />;
}
