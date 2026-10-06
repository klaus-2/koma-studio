import { useThemeStore } from '@koma/ui/stores/theme-store';
import { MandatoryUpdateGateClassic } from './MandatoryUpdateGateClassic';
import { MandatoryUpdateGateNoir } from './noir/MandatoryUpdateGateNoir';

export const MandatoryUpdateGate = () => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <MandatoryUpdateGateNoir /> : <MandatoryUpdateGateClassic />;
};

export default MandatoryUpdateGate;
