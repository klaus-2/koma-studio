import type React from 'react';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import ModelManagerModalClassic from './ModelManagerModalClassic';
import ModelManagerModalNoir from './noir/ModelManagerModalNoir';

export type { ModelManagerModalProps } from './ModelManagerModalClassic';

const ModelManagerModal = (props: React.ComponentProps<typeof ModelManagerModalClassic>) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <ModelManagerModalNoir {...props} /> : <ModelManagerModalClassic {...props} />;
};

export { ModelManagerModal };
export default ModelManagerModal;
