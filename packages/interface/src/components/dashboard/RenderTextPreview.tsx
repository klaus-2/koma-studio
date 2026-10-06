import React from 'react';
import { useThemeStore } from '@koma/ui/stores/theme-store';
import RenderTextPreviewClassic from './RenderTextPreviewClassic';
import RenderTextPreviewNoir from './noir/RenderTextPreviewNoir';

type RenderTextPreviewProps = React.ComponentProps<typeof RenderTextPreviewClassic>;

const RenderTextPreview = (props: RenderTextPreviewProps) => {
  const family = useThemeStore((s) => s.family);

  return family === 'noir' ? <RenderTextPreviewNoir {...props} /> : <RenderTextPreviewClassic {...props} />;
};

export default RenderTextPreview;