import { currentFamilySkin } from '@koma/ui/themes/family-skins';
import { renderSettingsTypographerTab as renderSettingsTypographerTabClassic } from './SettingsTypographerTab';
import { renderSettingsTypographerTabNoir } from './noir/SettingsTypographerTabNoir';

type SettingsTypographerTabArgs = Parameters<typeof renderSettingsTypographerTabClassic>[0];

export const renderSettingsTypographerTab = (args: SettingsTypographerTabArgs) => {
  const render = currentFamilySkin({
    classic: renderSettingsTypographerTabClassic,
    noir: (bag: SettingsTypographerTabArgs) => renderSettingsTypographerTabNoir(bag),
  });

  return render(args);
};

export default renderSettingsTypographerTab;
