import { useState } from 'react';

import type { AioTextRegion, LoadedImage } from '../../../types/dashboard.types';
import RegionPickerOverlay from './RegionPickerOverlay';

export interface RegionPickerState {
  hits: readonly AioTextRegion[];
  point: { x: number; y: number };
}

/** Picker state + the pointer-hook callback that opens it (F3, shared by the render preview and the detect stage). */
export const useRegionPickerState = (): {
  picker: RegionPickerState | null;
  openRegionPicker: (
    hits: readonly AioTextRegion[],
    point: { x: number; y: number },
  ) => void;
  closeRegionPicker: () => void;
} => {
  const [picker, setPicker] = useState<RegionPickerState | null>(null);
  return {
    picker,
    openRegionPicker: (hits, point) => setPicker({ hits, point }),
    closeRegionPicker: () => setPicker(null),
  };
};

interface RegionPickerMountProps {
  picker: RegionPickerState | null;
  image: LoadedImage;
  onSelectRegion: (regionId: string) => void;
  onClose: () => void;
}

/** Renders the overlap picker overlay when a pending pick exists. */
export function RegionPickerMount({
  picker,
  image,
  onSelectRegion,
  onClose,
}: RegionPickerMountProps) {
  if (!picker) {
    return null;
  }
  return (
    <RegionPickerOverlay
      hits={picker.hits}
      imageWidth={image.width}
      imageHeight={image.height}
      thumbnailUrl={image.thumbnailUrl}
      onSelect={onSelectRegion}
      onClose={onClose}
    />
  );
}
