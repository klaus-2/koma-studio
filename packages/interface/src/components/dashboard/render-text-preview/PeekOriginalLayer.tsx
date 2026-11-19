import { type ReactElement } from 'react';

import { ensureDirectPageUrl } from '../../../pages/dashboard/hooks/image-collection';
import { useUiShellStore } from '../../../pages/dashboard/stores/ui-shell-store';
import type { LoadedImage } from '../../../types/dashboard.types';

export interface PeekOriginalLayerProps {
  readonly image: LoadedImage;
  readonly active: boolean;
  readonly previewSrc: string;
  readonly imgElemWidth: number;
  readonly variant: 'classic' | 'noir';
}

export const usePeekOriginalOverlayHidden = (active: boolean): boolean =>
  useUiShellStore((s) => s.holdOriginalActive && active);

export function PeekOriginalLayer(props: PeekOriginalLayerProps): ReactElement {
  const { image, active, previewSrc, imgElemWidth, variant } = props;
  const peeking = useUiShellStore((s) => s.holdOriginalActive && active);
  const src = peeking
    ? ensureDirectPageUrl(image) || previewSrc
    : previewSrc;
  if (variant === 'noir') {
    return (
      <img
        src={src}
        className="block h-auto w-full select-none"
        style={{ maxWidth: `${imgElemWidth}px` }}
        alt={image.file.name}
        decoding="async"
        draggable={false}
      />
    );
  }
  return (
    <img
      src={src}
      className="koma-preview-card__img"
      style={{ maxWidth: `${imgElemWidth}px` }}
      alt={image.file.name}
      decoding="async"
    />
  );
}
