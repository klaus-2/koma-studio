import { useThemeStore } from '@koma/ui/stores/theme-store';
import { renderSettingsGeneralTab as renderSettingsGeneralTabClassic } from './SettingsGeneralTab';
import { renderSettingsGeneralTabNoir } from './noir/SettingsGeneralTabNoir';

export const renderSettingsGeneralTab = (args: Parameters<typeof renderSettingsGeneralTabClassic>[0]) => {
  const family = useThemeStore.getState().family;

  return family === 'noir' ? renderSettingsGeneralTabNoir(args as Parameters<typeof renderSettingsGeneralTabNoir>[0]) : renderSettingsGeneralTabClassic(args);
};

export default renderSettingsGeneralTab;
