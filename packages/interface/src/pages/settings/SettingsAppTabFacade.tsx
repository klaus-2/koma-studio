import { currentFamilySkin } from '@koma/ui/themes/family-skins';
import { renderSettingsAppTab as renderSettingsAppTabClassic } from './SettingsAppTab';
import { renderSettingsAppTabNoir } from './noir/SettingsAppTabNoir';

type SettingsAppTabArgs = Parameters<typeof renderSettingsAppTabClassic>[0];

export const renderSettingsAppTab = (args: SettingsAppTabArgs) => {
  const render = currentFamilySkin({
    classic: renderSettingsAppTabClassic,
    noir: (bag: SettingsAppTabArgs) => renderSettingsAppTabNoir(bag),
  });

  return render(args);
};

export default renderSettingsAppTab;
