'use client';

import {
  Download,
  FolderOutput,
  RefreshCcw,
  Scissors,
  Settings2,
  Sparkles,
  Wand2,
} from 'lucide-react';

import { SPLITTER_PRESET_LABELS } from '../splitter/splitterUtils';
import type { SplitterController } from '../splitter/useSplitterController';
import type { SplitStrategy } from '../splitter/types';
import { AioSection } from '../../../pages/AioSection';
import KlSlider from '../KlSlider';
import { useI18n } from '../../../i18n';
import {
  ModeTag, Field, NumberField, Hint, Check, InfoNote,
} from '../../noir-panels/NoirPrimitives';

interface SplitterSidebarToolboxProps {
  controller: SplitterController;
  imagesCount: number;
  processing: boolean;
  hasQuotaForCurrentBatch?: boolean;
  quotaLimitButtonTitle?: string;
}

export const SplitterSidebarToolboxNoir = ({
  controller,
  imagesCount,
  processing,
  hasQuotaForCurrentBatch = true,
  quotaLimitButtonTitle = '',
}: SplitterSidebarToolboxProps) => {
  const { t } = useI18n();

  const STRATEGIES: Array<{ value: SplitStrategy; label: string; hint: string }> = [
    { value: 'smart', label: t('splitter.strategy.smart'), hint: t('splitter.strategy.smartHint') },
    { value: 'advanced_desktop', label: t('splitter.strategy.advancedDesktop'), hint: t('splitter.strategy.advancedDesktopHint') },
    { value: 'manual', label: t('splitter.strategy.manual'), hint: t('splitter.strategy.manualHint') },
    { value: 'fixed_height', label: t('splitter.strategy.fixedHeight'), hint: t('splitter.strategy.fixedHeightHint') },
    { value: 'count', label: t('splitter.strategy.count'), hint: t('splitter.strategy.countHint') },
  ];

  const {
    recipe, setRecipe, setPreset, resetRecipe, activeImage, activeImageState,
    analyzeActiveImage, applyRecipeToSelected, applyRecipeToAll, clearActiveAnalysis,
    exportCurrentSelection, exportBatch, exportBatchToDirectory, directorySaveSupported,
  } = controller;

  const strategyHint = STRATEGIES.find((s) => s.value === recipe.strategy)?.hint ?? '';

  return (
    <div className="font-display text-paper">
      <ModeTag>{t('splitter.sidebar.title')}</ModeTag>

      {/* ── RECIPE ── */}
      <AioSection icon={Scissors} title={t('splitter.sidebar.recipe')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('splitter.sidebar.preset')}>
            <select value={recipe.preset} onChange={(e) => setPreset(e.target.value as typeof recipe.preset)} className="noir-select panel-cut-sm">
              {Object.entries(SPLITTER_PRESET_LABELS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
            </select>
          </Field>
          <Field label={t('splitter.sidebar.mode')}>
            <select value={recipe.strategy} onChange={(e) => setRecipe((c) => ({ ...c, strategy: e.target.value as SplitStrategy }))} className="noir-select panel-cut-sm">
              {STRATEGIES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
          </Field>
        </div>
        <Hint>{strategyHint}</Hint>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('splitter.sidebar.direction')}>
            <select value={recipe.axis} onChange={(e) => setRecipe((c) => ({ ...c, axis: e.target.value as typeof recipe.axis }))} className="noir-select panel-cut-sm">
              <option value="vertical">{t('splitter.sidebar.vertical')}</option>
              <option value="horizontal">{t('splitter.sidebar.horizontal')}</option>
            </select>
          </Field>
          <Field label={t('common.format')}>
            <select value={recipe.outputFormat} onChange={(e) => setRecipe((c) => ({ ...c, outputFormat: e.target.value as typeof recipe.outputFormat }))} className="noir-select panel-cut-sm">
              <option value="png">{t('settings.downloadFormat.png')}</option>
              <option value="jpeg">{t('settings.downloadFormat.jpeg')}</option>
              <option value="webp">{t('settings.downloadFormat.webp')}</option>
            </select>
          </Field>
        </div>

        {recipe.strategy === 'count' && (
          <NumberField label={t('splitter.sidebar.parts')} value={recipe.parts} min={2} max={24} onChange={(v) => setRecipe((c) => ({ ...c, parts: Math.max(2, v || 2) }))} />
        )}
        {recipe.strategy === 'fixed_height' && (
          <NumberField label={t('splitter.sidebar.targetHeight')} value={recipe.fixedHeight} min={300} step={50} onChange={(v) => setRecipe((c) => ({ ...c, fixedHeight: Math.max(300, v || 300) }))} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <NumberField label={t('splitter.sidebar.minimum')} value={recipe.minSegmentSize} min={300} step={50} onChange={(v) => setRecipe((c) => ({ ...c, minSegmentSize: Math.max(300, v || 300) }))} />
          <NumberField label={t('splitter.sidebar.maximum')} value={recipe.maxSegmentSize} min={600} step={50} onChange={(v) => setRecipe((c) => ({ ...c, maxSegmentSize: Math.max(c.minSegmentSize + 50, v || c.maxSegmentSize) }))} />
        </div>
      </AioSection>

      {/* ── TUNING ── */}
      <AioSection icon={Settings2} title={t('splitter.sidebar.adjustments')} defaultOpen={false}>
        <div className="space-y-2">
          <KlSlider label={t('splitter.sidebar.overlap', { value: recipe.overlap })} value={recipe.overlap} min={0} max={120} step={2} onChange={(v) => setRecipe((c) => ({ ...c, overlap: v }))} resetVal={0} />
          <KlSlider label={t('splitter.sidebar.whitespace', { value: recipe.whitespaceSensitivity })} value={recipe.whitespaceSensitivity} min={1} max={100} step={1} onChange={(v) => setRecipe((c) => ({ ...c, whitespaceSensitivity: v }))} resetVal={50} />
          <KlSlider label={t('splitter.sidebar.noise', { value: recipe.noiseReduction })} value={recipe.noiseReduction} min={0} max={100} step={1} onChange={(v) => setRecipe((c) => ({ ...c, noiseReduction: v }))} resetVal={0} />
          <KlSlider label={t('splitter.sidebar.edgeGuard', { value: recipe.edgeGuard })} value={recipe.edgeGuard} min={8} max={200} step={2} onChange={(v) => setRecipe((c) => ({ ...c, edgeGuard: v }))} resetVal={20} />
        </div>

        <Check label={t('splitter.sidebar.protectTallBlocks')} checked={recipe.protectTallBlocks} onChange={(v) => setRecipe((c) => ({ ...c, protectTallBlocks: v }))} />

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('splitter.sidebar.baseName')}>
            <input type="text" value={recipe.baseName} onChange={(e) => setRecipe((c) => ({ ...c, baseName: e.target.value }))} className="noir-input panel-cut-sm" placeholder={t('splitter.sidebar.baseNamePlaceholder')} />
          </Field>
          <Field label={t('splitter.sidebar.suffix')}>
            <input type="text" value={recipe.suffixPattern} onChange={(e) => setRecipe((c) => ({ ...c, suffixPattern: e.target.value }))} className="noir-input panel-cut-sm" placeholder={t('splitter.sidebar.suffixPlaceholder')} />
          </Field>
        </div>
        <Hint><span dangerouslySetInnerHTML={{ __html: `${t('splitter.sidebar.tokensPrefix')} <code class="text-crimson">{image}</code> ${t('splitter.sidebar.tokensAnd')} <code class="text-crimson">{index}</code>` }} /></Hint>
      </AioSection>

      {/* ── ACTIONS ── */}
      <AioSection icon={Sparkles} title={t('splitter.sidebar.actions')}>
        <InfoNote icon={Settings2} tone="azure">
          {t('splitter.sidebar.imagesCount', { count: imagesCount })}{' '}
          {activeImage ? t('splitter.sidebar.activeImage', { name: activeImage.file.name }) : t('splitter.sidebar.selectImage')}
        </InfoNote>

        {activeImageState?.error && (
          <InfoNote icon={Wand2} tone="gold" role="alert">{activeImageState.error}</InfoNote>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost panel-cut-sm" onClick={() => void analyzeActiveImage(true)} disabled={!activeImage || processing}><Sparkles size={11} /> {t('splitter.sidebar.reanalyze')}</button>
          <button type="button" className="btn-ghost panel-cut-sm" onClick={applyRecipeToSelected} disabled={!activeImage || processing}><Settings2 size={11} /> {t('splitter.sidebar.applyToActive')}</button>
          <button type="button" className="btn-ghost panel-cut-sm" onClick={applyRecipeToAll} disabled={imagesCount === 0 || processing}><Sparkles size={11} /> {t('splitter.sidebar.applyToAll')}</button>
          <button type="button" className="btn-ghost panel-cut-sm" onClick={clearActiveAnalysis} disabled={!activeImageState?.analysis || processing}><RefreshCcw size={11} /> {t('splitter.sidebar.clearCuts')}</button>
        </div>
        <button type="button" className="btn-ghost panel-cut-sm w-full" onClick={resetRecipe} disabled={processing}><RefreshCcw size={11} /> {t('splitter.sidebar.resetRecipe')}</button>
      </AioSection>

      {/* ── EXPORT ── */}
      <div className="sticky bottom-0 z-10 space-y-2 border-t border-paper/8 bg-ink/90 py-3 backdrop-blur-md">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary panel-cut-sm" disabled={!activeImage || processing || !hasQuotaForCurrentBatch} title={quotaLimitButtonTitle} onClick={() => void exportCurrentSelection()}><Download size={12} /> {t('splitter.sidebar.exportActive')}</button>
          <button type="button" className="btn-primary panel-cut-sm" disabled={imagesCount === 0 || processing || !hasQuotaForCurrentBatch} title={quotaLimitButtonTitle} onClick={() => void exportBatch()}><Download size={12} /> {t('splitter.sidebar.exportBatch')}</button>
        </div>
        <button type="button" className="btn-ghost panel-cut-sm w-full" disabled={!directorySaveSupported || imagesCount === 0 || processing || !hasQuotaForCurrentBatch} title={!directorySaveSupported ? t('splitter.sidebar.directoryUnavailable') : quotaLimitButtonTitle} onClick={() => void exportBatchToDirectory()}><FolderOutput size={12} /> {t('splitter.sidebar.exportToFolder')}</button>
      </div>
    </div>
  );
};

export default SplitterSidebarToolboxNoir;
