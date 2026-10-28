import { ZoomIn } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { OptimizationRecipe } from '../../../../types';
import type { OptimizerRecipeUpdate } from '../ChapterOptimizerWorkspace.types';
import { ROTATION_OPTIONS } from '../ChapterOptimizerWorkspace.utils';
import { ControlSection, RangeControl, ToggleControl } from './primitives';

interface ChapterOptimizerDimensionsSectionNoirProps {
  recipe: OptimizationRecipe;
  onRecipeChange: OptimizerRecipeUpdate;
}

export default function ChapterOptimizerDimensionsSectionNoir({
  recipe,
  onRecipeChange,
}: ChapterOptimizerDimensionsSectionNoirProps) {
  const { t } = useI18n();

  return (
    <ControlSection
      index="A03"
      icon={ZoomIn}
      title={t(
        'optimizer.panel.dimensions',
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
        <ToggleControl
          label={t(
            'optimizer.config.resize',
          )}
          checked={recipe.resizeEnabled}
          onChange={(checked) =>
            onRecipeChange(
              'resizeEnabled',
              checked,
            )
          }
        />

        <ToggleControl
          label={t(
            'optimizer.config.trimBorders',
          )}
          checked={recipe.trimBorders}
          onChange={(checked) =>
            onRecipeChange(
              'trimBorders',
              checked,
            )
          }
        />

        <label className="block">
          <span className="mb-2 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-paper/42">
            {t(
              'optimizer.config.maxWidth',
            )}
          </span>

          <input
            type="number"
            className="w-full bg-ink-2 text-paper px-3 py-2 panel-cut-sm border border-paper/15 font-mono text-[11px] focus:border-crimson focus:shadow-[3px_3px_0_0_#ff2e63] focus-visible:outline-none transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
            min={320}
            max={4000}
            value={recipe.maxWidth}
            disabled={!recipe.resizeEnabled}
            onChange={(event) =>
              onRecipeChange(
                'maxWidth',
                Math.max(
                  320,
                  Number(
                    event.target.value,
                  ) || recipe.maxWidth,
                ),
              )
            }
          />
        </label>

        <label className="block">
          <span className="mb-2 block font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-paper/42">
            {t(
              'optimizer.config.maxHeight',
            )}
          </span>

          <input
            type="number"
            className="w-full bg-ink-2 text-paper px-3 py-2 panel-cut-sm border border-paper/15 font-mono text-[11px] focus:border-crimson focus:shadow-[3px_3px_0_0_#ff2e63] focus-visible:outline-none transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed"
            min={320}
            max={6000}
            value={recipe.maxHeight}
            disabled={!recipe.resizeEnabled}
            onChange={(event) =>
              onRecipeChange(
                'maxHeight',
                Math.max(
                  320,
                  Number(
                    event.target.value,
                  ) || recipe.maxHeight,
                ),
              )
            }
          />
        </label>

        {recipe.trimBorders ? (
          <div className="sm:col-span-2">
            <RangeControl
              label={t(
                'optimizer.config.trimTolerance',
              )}
              valueLabel={String(
                recipe.trimTolerance,
              )}
              min={4}
              max={60}
              step={1}
              value={recipe.trimTolerance}
              onChange={(value) =>
                onRecipeChange(
                  'trimTolerance',
                  value,
                )
              }
            />
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <span className="mb-2 flex items-center justify-between font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-paper/42">
            {t(
              'optimizer.config.rotation',
            )}
            <span className="text-crimson">
              {recipe.rotation}°
            </span>
          </span>

          <div className="grid grid-cols-4 gap-1">
            {ROTATION_OPTIONS.map(
              (rotation) => (
                <button
                  key={rotation}
                  type="button"
                  aria-pressed={
                    recipe.rotation ===
                    rotation
                  }
                  className={[
                    'panel-cut-sm min-h-10 border font-mono text-[0.63rem] font-black transition',
                    recipe.rotation === rotation
                      ? 'border-crimson bg-crimson text-ink shadow-[2px_2px_0_0_rgba(255,200,87,0.4)]'
                      : 'border-paper/10 bg-ink/50 text-paper/40 hover:border-crimson/40',
                  ].join(' ')}
                  onClick={() =>
                    onRecipeChange(
                      'rotation',
                      rotation,
                    )
                  }
                >
                  {rotation === 0
                    ? t(
                      'optimizer.config.rotationNone',
                    )
                    : `${rotation}°`}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </ControlSection>
  );
}
