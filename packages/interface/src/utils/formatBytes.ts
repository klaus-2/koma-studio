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

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = Math.round(value * 10) / 10;
  const display = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);
  return `${display} ${BYTE_UNITS[unitIndex]}`;
}
