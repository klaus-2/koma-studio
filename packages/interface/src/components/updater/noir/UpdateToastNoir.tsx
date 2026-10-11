import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { DownloadCloud, X } from "lucide-react";
import { useUpdater } from "../../../hooks/useUpdater";
import { useUpdaterSync } from "../../../hooks/useUpdaterSync";
import type { UpdaterStatus } from "../../../types";
import { sendDiscordWebhookEvent } from "../../../services/discordWebhook";
import UpdateModalNoir from "./UpdateModalNoir";
import { useI18n } from "../../../i18n";
import { btnPrimary, btnGhost } from "../../system/v2/kit";

// Noir variant — source-only update model (single "available" state; primary
// action opens the update modal with the sync panel).
export const UpdateToastNoir = () => {
  const { t } = useI18n();
  const updater = useUpdater();
  const sync = useUpdaterSync();
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const previousStatusRef = useRef<UpdaterStatus>(updater.status);
  const emittedWebhookKeysRef = useRef<Set<string>>(new Set());

  const dismissedKey = updater.newVersion ?? "unknown";

  useEffect(() => {
    if (dismissed && dismissed !== dismissedKey) setDismissed(null);
  }, [dismissed, dismissedKey]);

  /* Webhook dedupe — lógica V1 intacta */
  useEffect(() => {
    if (previousStatusRef.current === updater.status) return;
    const version = updater.newVersion ?? updater.currentVersion ?? null;
    const eventKey =
      updater.status === "available" ? "updateAvailable"
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
    return null;
  }, [t, updater.channel, updater.newVersion, updater.status]);

  const shouldShowBanner = toastContent !== null && dismissed !== dismissedKey && !sync.running;

  const toneCls = { bar: "bg-crimson", icon: "border-crimson bg-crimson/10 text-crimson" };

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

            <button type="button" onClick={() => setDismissed(dismissedKey)}
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
              <button type="button" onClick={() => setModalOpen(true)} className={`${btnPrimary} flex-1`}>
                {t("update.button.syncNow")}
              </button>
              <button type="button" onClick={() => setModalOpen(true)} className={btnGhost}>
                {t("update.button.details")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpdateModalNoir
        open={modalOpen}
        currentVersion={updater.currentVersion}
        newVersion={updater.newVersion}
        releaseNotes={updater.releaseNotes}
        onClose={() => setModalOpen(false)}
        onOpenReleasePage={updater.downloadUpdate}
      />
    </>
  );
};

export default UpdateToastNoir;
