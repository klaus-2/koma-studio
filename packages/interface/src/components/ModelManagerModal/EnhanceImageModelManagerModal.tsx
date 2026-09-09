import { CheckCircle2, Download, ExternalLink, FolderOpen, Info, Layers, RefreshCcw, Trash2, X } from "lucide-react";

import { formatBytes, estimateModelRequiredDiskBytes } from "../../models/model-storage";
import type { DiskSpaceInfo, ModelInstallState, TranslationModel } from "../../models/types";
import { useI18n } from "../../i18n";
import styles from "./styles.module.css";

import { desktopBridge } from "@/lib/desktop-bridge";
interface EnhanceImageModelManagerModalProps {
  open: boolean;
  diskSpace: DiskSpaceInfo | null;
  entries: Record<string, ModelInstallState>;
  selectedModelId: string;
  onClose: () => void;
  onSelectModel: (modelId: string) => void;
  onInstallModel: (modelId: string) => Promise<void>;
  onUpdateModel: (modelId: string) => Promise<void>;
  onUninstallModel: (modelId: string) => Promise<void>;
  onRetryModel: (modelId: string) => Promise<void>;
  onCancelModel: (modelId: string) => Promise<void>;
  onImportModel: (model: TranslationModel) => Promise<void>;
}

const sortEntries = (entries: ModelInstallState[]): ModelInstallState[] =>
  [...entries].sort((a, b) => {
    if (a.model.recommended && !b.model.recommended) return -1;
    if (!a.model.recommended && b.model.recommended) return 1;
    return a.model.name.localeCompare(b.model.name, "pt-BR");
  });

const openModelDocs = (url: string): void => {
  const openCommunityLink = desktopBridge.desktop?.openCommunityLink;
  if (openCommunityLink) {
    void openCommunityLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

export const EnhanceImageModelManagerModal = ({
  open,
  diskSpace,
  entries,
  selectedModelId,
  onClose,
  onSelectModel,
  onInstallModel,
  onUpdateModel,
  onUninstallModel,
  onRetryModel,
  onCancelModel,
  onImportModel,
}: EnhanceImageModelManagerModalProps) => {
  const { t } = useI18n();
  const statusLabel = (entry: ModelInstallState): string => {
    if (entry.status === "installed") return t("modelManager.status.installed");
    if (entry.status === "update_available") return t("modelManager.status.updateAvailable");
    if (entry.status === "downloading") return t("modelManager.status.downloading");
    if (entry.status === "queued") return t("modelManager.status.queued");
    if (entry.status === "verifying") return t("modelManager.status.verifying");
    if (entry.status === "failed") return t("modelManager.status.failed");
    if (entry.status === "cancelled") return t("modelManager.status.cancelled");
    if (entry.status === "incomplete") return t("modelManager.status.incomplete");
    return t("modelManager.status.notInstalled");
  };
  if (!open) {
    return null;
  }

  const enhanceEntries = Object.values(entries).filter((entry) => entry.model.stage === "enhanceImage");
  const installableEntries = sortEntries(enhanceEntries.filter((entry) => entry.model.installStrategy !== "manual_import"));
  const importEntries = sortEntries(enhanceEntries.filter((entry) => entry.model.installStrategy === "manual_import"));

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <Layers size={18} />
            <div>
              <h2>{t("modelManager.enhance.title")}</h2>
              <p>{t("modelManager.enhance.description")}</p>
              <p>
                {t("modelManager.enhance.freeSpace")}: {diskSpace ? formatBytes(diskSpace.freeBytes) : t("modelManager.enhance.notChecked")}
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t("modelManager.enhance.closeAria")}>
            <X size={16} />
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.catalogSection}>
            <div className={styles.catalogHeader}>
              <h3>{t("modelManager.enhance.directInstall")}</h3>
              <p>{t("modelManager.enhance.directInstallDesc")}</p>
            </div>
            <div className={styles.modelGrid}>
              {installableEntries.map((entry) => {
                const selected = selectedModelId === entry.model.id;
                const canUse = entry.status === "installed" || entry.status === "update_available";
                return (
                  <article key={entry.model.id} className={[styles.modelCard, selected ? styles.modelCardFocused : ""].filter(Boolean).join(" ")}>
                    <header className={styles.modelCardHeader}>
                      <div>
                        <h4 className={styles.modelCardTitle}>{entry.model.name}</h4>
                        <p className={styles.modelCardMeta}>
                          {entry.model.fileSize} • {entry.model.requirements.gpu ? "GPU" : "CPU"} • {entry.model.speed}
                        </p>
                      </div>
                    </header>
                    <p className={styles.modelCardDescription}>{t(entry.model.description as any)}</p>
                    <p className={styles.modelCardMeta}>
                      {t("modelManager.enhance.statusLabel")}: {statusLabel(entry)} • {t("modelManager.enhance.estimatedDisk")}: {formatBytes(estimateModelRequiredDiskBytes(entry.model))}
                    </p>
                    {entry.model.notes ? <p className={styles.modelCardMeta}>{entry.model.notes}</p> : null}
                    <div className={styles.modelCardFooter}>
                      <div className={styles.actionsSlot}>
                        {canUse ? (
                          <button type="button" className={styles.ghostButton} onClick={() => onSelectModel(entry.model.id)} disabled={selected}>
                            <CheckCircle2 size={14} /> {selected ? t("modelManager.actions.selected") : t("modelManager.actions.useModel")}
                          </button>
                        ) : null}
                        {entry.status === "installed" ? (
                          <button type="button" className={styles.ghostButton} onClick={() => void onUninstallModel(entry.model.id)}>
                            <Trash2 size={14} /> {t("modelManager.actions.uninstall")}
                          </button>
                        ) : entry.status === "update_available" ? (
                          <button type="button" className={styles.primaryButton} onClick={() => void onUpdateModel(entry.model.id)}>
                            <RefreshCcw size={14} /> {t("modelManager.actions.update")}
                          </button>
                        ) : entry.status === "queued" || entry.status === "downloading" || entry.status === "verifying" ? (
                          <button type="button" className={styles.warningButton} onClick={() => void onCancelModel(entry.model.id)}>
                            {t("stitch.workspace.cancel")}
                          </button>
                        ) : entry.status === "failed" || entry.status === "cancelled" || entry.status === "incomplete" ? (
                          <button type="button" className={styles.primaryButton} onClick={() => void onRetryModel(entry.model.id)}>
                            <RefreshCcw size={14} /> {t("modelManager.actions.retry")}
                          </button>
                        ) : (
                          <button type="button" className={styles.primaryButton} onClick={() => void onInstallModel(entry.model.id)}>
                            <Download size={14} /> {t("modelManager.actions.install")}
                          </button>
                        )}
                        {entry.model.docsUrl ? (
                          <button
                            type="button"
                            className={styles.ghostButton}
                            onClick={() => openModelDocs(entry.model.docsUrl!)}
                          >
                            <ExternalLink size={14} /> {t("modelManager.actions.source")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.catalogSection}>
            <div className={styles.catalogHeader}>
              <h3>{t("modelManager.enhance.manualImport")}</h3>
              <p>{t("modelManager.enhance.manualImportDesc")}</p>
            </div>
            <div className={styles.modelGrid}>
              {importEntries.map((entry) => {
                const selected = selectedModelId === entry.model.id;
                const canUse = entry.status === "installed" || entry.status === "update_available";
                return (
                  <article key={entry.model.id} className={[styles.modelCard, selected ? styles.modelCardFocused : ""].filter(Boolean).join(" ")}>
                    <header className={styles.modelCardHeader}>
                      <div>
                        <h4 className={styles.modelCardTitle}>{entry.model.name}</h4>
                        <p className={styles.modelCardMeta}>
                          {t("modelManager.enhance.importOnnxBadge")} • {entry.model.fileSize} • {entry.model.speed}
                        </p>
                      </div>
                    </header>
                    <p className={styles.modelCardDescription}>{t(entry.model.description as any)}</p>
                    <p className={styles.modelCardMeta}>{t("modelManager.enhance.statusLabel")}: {statusLabel(entry)}</p>
                    {entry.model.notes ? <p className={styles.modelCardMeta}>{entry.model.notes}</p> : null}
                    <div className={styles.modelCardFooter}>
                      <div className={styles.actionsSlot}>
                        {canUse ? (
                          <button type="button" className={styles.ghostButton} onClick={() => onSelectModel(entry.model.id)} disabled={selected}>
                            <CheckCircle2 size={14} /> {selected ? t("modelManager.actions.selected") : t("modelManager.actions.useModel")}
                          </button>
                        ) : null}
                        <button type="button" className={styles.primaryButton} onClick={() => void onImportModel(entry.model)}>
                          <FolderOpen size={14} /> {canUse ? t("modelManager.enhance.reimportOnnx") : t("modelManager.enhance.importOnnx")}
                        </button>
                        {entry.status === "installed" || entry.status === "update_available" ? (
                          <button type="button" className={styles.ghostButton} onClick={() => void onUninstallModel(entry.model.id)}>
                            <Trash2 size={14} /> {t("modelManager.actions.uninstall")}
                          </button>
                        ) : null}
                        {entry.model.docsUrl ? (
                          <button
                            type="button"
                            className={styles.ghostButton}
                            onClick={() => openModelDocs(entry.model.docsUrl!)}
                          >
                            <ExternalLink size={14} /> {t("modelManager.actions.source")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className={styles.emptyHint}>
            <Info size={14} style={{ marginRight: 6 }} />
            {t("modelManager.enhance.pthHint")} <code>.pth</code>, {t("modelManager.enhance.pthHintSuffix")}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhanceImageModelManagerModal;
