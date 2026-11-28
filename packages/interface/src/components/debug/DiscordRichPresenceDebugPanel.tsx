import { useMemo, useState } from "react";
import { Activity, CheckCircle2, ChevronDown, RefreshCcw, Zap } from "lucide-react";

import { useThemeStore } from "@koma/ui/stores/theme-store";
import type { AuthUser } from "../../contexts/AuthContext";
import { useDiscordRPC } from "../../hooks/useDiscordRPC";
import { useI18n } from "../../i18n";
import type { DiscordActivityPreset } from "../../types";
import { Alert, Field, InkToggle, Sec, ToggleRow, btnGhost, btnPrimary, chip, inputCls, selectCls } from "../../pages/settings/noir/primitives";

const PRESET_ORDER: DiscordActivityPreset[] = [
  "aio_pipeline_automatic",
  "aio_pipeline_manual",
  "translator_mode",
  "typesetter_mode",
  "cleaner_redraw_mode",
  "idle",
  "workspace_idle",
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
  const { t } = useI18n();
  const noir = useThemeStore((s) => s.family === "noir");
  const discord = useDiscordRPC(user);
  const [selectedPreset, setSelectedPreset] = useState<DiscordActivityPreset>("idle");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const presetOptions = useMemo(
    () => PRESET_ORDER.map((preset) => ({ preset, asset: discord.presetAssets[preset] ?? "-" })),
    [discord.presetAssets],
  );

  const statusLabel = !discord.isAvailable
    ? t("settings.integrations.discordRpc.statusDesktopOnly")
    : discord.isConnected
      ? t("settings.integrations.discordRpc.statusConnected")
      : t("settings.integrations.discordRpc.statusDisconnected");

  const triggerPreset = async (preset: DiscordActivityPreset) => {
    setBusy(true);
    setFeedback(null);
    try {
      await discord.setPreset(preset);
      setFeedback(t("settings.integrations.discordRpc.triggeredFeedback", { preset }));
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
      setFeedback(
        t("settings.integrations.discordRpc.connectionFeedback", {
          status: connected
            ? t("settings.integrations.discordRpc.statusConnected")
            : t("settings.integrations.discordRpc.statusDisconnected"),
        }),
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to refresh Discord RPC connection");
    } finally {
      setBusy(false);
    }
  };

  if (noir) {
    return (
      <Sec
        icon={<Activity size={14} />}
        title="Discord"
        accent="Rich Presence"
        desc={t("settings.integrations.discordRpc.desc")}
        actions={
          <span className={chip(discord.isConnected ? "mint" : discord.isAvailable ? "neutral" : "gold")}>
            {discord.isConnected && <span className="blink" aria-hidden>●</span>}
            {statusLabel}
          </span>
        }
      >
        <div className="space-y-4">
          <ToggleRow
            title={t("settings.integrations.discordRpc.enableTitle")}
            desc={t("settings.integrations.discordRpc.enableDesc")}
            checked={discord.enabled}
            disabled={!discord.isAvailable || busy}
            onChange={(next) => {
              void discord.toggleRPC(next);
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className={btnGhost}
              disabled={!discord.isAvailable || busy}
              onClick={() => void refreshConnection()}
            >
              <RefreshCcw size={11} /> {t("settings.integrations.discordRpc.refresh")}
            </button>
            <button
              type="button"
              className={btnGhost}
              aria-expanded={diagnosticsOpen}
              onClick={() => setDiagnosticsOpen((prev) => !prev)}
            >
              <ChevronDown size={11} className={`transition-transform ${diagnosticsOpen ? "rotate-180" : ""}`} />
              {t("settings.integrations.discordRpc.diagnosticsToggle")}
            </button>
          </div>

          {diagnosticsOpen && (
            <div className="panel-cut-sm space-y-3 border border-paper/10 bg-ink/50 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("settings.integrations.discordRpc.preset")}>
                  <select
                    className={selectCls}
                    value={selectedPreset}
                    onChange={(event) => setSelectedPreset(event.target.value as DiscordActivityPreset)}
                  >
                    {presetOptions.map((option) => (
                      <option key={option.preset} value={option.preset}>
                        {option.preset}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("settings.integrations.discordRpc.assetKey")}>
                  <input
                    type="text"
                    className={inputCls}
                    value={discord.presetAssets[selectedPreset] ?? "-"}
                    readOnly
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-paper/8 pt-3">
                <div className="flex gap-4 font-mono text-[10px] uppercase tracking-wider text-paper/50">
                  <span>
                    {t("settings.integrations.discordRpc.enabledLabel")}:{" "}
                    <strong className="text-paper">
                      {discord.enabled ? t("settings.integrations.discordRpc.yes") : t("settings.integrations.discordRpc.no")}
                    </strong>
                  </span>
                  <span>
                    {t("settings.integrations.discordRpc.connectedLabel")}:{" "}
                    <strong className="text-paper">
                      {discord.isConnected ? t("settings.integrations.discordRpc.yes") : t("settings.integrations.discordRpc.no")}
                    </strong>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={!discord.isAvailable || !discord.enabled || busy}
                    onClick={() => void triggerPreset("idle")}
                  >
                    <CheckCircle2 size={11} /> {t("settings.integrations.discordRpc.triggerIdle")}
                  </button>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={!discord.isAvailable || !discord.enabled || busy}
                    onClick={() => void triggerPreset(selectedPreset)}
                  >
                    <Zap size={11} /> {t("settings.integrations.discordRpc.triggerPreset")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {feedback && <Alert tone="success">{feedback}</Alert>}
        </div>
      </Sec>
    );
  }

  return (
    <section className="koma-integ-card">
      <div className="koma-integ-card__head">
        <span className="koma-integ-card__icon koma-integ-card__icon--discord" aria-hidden="true">
          <Activity size={16} />
        </span>
        <div className="koma-integ-card__title-group">
          <h3 className="koma-integ-card__title">
            {t("settings.integrations.discordRpc.title")}
            <span className={`koma-integ-status${discord.isConnected ? " koma-integ-status--on" : " koma-integ-status--off"}`} />
          </h3>
          <p className="koma-integ-card__desc">{t("settings.integrations.discordRpc.desc")}</p>
        </div>
      </div>

      <div className="koma-integ-body">
        <label className="koma-ig-toggle-row">
          <div>
            <span>{t("settings.integrations.discordRpc.enableTitle")}</span>
            <p className="koma-integ-card__desc">{t("settings.integrations.discordRpc.enableDesc")}</p>
          </div>
          <InkToggle
            checked={discord.enabled}
            disabled={!discord.isAvailable || busy}
            label={t("settings.integrations.discordRpc.enableTitle")}
            onChange={(next) => {
              void discord.toggleRPC(next);
            }}
          />
        </label>

        <div className="koma-ig-footer">
          <div className="koma-ig-footer__meta" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>{statusLabel}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="koma-btn koma-btn--ghost koma-btn--sm"
              disabled={!discord.isAvailable || busy}
              onClick={() => void refreshConnection()}
            >
              <RefreshCcw size={10} /> {t("settings.integrations.discordRpc.refresh")}
            </button>
            <button
              type="button"
              className="koma-btn koma-btn--ghost koma-btn--sm"
              aria-expanded={diagnosticsOpen}
              onClick={() => setDiagnosticsOpen((prev) => !prev)}
            >
              <ChevronDown size={10} style={{ transform: diagnosticsOpen ? "rotate(180deg)" : undefined }} />
              {t("settings.integrations.discordRpc.diagnosticsToggle")}
            </button>
          </div>
        </div>

        {diagnosticsOpen && (
          <div className="koma-integ-body" style={{ paddingTop: 6 }}>
            <div className="koma-ig-grid">
              <div className="koma-ig-field">
                <label className="koma-ig-field__label">{t("settings.integrations.discordRpc.preset")}</label>
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
                <label className="koma-ig-field__label">{t("settings.integrations.discordRpc.assetKey")}</label>
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
                <span>
                  {t("settings.integrations.discordRpc.enabledLabel")}:{" "}
                  {discord.enabled ? t("settings.integrations.discordRpc.yes") : t("settings.integrations.discordRpc.no")}
                </span>
                <span>
                  {t("settings.integrations.discordRpc.connectedLabel")}:{" "}
                  {discord.isConnected ? t("settings.integrations.discordRpc.yes") : t("settings.integrations.discordRpc.no")}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="koma-btn koma-btn--ghost koma-btn--sm"
                  disabled={!discord.isAvailable || !discord.enabled || busy}
                  onClick={() => void triggerPreset("idle")}
                >
                  <CheckCircle2 size={10} /> {t("settings.integrations.discordRpc.triggerIdle")}
                </button>
                <button
                  type="button"
                  className="koma-btn koma-btn--primary koma-btn--sm"
                  disabled={!discord.isAvailable || !discord.enabled || busy}
                  onClick={() => void triggerPreset(selectedPreset)}
                >
                  <Zap size={10} /> {t("settings.integrations.discordRpc.triggerPreset")}
                </button>
              </div>
            </div>
          </div>
        )}
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
