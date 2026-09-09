import {
  Download,
  FolderOutput,
  RefreshCcw,
  Scissors,
  Settings2,
  Sparkles,
  Wand2,
} from 'lucide-react';

import { SPLITTER_PRESET_LABELS } from './splitterUtils';
import type { SplitterController } from './useSplitterController';
import type { SplitStrategy } from './types';
import { AioSection } from '../../../pages/AioSection';
import KlSlider from '../KlSlider';
import '../../../pages/UtilityToolsPanel.css';
import { useI18n } from '../../../i18n';

interface SplitterSidebarToolboxProps {
  controller: SplitterController;
  imagesCount: number;
  processing: boolean;
}

export const SplitterSidebarToolbox = ({
  controller,
  imagesCount,
  processing,
}: SplitterSidebarToolboxProps) => {
  const { t } = useI18n();

  const STRATEGIES: Array<{ value: SplitStrategy; label: string; hint: string }> =
    [
      { value: 'smart', label: t('splitter.strategy.smart'), hint: t('splitter.strategy.smartHint') },
      {
        value: 'advanced_desktop',
        label: t('splitter.strategy.advancedDesktop'),
        hint: t('splitter.strategy.advancedDesktopHint'),
      },
      { value: 'manual', label: t('splitter.strategy.manual'), hint: t('splitter.strategy.manualHint') },
      {
        value: 'fixed_height',
        label: t('splitter.strategy.fixedHeight'),
        hint: t('splitter.strategy.fixedHeightHint'),
      },
      { value: 'count', label: t('splitter.strategy.count'), hint: t('splitter.strategy.countHint') },
    ];

  const {
    recipe,
    setRecipe,
    setPreset,
    resetRecipe,
    activeImage,
    activeImageState,
    analyzeActiveImage,
    applyRecipeToSelected,
    applyRecipeToAll,
    clearActiveAnalysis,
    exportCurrentSelection,
    exportBatch,
    exportBatchToDirectory,
    directorySaveSupported,
  } = controller;

  const strategyHint =
    STRATEGIES.find((s) => s.value === recipe.strategy)?.hint ?? '';

  return (
    <div className="koma-mode-tools">
      <span className="koma-mode-tag" aria-hidden="true">
      <span className="koma-mode-tag__dot" />
        {t("splitter.sidebar.title")}
      </span>

      {/* ═══ Recipe ═══ */}
      <AioSection icon={Scissors} title={t("splitter.sidebar.recipe")}>
        <div className="koma-dual-row">
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.preset")}</label>
            <select
              value={recipe.preset}
              onChange={(e) =>
                setPreset(e.target.value as typeof recipe.preset)
              }
              className="koma-select"
            >
              {Object.entries(SPLITTER_PRESET_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.mode")}</label>
            <select
              value={recipe.strategy}
              onChange={(e) =>
                setRecipe((c) => ({
                  ...c,
                  strategy: e.target.value as SplitStrategy,
                }))
              }
              className="koma-select"
            >
              {STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="koma-tools-hint">{strategyHint}</p>

        <div className="koma-dual-row">
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.direction")}</label>
            <select
              value={recipe.axis}
              onChange={(e) =>
                setRecipe((c) => ({
                  ...c,
                  axis: e.target.value as typeof recipe.axis,
                }))
              }
              className="koma-select"
            >
              <option value="vertical">{t("splitter.sidebar.vertical")}</option>
              <option value="horizontal">{t("splitter.sidebar.horizontal")}</option>
            </select>
          </div>
          <div className="koma-field">
            <label className="koma-field__label">{t("common.format")}</label>
            <select
              value={recipe.outputFormat}
              onChange={(e) =>
                setRecipe((c) => ({
                  ...c,
                  outputFormat: e.target.value as typeof recipe.outputFormat,
                }))
              }
              className="koma-select"
            >
              <option value="png">{t("settings.downloadFormat.png")}</option>
              <option value="jpeg">{t("settings.downloadFormat.jpeg")}</option>
              <option value="webp">{t("settings.downloadFormat.webp")}</option>
            </select>
          </div>
        </div>

        {recipe.strategy === 'count' && (
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.parts")}</label>
            <input
              type="number"
              min={2}
              max={24}
              value={recipe.parts}
              onChange={(e) =>
                setRecipe((c) => ({
                  ...c,
                  parts: Math.max(2, Number(e.target.value) || 2),
                }))
              }
              className="koma-input"
            />
          </div>
        )}

        {recipe.strategy === 'fixed_height' && (
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.targetHeight")}</label>
            <input
              type="number"
              min={300}
              step={50}
              value={recipe.fixedHeight}
              onChange={(e) =>
                setRecipe((c) => ({
                  ...c,
                  fixedHeight: Math.max(300, Number(e.target.value) || 300),
                }))
              }
              className="koma-input"
            />
          </div>
        )}

        <div className="koma-dual-row">
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.minimum")}</label>
            <input
              type="number"
              min={300}
              step={50}
              value={recipe.minSegmentSize}
              onChange={(e) =>
                setRecipe((c) => ({
                  ...c,
                  minSegmentSize: Math.max(300, Number(e.target.value) || 300),
                }))
              }
              className="koma-input"
            />
          </div>
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.maximum")}</label>
            <input
              type="number"
              min={600}
              step={50}
              value={recipe.maxSegmentSize}
              onChange={(e) =>
                setRecipe((c) => ({
                  ...c,
                  maxSegmentSize: Math.max(
                    c.minSegmentSize + 50,
                    Number(e.target.value) || c.maxSegmentSize,
                  ),
                }))
              }
              className="koma-input"
            />
          </div>
        </div>
      </AioSection>

      {/* ═══ Tuning ═══ */}
      <AioSection icon={Settings2} title={t("splitter.sidebar.adjustments")} defaultOpen={false}>
        <div className="koma-split-sliders">
          <KlSlider
            label={t("splitter.sidebar.overlap", { value: recipe.overlap })}
            value={recipe.overlap}
            min={0}
            max={120}
            step={2}
            onChange={(v) => setRecipe((c) => ({ ...c, overlap: v }))}
            resetVal={0}
          />
          <KlSlider
            label={t("splitter.sidebar.whitespace", { value: recipe.whitespaceSensitivity })}
            value={recipe.whitespaceSensitivity}
            min={1}
            max={100}
            step={1}
            onChange={(v) =>
              setRecipe((c) => ({ ...c, whitespaceSensitivity: v }))
            }
            resetVal={50}
          />
          <KlSlider
            label={t("splitter.sidebar.noise", { value: recipe.noiseReduction })}
            value={recipe.noiseReduction}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setRecipe((c) => ({ ...c, noiseReduction: v }))}
            resetVal={0}
          />
          <KlSlider
            label={t("splitter.sidebar.edgeGuard", { value: recipe.edgeGuard })}
            value={recipe.edgeGuard}
            min={8}
            max={200}
            step={2}
            onChange={(v) => setRecipe((c) => ({ ...c, edgeGuard: v }))}
            resetVal={20}
          />
        </div>

        <label className="koma-checklist__item">
          <input
            type="checkbox"
            checked={recipe.protectTallBlocks}
            onChange={(e) =>
              setRecipe((c) => ({ ...c, protectTallBlocks: e.target.checked }))
            }
          />
          <span>{t("splitter.sidebar.protectTallBlocks")}</span>
        </label>

        <div className="koma-dual-row">
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.baseName")}</label>
            <input
              type="text"
              value={recipe.baseName}
              onChange={(e) =>
                setRecipe((c) => ({ ...c, baseName: e.target.value }))
              }
              className="koma-input"
              placeholder={t("splitter.sidebar.baseNamePlaceholder")}
            />
          </div>
          <div className="koma-field">
            <label className="koma-field__label">{t("splitter.sidebar.suffix")}</label>
            <input
              type="text"
              value={recipe.suffixPattern}
              onChange={(e) =>
                setRecipe((c) => ({ ...c, suffixPattern: e.target.value }))
              }
              className="koma-input"
              placeholder={t("splitter.sidebar.suffixPlaceholder")}
            />
          </div>
        </div>
        <p className="koma-tools-hint">
          {t("splitter.sidebar.tokensPrefix")} <code>{'{image}'}</code> {t("splitter.sidebar.tokensAnd")} <code>{'{index}'}</code>
        </p>
      </AioSection>

      {/* ═══ Actions ═══ */}
      <AioSection icon={Sparkles} title={t("splitter.sidebar.actions")}>
        <div
          className="koma-info-note koma-info-note--info"
          role="status"
          aria-hidden="true"
        >
          <Settings2 size={11} className="koma-info-note__icon" />
          <span>
            {t("splitter.sidebar.imagesCount", { count: imagesCount })}{' '}
            {activeImage
              ? t("splitter.sidebar.activeImage", { name: activeImage.file.name })
              : t("splitter.sidebar.selectImage")}
          </span>
        </div>

        {activeImageState?.error && (
          <div className="koma-info-note koma-info-note--warning" role="alert">
            <Wand2 size={11} className="koma-info-note__icon" />
            <span>{activeImageState.error}</span>
          </div>
        )}

        <div className="koma-split-actions">
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={() => void analyzeActiveImage(true)}
            disabled={!activeImage || processing}
          >
            <Sparkles size={11} /> {t("splitter.sidebar.reanalyze")}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={applyRecipeToSelected}
            disabled={!activeImage || processing}
          >
            <Settings2 size={11} /> {t("splitter.sidebar.applyToActive")}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={applyRecipeToAll}
            disabled={imagesCount === 0 || processing}
          >
            <Sparkles size={11} /> {t("splitter.sidebar.applyToAll")}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={clearActiveAnalysis}
            disabled={!activeImageState?.analysis || processing}
          >
            <RefreshCcw size={11} /> {t("splitter.sidebar.clearCuts")}
          </button>
        </div>

        <button
          type="button"
          className="koma-btn koma-btn--ghost koma-btn--full"
          onClick={resetRecipe}
          disabled={processing}
        >
          <RefreshCcw size={11} /> {t("splitter.sidebar.resetRecipe")}
        </button>
      </AioSection>

      {/* ═══ Export ═══ */}
      <div className="koma-execute-bar">
        <div className="koma-split-actions" style={{ marginBottom: 6 }}>
          <button
            type="button"
            className="koma-execute-bar__btn"
            disabled={!activeImage || processing}
            onClick={() => void exportCurrentSelection()}
          >
            <Download size={12} /> {t("splitter.sidebar.exportActive")}
          </button>
          <button
            type="button"
            className="koma-execute-bar__btn"
            disabled={imagesCount === 0 || processing}
            onClick={() => void exportBatch()}
          >
            <Download size={12} /> {t("splitter.sidebar.exportBatch")}
          </button>
        </div>
        <button
          type="button"
          className="koma-execute-bar__btn koma-execute-bar__btn--ghost"
          disabled={
            !directorySaveSupported || imagesCount === 0 || processing
          }
          title={
            !directorySaveSupported
              ? t("splitter.sidebar.directoryUnavailable")
              : undefined
          }
          onClick={() => void exportBatchToDirectory()}
        >
          <FolderOutput size={12} /> {t("splitter.sidebar.exportToFolder")}
        </button>
      </div>
    </div>
  );
};

export default SplitterSidebarToolbox;
