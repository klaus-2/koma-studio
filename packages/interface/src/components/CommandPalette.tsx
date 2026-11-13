import { CommandPaletteClassic } from './CommandPaletteClassic';
import CommandPaletteNoir from './noir/CommandPaletteNoir';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

const CommandPalette = createFamilyComponent(CommandPaletteClassic, CommandPaletteNoir);

export default CommandPalette;
