import { useThemeStore } from '@koma/ui/stores/theme-store';
import { renderSettingsIntegrationsTab as renderSettingsIntegrationsTabClassic } from './SettingsIntegrationsTab';
import { renderSettingsIntegrationsTabNoir } from './noir/SettingsIntegrationsTabNoir';

export const renderSettingsIntegrationsTab = (args: Parameters<typeof renderSettingsIntegrationsTabClassic>[0]) => {
  const family = useThemeStore.getState().family;

  return family === 'noir' ? renderSettingsIntegrationsTabNoir(args as Parameters<typeof renderSettingsIntegrationsTabNoir>[0]) : renderSettingsIntegrationsTabClassic(args);
};

export default renderSettingsIntegrationsTab;
