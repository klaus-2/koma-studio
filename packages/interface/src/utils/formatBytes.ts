import type { useI18n } from "../i18n";

type Translate = ReturnType<typeof useI18n>["t"];

export const formatBytesI18n = (value: number, t: Translate): string => {
  if (value < 1024) return `${value} ${t("update.units.bytes")}`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} ${t("update.units.kilobytes")}`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} ${t("update.units.megabytes")}`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} ${t("update.units.gigabytes")}`;
};
