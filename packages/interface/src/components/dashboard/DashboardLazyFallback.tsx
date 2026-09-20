/**
 * Shared Suspense fallback for lazily-loaded dashboard stages/panels.
 * Same visual pattern as the LazyFallback in DashboardSpecialModeStage.tsx.
 * Rendered only during a chunk fetch (idle preload keeps this off-screen in
 * practice; see useDashboardIdlePreload).
 */
export default function DashboardLazyFallback() {
  return (
    <div className="koma-stage__empty" data-tour="dashboard-stage-empty">
      <div className="koma-spinner" />
      <p>Loading workspace...</p>
    </div>
  );
}
