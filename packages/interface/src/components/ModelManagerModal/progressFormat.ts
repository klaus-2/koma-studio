export const formatDownloadBytes = (value: number, compact = false): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }

  const digits = compact
    ? current >= 100
      ? 0
      : current >= 10
        ? 1
        : 2
    : current >= 100
      ? 0
      : current >= 10
        ? 1
        : 2;

  return `${current.toFixed(digits)} ${units[index]}`;
};

export const formatDownloadEta = (etaSeconds: number | null | undefined): string | null => {
  if (typeof etaSeconds !== "number" || !Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return null;
  }
  const rounded = Math.ceil(etaSeconds);
  if (rounded < 60) {
    return `${rounded}s`;
  }
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

export const truncateDownloadFilename = (filename: string, maxLength = 28): string => {
  const trimmed = filename.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  const basename = trimmed.split(/[/\\]/).pop() ?? trimmed;
  if (basename.length <= maxLength) {
    return basename;
  }
  return `…${basename.slice(-(maxLength - 1))}`;
};
