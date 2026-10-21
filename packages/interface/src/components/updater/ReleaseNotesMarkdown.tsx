import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { ReleaseNotesMarkdownClassic } from './ReleaseNotesMarkdownClassic';
import { ReleaseNotesMarkdownNoir } from './noir/ReleaseNotesMarkdownNoir';

export const ReleaseNotesMarkdown = createFamilyComponent(ReleaseNotesMarkdownClassic, ReleaseNotesMarkdownNoir);

export default ReleaseNotesMarkdown;
