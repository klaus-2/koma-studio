import { useThemeStore } from '@koma/ui/stores/theme-store';
import { renderSettingsAppTab as renderSettingsAppTabClassic } from './SettingsAppTab';
import { renderSettingsAppTabNoir } from './noir/SettingsAppTabNoir';

export const renderSettingsAppTab = (args: Parameters<typeof renderSettingsAppTabClassic>[0]) => {
  const family = useThemeStore.getState().family;

  return family === 'noir' ? renderSettingsAppTabNoir(args as Parameters<typeof renderSettingsAppTabNoir>[0]) : renderSettingsAppTabClassic(args);
};

export default renderSettingsAppTab;
