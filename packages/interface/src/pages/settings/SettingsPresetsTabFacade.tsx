import { currentFamilySkin } from '@koma/ui/themes/family-skins';
import { renderSettingsPresetsTab as renderSettingsPresetsTabClassic } from './SettingsPresetsTab';
import { renderSettingsPresetsTabNoir } from './noir/SettingsPresetsTabNoir';

type SettingsPresetsTabArgs = Parameters<typeof renderSettingsPresetsTabClassic>[0];

export const renderSettingsPresetsTab = (args: SettingsPresetsTabArgs) => {
  const render = currentFamilySkin({
    classic: renderSettingsPresetsTabClassic,
    noir: (bag: SettingsPresetsTabArgs) => renderSettingsPresetsTabNoir(bag),
  });

  return render(args);
};

export default renderSettingsPresetsTab;
