import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DownloadCloud, CheckCircle2, X } from "lucide-react";
import { useUpdater } from "../../../hooks/useUpdater";
import type { UpdaterStatus } from "../../../types";
import { sendDiscordWebhookEvent } from "../../../services/discordWebhook";
import UpdateModalNoir from "./UpdateModalNoir";
import UpdateProgressNoir from "./UpdateProgressNoir";
import { useI18n } from "../../../i18n";
import { btnPrimary, btnMint, btnGhost } from "../../system/v2/kit";

export const UpdateToastNoir = () => {
  const { t } = useI18n();
  const updater = useUpdater();
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedStatus, setDismissedStatus] = useState<UpdaterStatus | null>(null);
  const previousStatusRef = useRef<UpdaterStatus>(updater.status);
  const emittedWebhookKeysRef = useRef<Set<string>>(new Set());
  const downloadedPercent = updater.status === "downloaded" ? 100 : Math.max(0, Math.min(100, updater.progress.percent || 0));

  const handleInstallLater = async (): Promise<void> => {
    await updater.setAutoInstall(true);
    setDismissedStatus("downloaded");
    setModalOpen(false);
  };

  useEffect(() => {
    if (dismissedStatus && dismissedStatus !== updater.status) setDismissedStatus(null);
  }, [dismissedStatus, updater.status]);

  useEffect(() => {
    if (updater.blocking) { setModalOpen(true); setDismissedStatus(null); }
  }, [updater.blocking]);

  /* Webhook dedupe — lógica V1 intacta */
  useEffect(() => {
    if (previousStatusRef.current === updater.status) return;
    const version = updater.newVersion ?? updater.currentVersion ?? null;
    const eventKey =
      updater.status === "available" ? "updateAvailable"
      : updater.status === "downloaded" ? "updateDownloaded"
      : updater.status === "error" ? "updateError" : null;

    if (eventKey) {
      const dedupeKey = `${updater.status}:${version ?? "unknown"}`;
      const emitted = emittedWebhookKeysRef.current;
      if (!emitted.has(dedupeKey)) {
        emitted.add(dedupeKey);
        if (emitted.size > 120) {
          emittedWebhookKeysRef.current = new Set(Array.from(emitted).slice(-80));
        }
        void sendDiscordWebhookEvent(eventKey, {
          version,
          error: updater.status === "error" ? updater.error ?? undefined : undefined,
        });
      }
    }
    previousStatusRef.current = updater.status;
  }, [updater.currentVersion, updater.error, updater.newVersion, updater.status]);

  const toastContent = useMemo(() => {
    if (updater.status === "available")
      return {
        tone: "crimson" as const,
        title: t("update.toast.availableTitle"),
        description: t("update.toast.availableDescription", {
          version: updater.newVersion ?? t("update.toast.newVersionFallback"),
          channel: updater.channel === "beta" ? t("update.channel.beta") : t("update.channel.stable"),
        }),
        icon: <DownloadCloud size={16} />,
      };
    if (updater.status === "downloaded")
      return {
        tone: "mint" as const,
        title: t("update.toast.downloadedTitle"),
        description: t("update.toast.downloadedDescription", { percent: downloadedPercent.toFixed(0) }),
        icon: <CheckCircle2 size={16} />,
      };
    if (updater.status === "downloading")
      return {
        tone: "crimson" as const,
        title: t("update.toast.downloadingTitle"),
        description: t("update.toast.downloadingDescription", { percent: updater.progress.percent.toFixed(0) }),
        icon: <span className="blink text-crimson">▼</span>,
      };
    return null;
  }, [downloadedPercent, t, updater.channel, updater.newVersion, updater.progress.percent, updater.status]);

  const shouldShowBanner =
    toastContent !== null &&
    updater.status !== "downloading" &&
    updater.blocking !== true &&
    dismissedStatus !== updater.status;

  const toneCls = toastContent?.tone === "mint"
    ? { bar: "bg-mint", icon: "border-mint bg-mint/10 text-mint" }
    : { bar: "bg-crimson", icon: "border-crimson bg-crimson/10 text-crimson" };

  return (
    <>
      <AnimatePresence>
        {shouldShowBanner && toastContent && (
          <motion.div
            initial={{ opacity: 0, y: 32, x: 12 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="glass panel-cut fixed bottom-5 right-5 z-[130] w-[min(380px,calc(100vw-2rem))] border border-paper/10 p-4"
            role="status"
          >
            <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${toneCls.bar}`} />
            <span aria-hidden className="v-text pointer-events-none absolute right-1.5 top-3 select-none font-display text-[10px] font-black tracking-widest text-paper/[0.07]">
              通信
            </span>

            <button type="button" onClick={() => setDismissedStatus(updater.status)}
              aria-label={t("update.toast.closeAria")}
              className="absolute right-2 top-2 p-1 text-paper/35 transition-colors hover:text-crimson">
              <X size={12} />
            </button>

            <div className="flex items-start gap-3 pr-5">
              <motion.span aria-hidden
                initial={{ rotate: -10, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.1 }}
                className={`panel-cut-sm flex h-9 w-9 shrink-0 items-center justify-center border ${toneCls.icon}`}>
                {toastContent.icon}
              </motion.span>
              <div className="min-w-0">
                <p className="kicker !text-[9px]">// TRANSMISSION</p>
                <h3 className="font-display text-sm font-black uppercase tracking-tight text-paper">
                  {toastContent.title}
                </h3>
                <p className="mt-0.5 font-mono text-[10px] text-paper/50">{toastContent.description}</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 border-t border-paper/8 pt-3">
              {updater.status === "available" && (
                <>
                  <button type="button" onClick={() => void updater.downloadUpdate()} className={`${btnPrimary} flex-1`}>
                    {t("update.button.download")}
                  </button>
                  <button type="button" onClick={() => setModalOpen(true)} className={btnGhost}>
                    {t("update.button.details")}
                  </button>
                </>
              )}
              {updater.status === "downloaded" && (
                <>
                  <button type="button" onClick={() => void updater.installUpdate()} className={`${btnMint} flex-1`}>
                    {t("update.button.installNow")}
                  </button>
                  <button type="button" onClick={() => void handleInstallLater()} className={btnGhost}>
                    {t("update.button.installLater")}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpdateProgressNoir status={updater.status} progress={updater.progress} newVersion={updater.newVersion} hidden={modalOpen} />

      <UpdateModalNoir
        open={modalOpen}
        status={updater.status}
        currentVersion={updater.currentVersion}
        newVersion={updater.newVersion}
        mandatory={updater.mandatory}
        releaseNotes={updater.releaseNotes}
        progress={updater.progress}
        autoInstallOnQuit={updater.autoInstallOnQuit}
        onClose={() => { if (!updater.mandatory) setModalOpen(false); }}
        onDownload={updater.downloadUpdate}
        onInstall={updater.installUpdate}
        onInstallLater={handleInstallLater}
        onPostpone={updater.postpone}
      />
    </>
  );
};

export default UpdateToastNoir;
