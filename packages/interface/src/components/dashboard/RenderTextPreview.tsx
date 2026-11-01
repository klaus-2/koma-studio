import type { ComponentProps, ReactElement } from 'react';

import RenderTextPreviewClassic from './RenderTextPreviewClassic';
import RenderTextPreviewNoir from './noir/RenderTextPreviewNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { useUiShellStore } from '@/pages/dashboard/stores/ui-shell-store';

const RenderTextPreviewFamily = createFamilyComponent(RenderTextPreviewClassic, RenderTextPreviewNoir);

type RenderTextPreviewProps = Omit<ComponentProps<typeof RenderTextPreviewFamily>, 'zoom'>;

// Zoom is a high-frequency store value: the wrapper is the single subscriber,
// so a Ctrl+wheel gesture re-renders each preview leaf without touching the
// stage section, the page or the layout that used to forward the prop.
export default function RenderTextPreview(props: RenderTextPreviewProps): ReactElement {
  const zoom = useUiShellStore((s) => s.zoom);
  return <RenderTextPreviewFamily {...props} zoom={zoom} />;
}
