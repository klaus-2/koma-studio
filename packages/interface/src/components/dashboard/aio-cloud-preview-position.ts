export const TOOLS_PANEL_SELECTOR = '[data-tour="dashboard-tools-panel"]';

const POPOVER_GAP = 12;
const POPOVER_MAX_WIDTH = 420;
const POPOVER_MIN_SIDE_WIDTH = 300;
const POPOVER_ABOVE_OFFSET = 10;

type RectLike = Pick<DOMRect, 'left' | 'top' | 'bottom' | 'width'>;

export type CloudPreviewPosition =
  | {
      readonly placement: 'side';
      readonly right: number;
      readonly width: number;
      readonly bottom: number;
    }
  | {
      readonly placement: 'above';
      readonly left: number;
      readonly width: number;
      readonly bottom: number;
    };

export const resolveCloudPreviewPosition = (
  anchor: RectLike,
  panel: RectLike | null,
  viewportWidth: number,
  viewportHeight: number,
): CloudPreviewPosition => {
  if (panel !== null) {
    const room = panel.left - POPOVER_GAP * 2;
    if (room >= POPOVER_MIN_SIDE_WIDTH) {
      return {
        placement: 'side',
        right: viewportWidth - panel.left + POPOVER_GAP,
        width: Math.min(POPOVER_MAX_WIDTH, room),
        bottom: Math.max(POPOVER_GAP, viewportHeight - anchor.bottom),
      };
    }
  }
  return {
    placement: 'above',
    left: anchor.left,
    width: anchor.width,
    bottom: viewportHeight - anchor.top + POPOVER_ABOVE_OFFSET,
  };
};
