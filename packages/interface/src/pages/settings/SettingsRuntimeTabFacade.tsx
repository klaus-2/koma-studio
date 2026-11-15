import { currentFamilySkin } from '@koma/ui/themes/family-skins';
import { renderSettingsRuntimeTab as renderSettingsRuntimeTabClassic } from './SettingsRuntimeTab';
import { renderSettingsRuntimeTabNoir } from './noir/SettingsRuntimeTabNoir';

type SettingsRuntimeTabArgs = Parameters<typeof renderSettingsRuntimeTabClassic>[0];

export const renderSettingsRuntimeTab = (args: SettingsRuntimeTabArgs) => {
  const render = currentFamilySkin({
    classic: renderSettingsRuntimeTabClassic,
    noir: (bag: SettingsRuntimeTabArgs) => renderSettingsRuntimeTabNoir(bag),
  });

  return render(args);
};

export default renderSettingsRuntimeTab;
