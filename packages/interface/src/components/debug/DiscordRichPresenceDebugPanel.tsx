import { useMemo, useState } from "react";
import { Activity, CheckCircle2, RefreshCcw, Zap } from "lucide-react";

import type { AuthUser } from "../../contexts/AuthContext";
import { useDiscordRPC } from "../../hooks/useDiscordRPC";

import type { DiscordActivityPreset } from "../../types";

const PRESET_ORDER: DiscordActivityPreset[] = [
  "aio_pipeline_automatic",
  "aio_pipeline_manual",
  "translator_mode",
  "typesetter_mode",
  "cleaner_redraw_mode",
  "idle",
  "workspace_organize_mode",
  "raw_provider_mode",
  "proofreader_qc_mode",
  "stitcher_mode",
  "splitter_mode",
  "watermark_mode",
  "enhance_mode",
  "chapter_optimizer_mode",
  "blogger_cdn_mode",
  "image_upload_mode",
  "guides_tutorials",
  "resources_materials",
  "settings",
  "rankings",
  "scanlation_feed",
  "login_register",
  "batch_mode",
];

interface DiscordRichPresenceDebugPanelProps {
  user: AuthUser | null;
}

export default function DiscordRichPresenceDebugPanel({
  user,
}: DiscordRichPresenceDebugPanelProps) {
  const discord = useDiscordRPC(user);
  const [selectedPreset, setSelectedPreset] = useState<DiscordActivityPreset>(
    "idle",
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const presetOptions = useMemo(
    () => PRESET_ORDER.map((preset) => ({ preset, asset: discord.presetAssets[preset] ?? "-" })),
    [discord.presetAssets],
  );

  const triggerPreset = async (preset: DiscordActivityPreset) => {
    setBusy(true);
    setFeedback(null);
    try {
      await discord.setPreset(preset);
      setFeedback(`Triggered preset: ${preset}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : `Failed to trigger ${preset}`);
    } finally {
      setBusy(false);
    }
  };

  const refreshConnection = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const connected = await discord.refreshConnection();
      setFeedback(`Discord RPC connection: ${connected ? "connected" : "disconnected"}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to refresh Discord RPC connection");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="koma-integ-card">
      <div className="koma-integ-card__head">
        <span className="koma-integ-card__icon koma-integ-card__icon--discord" aria-hidden="true">
          <Activity size={16} />
        </span>
        <div className="koma-integ-card__title-group">
          <h3 className="koma-integ-card__title">
            Discord Rich Presence Debug
            <span className={`koma-integ-status${discord.isConnected ? " koma-integ-status--on" : " koma-integ-status--off"}`} />
          </h3>
          <p className="koma-integ-card__desc">
            Trigger presets manually and inspect which asset key is mapped to each Rich Presence state.
          </p>
        </div>
      </div>

      <div className="koma-integ-body">
        <div className="koma-ig-grid">
          <div className="koma-ig-field">
            <label className="koma-ig-field__label">Preset</label>
            <select
              className="koma-ig-field__select"
              value={selectedPreset}
              onChange={(event) => setSelectedPreset(event.target.value as DiscordActivityPreset)}
            >
              {presetOptions.map((option) => (
                <option key={option.preset} value={option.preset}>
                  {option.preset}
                </option>
              ))}
            </select>
          </div>
          <div className="koma-ig-field">
            <label className="koma-ig-field__label">Asset key</label>
            <input
              type="text"
              className="koma-ig-field__input"
              value={discord.presetAssets[selectedPreset] ?? "-"}
              readOnly
            />
          </div>
        </div>

        <div className="koma-ig-footer">
          <div className="koma-ig-footer__meta" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>Enabled: {discord.enabled ? "yes" : "no"}</span>
            <span>Connected: {discord.isConnected ? "yes" : "no"}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" disabled={busy} onClick={() => void refreshConnection()}>
              <RefreshCcw size={10} /> Refresh
            </button>
            <button type="button" className="koma-btn koma-btn--ghost koma-btn--sm" disabled={busy} onClick={() => void triggerPreset("idle")}>
              <CheckCircle2 size={10} /> Trigger Idle
            </button>
            <button type="button" className="koma-btn koma-btn--primary koma-btn--sm" disabled={busy} onClick={() => void triggerPreset(selectedPreset)}>
              <Zap size={10} /> Trigger Preset
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="koma-ig-alert koma-ig-alert--success" role="status">
          <CheckCircle2 size={12} className="koma-ig-alert__icon" />
          <span>{feedback}</span>
        </div>
      )}
    </section>
  );
}
