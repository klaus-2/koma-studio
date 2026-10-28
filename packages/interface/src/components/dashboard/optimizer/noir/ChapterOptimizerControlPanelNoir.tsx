import { m, useReducedMotion } from 'framer-motion';
import {
  Eye,
  Gauge,
  Globe,
  Image as ImageIcon,
  Layers3,
  MonitorSmartphone,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type {
  OptimizationPreset,
  OptimizationRecipe,
  RawOutputFormat,
} from '../../../../types';
import { EASE } from '../../../system/v2/kit';
import type {
  OptimizerImageInput,
  OptimizerRecipeUpdate,
} from '../ChapterOptimizerWorkspace.types';
import ChapterOptimizerAdvancedSectionNoir from './ChapterOptimizerAdvancedSectionNoir';
import ChapterOptimizerDimensionsSectionNoir from './ChapterOptimizerDimensionsSectionNoir';
import ChapterOptimizerExecuteSectionNoir from './ChapterOptimizerExecuteSectionNoir';
import ChapterOptimizerFiltersSectionNoir from './ChapterOptimizerFiltersSectionNoir';
import { ControlSection, RangeControl } from './primitives';

type BatchProgress = {
  current: number;
  total: number;
} | null;

const PRESET_META: Record<
  OptimizationPreset,
  {
    icon: LucideIcon;
    descKey: string;
  }
> = {
  'web-light': {
    icon: Globe,
    descKey: 'optimizer.presets.webLight.desc',
  },
  reading: {
    icon: Eye,
    descKey: 'optimizer.presets.reading.desc',
  },
  archive: {
    icon: Layers3,
    descKey: 'optimizer.presets.archive.desc',
  },
  social: {
    icon: MonitorSmartphone,
    descKey: 'optimizer.presets.social.desc',
  },
  custom: {
    icon: Settings2,
    descKey: 'optimizer.presets.custom.desc',
  },
};

interface ChapterOptimizerControlPanelNoirProps {
  recipe: OptimizationRecipe;
  selectedPreset: OptimizationPreset;
  presetKeys: OptimizationPreset[];
  imageCount: number;
  activeImage: OptimizerImageInput | null;
  activeImageIndex: number;
  busy: boolean;
  batchProgress: BatchProgress;
  filtersExpanded: boolean;
  advancedExpanded: boolean;
  directoryPickerAvailable: boolean;
  onPresetChange: (preset: OptimizationPreset) => void;
  onRecipeChange: OptimizerRecipeUpdate;
  onToggleFilters: () => void;
  onToggleAdvanced: () => void;
  onOptimizeAll: (saveToDirectory: boolean) => void;
}

export default function ChapterOptimizerControlPanelNoir({
  recipe,
  selectedPreset,
  presetKeys,
  imageCount,
  activeImage,
  activeImageIndex,
  busy,
  batchProgress,
  filtersExpanded,
  advancedExpanded,
  directoryPickerAvailable,
  onPresetChange,
  onRecipeChange,
  onToggleFilters,
  onToggleAdvanced,
  onOptimizeAll,
}: ChapterOptimizerControlPanelNoirProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <m.aside
      initial={
        reduceMotion
          ? false
          : {
            opacity: 0,
            x: -20,
          }
      }
      animate={{
        opacity: 1,
        x: 0,
      }}
      transition={{
        duration: reduceMotion ? 0 : 0.55,
        delay: reduceMotion ? 0 : 0.08,
        ease: EASE,
      }}
      className="glass panel-cut overflow-hidden"
    >
      {/* Presets */}
      <ControlSection
        index="A01"
        icon={Gauge}
        title={t('optimizer.panel.presets')}
      >
        <div className="grid grid-cols-2 gap-2">
          {presetKeys.map((presetKey) => {
            const metadata =
              PRESET_META[presetKey];

            const PresetIcon = metadata.icon;

            const presetNameKey =
              presetKey === 'web-light'
                ? 'webLight'
                : presetKey;

            const active =
              selectedPreset === presetKey;

            return (
              <button
                key={presetKey}
                type="button"
                aria-pressed={active}
                className={[
                  'offset-card panel-cut-sm min-h-24 border p-3 text-left',
                  active
                    ? 'border-crimson/65 bg-crimson/10 drop-shadow-[4px_4px_0_rgba(255,46,99,0.3)]'
                    : 'border-paper/10 bg-ink/50 hover:border-crimson/35',
                ].join(' ')}
                onClick={() =>
                  onPresetChange(presetKey)
                }
              >
                <span
                  className={[
                    'mb-3 grid size-7 place-items-center border panel-cut-sm',
                    active
                      ? 'border-crimson/45 bg-crimson text-ink'
                      : 'border-paper/10 bg-paper/[0.035] text-paper/40',
                  ].join(' ')}
                >
                  <PresetIcon size={13} />
                </span>

                <strong className="block font-display text-xs font-black uppercase tracking-[-0.02em] text-paper">
                  {t(
                    `optimizer.presets.${presetNameKey}`,
                  )}
                </strong>

                <span className="mt-1 block text-[0.65rem] leading-4 text-paper/35">
                  {t(metadata.descKey)}
                </span>
              </button>
            );
          })}
        </div>
      </ControlSection>

      {/* Output */}
      <ControlSection
        index="A02"
        icon={ImageIcon}
        title={t('optimizer.panel.output')}
      >
        <div className="space-y-5">
          <div>
            <span className="mb-2 block font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper/48">
              {t('optimizer.config.format')}
            </span>

            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  'png',
                  'jpeg',
                  'webp',
                ] as RawOutputFormat[]
              ).map((format) => (
                <button
                  key={format}
                  type="button"
                  aria-pressed={
                    recipe.outputFormat === format
                  }
                  className={[
                    'panel-cut-sm min-h-10 border font-mono text-[0.65rem] font-black uppercase tracking-[0.08em] transition',
                    recipe.outputFormat === format
                      ? 'border-crimson bg-crimson text-ink shadow-[2px_2px_0_0_rgba(255,200,87,0.4)]'
                      : 'border-paper/10 bg-ink/55 text-paper/45 hover:border-crimson/40',
                  ].join(' ')}
                  onClick={() =>
                    onRecipeChange(
                      'outputFormat',
                      format,
                    )
                  }
                >
                  {format === 'jpeg'
                    ? 'JPG'
                    : format}
                </button>
              ))}
            </div>
          </div>

          <RangeControl
            label={t(
              'optimizer.config.quality',
            )}
            valueLabel={`${Math.round(
              recipe.quality * 100,
            )}%`}
            min={30}
            max={100}
            step={1}
            value={Math.round(
              recipe.quality * 100,
            )}
            onChange={(value) =>
              onRecipeChange(
                'quality',
                value / 100,
              )
            }
          />
        </div>
      </ControlSection>

      {/* Dimensions */}
      <ChapterOptimizerDimensionsSectionNoir
        recipe={recipe}
        onRecipeChange={onRecipeChange}
      />

      {/* Filters */}
      <ChapterOptimizerFiltersSectionNoir
        recipe={recipe}
        expanded={filtersExpanded}
        onRecipeChange={onRecipeChange}
        onToggle={onToggleFilters}
      />

      {/* Advanced */}
      <ChapterOptimizerAdvancedSectionNoir
        recipe={recipe}
        activeImage={activeImage}
        activeImageIndex={activeImageIndex}
        expanded={advancedExpanded}
        onRecipeChange={onRecipeChange}
        onToggle={onToggleAdvanced}
      />

      {/* Execute */}
      <ChapterOptimizerExecuteSectionNoir
        imageCount={imageCount}
        busy={busy}
        batchProgress={batchProgress}
        directoryPickerAvailable={directoryPickerAvailable}
        onOptimizeAll={onOptimizeAll}
      />
    </m.aside>
  );
}
