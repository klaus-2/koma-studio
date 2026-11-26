import { useMemo } from 'react';
import { BookOpen, HardDrive, Languages, Plus, ScanText, Sparkles, Zap } from 'lucide-react';

import ImageEditCompatibilityBanner from '../../../components/dashboard/ImageEditCompatibilityBanner';
import ImageEditModelConfigFields from '../../../components/dashboard/ImageEditModelConfigFields';
import ImageEditModelGuideCard from '../../../components/dashboard/ImageEditModelGuideCard';
import { useI18n } from '../../../i18n';
import type { AioStageOption } from '../../../models/aioStageCatalog';
import { IMAGE_EDIT_MODELS_REGISTRY } from '../../../models/translation-models-registry';
import { useModelManagerStatusSnapshot } from '../../../hooks/useModelManager';
import { getCustomLlmProviderNotice, type CustomLlmProfile } from '../../../utils/customLlm';
import { GLOSSARY_MAX_TERMS, mergeWorkGlossary } from '../../../utils/glossary';
import {
  formatLocalImageEditModelKey,
  getLocalImageEditSpec,
  type LocalImageEditModelId,
} from '../../../utils/imageEditLocalModels';
import type {
  AioAiExecutionMode,
  AioAiSfxMode,
  AioAiStyleMode,
} from '../../../utils/imageEditModelConfig';
import { DIRECT_IMAGES_CHAPTER_ID } from '../lib/aio-chapters';
import { useAioPipelineStore } from '../stores/aio-pipeline-store';
import { useCleanerStore } from '../stores/cleaner-store';
import { useImageCollectionStore } from '../stores/image-collection-store';
import { useLlmProvidersStore } from '../stores/llm-providers-store';
import { useWorksStore } from '../stores/works-store';
import { AioChecklistOption, aioPanelClasses } from './AioRightPanel.skin';
import styles from './AioAiConfigPanel.module.css';

interface AioAiConfigPanelProps {
  noir: boolean;
  cleanCustomProfiles: CustomLlmProfile[];
  availableDetectStageOptions: AioStageOption[];
  availableOcrStageOptions: AioStageOption[];
  availableTranslationStageOptions: AioStageOption[];
  formatAioStageOptionLabel: (option: AioStageOption) => string;
  onOpenStageModelManager: (
    stage: 'detectText' | 'recognizeText' | 'getTranslations',
  ) => void;
}

const EXECUTION_MODES: ReadonlyArray<{
  key: AioAiExecutionMode;
  Icon: typeof Zap;
  labelKey: 'dashboard.aio.ai.mode.direct.label' | 'dashboard.aio.ai.mode.hybrid_guided.label' | 'dashboard.aio.ai.mode.script_guided.label';
  descKey: 'dashboard.aio.ai.mode.direct.desc' | 'dashboard.aio.ai.mode.hybrid_guided.desc' | 'dashboard.aio.ai.mode.script_guided.desc';
}> = [
  {
    key: 'direct',
    Icon: Zap,
    labelKey: 'dashboard.aio.ai.mode.direct.label',
    descKey: 'dashboard.aio.ai.mode.direct.desc',
  },
  {
    key: 'hybrid_guided',
    Icon: ScanText,
    labelKey: 'dashboard.aio.ai.mode.hybrid_guided.label',
    descKey: 'dashboard.aio.ai.mode.hybrid_guided.desc',
  },
  {
    key: 'script_guided',
    Icon: Languages,
    labelKey: 'dashboard.aio.ai.mode.script_guided.label',
    descKey: 'dashboard.aio.ai.mode.script_guided.desc',
  },
];

const INSTRUCTION_CHIPS: ReadonlyArray<{
  key: 'keepHonorifics' | 'handwrittenThoughts' | 'boldShouts' | 'preserveSfx';
  labelKey: 'dashboard.aio.ai.chip.keepHonorifics.label' | 'dashboard.aio.ai.chip.handwrittenThoughts.label' | 'dashboard.aio.ai.chip.boldShouts.label' | 'dashboard.aio.ai.chip.preserveSfx.label';
  snippetKey: 'dashboard.aio.ai.chip.keepHonorifics.text' | 'dashboard.aio.ai.chip.handwrittenThoughts.text' | 'dashboard.aio.ai.chip.boldShouts.text' | 'dashboard.aio.ai.chip.preserveSfx.text';
}> = [
  {
    key: 'keepHonorifics',
    labelKey: 'dashboard.aio.ai.chip.keepHonorifics.label',
    snippetKey: 'dashboard.aio.ai.chip.keepHonorifics.text',
  },
  {
    key: 'handwrittenThoughts',
    labelKey: 'dashboard.aio.ai.chip.handwrittenThoughts.label',
    snippetKey: 'dashboard.aio.ai.chip.handwrittenThoughts.text',
  },
  {
    key: 'boldShouts',
    labelKey: 'dashboard.aio.ai.chip.boldShouts.label',
    snippetKey: 'dashboard.aio.ai.chip.boldShouts.text',
  },
  {
    key: 'preserveSfx',
    labelKey: 'dashboard.aio.ai.chip.preserveSfx.label',
    snippetKey: 'dashboard.aio.ai.chip.preserveSfx.text',
  },
];

const findOptionLabel = (
  options: ReadonlyArray<AioStageOption>,
  key: string,
  format: (option: AioStageOption) => string,
): string => {
  const found = options.find((opt) => opt.key === key);
  return found ? format(found) : key;
};

export default function AioAiConfigPanel({
  noir,
  cleanCustomProfiles,
  availableDetectStageOptions,
  availableOcrStageOptions,
  availableTranslationStageOptions,
  formatAioStageOptionLabel,
  onOpenStageModelManager,
}: AioAiConfigPanelProps) {
  const { t } = useI18n();
  const skin = aioPanelClasses(noir);

  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const aioLanguageOptions = useAioPipelineStore((s) => s.aioLanguageOptions);
  const aioStageSelection = useAioPipelineStore((s) => s.aioStageSelection);

  const aioAiModelKey = useAioPipelineStore((s) => s.aioAiModelKey);
  const setAioAiModelKey = useAioPipelineStore((s) => s.setAioAiModelKey);
  const aioAiInstructions = useAioPipelineStore((s) => s.aioAiInstructions);
  const setAioAiInstructions = useAioPipelineStore((s) => s.setAioAiInstructions);
  const aioAiOptions = useAioPipelineStore((s) => s.aioAiOptions);
  const setAioAiOptions = useAioPipelineStore((s) => s.setAioAiOptions);
  const aioAiModelConfig = useAioPipelineStore((s) => s.aioAiModelConfig);
  const setAioAiModelConfig = useAioPipelineStore((s) => s.setAioAiModelConfig);

  const openImageEditModelManager = useCleanerStore(
    (s) => s.openImageEditModelManager,
  );
  const globalGlossary = useLlmProvidersStore((s) => s.llmSettings.glossary);
  const works = useWorksStore((s) => s.works);
  const images = useImageCollectionStore((s) => s.images);
  const activeId = useImageCollectionStore((s) => s.activeId);

  const { entries: modelEntries } = useModelManagerStatusSnapshot();

  const selectedLocalSpec = useMemo(
    () => getLocalImageEditSpec(aioAiModelKey),
    [aioAiModelKey],
  );
  const selectedLocalRegistryEntry = useMemo(
    () =>
      selectedLocalSpec
        ? (IMAGE_EDIT_MODELS_REGISTRY.find((m) => m.id === selectedLocalSpec.id) ?? null)
        : null,
    [selectedLocalSpec],
  );
  const selectedLocalInstalled = selectedLocalSpec
    ? modelEntries[selectedLocalSpec.id]?.status === 'installed'
    : true;

  const selectedProfile = useMemo(
    () =>
      cleanCustomProfiles.find(
        (profile) => `custom_clean:${profile.id}` === aioAiModelKey,
      ) ?? null,
    [aioAiModelKey, cleanCustomProfiles],
  );

  const activeGlossaryCount = useMemo(() => {
    const activeImage =
      images.find((img) => img.id === activeId) ?? images[0] ?? null;
    const chapterLabel =
      activeImage?.chapterLabel?.trim() || DIRECT_IMAGES_CHAPTER_ID;
    const activeWork = works.find((work) =>
      work.chapterLabels.includes(chapterLabel),
    );
    return mergeWorkGlossary(
      globalGlossary ?? [],
      activeWork?.terms ?? [],
      GLOSSARY_MAX_TERMS,
    ).length;
  }, [activeId, globalGlossary, images, works]);

  const appendInstructionSnippet = (snippet: string): void => {
    const normalized = snippet.trim();
    if (!normalized) return;
    if (aioAiInstructions.toLowerCase().includes(normalized.toLowerCase())) {
      return;
    }
    const separator = aioAiInstructions.trim().length > 0 ? '\n' : '';
    setAioAiInstructions(`${aioAiInstructions.trimEnd()}${separator}${normalized}`);
  };

  const providerNotice = selectedProfile
    ? getCustomLlmProviderNotice(selectedProfile.apiBase)
    : null;

  return (
    <div className={`${styles.panel} ${noir ? styles.noir : ''}`}>
      <div className={styles.langRow}>
        <div className="koma-field">
          <span className={skin.label}>{t('dashboard.aio.config.sourceLanguage')}</span>
          <select
            value={aioSrcLang}
            onChange={(e) => setAioSrcLang(e.target.value)}
            className={skin.select}
            aria-label={t('dashboard.aio.config.sourceLanguage')}
          >
            {aioLanguageOptions.source.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </div>
        <div className="koma-field">
          <span className={skin.label}>{t('dashboard.aio.config.targetLanguage')}</span>
          <select
            value={aioTgtLang}
            onChange={(e) => setAioTgtLang(e.target.value)}
            className={skin.select}
            aria-label={t('dashboard.aio.config.targetLanguage')}
          >
            {aioLanguageOptions.target.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="koma-field">
        <div className={styles.labelRow}>
          <span className={skin.label}>
            <Sparkles size={10} className={styles.inlineIcon} aria-hidden="true" />
            {t('dashboard.aio.ai.modelLabel')}
          </span>
          <button
            type="button"
            onClick={() => openImageEditModelManager('aio_ai')}
            className={
              noir
                ? 'flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-paper-dim transition-colors hover:text-crimson'
                : 'koma-model-slot__manage'
            }
          >
            <HardDrive size={9} aria-hidden="true" />
            {t('dashboard.cleaner.models.button')}
          </button>
        </div>

        <select
          value={selectedProfile || selectedLocalSpec ? aioAiModelKey : ''}
          onChange={(e) => setAioAiModelKey(e.target.value)}
          className={skin.select}
          aria-label={t('dashboard.aio.ai.modelLabel')}
        >
          <option value="" disabled>
            {t('dashboard.aio.clean.aiClean.modelPickerPlaceholder')}
          </option>
          <optgroup label={t('dashboard.imageEdit.optgroup.localHf')}>
            {IMAGE_EDIT_MODELS_REGISTRY.map((model) => {
              const key = formatLocalImageEditModelKey(model.id as LocalImageEditModelId);
              const installed = modelEntries[model.id]?.status === 'installed';
              return (
                <option key={key} value={key}>
                  {`${model.name} · ${model.requirements.vramMin}${
                    installed ? '' : ` · ${t('dashboard.imageEdit.notInstalledTag')}`
                  }`}
                </option>
              );
            })}
          </optgroup>
          {cleanCustomProfiles.length > 0 && (
            <optgroup label={t('dashboard.imageEdit.optgroup.cloudApi')}>
              {cleanCustomProfiles.map((profile) => (
                <option key={profile.id} value={`custom_clean:${profile.id}`}>
                  {`${profile.label} (${profile.model})`}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {!selectedProfile && !selectedLocalSpec && (
          <p className={skin.hint}>
            {t('dashboard.aio.ai.emptyModelHint')}
          </p>
        )}

        {selectedLocalSpec && (
          <>
            <ImageEditCompatibilityBanner
              model={selectedLocalSpec.id}
              targetMode="aio_ai"
              noir={noir}
            />
            {!selectedLocalInstalled && (
              <p className={skin.hint}>
                {t('dashboard.imageEdit.localNotInstalledHint', {
                  model: selectedLocalSpec.name,
                  size: selectedLocalRegistryEntry?.fileSize ?? '',
                })}
              </p>
            )}
          </>
        )}

        {selectedProfile && (
          <ImageEditCompatibilityBanner
            model={selectedProfile.model}
            apiBase={selectedProfile.apiBase}
            protocol={selectedProfile.protocol}
            targetMode="aio_ai"
            noir={noir}
          />
        )}

        {providerNotice && <p className={skin.hint}>{providerNotice}</p>}
      </div>

      <ImageEditModelGuideCard
        mode="aio_ai"
        noir={noir}
        compact
        defaultOpen={!selectedProfile && !selectedLocalSpec}
      />

      <div className="koma-field">
        <span className={skin.label}>{t('dashboard.aio.ai.strategyTitle')}</span>
        <div role="radiogroup" aria-label={t('dashboard.aio.ai.strategyTitle')} className={styles.strategyList}>
          {EXECUTION_MODES.map(({ key, Icon, labelKey, descKey }) => {
            const active = aioAiOptions.executionMode === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() =>
                  setAioAiOptions({
                    ...aioAiOptions,
                    executionMode: key,
                  })
                }
                className={`${styles.strategyCard} ${active ? styles.strategyCardActive : ''}`}
              >
                <div className={styles.strategyHead}>
                  <Icon size={12} className={styles.strategyIcon} aria-hidden="true" />
                  <span className={styles.strategyName}>{t(labelKey)}</span>
                </div>
                <p className={styles.strategyDesc}>{t(descKey)}</p>
              </button>
            );
          })}
        </div>

        {aioAiOptions.executionMode !== 'direct' && (
          <div className={styles.guidedSummary}>
            <div className={styles.guidedRow}>
              <span className={styles.guidedLabel}>{t('aio.stage.detectText.short')}:</span>
              <button
                type="button"
                className={styles.guidedModelLink}
                onClick={() => onOpenStageModelManager('detectText')}
              >
                {findOptionLabel(
                  availableDetectStageOptions,
                  aioStageSelection.detectText,
                  formatAioStageOptionLabel,
                )}
              </button>
            </div>
            {aioAiOptions.executionMode === 'script_guided' && (
              <>
                <div className={styles.guidedRow}>
                  <span className={styles.guidedLabel}>{t('aio.stage.recognizeText.short')}:</span>
                  <button
                    type="button"
                    className={styles.guidedModelLink}
                    onClick={() => onOpenStageModelManager('recognizeText')}
                  >
                    {findOptionLabel(
                      availableOcrStageOptions,
                      aioStageSelection.recognizeText,
                      formatAioStageOptionLabel,
                    )}
                  </button>
                </div>
                <div className={styles.guidedRow}>
                  <span className={styles.guidedLabel}>{t('aio.stage.getTranslations.short')}:</span>
                  <button
                    type="button"
                    className={styles.guidedModelLink}
                    onClick={() => onOpenStageModelManager('getTranslations')}
                  >
                    {findOptionLabel(
                      availableTranslationStageOptions,
                      aioStageSelection.getTranslations,
                      formatAioStageOptionLabel,
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.twoCol}>
        <div className="koma-field">
          <span className={skin.label}>{t('dashboard.aio.ai.styleModeLabel')}</span>
          <select
            value={aioAiOptions.styleMode}
            onChange={(e) =>
              setAioAiOptions({
                ...aioAiOptions,
                styleMode: e.target.value as AioAiStyleMode,
              })
            }
            className={skin.select}
            aria-label={t('dashboard.aio.ai.styleModeLabel')}
          >
            <option value="match_original">{t('dashboard.aio.ai.styleMode.matchOriginal')}</option>
            <option value="clean_comic">{t('dashboard.aio.ai.styleMode.cleanComic')}</option>
            <option value="custom">{t('dashboard.aio.ai.styleMode.custom')}</option>
          </select>
        </div>

        <div className="koma-field">
          <span className={skin.label}>{t('dashboard.aio.ai.sfxModeLabel')}</span>
          <select
            value={aioAiOptions.sfxMode}
            onChange={(e) =>
              setAioAiOptions({
                ...aioAiOptions,
                sfxMode: e.target.value as AioAiSfxMode,
              })
            }
            className={skin.select}
            aria-label={t('dashboard.aio.ai.sfxModeLabel')}
          >
            <option value="translate">{t('dashboard.aio.ai.sfxMode.translate')}</option>
            <option value="keep">{t('dashboard.aio.ai.sfxMode.keep')}</option>
            <option value="clean_only">{t('dashboard.aio.ai.sfxMode.cleanOnly')}</option>
          </select>
        </div>
      </div>

      <div className={styles.checksList}>
        <AioChecklistOption
          noir={noir}
          checked={aioAiOptions.refineAlignment}
          label={t('dashboard.aio.ai.option.refineAlignment')}
          onChange={(checked) =>
            setAioAiOptions({ ...aioAiOptions, refineAlignment: checked })
          }
        />
        <AioChecklistOption
          noir={noir}
          checked={aioAiOptions.preserveArtwork}
          disabled={aioAiOptions.executionMode === 'direct'}
          label={t('dashboard.aio.ai.option.preserveArtwork')}
          onChange={(checked) =>
            setAioAiOptions({ ...aioAiOptions, preserveArtwork: checked })
          }
        />
        {aioAiOptions.executionMode === 'direct' && (
          <p className={skin.hint}>
            {t('dashboard.aio.ai.option.preserveArtworkHint')}
          </p>
        )}
        <AioChecklistOption
          noir={noir}
          checked={aioAiOptions.skipEmptyPages}
          label={t('dashboard.aio.ai.option.skipEmptyPages')}
          onChange={(checked) =>
            setAioAiOptions({ ...aioAiOptions, skipEmptyPages: checked })
          }
        />
      </div>

      <div className="koma-field">
        <div className={styles.labelRow}>
          <span className={skin.label}>{t('dashboard.aio.ai.instructionsLabel')}</span>
          <span className={styles.glossaryBadge}>
            <BookOpen size={10} aria-hidden="true" />
            {t('dashboard.aio.ai.glossaryCount', { count: activeGlossaryCount })}
          </span>
        </div>
        <textarea
          value={aioAiInstructions}
          onChange={(e) => setAioAiInstructions(e.target.value)}
          className={noir ? 'noir-textarea panel-cut-sm' : 'koma-input'}
          rows={3}
          placeholder={t('dashboard.aio.ai.instructionsPlaceholder')}
          aria-label={t('dashboard.aio.ai.instructionsLabel')}
        />
        <div className={styles.chipsRow}>
          {INSTRUCTION_CHIPS.map(({ key, labelKey, snippetKey }) => (
            <button
              key={key}
              type="button"
              className={styles.chipButton}
              onClick={() => appendInstructionSnippet(t(snippetKey))}
            >
              <Plus size={10} aria-hidden="true" />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <ImageEditModelConfigFields
        config={aioAiModelConfig}
        onChange={setAioAiModelConfig}
        protocol={selectedProfile?.protocol}
        apiBase={selectedProfile?.apiBase}
        isLocalDiffusers={Boolean(selectedLocalSpec)}
        showCompositeMargin={
          aioAiOptions.preserveArtwork && aioAiOptions.executionMode !== 'direct'
        }
        noir={noir}
      />
    </div>
  );
}
