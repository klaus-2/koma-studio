import { useThemeStore } from "@koma/ui/stores/theme-store";
import { ShortcutCenterModalClassic } from "./ShortcutCenterModalClassic";
import ShortcutCenterModalNoir from "./noir/ShortcutCenterModalNoir";
import type { ShortcutCenterModalProps } from "../shortcuts/useShortcutCenterModel";

const ShortcutCenterModal = (props: ShortcutCenterModalProps) => {
  const family = useThemeStore((s) => s.family);
  return family === "noir" ? (
    <ShortcutCenterModalNoir {...props} />
  ) : (
    <ShortcutCenterModalClassic {...props} />
  );
};

export default ShortcutCenterModal;
