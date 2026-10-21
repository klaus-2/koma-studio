export const readHeaderValue = (
  value: string | string[] | undefined,
): string | null => {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (typeof normalized !== "string") {
    return null;
  }

  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return fallback;
  }
  return numberValue;
};
