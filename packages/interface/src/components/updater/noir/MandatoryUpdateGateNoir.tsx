import { motion } from "framer-motion";
import { ShieldAlert, Download, CheckCheck, Zap } from "lucide-react";
import ReleaseNotesMarkdownClassic from "../ReleaseNotesMarkdownClassic";
import { useUpdater } from "../../../hooks/useUpdater";
import { useI18n } from "../../../i18n";
import { EASE, StripeBar, btnPrimary, btnMint, btnGhost } from "../../system/v2/kit";

type UpdateTranslationFn = ReturnType<typeof useI18n>["t"];

const formatBytes = (t: UpdateTranslationFn, value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return `0 ${t("update.units.bytes")}`;
  const units = [t("update.units.bytes"), t("update.units.kilobytes"), t("update.units.megabytes"), t("update.units.gigabytes")];
  let size = value, unit = units[0];
  for (let i = 0; i < units.length; i += 1) {
    unit = units[i];
    if (size < 1024 || i === units.length - 1) break;
    size /= 1024;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
};

export const MandatoryUpdateGateNoir = () => {
  const { t } = useI18n();
  const updater = useUpdater();

  const isAvailable = updater.status === "available";
  const isDownloading = updater.status === "downloading";
  const isDownloaded = updater.status === "downloaded";
  const progressPercent = isDownloaded ? 100 : Math.max(0, Math.min(100, Number(updater.progress.percent || 0)));

  return (
    <div className="halftone fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-ink p-4 text-paper">
      {/* Decor */}
      <span aria-hidden className="text-outline pointer-events-none fixed left-1/2 top-8 -translate-x-1/2 select-none font-display text-[18vw] font-black leading-none opacity-60">
        UPDATE
      </span>
      <span aria-hidden className="v-text pointer-events-none fixed right-6 top-1/2 hidden -translate-y-1/2 select-none font-display text-2xl font-black tracking-[0.3em] text-crimson/10 sm:block">
        強制更新プロトコル
      </span>
      <span aria-hidden className="fixed left-0 top-0 h-[3px] w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="glass panel-cut relative w-full max-w-xl border border-crimson/25 p-7"
      >
        <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-crimson" />

        <div className="flex items-start gap-4">
          <motion.span aria-hidden
            initial={{ rotate: -10, scale: 0.7 }} animate={{ rotate: -2, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.15 }}
            className="panel-cut-sm flex h-12 w-12 shrink-0 items-center justify-center border-2 border-crimson bg-crimson/10 text-crimson">
            <ShieldAlert size={20} strokeWidth={2.5} />
          </motion.span>
          <div>
            <span className="stamp"><span className="blink">●</span> {t("login.warning.mandatoryUpdateTitle")}</span>
            <h1 className="mt-2 font-display text-2xl font-black uppercase leading-tight tracking-tight text-paper">
              {t("update.modal.mandatory")}
            </h1>
            <p className="mt-1.5 max-w-prose font-mono text-[11px] text-paper/55">
              {t("login.warning.mandatoryUpdateBody", {
                version: updater.newVersion
                  ? t("login.warning.versionPrefix", { version: updater.newVersion })
                  : t("login.warning.latestVersion"),
              })}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 font-mono text-[11px]">
          <span className="border border-paper/20 px-2.5 py-1 text-paper/50">
            {t("update.versionPrefix", { version: updater.currentVersion })}
          </span>
          <span aria-hidden className="text-crimson">▸▸▸</span>
          <span className="stamp !text-[11px]">
            {updater.newVersion
              ? t("update.versionPrefix", { version: updater.newVersion })
              : t("update.modal.unknownVersion")}
          </span>
        </div>

        {(isDownloading || isDownloaded) && (
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between font-mono text-[10px]">
              <span className={isDownloaded ? "text-mint" : "text-crimson"}>
                {isDownloaded ? `✓ ${t("update.modal.readyProgress")}` : <><span className="blink">▼</span> {t("update.modal.downloadingProgress")}</>}
              </span>
              <strong className="text-gold">{progressPercent.toFixed(0)}%</strong>
            </div>
            <StripeBar percent={progressPercent} done={isDownloaded} />
            <div className="mt-1.5 flex justify-between font-mono text-[9px] text-paper/45">
              <span>{formatBytes(t, updater.progress.transferred)} / {formatBytes(t, updater.progress.total)}</span>
              {isDownloading
                ? <span className="inline-flex items-center gap-1"><Zap size={9} className="text-gold" fill="currentColor" />{formatBytes(t, updater.progress.speed)}{t("update.units.perSecond")}</span>
                : <span>{t("update.modal.readyToInstall")}</span>}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {isAvailable && (
            <button type="button" className={`${btnPrimary} flex-1`} onClick={() => void updater.downloadUpdate()}>
              <Download size={12} /> {t("update.modal.downloadAction")}
            </button>
          )}
          {isDownloading && (
            <button type="button" className={`${btnPrimary} flex-1 !opacity-60`} disabled>
              <span className="blink">▼</span> {t("update.modal.downloadingAction")}
            </button>
          )}
          {isDownloaded && (
            <>
              <button type="button" className={`${btnMint} flex-1`} onClick={() => void updater.installUpdate()}>
                <CheckCheck size={13} /> {t("update.modal.installAction")}
              </button>
              <button type="button" className={btnGhost} onClick={() => void updater.setAutoInstall(true)}>
                {t("update.modal.installLaterAction")}
              </button>
            </>
          )}
        </div>

        {updater.releaseNotes && (
          <div className="mt-5">
            <p className="kicker mb-2">// {t("update.modal.releaseNotes")}</p>
            <div className="panel-cut-sm max-h-44 overflow-y-auto border border-paper/8 bg-ink/60 p-3.5">
              <ReleaseNotesMarkdownClassic markdown={updater.releaseNotes} />
            </div>
          </div>
        )}

        {updater.error && (
          <div role="alert" className="mt-4 border-l-2 border-crimson bg-crimson/8 px-3 py-2 font-mono text-[11px] text-crimson">
            ✕ {updater.error}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default MandatoryUpdateGateNoir;
