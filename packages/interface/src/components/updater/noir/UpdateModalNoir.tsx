import { AnimatePresence, motion } from "framer-motion";
import { RefreshCcw, X, Download, CheckCheck, FileText, Zap } from "lucide-react";
import type { UpdaterProgress, UpdaterStatus } from "../../../types";
import ReleaseNotesMarkdownClassic from '../ReleaseNotesMarkdownClassic';
import { useI18n } from "../../../i18n";
import { EASE, StripeBar, btnPrimary, btnMint, btnGhost } from "../../system/v2/kit";

type UpdateTranslationFn = ReturnType<typeof useI18n>["t"];

interface UpdateModalProps {
  open: boolean;
  status: UpdaterStatus;
  currentVersion: string;
  newVersion: string | null;
  mandatory: boolean;
  releaseNotes: string | null;
  progress: UpdaterProgress;
  autoInstallOnQuit: boolean;
  onClose: () => void;
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
  onInstallLater: () => Promise<void>;
  onPostpone: () => Promise<void>;
}

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
const formatSpeed = (t: UpdateTranslationFn, bps: number): string =>
  `${formatBytes(t, Math.max(0, bps))}${t("update.units.perSecond")}`;

export const UpdateModalNoir = ({
  open, status, currentVersion, newVersion, mandatory, releaseNotes,
  progress, autoInstallOnQuit, onClose, onDownload, onInstall, onInstallLater, onPostpone,
}: UpdateModalProps) => {
  const { t } = useI18n();

  const isDownloading = status === "downloading";
  const isDownloaded = status === "downloaded";
  const isAvailable = status === "available";
  const showProgress = isDownloading || isDownloaded;
  const progressPercent = Math.max(0, Math.min(100, isDownloaded ? 100 : Number(progress.percent || 0)));
  const transferredBytes = isDownloaded
    ? Math.max(progress.transferred || 0, progress.total || 0)
    : progress.transferred || 0;
  const rawTotal = Math.max(progress.total || 0, transferredBytes);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={mandatory ? undefined : onClose}
        >
          <motion.div
            role="dialog" aria-modal="true"
            className="glass panel-cut halftone relative w-full max-w-lg p-6"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.4, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <span aria-hidden className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" />
            <span aria-hidden className="v-text pointer-events-none absolute right-2 top-6 select-none font-display text-base font-black tracking-widest text-paper/[0.06]">
              アップデート
            </span>

            {/* Header */}
            <div className="flex items-start gap-3.5 pr-6">
              <motion.span aria-hidden
                initial={{ rotate: -8, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.12 }}
                className="panel-cut-sm flex h-11 w-11 shrink-0 items-center justify-center border-2 border-crimson bg-crimson/10 text-crimson">
                <RefreshCcw size={17} strokeWidth={2.5} />
              </motion.span>
              <div className="min-w-0">
                <p className="kicker">// PATCH INBOUND</p>
                <h2 className="font-display text-lg font-black uppercase tracking-tight text-paper">
                  {t("update.modal.title")}
                </h2>
                {/* Version stamps: v atual ▸ v nova */}
                <p className="mt-1.5 flex items-center gap-2 font-mono text-[10px]">
                  <span className="border border-paper/20 px-2 py-0.5 text-paper/50">
                    {t("update.versionPrefix", { version: currentVersion })}
                  </span>
                  <span aria-hidden className="text-crimson">▸▸</span>
                  <span className="stamp !text-[10px]">
                    {newVersion ? t("update.versionPrefix", { version: newVersion }) : t("update.modal.unknownVersion")}
                  </span>
                </p>
              </div>
            </div>

            {!mandatory && (
              <button type="button" onClick={onClose} aria-label={t("update.modal.closeAria")}
                className="panel-cut-sm absolute right-4 top-4 border border-paper/15 p-1.5 text-paper/45 transition-colors hover:border-crimson/50 hover:text-crimson">
                <X size={12} />
              </button>
            )}

            {mandatory && (
              <div role="alert" className="mt-4 border-l-2 border-gold bg-gold/8 px-3 py-2 font-mono text-[11px] text-gold">
                <span className="blink">●</span> {t("update.modal.mandatory")}
              </div>
            )}

            {/* Release Notes */}
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">
                <FileText size={10} className="text-crimson" /> {t("update.modal.releaseNotes")}
              </p>
              <div className="panel-cut-sm max-h-48 overflow-y-auto border border-paper/8 bg-ink/60 p-3.5">
                {releaseNotes ? (
                  <ReleaseNotesMarkdownClassic markdown={releaseNotes} />
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-wider text-paper/30">
                    {t("update.modal.releaseNotesEmpty")}
                  </p>
                )}
              </div>
            </div>

            {/* Progress */}
            {showProgress && (
              <div className="mt-4">
                <div className="mb-1.5 flex items-baseline justify-between font-mono text-[10px]">
                  <span className={`font-bold uppercase tracking-wider ${isDownloaded ? "text-mint" : "text-crimson"}`}>
                    {isDownloaded ? `✓ ${t("update.modal.readyProgress")}` : <><span className="blink">▼</span> {t("update.modal.downloadingProgress")}</>}
                  </span>
                  <span className="font-bold text-gold">{progressPercent.toFixed(1)}%</span>
                </div>
                <StripeBar percent={progressPercent} done={isDownloaded} />
                <div className="mt-1.5 flex justify-between font-mono text-[9px] text-paper/45">
                  <span>{formatBytes(t, transferredBytes)} / {formatBytes(t, rawTotal)}</span>
                  <span className="inline-flex items-center gap-1">
                    {isDownloading
                      ? <><Zap size={9} className="text-gold" fill="currentColor" /> {formatSpeed(t, progress.speed || 0)}</>
                      : t("update.modal.readyToInstall")}
                  </span>
                </div>
                {isDownloaded && (
                  <p className={`mt-2 border-l-2 px-2.5 py-1.5 font-mono text-[10px] ${
                    autoInstallOnQuit ? "border-mint/50 bg-mint/5 text-mint" : "border-gold/50 bg-gold/5 text-gold"
                  }`}>
                    {autoInstallOnQuit ? t("update.modal.installHintAuto") : t("update.modal.installHintManual")}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-paper/8 pt-4">
              {isAvailable && (
                <button type="button" onClick={() => void onDownload()} className={`${btnPrimary} flex-1`}>
                  <Download size={12} /> {t("update.modal.downloadAction")}
                </button>
              )}
              {isDownloading && (
                <button type="button" disabled className={`${btnPrimary} flex-1 !opacity-60`}>
                  <span className="blink">▼</span> {t("update.modal.downloadingAction")}
                </button>
              )}
              {isDownloaded && (
                <>
                  <button type="button" onClick={() => void onInstall()} className={`${btnMint} flex-1`}>
                    <CheckCheck size={13} /> {t("update.modal.installAction")}
                  </button>
                  <button type="button" onClick={() => void onInstallLater()} className={btnGhost}>
                    {t("update.modal.installLaterAction")}
                  </button>
                </>
              )}
              {!isDownloaded && !mandatory && (
                <button type="button" className={btnGhost}
                  onClick={() => { void onPostpone(); onClose(); }}>
                  {t("update.modal.laterAction")}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateModalNoir;
