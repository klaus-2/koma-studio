import { AlertTriangle } from "lucide-react";
import { useI18n } from "../../i18n";
import { KomaDialog } from "@koma/ui/components/dialog";

import { computeRequiredBytesWithSlack, formatBytes } from "../../models/model-storage";
import type { DiskSpaceInfo } from "../../models/types";
import styles from "./styles.module.css";

export interface InstallAllConfirmationProps {
  open: boolean;
  totalBytes: number;
  diskSpace: DiskSpaceInfo | null;
  onCancel: () => void;
  onConfirm: () => void;
  blockedReason?: string | null;
  stageLabels?: readonly string[];
}

export const InstallAllConfirmationClassic = ({
  open,
  totalBytes,
  diskSpace,
  onCancel,
  onConfirm,
  blockedReason,
  stageLabels,
}: InstallAllConfirmationProps) => {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  const requiredBytes = computeRequiredBytesWithSlack(totalBytes);
  const hasEnoughSpace = diskSpace ? diskSpace.freeBytes >= requiredBytes : false;

  return (
    <KomaDialog
      open
      onClose={onCancel}
      layerClassName={styles.confirmBackdrop ?? ""}
      modalClassName={styles.confirmCard}
      label={t("modelManager.installAll.attention")}
    >
        <div className={styles.confirmTitle}>
          <AlertTriangle size={18} />
          <span>{t("modelManager.installAll.attention")}</span>
        </div>

        <p>{t("modelManager.installAll.warning")}</p>
        <ul className={styles.confirmList}>
          <li>{t("modelManager.installAll.totalSize", { size: formatBytes(totalBytes) })}</li>
          {stageLabels && stageLabels.length > 1 && (
            <li>{t("modelManager.installAll.multiStage.stagesList", { stages: stageLabels.join(", ") })}</li>
          )}
          <li>{t("modelManager.installAll.space", { space: diskSpace ? formatBytes(diskSpace.freeBytes) : "--" })}</li>
          <li>{t("modelManager.installAll.time")}</li>
        </ul>

        {blockedReason ? (
          <p className={styles.confirmError}>{blockedReason}</p>
        ) : !hasEnoughSpace ? (
          <p className={styles.confirmError}>
            {t("modelManager.disk.requiredVsAvailable", { required: formatBytes(requiredBytes), available: diskSpace ? formatBytes(diskSpace.freeBytes) : "--" })}
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
    </KomaDialog>
  );
};

export default InstallAllConfirmationClassic;
