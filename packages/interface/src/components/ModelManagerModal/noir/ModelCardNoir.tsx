import { m } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Download, RefreshCcw,
  Trash2, XCircle, Zap, Star,
} from "lucide-react";
import { useI18n } from "../../../i18n";
import type { ModelInstallState } from "../../../models/types";
import {
  isDownloadOnlyModel,
  modelStageLabel,
} from "../../../models/translation-models-registry";
import { ModelInfoTooltipNoir } from "./ModelInfoTooltipNoir";
import { ModelProgressBarNoir } from "./ModelProgressBarNoir";

const EASE = [0.22, 1, 0.36, 1] as const;

const SPEED_LABEL_KEY: Record<string, string> = {
  fast: "modelManager.tooltip.speed.fast",
  ok: "modelManager.tooltip.speed.ok",
  good: "modelManager.tooltip.speed.good",
  excellent: "modelManager.tooltip.speed.excellent",
};

const Stamp = ({ tone, title, children }: { tone: "mint" | "gold" | "crimson" | "azure" | "neutral"; title?: string; children: React.ReactNode }) => {
  const tones = {
    mint: "border-mint/50 bg-mint/10 text-mint",
    gold: "border-gold/50 bg-gold/10 text-gold",
    crimson: "border-crimson/50 bg-crimson/10 text-crimson",
    azure: "border-azure/50 bg-azure/10 text-azure",
    neutral: "border-paper/20 bg-paper/5 text-paper/50",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${tones[tone]}`}>
      {children}
    </span>
  );
};

interface ModelCardProps {
  entry: ModelInstallState;
  focused?: boolean;
  selected?: boolean;
  selectable?: boolean;
  onInstall: (modelId: string) => Promise<void>;
  onUpdate: (modelId: string) => Promise<void>;
  onUninstall: (modelId: string) => Promise<void>;
  onRetry: (modelId: string) => Promise<void>;
  onCancel: (modelId: string) => Promise<void>;
  onSelect?: (modelId: string) => void;
}

export const ModelCardNoir = ({
  entry, focused = false, selected = false, selectable = true,
  onInstall, onUpdate, onUninstall, onRetry, onCancel, onSelect,
}: ModelCardProps) => {
  const { t } = useI18n();
  const { model } = entry;

  const isActive =
    entry.status === "downloading" || entry.status === "queued" || entry.status === "verifying";

  /* ── Status stamp ─────────────────────────────── */
  const statusStamp = (() => {
    if (selected && (entry.status === "installed" || entry.status === "update_available"))
      return <Stamp tone="crimson"><CheckCircle2 size={10} /> {t("modelCard.status.selected")}</Stamp>;
    if (entry.status === "installed")
      return <Stamp tone="mint">v{entry.installedVersion ?? model.version}</Stamp>;
    if (entry.status === "update_available")
      return <Stamp tone="gold"><AlertTriangle size={10} /> v{model.version}</Stamp>;
    if (entry.status === "failed")
      return <Stamp tone="crimson"><XCircle size={10} /> {t("modelCard.status.failed")}</Stamp>;
    if (entry.status === "verifying")
      return <Stamp tone="azure"><span className="blink">●</span> {t("modelCard.status.verifying")}</Stamp>;
    if (entry.status === "queued")
      return <Stamp tone="azure">{t("modelCard.status.queued")}</Stamp>;
    if (entry.status === "downloading")
      return <Stamp tone="crimson"><span className="blink">●</span> {t("modelCard.status.downloading")}</Stamp>;
    if (entry.status === "cancelled")
      return <Stamp tone="neutral">{t("modelCard.status.cancelled")}</Stamp>;
    if (entry.status === "incomplete")
      return <Stamp tone="crimson">{t("modelCard.status.incomplete")}</Stamp>;
    return <Stamp tone="neutral">{t("modelCard.status.notInstalled")}</Stamp>;
  })();

  /* ── Primary action ───────────────────────────── */
  const btnBase =
    "panel-cut-sm hard-hover inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-crimson disabled:cursor-not-allowed disabled:opacity-40";
  const btnPrimary = `${btnBase} bg-crimson text-ink`;
  const btnGhost = `${btnBase} border border-paper/20 bg-transparent text-paper/70 hover:text-paper`;
  const btnWarn = `${btnBase} border border-gold/50 bg-gold/10 text-gold`;

  const actionButton = (() => {
    if (isActive)
      return <button type="button" className={btnWarn} onClick={() => void onCancel(model.id)}>{t("modelCard.action.cancel")}</button>;
    if (entry.status === "installed")
      return <button type="button" className={btnGhost} onClick={() => void onUninstall(model.id)}><Trash2 size={11} /> {t("modelCard.action.remove")}</button>;
    if (entry.status === "update_available")
      return <button type="button" className={btnPrimary} onClick={() => void onUpdate(model.id)}><RefreshCcw size={11} /> {t("modelCard.action.update")}</button>;
    if (entry.status === "failed" || entry.status === "cancelled")
      return <button type="button" className={btnPrimary} onClick={() => void onRetry(model.id)}><RefreshCcw size={11} /> {t("modelCard.action.retry")}</button>;
    return <button type="button" className={btnPrimary} onClick={() => void onInstall(model.id)}><Download size={11} /> {t("modelCard.action.install")}</button>;
  })();

  const canSelect =
    selectable &&
    (entry.status === "installed" || entry.status === "update_available");

  return (
    <m.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      style={{ "--card-shadow": "rgba(62,242,176,0.85)" } as React.CSSProperties}
      className={`panel-cut-sm group relative flex flex-col gap-3 border p-4 transition-[transform,filter,border-color] duration-200 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:[filter:drop-shadow(6px_6px_0_var(--card-shadow))] ${selected || focused ? "border-crimson/60 bg-ink-3" : "border-paper/10 bg-ink-2"
        }`}
    >
      {/* Selected ink bar */}
      {selected && <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-crimson" />}

      {/* Header */}
      <header className="flex items-start justify-between gap-2 pr-3">
        <div className="min-w-0">
          <h4 className="flex flex-wrap items-center gap-2 font-display text-sm font-extrabold uppercase tracking-tight text-paper">
            {model.name}
            {model.recommended && (
              <span className="stamp inline-flex items-center gap-1 !border-gold/60 !bg-gold/10 !text-gold">
                <Star size={8} fill="currentColor" /> {t("modelCard.recommended")}
              </span>
            )}
          </h4>
          {isDownloadOnlyModel(model) && (
            <div className="mt-2">
              <Stamp tone="azure" title={t("modelCard.badge.downloadOnly")}>
                {t("modelCard.badge.downloadOnly")}
              </Stamp>
            </div>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-paper/45">
            <span>{modelStageLabel(model.stage)}</span>
            <span aria-hidden className="text-crimson/60">/</span>
            <span>{model.requirements.gpu ? t("modelCard.hardware.gpu") : t("modelCard.hardware.cpu")}</span>
            <span aria-hidden className="text-crimson/60">/</span>
            <span>{model.fileSize}</span>
            <span className="inline-flex items-center gap-0.5 text-mint">
              <Zap size={9} fill="currentColor" />
              {t((SPEED_LABEL_KEY[model.speed] ?? "modelManager.tooltip.speed.ok") as Parameters<typeof t>[0])}
            </span>
          </p>
        </div>
      </header>

      <p className="line-clamp-2 text-xs leading-relaxed text-paper/55">
        {t((model.description ?? "") as Parameters<typeof t>[0])}
      </p>

      {entry.progress && isActive && (
        <ModelProgressBarNoir progress={entry.progress} onCancel={() => void onCancel(model.id)} />
      )}

      {/* Footer */}
      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-paper/8 pt-3">
        <div>{statusStamp}</div>
        <div className="flex items-center gap-1.5">
          {canSelect && (
            <button type="button" disabled={selected} onClick={() => onSelect?.(model.id)} className={btnGhost}>
              {selected
                ? <><CheckCircle2 size={11} /> {t("modelCard.action.active")}</>
                : t("modelCard.action.use")}
            </button>
          )}
          {actionButton}
          <ModelInfoTooltipNoir model={model} />
        </div>
      </footer>

      {entry.error && (
        <p className="border-l-2 border-crimson bg-crimson/5 px-2 py-1 font-mono text-[10px] text-crimson">
          {entry.error ? t(entry.error as Parameters<typeof t>[0]) : null}
        </p>
      )}
    </m.article>
  );
};

export default ModelCardNoir;
