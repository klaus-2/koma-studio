import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "../../../i18n";
import { formatBytes } from "../../../models/model-storage";
import type { DiskSpaceInfo } from "../../../models/types";

const EASE = [0.22, 1, 0.36, 1] as const;

interface InstallAllConfirmationProps {
  open: boolean;
  totalBytes: number;
  diskSpace: DiskSpaceInfo | null;
  onCancel: () => void;
  onConfirm: () => void;
  blockedReason?: string | null;
}

export const InstallAllConfirmationNoir = ({
  open, totalBytes, diskSpace, onCancel, onConfirm, blockedReason,
}: InstallAllConfirmationProps) => {
  const { t } = useI18n();
  const hasEnoughSpace = diskSpace ? diskSpace.freeBytes >= totalBytes : false;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="alertdialog" aria-modal="true"
            className="glass panel-cut relative w-full max-w-md p-6"
            initial={{ opacity: 0, scale: 0.92, rotate: -1 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Katakana decorativo */}
            <span aria-hidden className="v-text absolute right-3 top-6 select-none font-display text-lg font-black text-crimson/15">
              ダウンロード
            </span>
            <span aria-hidden className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-crimson via-crimson/40 to-transparent" />

            <div className="mb-4 flex items-center gap-3">
              <span className="panel-cut-sm flex h-10 w-10 items-center justify-center border border-gold/50 bg-gold/10 text-gold">
                <AlertTriangle size={18} />
              </span>
              <div>
                <p className="kicker">// 注意</p>
                <h3 className="font-display text-lg font-black uppercase tracking-tight text-paper">
                  {t("modelManager.installAll.attention")}
                </h3>
              </div>
            </div>

            <p className="mb-3 text-sm text-paper/70">{t("modelManager.installAll.warning")}</p>

            <ul className="mb-4 space-y-1.5 border-l-2 border-crimson/40 pl-3 font-mono text-[11px] text-paper/60">
              <li><span aria-hidden className="text-crimson">▸</span> {t("modelManager.installAll.totalSize", { size: formatBytes(totalBytes) })}</li>
              <li><span aria-hidden className="text-crimson">▸</span> {t("modelManager.installAll.space", { space: diskSpace ? formatBytes(diskSpace.freeBytes) : "--" })}</li>
              <li><span aria-hidden className="text-crimson">▸</span> {t("modelManager.installAll.time")}</li>
            </ul>

            {blockedReason ? (
              <p className="mb-4 border border-crimson/40 bg-crimson/8 px-3 py-2 font-mono text-[11px] text-crimson">{blockedReason}</p>
            ) : !hasEnoughSpace ? (
              <p className="mb-4 border border-crimson/40 bg-crimson/8 px-3 py-2 font-mono text-[11px] text-crimson">
                {t("modelManager.installAll.notEnoughSpace", {
                  required: formatBytes(totalBytes),
                  available: diskSpace ? formatBytes(diskSpace.freeBytes) : "--",
                })}
              </p>
            ) : (
              <p className="mb-4 text-sm text-paper/70">{t("modelManager.installAll.confirm")}</p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onCancel}
                className="panel-cut-sm hard-hover border border-paper/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/70 hover:text-paper">
                {t("modelManager.modal.cancel")}
              </button>
              <button type="button" onClick={onConfirm} disabled={Boolean(blockedReason) || !hasEnoughSpace}
                className="panel-cut-sm hard-hover bg-crimson px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink disabled:cursor-not-allowed disabled:opacity-40">
                {t("modelManager.installAll.confirmDownload")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallAllConfirmationNoir;
