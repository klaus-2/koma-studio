import { Cpu, Download, Sparkles } from "lucide-react";
import type {
  DesktopMiniBackendRuntimeArtifactOption,
  DesktopMiniBackendRuntimeState,
} from "../../../types";
import { resolveRecommendedSelectableProfile } from "../runtime-profile-selection";
import { Sec, SpecGrid, SpecRow, Alert, selectCls, btnPrimary, btnGhost, chip } from "../../../pages/settings/noir/primitives";
import { StripeBar } from "../../system/v2/kit";

interface RuntimeProfileSectionProps {
  runtimeState: DesktopMiniBackendRuntimeState | null;
  recommendedProfile: string;
  runtimeArtifactsAvailable: boolean;
  runtimeArtifactsAvailabilityLabel: string;
  runtimeInstallBusy: boolean;
  runtimeInstallInProgress: boolean;
  runtimeInstallMode: "manual" | null;
  runtimeInstallButtonLabel: string;
  runtimeInstallFeedback: string | null;
  runtimeInstallError: string | null;
  manualArtifacts: DesktopMiniBackendRuntimeArtifactOption[];
  selectedManualProfile: string;
  onSelectedManualProfileChange: (profile: string) => void;
  onUseRecommendedProfile: (profile: string) => void;
  onInstallSelected: () => void;
  formatRuntimeProfileLabel: (profile: string) => string;
}

const formatArtifactSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes, unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex += 1; }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const RuntimeProfileSectionNoir = ({
  runtimeState, recommendedProfile, runtimeArtifactsAvailable, runtimeArtifactsAvailabilityLabel,
  runtimeInstallBusy, runtimeInstallInProgress, runtimeInstallMode, runtimeInstallButtonLabel,
  runtimeInstallFeedback, runtimeInstallError, manualArtifacts, selectedManualProfile,
  onSelectedManualProfileChange, onUseRecommendedProfile, onInstallSelected, formatRuntimeProfileLabel,
}: RuntimeProfileSectionProps) => {
  const showManualSelector = runtimeArtifactsAvailable && manualArtifacts.length > 0;
  const selectedManualArtifact = manualArtifacts.find((e) => e.profile === selectedManualProfile) ?? null;
  const isManualInstallActive = runtimeInstallBusy || (runtimeInstallInProgress && runtimeInstallMode === "manual");
  const recommendedSelectableProfile = resolveRecommendedSelectableProfile(
    manualArtifacts.map((a) => ({ profile: a.profile, recommended: a.recommended })),
    recommendedProfile,
  );
  const busy = runtimeInstallBusy || runtimeInstallInProgress;

  return (
    <Sec icon={<Cpu size={14} />} title="Runtime" accent="Engine Bay"
      desc="Download and install the recommended runtime artifact for this machine. The app detects the current GPU profile automatically.">
      <span aria-hidden className="v-text pointer-events-none absolute right-2 top-4 select-none font-display text-sm font-black text-paper/[0.05]">実行環境</span>

      <SpecGrid>
        <SpecRow label="Recommended profile">
          <span className={chip("gold")}>★ {formatRuntimeProfileLabel(recommendedProfile)}</span>
        </SpecRow>
        <SpecRow label="Active profile">
          <span className={chip("mint")}>
            <span className="blink">●</span> {formatRuntimeProfileLabel(runtimeState?.activeProfile ?? "cpu")}
          </span>
        </SpecRow>
        <SpecRow label="Runtime source" mono>
          {runtimeState?.source === "downloaded-runtime" ? "DOWNLOADED" : "EMBEDDED CORE"}
        </SpecRow>
        <SpecRow label="Manual install" mono>{runtimeArtifactsAvailabilityLabel}</SpecRow>
        {runtimeState?.installDir && (
          <SpecRow label="Install dir" mono>{runtimeState.installDir}</SpecRow>
        )}
        {runtimeState?.downloadCacheDir && (
          <SpecRow label="Download cache" mono>{runtimeState.downloadCacheDir}</SpecRow>
        )}
      </SpecGrid>

      {runtimeState?.statusMessage && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-paper/45">
          <span aria-hidden className="text-crimson">//</span> {runtimeState.statusMessage}
        </p>
      )}

      {runtimeState?.progress && (
        <div className="mt-3">
          <StripeBar percent={Math.max(0, Math.min(100, runtimeState.progress.percent))} />
          <p className="mt-1.5 font-mono text-[9px] text-paper/45">
            <span className="font-bold text-crimson">{Math.round(runtimeState.progress.percent)}%</span>
            {" · "}{(runtimeState.progress.transferredBytes / 1048576).toFixed(1)} MB
            {" / "}{(runtimeState.progress.totalBytes / 1048576).toFixed(1)} MB
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnGhost}
          disabled={!showManualSelector || busy}
          onClick={() => onUseRecommendedProfile(recommendedSelectableProfile)}>
          <Sparkles size={11} className="text-gold" /> Use recommended profile
        </button>
      </div>

      {showManualSelector && (
        <div className="mt-4 panel-cut-sm border border-azure/20 bg-azure/[0.03] p-4">
          <p className="kicker mb-3 !text-azure">// MANUAL ARTIFACT</p>
          <p className="mb-3 font-mono text-[10px] text-paper/45">
            Or choose a specific runtime artifact from the server and install it manually.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${selectCls} min-w-[260px] flex-1`}
              value={selectedManualProfile} disabled={busy}
              onChange={(e) => onSelectedManualProfileChange(e.target.value)}
              aria-label="Manual runtime artifact profile">
              {manualArtifacts.map((a) => (
                <option key={a.profile} value={a.profile}>
                  {`${formatRuntimeProfileLabel(a.profile)} · ${formatArtifactSize(a.size)}${a.recommended ? " · ★ recommended" : ""}${a.installed ? " · ✓ installed" : ""}`}
                </option>
              ))}
            </select>
            <button type="button" className={btnPrimary}
              disabled={!selectedManualArtifact || busy}
              onClick={() => onInstallSelected()}>
              {isManualInstallActive
                ? <span className="blink">{runtimeInstallButtonLabel}</span>
                : <><Download size={11} /> Install selected profile</>}
            </button>
          </div>
          {selectedManualArtifact && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={chip("azure")}>{formatArtifactSize(selectedManualArtifact.size)}</span>
              {selectedManualArtifact.recommended && <span className={chip("gold")}>★ recommended</span>}
              {selectedManualArtifact.installed && <span className={chip("mint")}>✓ installed</span>}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {runtimeInstallFeedback && <Alert tone="success">{runtimeInstallFeedback}</Alert>}
        {runtimeInstallError && <Alert tone="error">{runtimeInstallError}</Alert>}
      </div>

      <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.2em] text-paper/25">
        Runtime archives are downloaded to the temporary cache during transfer and removed automatically after a successful install.
      </p>
    </Sec>
  );
};

export default RuntimeProfileSectionNoir;
