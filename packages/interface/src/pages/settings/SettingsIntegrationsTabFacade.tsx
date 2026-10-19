import { currentFamilySkin } from '@koma/ui/themes/family-skins';
import { renderSettingsIntegrationsTab as renderSettingsIntegrationsTabClassic } from './SettingsIntegrationsTab';
import { renderSettingsIntegrationsTabNoir } from './noir/SettingsIntegrationsTabNoir';

type SettingsIntegrationsTabArgs = Parameters<typeof renderSettingsIntegrationsTabClassic>[0];

export const renderSettingsIntegrationsTab = (args: SettingsIntegrationsTabArgs) => {
  const render = currentFamilySkin({
    classic: renderSettingsIntegrationsTabClassic,
    noir: (bag: SettingsIntegrationsTabArgs) => renderSettingsIntegrationsTabNoir(bag),
  });

  return render(args);
};

export default renderSettingsIntegrationsTab;
