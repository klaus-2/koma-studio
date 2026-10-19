import { currentFamilySkin } from '@koma/ui/themes/family-skins';
import { renderSettingsGeneralTab as renderSettingsGeneralTabClassic } from './SettingsGeneralTab';
import { renderSettingsGeneralTabNoir } from './noir/SettingsGeneralTabNoir';

type SettingsGeneralTabArgs = Parameters<typeof renderSettingsGeneralTabClassic>[0];

export const renderSettingsGeneralTab = (args: SettingsGeneralTabArgs) => {
  const render = currentFamilySkin({
    classic: renderSettingsGeneralTabClassic,
    noir: (bag: SettingsGeneralTabArgs) => renderSettingsGeneralTabNoir(bag),
  });

  return render(args);
};

export default renderSettingsGeneralTab;
