/**
 * Region picker trigger (F3, decision D3): the picker opens on a pointerdown
 * that hits MORE than one region while the topmost region is not already
 * selected. Ctrl/Cmd multi-select clicks never open the picker.
 */
export const shouldOpenRegionPicker = (
  hitCount: number,
  topmostId: string | undefined,
  selectedRegionId: string | null,
  isMultiSelectModifier: boolean,
): boolean =>
  hitCount > 1 && topmostId !== selectedRegionId && !isMultiSelectModifier;
