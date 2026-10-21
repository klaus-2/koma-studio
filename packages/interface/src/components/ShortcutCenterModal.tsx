import { ShortcutCenterModalClassic } from "./ShortcutCenterModalClassic";
import ShortcutCenterModalNoir from "./noir/ShortcutCenterModalNoir";
import { createFamilyComponent } from "@koma/ui/themes/family-skins";

const ShortcutCenterModal = createFamilyComponent(ShortcutCenterModalClassic, ShortcutCenterModalNoir);

export default ShortcutCenterModal;
