import { useEffect, useMemo, useRef, useState } from "react";

import { useUpdater } from "../../hooks/useUpdater";
import UpdateModal from "./UpdateModal";
import UpdateProgress from "./UpdateProgress";
import type { UpdaterStatus } from "../../types";
import { sendDiscordWebhookEvent } from "../../services/discordWebhook";
import { useI18n } from "../../i18n";

export const UpdateToast = () => {
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
    if (updater.blocking) {
      setModalOpen(true);
      setDismissedStatus(null);
    }
  }, [updater.blocking]);

  useEffect(() => {
    if (previousStatusRef.current === updater.status) {
      return;
    }

    const version = updater.newVersion ?? updater.currentVersion ?? null;
    const eventKey =
      updater.status === "available"
        ? "updateAvailable"
        : updater.status === "downloaded"
          ? "updateDownloaded"
          : updater.status === "error"
            ? "updateError"
            : null;

    if (eventKey) {
      const dedupeKey = `${updater.status}:${version ?? "unknown"}`;
      const emitted = emittedWebhookKeysRef.current;
      if (!emitted.has(dedupeKey)) {
        emitted.add(dedupeKey);
        if (emitted.size > 120) {
          const recentKeys = Array.from(emitted).slice(-80);
          emittedWebhookKeysRef.current = new Set(recentKeys);
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
        title: t("update.toast.availableTitle"),
        description: t("update.toast.availableDescription", {
          version: updater.newVersion ?? t("update.toast.newVersionFallback"),
          channel: updater.channel === "beta" ? t("update.channel.beta") : t("update.channel.stable"),
        }),
        icon: (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
              clipRule="evenodd"
            />
          </svg>
        ),
      };
    if (updater.status === "downloaded")
      return {
        title: t("update.toast.downloadedTitle"),
        description: t("update.toast.downloadedDescription", { percent: downloadedPercent.toFixed(0) }),
        icon: (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ),
      };
    if (updater.status === "downloading")
      return {
        title: t("update.toast.downloadingTitle"),
        description: t("update.toast.downloadingDescription", {
          percent: updater.progress.percent.toFixed(0),
        }),
        icon: <span className="auth-spinner" style={{ width: 16, height: 16 }} />,
      };
    return null;
  }, [downloadedPercent, t, updater.channel, updater.newVersion, updater.progress.percent, updater.status]);

  const shouldShowBanner =
    toastContent !== null &&
    updater.status !== "downloading" &&
    updater.blocking !== true &&
    dismissedStatus !== updater.status;

  return (
    <>
      {shouldShowBanner && (
        <div className="koma-toast">
          <div className="koma-toast__glow" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setDismissedStatus(updater.status)}
            className="koma-toast__close"
            aria-label={t("update.toast.closeAria")}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>

          <div className="koma-toast__icon">{toastContent.icon}</div>

          <div className="koma-toast__body">
            <h3 className="koma-toast__title">{toastContent.title}</h3>
            <p className="koma-toast__desc">{toastContent.description}</p>
          </div>

          <div className="koma-toast__actions">
            {updater.status === "available" && (
              <>
                <button
                  type="button"
                  onClick={() => void updater.downloadUpdate()}
                  className="koma-toast__btn koma-toast__btn--primary"
                >
                  {t("update.button.download")}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="koma-toast__btn koma-toast__btn--ghost"
                >
                  {t("update.button.details")}
                </button>
              </>
            )}
            {updater.status === "downloaded" && (
              <>
                <button
                  type="button"
                  onClick={() => void updater.installUpdate()}
                  className="koma-toast__btn koma-toast__btn--success"
                >
                  {t("update.button.installNow")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleInstallLater()}
                  className="koma-toast__btn koma-toast__btn--ghost"
                >
                  {t("update.button.installLater")}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <UpdateProgress status={updater.status} progress={updater.progress} newVersion={updater.newVersion} hidden={modalOpen} />

      <UpdateModal
        open={modalOpen}
        status={updater.status}
        currentVersion={updater.currentVersion}
        newVersion={updater.newVersion}
        mandatory={updater.mandatory}
        releaseNotes={updater.releaseNotes}
        progress={updater.progress}
        autoInstallOnQuit={updater.autoInstallOnQuit}
        onClose={() => {
          if (!updater.mandatory) {
            setModalOpen(false);
          }
        }}
        onDownload={updater.downloadUpdate}
        onInstall={updater.installUpdate}
        onInstallLater={handleInstallLater}
        onPostpone={updater.postpone}
      />
    </>
  );
};

export default UpdateToast;
