/**
 * Region selection click decision: shift+click joins Ctrl/Cmd as a
 * multi-select toggle, and every multi-select modifier (shift included) is
 * EXCLUDED from opening the region picker. Pure module — the pointer hook
 * consumes the decision instead of branching inline (extraction keeps the
 * grandfathered pointer file from growing).
 */
import { shouldOpenRegionPicker } from './regionPickerDecision';

export interface RegionSelectionClickModifiers {
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
}

export interface RegionSelectionClickArgs {
  readonly modifiers: RegionSelectionClickModifiers;
  /** Whether an `onMultiSelectToggle` handler is wired for the stage. */
  readonly multiSelectToggleAvailable: boolean;
  readonly areaSelectionEnabled: boolean;
  readonly hitCount: number;
  readonly topmostRegionId: string | undefined;
  readonly selectedRegionId: string | null;
}

export type RegionSelectionClickAction =
  | 'multi-toggle'
  | 'open-picker'
  | 'select';

export const decideRegionSelectionClick = (
  args: RegionSelectionClickArgs,
): RegionSelectionClickAction => {
  const isMultiSelectModifier =
    args.modifiers.shift || args.modifiers.ctrl || args.modifiers.meta;
  if (
    isMultiSelectModifier &&
    args.multiSelectToggleAvailable &&
    args.areaSelectionEnabled
  ) {
    return 'multi-toggle';
  }
  if (
    shouldOpenRegionPicker(
      args.hitCount,
      args.topmostRegionId,
      args.selectedRegionId,
      isMultiSelectModifier,
    )
  ) {
    return 'open-picker';
  }
  return 'select';
};
