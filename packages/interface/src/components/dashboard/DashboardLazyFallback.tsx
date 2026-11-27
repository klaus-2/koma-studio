import { KomaNekoRig } from '../koma-mascot/KomaNekoRig';

export default function DashboardLazyFallback() {
  return (
    <div className="koma-stage__empty" data-tour="dashboard-stage-empty" role="status" aria-live="polite">
      <KomaNekoRig pose="stretch" size={84} />
      <div className="koma-spinner" />
      <p>Loading workspace...</p>
    </div>
  );
}
