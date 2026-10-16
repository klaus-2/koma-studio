import { useThemeStore } from "@koma/ui/stores/theme-store";
import { ShortcutCenterModalClassic } from "./ShortcutCenterModalClassic";
import ShortcutCenterModalNoir from "./noir/ShortcutCenterModalNoir";

interface ShortcutCenterModalProps {
  open: boolean;
  config: import("../shortcuts/keyboardShortcuts").KeyboardShortcutConfigV2;
  onConfigChange: (next: import("../shortcuts/keyboardShortcuts").KeyboardShortcutConfigV2) => void;
  onClose: () => void;
}

const ShortcutCenterModal = (props: ShortcutCenterModalProps) => {
  const family = useThemeStore((s) => s.family);
  return family === "noir" ? (
    <ShortcutCenterModalNoir {...props} />
  ) : (
    <ShortcutCenterModalClassic {...props} />
  );
};

export default ShortcutCenterModal;
