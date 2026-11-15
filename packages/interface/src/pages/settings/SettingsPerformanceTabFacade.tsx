import { currentFamilySkin } from '@koma/ui/themes/family-skins';
import { renderSettingsPerformanceTab as renderSettingsPerformanceTabClassic } from './SettingsPerformanceTab';
import { renderSettingsPerformanceTabNoir } from './noir/SettingsPerformanceTabNoir';

type SettingsPerformanceTabArgs = Parameters<typeof renderSettingsPerformanceTabClassic>[0];

export const renderSettingsPerformanceTab = (args: SettingsPerformanceTabArgs) => {
  const render = currentFamilySkin({
    classic: renderSettingsPerformanceTabClassic,
    noir: (bag: SettingsPerformanceTabArgs) => renderSettingsPerformanceTabNoir(bag),
  });

  return render(args);
};

export default renderSettingsPerformanceTab;
