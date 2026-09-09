import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type {
  DesktopMiniBackendRuntimeArtifactOption,
  DesktopMiniBackendRuntimeState,
} from "../../types";
import { resolveRecommendedSelectableProfile } from "./runtime-profile-selection";

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
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export const RuntimeProfileSection = ({
  runtimeState,
  recommendedProfile,
  runtimeArtifactsAvailable,
  runtimeArtifactsAvailabilityLabel,
  runtimeInstallBusy,
  runtimeInstallInProgress,
  runtimeInstallMode,
  runtimeInstallButtonLabel,
  runtimeInstallFeedback,
  runtimeInstallError,
  manualArtifacts,
  selectedManualProfile,
  onSelectedManualProfileChange,
  onUseRecommendedProfile,
  onInstallSelected,
  formatRuntimeProfileLabel,
}: RuntimeProfileSectionProps) => {
  const showManualSelector = runtimeArtifactsAvailable && manualArtifacts.length > 0;
  const selectedManualArtifact = manualArtifacts.find((entry) => entry.profile === selectedManualProfile) ?? null;
  const isManualInstallActive = runtimeInstallBusy || (runtimeInstallInProgress && runtimeInstallMode === "manual");
  const recommendedSelectableProfile = resolveRecommendedSelectableProfile(
    manualArtifacts.map((artifact) => ({
      profile: artifact.profile,
      recommended: artifact.recommended,
    })),
    recommendedProfile,
  );

  return (
    <section className="koma-stg-section">
      <div className="koma-stg-section__head">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
          <path d="M10 3a1 1 0 011 1v1.18a5.5 5.5 0 012.1.87l.83-.83a1 1 0 111.41 1.42l-.82.82A5.5 5.5 0 0115.82 10H17a1 1 0 110 2h-1.18a5.5 5.5 0 01-.87 2.1l.82.83a1 1 0 01-1.41 1.41l-.83-.82A5.5 5.5 0 0111 16.82V18a1 1 0 11-2 0v-1.18a5.5 5.5 0 01-2.1-.87l-.83.82a1 1 0 11-1.41-1.41l.82-.83A5.5 5.5 0 014.18 12H3a1 1 0 110-2h1.18a5.5 5.5 0 01.87-2.1l-.82-.82a1 1 0 111.41-1.42l.83.83A5.5 5.5 0 019 5.18V4a1 1 0 011-1zm0 4a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
        <h3 className="koma-stg-section__title">Runtime profile</h3>
      </div>
      <p className="koma-stg-section__desc">
        Download and install the recommended runtime artifact for this machine. The app detects the current GPU profile automatically.
      </p>

      <div className="koma-stg-grid">
        <div className="koma-stg-item">
          <span className="koma-stg-item__label">Recommended profile</span>
          <span className="koma-stg-item__value">{formatRuntimeProfileLabel(recommendedProfile)}</span>
        </div>
        <div className="koma-stg-item">
          <span className="koma-stg-item__label">Active profile</span>
          <span className="koma-stg-item__value">{formatRuntimeProfileLabel(runtimeState?.activeProfile ?? "cpu")}</span>
        </div>
        <div className="koma-stg-item">
          <span className="koma-stg-item__label">Runtime source</span>
          <span className="koma-stg-item__value">{runtimeState?.source === "downloaded-runtime" ? "Downloaded runtime" : "Embedded core"}</span>
        </div>
        <div className="koma-stg-item">
          <span className="koma-stg-item__label">Manual install availability</span>
          <span className="koma-stg-item__value">{runtimeArtifactsAvailabilityLabel}</span>
        </div>
        {runtimeState?.installDir && (
          <div className="koma-stg-item">
            <span className="koma-stg-item__label">Installed runtime directory</span>
            <span className="koma-stg-item__value">{runtimeState.installDir}</span>
          </div>
        )}
        {runtimeState?.downloadCacheDir && (
          <div className="koma-stg-item">
            <span className="koma-stg-item__label">Download cache</span>
            <span className="koma-stg-item__value">{runtimeState.downloadCacheDir}</span>
          </div>
        )}
      </div>

      {runtimeState?.statusMessage && (
        <p className="koma-stg-section__desc" style={{ marginTop: 12 }}>
          {runtimeState.statusMessage}
        </p>
      )}

      {runtimeState?.progress && (
        <div style={{ marginTop: 14 }}>
          <div className="koma-progress-bar">
            <div className="koma-progress-bar__fill" style={{ width: `${Math.max(0, Math.min(100, runtimeState.progress.percent))}%` }} />
          </div>
          <p className="koma-stg-section__desc" style={{ marginTop: 8 }}>
            {`${Math.round(runtimeState.progress.percent)}% · ${(runtimeState.progress.transferredBytes / (1024 * 1024)).toFixed(1)} MB / ${(runtimeState.progress.totalBytes / (1024 * 1024)).toFixed(1)} MB`}
          </p>
        </div>
      )}

      <div className="koma-stg-actions koma-stg-actions--row" style={{ marginTop: 18 }}>
        <button
          type="button"
          disabled={!showManualSelector || runtimeInstallBusy || runtimeInstallInProgress}
          onClick={() => onUseRecommendedProfile(recommendedSelectableProfile)}
          className="koma-btn koma-btn--ghost koma-btn--sm koma-runtime-profile__select-btn"
        >
          Use recommended profile
        </button>
      </div>

      {showManualSelector && (
        <>
          <p className="koma-stg-section__desc" style={{ marginTop: 16 }}>
            Or choose a specific runtime artifact from the server and install it manually.
          </p>
          <div className="koma-stg-actions koma-stg-actions--row" style={{ marginTop: 12, alignItems: "center", gap: 10 }}>
            <select
              className="koma-pf__select"
              value={selectedManualProfile}
              disabled={runtimeInstallBusy || runtimeInstallInProgress}
              onChange={(event) => onSelectedManualProfileChange(event.target.value)}
              aria-label="Manual runtime artifact profile"
              style={{ minWidth: 280 }}
            >
              {manualArtifacts.map((artifact) => (
                <option key={artifact.profile} value={artifact.profile}>
                  {`${formatRuntimeProfileLabel(artifact.profile)} · ${formatArtifactSize(artifact.size)}${artifact.recommended ? " · recommended" : ""}${artifact.installed ? " · installed" : ""}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedManualArtifact || runtimeInstallBusy || runtimeInstallInProgress}
              onClick={() => onInstallSelected()}
              className="koma-btn koma-btn--primary koma-btn--sm"
            >
              {isManualInstallActive ? (
                <><span className="auth-spinner" /> {runtimeInstallButtonLabel}</>
              ) : (
                "Install selected profile"
              )}
            </button>
          </div>
        </>
      )}

      {runtimeInstallFeedback && (
        <div className="koma-stg-alert koma-stg-alert--success" role="status">
          <CheckCircle2 size={11} />
          <span>{runtimeInstallFeedback}</span>
        </div>
      )}
      {runtimeInstallError && (
        <div className="koma-stg-alert koma-stg-alert--error" role="alert">
          <AlertTriangle size={11} />
          <span>{runtimeInstallError}</span>
        </div>
      )}
      <p className="koma-stg-section__desc" style={{ marginTop: 10 }}>
        Runtime archives are downloaded to the temporary cache during transfer and removed automatically after a successful install.
      </p>
    </section>
  );
};

export default RuntimeProfileSection;
