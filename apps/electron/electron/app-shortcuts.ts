export interface DesktopBeforeInputShortcutLike {
  key?: string;
  control?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  type?: string;
}

export type DesktopShortcutActionId = "workspaceSave";

export const resolveDesktopShortcutAction = (
  input: DesktopBeforeInputShortcutLike,
): DesktopShortcutActionId | null => {
  const key = String(input.key ?? "").trim().toLowerCase();
  const isKeyDown = !input.type || input.type === "keyDown";
  if (!isKeyDown) {
    return null;
  }

  if (input.control && !input.meta && !input.alt && !input.shift && key === "s") {
    return "workspaceSave";
  }

  return null;
};
