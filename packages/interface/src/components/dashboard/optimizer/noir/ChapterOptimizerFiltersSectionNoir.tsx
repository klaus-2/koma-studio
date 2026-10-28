import {
  Contrast,
  Palette,
  Sparkles,
  SunMedium,
  Wand2,
} from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { OptimizationRecipe } from '../../../../types';
import type { OptimizerRecipeUpdate } from '../ChapterOptimizerWorkspace.types';
import { ControlSection, RangeControl, ToggleControl } from './primitives';

interface ChapterOptimizerFiltersSectionNoirProps {
  recipe: OptimizationRecipe;
  expanded: boolean;
  onRecipeChange: OptimizerRecipeUpdate;
  onToggle: () => void;
}

export default function ChapterOptimizerFiltersSectionNoir({
  recipe,
  expanded,
  onRecipeChange,
  onToggle,
}: ChapterOptimizerFiltersSectionNoirProps) {
  const { t } = useI18n();

  return (
    <ControlSection
      index="A04"
      icon={Wand2}
      title={t('optimizer.panel.filters')}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="space-y-5">
        <RangeControl
          label={t(
            'optimizer.config.brightness',
          )}
          valueLabel={`${recipe.brightness > 0 ? '+' : ''
            }${recipe.brightness}`}
          min={-50}
          max={50}
          step={1}
          value={recipe.brightness}
          icon={SunMedium}
          onChange={(value) =>
            onRecipeChange(
              'brightness',
              value,
            )
          }
        />

        <RangeControl
          label={t(
            'optimizer.config.contrast',
          )}
          valueLabel={`${recipe.contrast > 0 ? '+' : ''
            }${recipe.contrast}`}
          min={-50}
          max={50}
          step={1}
          value={recipe.contrast}
          icon={Contrast}
          onChange={(value) =>
            onRecipeChange('contrast', value)
          }
        />

        <ToggleControl
          label={t(
            'optimizer.config.sharpen',
          )}
          checked={recipe.sharpen}
          icon={Contrast}
          onChange={(checked) =>
            onRecipeChange(
              'sharpen',
              checked,
            )
          }
        />

        {recipe.sharpen ? (
          <RangeControl
            label={t(
              'optimizer.config.sharpenStrength',
            )}
            valueLabel={recipe.sharpenStrength.toFixed(
              1,
            )}
            min={10}
            max={200}
            step={5}
            value={Math.round(
              recipe.sharpenStrength * 100,
            )}
            onChange={(value) =>
              onRecipeChange(
                'sharpenStrength',
                value / 100,
              )
            }
          />
        ) : null}

        <ToggleControl
          label={t(
            'optimizer.config.noiseReduction',
          )}
          checked={recipe.noiseReduction}
          icon={Sparkles}
          onChange={(checked) =>
            onRecipeChange(
              'noiseReduction',
              checked,
            )
          }
        />

        {recipe.noiseReduction ? (
          <RangeControl
            label={t(
              'optimizer.config.noiseReductionStrength',
            )}
            valueLabel={recipe.noiseReductionStrength.toFixed(
              1,
            )}
            min={10}
            max={100}
            step={5}
            value={Math.round(
              recipe.noiseReductionStrength *
              100,
            )}
            onChange={(value) =>
              onRecipeChange(
                'noiseReductionStrength',
                value / 100,
              )
            }
          />
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
          <ToggleControl
            label={t(
              'optimizer.config.grayscale',
            )}
            checked={recipe.grayscale}
            icon={Palette}
            onChange={(checked) =>
              onRecipeChange(
                'grayscale',
                checked,
              )
            }
          />

          <ToggleControl
            label={t(
              'optimizer.config.autoLevels',
            )}
            checked={recipe.autoLevels}
            icon={SunMedium}
            onChange={(checked) =>
              onRecipeChange(
                'autoLevels',
                checked,
              )
            }
          />
        </div>
      </div>
    </ControlSection>
  );
}
