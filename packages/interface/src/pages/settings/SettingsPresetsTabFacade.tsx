import { useThemeStore } from '@koma/ui/stores/theme-store';
import { renderSettingsPresetsTab as renderSettingsPresetsTabClassic } from './SettingsPresetsTab';
import { renderSettingsPresetsTabNoir } from './noir/SettingsPresetsTabNoir';

export const renderSettingsPresetsTab = (args: Parameters<typeof renderSettingsPresetsTabClassic>[0]) => {
  const family = useThemeStore.getState().family;

  return family === 'noir' ? renderSettingsPresetsTabNoir(args as Parameters<typeof renderSettingsPresetsTabNoir>[0]) : renderSettingsPresetsTabClassic(args);
};

export default renderSettingsPresetsTab;
