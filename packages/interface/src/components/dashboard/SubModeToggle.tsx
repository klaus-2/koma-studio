import { useThemeStore } from '@koma/ui/stores/theme-store';
import SubModeToggleClassic from './SubModeToggleClassic';
import SubModeToggleNoir from './noir/SubModeToggleNoir';
import { memo } from 'react';

export type { SubModeToggleProps } from './SubModeToggleClassic';

export default memo(function SubModeToggle(props: React.ComponentProps<typeof SubModeToggleClassic>) {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <SubModeToggleNoir {...props} /> : <SubModeToggleClassic {...props} />;
});
