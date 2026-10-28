import { Settings2, Type } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { OptimizationRecipe } from '../../../../types';
import type {
  OptimizerImageInput,
  OptimizerRecipeUpdate,
} from '../ChapterOptimizerWorkspace.types';
import { buildOutputName } from '../optimizerOutputName';
import { ControlSection } from './primitives';

interface ChapterOptimizerAdvancedSectionNoirProps {
  recipe: OptimizationRecipe;
  activeImage: OptimizerImageInput | null;
  activeImageIndex: number;
  expanded: boolean;
  onRecipeChange: OptimizerRecipeUpdate;
  onToggle: () => void;
}

export default function ChapterOptimizerAdvancedSectionNoir({
  recipe,
  activeImage,
  activeImageIndex,
  expanded,
  onRecipeChange,
  onToggle,
}: ChapterOptimizerAdvancedSectionNoirProps) {
  const { t } = useI18n();

  return (
    <ControlSection
      index="A05"
      icon={Settings2}
      title={t('optimizer.panel.advanced')}
      expanded={expanded}
      onToggle={onToggle}
    >
      <label className="block">
        <span className="mb-2 flex items-center gap-2 font-mono text-[0.64rem] font-bold uppercase tracking-[0.1em] text-paper/45">
          <Type
            size={13}
            className="text-crimson"
            aria-hidden="true"
          />
          {t(
            'optimizer.config.renamePattern',
          )}
        </span>

        <input
          type="text"
          className="w-full bg-ink-2 text-paper px-3 py-2 panel-cut-sm border border-paper/15 font-mono text-[11px] focus:border-crimson focus:shadow-[3px_3px_0_0_#ff2e63] focus-visible:outline-none transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
          value={recipe.renamePattern}
          placeholder="{name}"
          onChange={(event) =>
            onRecipeChange(
              'renamePattern',
              event.target.value,
            )
          }
        />

        <span className="mt-2 block text-[0.66rem] leading-4 text-paper/32">
          {t(
            'optimizer.config.renameHint',
          )}
        </span>

        {activeImage ? (
          <code className="mt-3 block overflow-hidden text-ellipsis whitespace-nowrap border-l-2 border-azure bg-azure/[0.045] px-3 py-2 font-mono text-[0.64rem] text-azure panel-cut-sm">
            {buildOutputName(
              activeImage.file.name,
              recipe.outputFormat,
              recipe.renamePattern,
              activeImageIndex >= 0
                ? activeImageIndex
                : 0,
            )}
          </code>
        ) : null}
      </label>
    </ControlSection>
  );
}
