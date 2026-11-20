/** Classic insertion guide line: accent bar on the hovered item's top edge. */
export default function DashboardLeftSidebarPageDragGuideClassic() {
  return (
    <span
      aria-hidden="true"
      data-testid="page-drop-guide"
      className="pointer-events-none absolute inset-x-1 top-0 h-[3px] rounded-full bg-[var(--auth-purple)]"
    />
  );
}
