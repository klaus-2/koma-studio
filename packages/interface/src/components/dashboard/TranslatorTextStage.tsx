import { useThemeStore } from '@koma/ui/stores/theme-store';
import TranslatorTextStageClassic from './TranslatorTextStageClassic';
import TranslatorTextStageNoir from './noir/TranslatorTextStageNoir';

const TranslatorTextStage = (props: React.ComponentProps<typeof TranslatorTextStageClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <TranslatorTextStageNoir {...props} /> : <TranslatorTextStageClassic {...props} />;
};

export default TranslatorTextStage;
