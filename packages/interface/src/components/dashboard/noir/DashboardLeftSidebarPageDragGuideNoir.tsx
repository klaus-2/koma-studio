/** Noir insertion guide line: crimson bar on the hovered item's top edge. */
export default function DashboardLeftSidebarPageDragGuideNoir() {
  return (
    <span
      aria-hidden="true"
      data-testid="page-drop-guide"
      className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-crimson shadow-hard-crimson"
    />
  );
}
