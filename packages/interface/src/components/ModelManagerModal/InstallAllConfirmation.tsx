import { AlertTriangle } from "lucide-react";
import { useI18n } from "../../i18n";

import { formatBytes } from "../../models/model-storage";
import type { DiskSpaceInfo } from "../../models/types";
import styles from "./styles.module.css";

interface InstallAllConfirmationProps {
  open: boolean;
  totalBytes: number;
  diskSpace: DiskSpaceInfo | null;
  onCancel: () => void;
  onConfirm: () => void;
  blockedReason?: string | null;
}

export const InstallAllConfirmation = ({
  open,
  totalBytes,
  diskSpace,
  onCancel,
  onConfirm,
  blockedReason,
}: InstallAllConfirmationProps) => {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  const hasEnoughSpace = diskSpace ? diskSpace.freeBytes >= totalBytes : false;

  return (
    <div className={styles.confirmBackdrop} onClick={onCancel}>
      <div className={styles.confirmCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.confirmTitle}>
          <AlertTriangle size={18} />
          <span>{t("modelManager.installAll.attention")}</span>
        </div>

        <p>{t("modelManager.installAll.warning")}</p>
        <ul className={styles.confirmList}>
          <li>{t("modelManager.installAll.totalSize", { size: formatBytes(totalBytes) })}</li>
          <li>{t("modelManager.installAll.space", { space: diskSpace ? formatBytes(diskSpace.freeBytes) : "--" })}</li>
          <li>{t("modelManager.installAll.time")}</li>
        </ul>

        {blockedReason ? (
          <p className={styles.confirmError}>{blockedReason}</p>
        ) : !hasEnoughSpace ? (
          <p className={styles.confirmError}>
            {t("modelManager.installAll.notEnoughSpace", { required: formatBytes(totalBytes), available: diskSpace ? formatBytes(diskSpace.freeBytes) : "--" })}
          </p>
        ) : (
          <p>{t("modelManager.installAll.confirm")}</p>
        )}

        <div className={styles.confirmActions}>
          <button type="button" className={styles.ghostButton} onClick={onCancel}>
            {t("modelManager.modal.cancel")}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onConfirm}
            disabled={Boolean(blockedReason) || !hasEnoughSpace}
          >
            {t("modelManager.installAll.confirmDownload")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallAllConfirmation;
