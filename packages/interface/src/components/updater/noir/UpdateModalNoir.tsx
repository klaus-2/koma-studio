import { m, AnimatePresence } from "framer-motion";
import { RefreshCcw, X, FileText } from "lucide-react";
import { useI18n } from "../../../i18n";
import { formatBytesI18n } from "../../../utils/formatBytes";
import { EASE, btnGhost, btnPrimary } from "../../system/v2/kit";
import { describeUpdaterAction } from "../update-action";
import SyncPanelNoir from "./SyncPanelNoir";
import { LazyReleaseNotesMarkdown } from "../LazyReleaseNotesMarkdown";
import type { UseUpdaterApi } from "../../../hooks/useUpdater";

interface UpdateModalProps {
  open: boolean;
  currentVersion: string | null;
  newVersion: string | null;
  releaseNotes: string | null;
  onClose: () => void;
  updater: UseUpdaterApi;
}

// Noir variant — changelog + in-app installer update (release-page fallback).
export const UpdateModalNoir = ({
  open, currentVersion, newVersion, releaseNotes, onClose, updater,
}: UpdateModalProps) => {
  const { t } = useI18n();

  const formatBytes = (value: number): string => formatBytesI18n(value, t);
  const action = describeUpdaterAction(updater);

  const renderUpdateAction = () => {
    switch (action.kind) {
      case "download-progress":
        return (
          <div className="koma-modal__progress" role="status">
            <div className="koma-modal__progress-head">
              <span className="koma-modal__progress-title">
                {t("update.modal.downloading", { percent: Math.round(action.percent) })}
              </span>
              <span className="koma-modal__progress-percent">{Math.round(action.percent)}%</span>
            </div>
            <div className="koma-progress-bar" aria-hidden="true">
              <div
                className="koma-progress-bar__fill"
                style={{ width: `${action.percent}%` }}
              />
            </div>
            <p className="koma-modal__progress-meta">
              <span>{formatBytes(action.transferred)}</span>
              <span>{formatBytes(action.total)}</span>
            </p>
          </div>
        );
      case "update-now":
        return (
          <button type="button" onClick={() => void updater.downloadUpdate()} className={btnPrimary}>
            {t("update.modal.updateNow")}
          </button>
        );
      case "restart-install":
        return (
          <button type="button" onClick={() => void updater.installUpdate()} className={btnPrimary}>
            {t("update.modal.restartToUpdate")}
          </button>
        );
      case "update-error":
        return (
          <>
            <p className="w-full font-mono text-[10px] text-paper/50" role="alert">
              {action.message ?? t("update.modal.retryUpdate")}
            </p>
            <button type="button" onClick={() => void updater.downloadUpdate()} className={btnPrimary}>
              {t("update.modal.retryUpdate")}
            </button>
            <button type="button" onClick={() => void updater.openReleasePage()} className={btnGhost}>
              {t("update.modal.openReleasePage")}
            </button>
          </>
        );
      case "release-page":
        return (
          <button type="button" onClick={() => void updater.openReleasePage()} className={btnGhost}>
            {t("update.modal.openReleasePage")}
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-ink/85 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <m.div
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
              <m.span aria-hidden
                initial={{ rotate: -8, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.12 }}
                className="panel-cut-sm flex h-11 w-11 shrink-0 items-center justify-center border-2 border-crimson bg-crimson/10 text-crimson">
                <RefreshCcw size={17} strokeWidth={2.5} />
              </m.span>
              <div className="min-w-0">
                <p className="kicker">// PATCH INBOUND</p>
                <h2 className="font-display text-lg font-black uppercase tracking-tight text-paper">
                  {t("update.modal.title")}
                </h2>
                {/* Version stamps: v atual ▸ v nova */}
                <p className="mt-1.5 flex items-center gap-2 font-mono text-[10px]">
                  <span className="border border-paper/20 px-2 py-0.5 text-paper/50">
                    {currentVersion
                      ? t("update.versionPrefix", { version: currentVersion })
                      : t("update.modal.unknownVersion")}
                  </span>
                  <span aria-hidden className="text-crimson">▸▸</span>
                  <span className="stamp !text-[10px]">
                    {newVersion ? t("update.versionPrefix", { version: newVersion }) : t("update.modal.unknownVersion")}
                  </span>
                </p>
              </div>
            </div>

            <button type="button" onClick={onClose} aria-label={t("update.modal.closeAria")}
              className="panel-cut-sm absolute right-4 top-4 border border-paper/15 p-1.5 text-paper/45 transition-colors hover:border-crimson/50 hover:text-crimson">
              <X size={12} />
            </button>

            {/* Release Notes */}
            <div className="mt-4">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.24em] text-paper/40">
                <FileText size={10} className="text-crimson" /> {t("update.modal.releaseNotes")}
              </p>
              <div className="panel-cut-sm max-h-48 overflow-y-auto border border-paper/8 bg-ink/60 p-3.5">
                {releaseNotes ? (
                  <LazyReleaseNotesMarkdown markdown={releaseNotes} />
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-wider text-paper/30">
                    {t("update.modal.releaseNotesEmpty")}
                  </p>
                )}
              </div>
            </div>

            {/* Sync control panel */}
            <SyncPanelNoir />

            {/* Actions */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-paper/8 pt-4">
              {renderUpdateAction()}
              <button type="button" onClick={onClose} className={btnGhost}>
                {t("update.modal.laterAction")}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateModalNoir;
