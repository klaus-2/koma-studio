const MODIFIER_TOKENS = new Set(["CTRL", "ALT", "SHIFT", "WIN"]);
const TOKEN_PRIORITY: Record<string, number> = {
  CTRL: 0,
  ALT: 1,
  SHIFT: 2,
  WIN: 3,
};

const normalizeShortcutToken = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const upper = raw.toUpperCase();
  if (upper === "CONTROL") return "CTRL";
  if (upper === "OPTION") return "ALT";
  if (upper === "META" || upper === "CMD" || upper === "COMMAND" || upper === "OS") {
    return "WIN";
  }
  if (upper === "ESCAPE") return "ESC";
  if (upper === "RETURN") return "ENTER";
  if (upper === "DEL") return "DELETE";
  if (upper === "SPACEBAR" || upper === "SPACE") return "SPACE";
  if (upper.startsWith("ARROW")) return upper;
  return upper.length === 1 ? upper : upper;
};

export const normalizeShortcutCombo = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const unique = new Set<string>();
  value.forEach((item) => {
    const normalized = normalizeShortcutToken(item);
    if (normalized) {
      unique.add(normalized);
    }
  });

  return Array.from(unique).sort((left, right) => {
    const leftPriority = TOKEN_PRIORITY[left] ?? 10;
    const rightPriority = TOKEN_PRIORITY[right] ?? 10;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.localeCompare(right);
  });
};

export const isCompleteShortcutCombo = (combo: string[]): boolean =>
  combo.some((token) => !MODIFIER_TOKENS.has(token));

export const getShortcutDisplayLabel = (combo: string[], noShortcutLabel = "Sem atalho"): string =>
  combo.length > 0 ? combo.join(" + ") : noShortcutLabel;

export const collectShortcutStateFromKeyboardEvent = (event: KeyboardEvent): string[] => {
  const keys: string[] = [];

  if (event.ctrlKey) keys.push("CTRL");
  if (event.altKey) keys.push("ALT");
  if (event.shiftKey) keys.push("SHIFT");
  if (event.metaKey) keys.push("WIN");

  const code = String(event.code ?? "").trim();
  let resolvedKey = "";
  if (/^Digit[0-9]$/i.test(code)) {
    resolvedKey = code.slice(-1);
  } else if (/^Numpad[0-9]$/i.test(code)) {
    resolvedKey = code.slice(-1);
  } else if (code === "Minus") {
    resolvedKey = "-";
  } else if (code === "Equal") {
    resolvedKey = "=";
  } else if (/^Key[A-Z]$/i.test(code)) {
    resolvedKey = code.slice(-1).toUpperCase();
  }

  const key = normalizeShortcutToken(resolvedKey || (event.key ?? ""));
  if (key && !MODIFIER_TOKENS.has(key)) {
    keys.push(key);
  }

  return normalizeShortcutCombo(keys);
};

export const isShortcutMatch = (pressed: string[], expected: string[]): boolean => {
  const normalizedPressed = normalizeShortcutCombo(pressed);
  const normalizedExpected = normalizeShortcutCombo(expected);
  if (normalizedPressed.length !== normalizedExpected.length) return false;
  return normalizedPressed.every((token, index) => token === normalizedExpected[index]);
};

export const isEditableShortcutTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
};
