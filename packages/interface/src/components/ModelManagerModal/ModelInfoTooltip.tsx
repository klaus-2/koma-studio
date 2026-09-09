import { Info } from "lucide-react";

import type { TranslationModel } from "../../models/types";
import { useI18n } from "../../i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";
import styles from "./styles.module.css";

import { desktopBridge } from "@/lib/desktop-bridge";
interface ModelInfoTooltipProps {
  model: TranslationModel;
}

export const ModelInfoTooltip = ({ model }: ModelInfoTooltipProps) => {
  const { t } = useI18n();

  const tooltipKey = model.tooltipKey;
  const highlights = tooltipKey ? (t(`${tooltipKey}.highlights` as any) as string) : null;
  const unique = tooltipKey ? (t(`${tooltipKey}.unique` as any) as string) : null;
  const bestFor = tooltipKey ? (t(`${tooltipKey}.bestFor` as any) as string) : null;
  const performance = tooltipKey ? (t(`${tooltipKey}.performance` as any) as string) : null;
  const notes = tooltipKey ? (t(`${tooltipKey}.notes` as any) as string) : null;

  const hasRichContent = highlights || unique || bestFor || performance || notes;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={styles.infoButton} aria-label={t("modelManager.tooltip.infoAria", { name: model.name })}>
            <Info size={14} />
            {t("modelManager.tooltip.info")}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className={`z-[140] ${styles.infoTooltip}`}>
          <div className={styles.infoTitle}>📦 {model.name}</div>
          <div className={styles.infoDivider} />

          {hasRichContent ? (
            <>
              {highlights && (
                <div className={styles.richSection}>
                  <p className={styles.richSectionTitle}>🔑 {t("modelManager.tooltip.rich.highlights")}</p>
                  <ul className={styles.richList}>
                    {highlights.split("\n").filter(Boolean).map((line: string, i: number) => (
                      <li key={i} className={styles.richListItem}>• {line.trim().replace(/^[•-]\s*/, "")}</li>
                    ))}
                  </ul>
                </div>
              )}
              {unique && (
                <div className={styles.richSection}>
                  <p className={styles.richSectionTitle}>✨ {t("modelManager.tooltip.rich.unique")}</p>
                  <p className={styles.richText}>{unique}</p>
                </div>
              )}
              {bestFor && (
                <div className={styles.richSection}>
                  <p className={styles.richSectionTitle}>🎯 {t("modelManager.tooltip.rich.bestFor")}</p>
                  <p className={styles.richText}>{bestFor}</p>
                </div>
              )}
              {performance && (
                <div className={styles.richSection}>
                  <p className={styles.richSectionTitle}>📊 {t("modelManager.tooltip.rich.performance")}</p>
                  <p className={styles.richText}>{performance}</p>
                </div>
              )}
              {notes && (
                <div className={styles.richSection}>
                  <p className={styles.richSectionTitle}>💡 {t("modelManager.tooltip.rich.notes")}</p>
                  <p className={styles.richText}>{notes}</p>
                </div>
              )}
            </>
          ) : (
            <p className={styles.infoLine}>{t(model.description as any)}</p>
          )}

          {model.docsUrl && (
            <div className={styles.richSection}>
              <a
                href={model.docsUrl}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const openExternal = desktopBridge.desktop?.openExternal;
                  if (typeof openExternal === 'function') {
                    await openExternal(model.docsUrl!);
                  } else {
                    window.open(model.docsUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                className={styles.docsLink}
              >
                {t("modelManager.tooltip.docsUrl")} →
              </a>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ModelInfoTooltip;
