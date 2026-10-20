import { useEffect, useMemo, useRef, useState } from "react";

import { useUpdater } from "../../hooks/useUpdater";
import { useUpdaterSync } from "../../hooks/useUpdaterSync";
import UpdateModalClassic from "./UpdateModalClassic";
import type { UpdaterStatus } from "../../types";
import { sendDiscordWebhookEvent } from "../../services/discordWebhook";
import { useI18n } from "../../i18n";

const DISMISSAL_STORAGE_KEY = "koma-update-toast-dismissed";

const getDismissedVersion = (): string | null => {
  try {
    return localStorage.getItem(DISMISSAL_STORAGE_KEY);
  } catch {
    return null;
  }
};

const setDismissedVersion = (version: string): void => {
  try {
    localStorage.setItem(DISMISSAL_STORAGE_KEY, version);
  } catch {
    // restricted browser modes
  }
};

export const UpdateToastClassic = () => {
  const { t } = useI18n();
  const updater = useUpdater();
  const sync = useUpdaterSync();
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(() => getDismissedVersion());
  const previousStatusRef = useRef<UpdaterStatus>(updater.status);
  const emittedWebhookKeysRef = useRef<Set<string>>(new Set());

  const dismissedKey = updater.newVersion ?? "unknown";

  const dismissToast = () => {
    setDismissedVersion(dismissedKey);
    setDismissed(dismissedKey);
  };

  useEffect(() => {
    if (previousStatusRef.current === updater.status) {
      return;
    }

    const version = updater.newVersion ?? updater.currentVersion ?? null;
    const eventKey =
      updater.status === "available"
        ? "updateAvailable"
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
    return null;
  }, [t, updater.channel, updater.newVersion, updater.status]);

  const shouldShowBanner = toastContent !== null && dismissed !== dismissedKey && !sync.running;

  return (
    <>
      {shouldShowBanner && toastContent && (
        <div className="koma-toast">
          <div className="koma-toast__glow" aria-hidden="true" />

          <button
            type="button"
            onClick={dismissToast}
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
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="koma-toast__btn koma-toast__btn--primary"
            >
              {t("update.button.syncNow")}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="koma-toast__btn koma-toast__btn--ghost"
            >
              {t("update.button.details")}
            </button>
          </div>
        </div>
      )}

      <UpdateModalClassic
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

export default UpdateToastClassic;
