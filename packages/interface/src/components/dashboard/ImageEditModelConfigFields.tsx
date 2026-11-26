import { useMemo, useState } from 'react';
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { CleanProtocol } from '../../utils/customLlm';
import {
  DEFAULT_IMAGE_EDIT_MODEL_CONFIG,
  getProtocolSupportedModelParams,
  sanitizeImageEditModelConfig,
  type AspectRatioStrategy,
  type ImageEditModelConfig,
  type ImageQualityPreset,
  type InputFidelityPreset,
  type ProtocolModelParamSupport,
  type SlicingMode,
} from '../../utils/imageEditModelConfig';
import styles from './ImageEditModelConfigFields.module.css';

interface ImageEditModelConfigFieldsProps {
  config: ImageEditModelConfig;
  onChange: (next: ImageEditModelConfig) => void;
  protocol?: CleanProtocol;
  apiBase?: string;
  isLocalDiffusers?: boolean;
  showCompositeMargin?: boolean;
  noir?: boolean;
}

const parseOptionalFloat = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseOptionalInt = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

function SupportPill({ support }: { support: ProtocolModelParamSupport }) {
  const { t } = useI18n();
  if (support === 'supported') {
    return null;
  }
  return (
    <span
      className={`${styles.supportPill} ${
        support === 'partial' ? styles.supportPartial : styles.supportIgnored
      }`}
    >
      {support === 'partial'
        ? t('dashboard.imageEdit.config.paramSupport.partial')
        : t('dashboard.imageEdit.config.paramSupport.ignored')}
    </span>
  );
}

export default function ImageEditModelConfigFields({
  config,
  onChange,
  protocol,
  apiBase = '',
  isLocalDiffusers = false,
  showCompositeMargin = false,
  noir = false,
}: ImageEditModelConfigFieldsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const supportMatrix = useMemo(
    () => getProtocolSupportedModelParams(protocol, apiBase, isLocalDiffusers),
    [apiBase, isLocalDiffusers, protocol],
  );

  const isModified = useMemo(
    () =>
      config.temperature !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.temperature ||
      config.topP !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.topP ||
      config.maxTokens !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.maxTokens ||
      config.seed !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.seed ||
      config.numInferenceSteps !==
        DEFAULT_IMAGE_EDIT_MODEL_CONFIG.numInferenceSteps ||
      config.guidanceScale !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.guidanceScale ||
      config.imageQuality !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.imageQuality ||
      config.inputFidelity !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.inputFidelity ||
      config.aspectRatioStrategy !==
        DEFAULT_IMAGE_EDIT_MODEL_CONFIG.aspectRatioStrategy ||
      config.slicingMode !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.slicingMode ||
      config.segmentHeight !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.segmentHeight ||
      config.segmentOverlap !== DEFAULT_IMAGE_EDIT_MODEL_CONFIG.segmentOverlap ||
      config.maxConcurrentSegments !==
        DEFAULT_IMAGE_EDIT_MODEL_CONFIG.maxConcurrentSegments ||
      config.compositeMaskMargin !==
        DEFAULT_IMAGE_EDIT_MODEL_CONFIG.compositeMaskMargin,
    [config],
  );

  const patchConfig = (partial: Partial<ImageEditModelConfig>): void => {
    onChange(sanitizeImageEditModelConfig({ ...config, ...partial }));
  };

  return (
    <div className={`${styles.root} ${noir ? styles.noir : ''}`}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.triggerLeft}>
          <SlidersHorizontal size={12} className={styles.triggerIcon} aria-hidden="true" />
          <span className={styles.triggerTitle}>{t('dashboard.imageEdit.config.title')}</span>
          {isModified && (
            <span className={styles.customDot} aria-hidden="true" />
          )}
        </span>
        <ChevronDown
          size={13}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.imageQuality')}</span>
                <SupportPill support={supportMatrix.imageQuality} />
              </label>
              <select
                value={config.imageQuality}
                onChange={(e) =>
                  patchConfig({
                    imageQuality: e.target.value as ImageQualityPreset,
                  })
                }
                className={noir ? 'noir-select panel-cut-sm' : 'koma-select'}
                aria-label={t('dashboard.imageEdit.config.imageQuality')}
              >
                <option value="auto">{t('dashboard.imageEdit.config.quality.auto')}</option>
                <option value="1k">{t('dashboard.imageEdit.config.quality.1k')}</option>
                <option value="2k">{t('dashboard.imageEdit.config.quality.2k')}</option>
                <option value="4k">{t('dashboard.imageEdit.config.quality.4k')}</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.inputFidelity')}</span>
                <SupportPill support={supportMatrix.inputFidelity} />
              </label>
              <select
                value={config.inputFidelity}
                onChange={(e) =>
                  patchConfig({
                    inputFidelity: e.target.value as InputFidelityPreset,
                  })
                }
                className={noir ? 'noir-select panel-cut-sm' : 'koma-select'}
                aria-label={t('dashboard.imageEdit.config.inputFidelity')}
              >
                <option value="high">{t('dashboard.imageEdit.config.fidelity.high')}</option>
                <option value="low">{t('dashboard.imageEdit.config.fidelity.low')}</option>
              </select>
            </div>

            <div className={`${styles.field} ${styles.fullRow}`}>
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.aspectRatioStrategy')}</span>
                <SupportPill support={supportMatrix.aspectRatioStrategy} />
              </label>
              <select
                value={config.aspectRatioStrategy}
                onChange={(e) =>
                  patchConfig({
                    aspectRatioStrategy: e.target.value as AspectRatioStrategy,
                  })
                }
                className={noir ? 'noir-select panel-cut-sm' : 'koma-select'}
                aria-label={t('dashboard.imageEdit.config.aspectRatioStrategy')}
              >
                <option value="auto">{t('dashboard.imageEdit.config.aspectRatio.auto')}</option>
                <option value="pad_unpad">{t('dashboard.imageEdit.config.aspectRatio.padUnpad')}</option>
              </select>
            </div>

            <div className={`${styles.field} ${styles.fullRow}`}>
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.slicingMode')}</span>
              </label>
              <select
                value={config.slicingMode}
                onChange={(e) =>
                  patchConfig({
                    slicingMode: e.target.value as SlicingMode,
                  })
                }
                className={noir ? 'noir-select panel-cut-sm' : 'koma-select'}
                aria-label={t('dashboard.imageEdit.config.slicingMode')}
              >
                <option value="auto">{t('dashboard.imageEdit.config.slicing.auto')}</option>
                <option value="disabled">{t('dashboard.imageEdit.config.slicing.disabled')}</option>
                <option value="custom">{t('dashboard.imageEdit.config.slicing.custom')}</option>
              </select>
            </div>

            {config.slicingMode === 'custom' && (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <span>{t('dashboard.imageEdit.config.segmentHeight')}</span>
                  </label>
                  <input
                    type="number"
                    min={600}
                    max={2800}
                    step={50}
                    value={config.segmentHeight}
                    onChange={(e) =>
                      patchConfig({
                        segmentHeight:
                          parseOptionalInt(e.target.value) ??
                          DEFAULT_IMAGE_EDIT_MODEL_CONFIG.segmentHeight,
                      })
                    }
                    className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    <span>{t('dashboard.imageEdit.config.segmentOverlap')}</span>
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={400}
                    step={10}
                    value={config.segmentOverlap}
                    onChange={(e) =>
                      patchConfig({
                        segmentOverlap:
                          parseOptionalInt(e.target.value) ??
                          DEFAULT_IMAGE_EDIT_MODEL_CONFIG.segmentOverlap,
                      })
                    }
                    className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
                  />
                </div>
                <div className={`${styles.field} ${styles.fullRow}`}>
                  <label className={styles.label}>
                    <span>{t('dashboard.imageEdit.config.maxConcurrentSegments')}</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    step={1}
                    value={config.maxConcurrentSegments}
                    onChange={(e) =>
                      patchConfig({
                        maxConcurrentSegments:
                          parseOptionalInt(e.target.value) ??
                          DEFAULT_IMAGE_EDIT_MODEL_CONFIG.maxConcurrentSegments,
                      })
                    }
                    className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
                  />
                </div>
              </>
            )}

            {showCompositeMargin && (
              <div className={`${styles.field} ${styles.fullRow}`}>
                <label className={styles.label}>
                  <span>{t('dashboard.imageEdit.config.compositeMaskMargin')}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={48}
                  step={2}
                  value={config.compositeMaskMargin}
                  onChange={(e) =>
                    patchConfig({
                      compositeMaskMargin:
                        parseOptionalInt(e.target.value) ??
                        DEFAULT_IMAGE_EDIT_MODEL_CONFIG.compositeMaskMargin,
                    })
                  }
                  className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
                />
              </div>
            )}

            <div
              className={`${styles.field} ${
                supportMatrix.temperature === 'ignored' ? styles.fieldDimmed : ''
              }`}
            >
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.temperature')}</span>
                <SupportPill support={supportMatrix.temperature} />
              </label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={config.temperature ?? ''}
                placeholder={t('dashboard.imageEdit.config.defaultPlaceholder')}
                onChange={(e) =>
                  patchConfig({
                    temperature: parseOptionalFloat(e.target.value),
                  })
                }
                className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
              />
            </div>

            <div
              className={`${styles.field} ${
                supportMatrix.topP === 'ignored' ? styles.fieldDimmed : ''
              }`}
            >
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.topP')}</span>
                <SupportPill support={supportMatrix.topP} />
              </label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={config.topP ?? ''}
                placeholder={t('dashboard.imageEdit.config.defaultPlaceholder')}
                onChange={(e) =>
                  patchConfig({
                    topP: parseOptionalFloat(e.target.value),
                  })
                }
                className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
              />
            </div>

            <div
              className={`${styles.field} ${
                supportMatrix.maxTokens === 'ignored' ? styles.fieldDimmed : ''
              }`}
            >
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.maxTokens')}</span>
                <SupportPill support={supportMatrix.maxTokens} />
              </label>
              <input
                type="number"
                min={128}
                max={16384}
                step={128}
                value={config.maxTokens ?? ''}
                placeholder={t('dashboard.imageEdit.config.defaultPlaceholder')}
                onChange={(e) =>
                  patchConfig({
                    maxTokens: parseOptionalInt(e.target.value),
                  })
                }
                className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
              />
            </div>

            <div
              className={`${styles.field} ${
                supportMatrix.numInferenceSteps === 'ignored'
                  ? styles.fieldDimmed
                  : ''
              }`}
            >
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.numInferenceSteps')}</span>
                <SupportPill support={supportMatrix.numInferenceSteps} />
              </label>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={config.numInferenceSteps ?? ''}
                placeholder={t('dashboard.imageEdit.config.defaultPlaceholder')}
                onChange={(e) =>
                  patchConfig({
                    numInferenceSteps: parseOptionalInt(e.target.value),
                  })
                }
                className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
                aria-label={t('dashboard.imageEdit.config.numInferenceSteps')}
              />
            </div>

            <div
              className={`${styles.field} ${
                supportMatrix.guidanceScale === 'ignored'
                  ? styles.fieldDimmed
                  : ''
              }`}
            >
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.guidanceScale')}</span>
                <SupportPill support={supportMatrix.guidanceScale} />
              </label>
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={config.guidanceScale ?? ''}
                placeholder={t('dashboard.imageEdit.config.defaultPlaceholder')}
                onChange={(e) =>
                  patchConfig({
                    guidanceScale: parseOptionalFloat(e.target.value),
                  })
                }
                className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
                aria-label={t('dashboard.imageEdit.config.guidanceScale')}
              />
            </div>

            <div
              className={`${styles.field} ${
                supportMatrix.seed === 'ignored' ? styles.fieldDimmed : ''
              }`}
            >
              <label className={styles.label}>
                <span>{t('dashboard.imageEdit.config.seed')}</span>
                <SupportPill support={supportMatrix.seed} />
              </label>
              <input
                type="number"
                min={0}
                max={2147483647}
                step={1}
                value={config.seed ?? ''}
                placeholder={t('dashboard.imageEdit.config.randomPlaceholder')}
                onChange={(e) =>
                  patchConfig({
                    seed: parseOptionalInt(e.target.value),
                  })
                }
                className={noir ? 'noir-input panel-cut-sm' : 'koma-input'}
              />
            </div>
          </div>

          <div className={styles.footerRow}>
            <span className={styles.protocolNote}>
              {t('dashboard.imageEdit.config.protocolNote', {
                protocol: supportMatrix.resolvedProtocol,
              })}
            </span>
            {isModified && (
              <button
                type="button"
                className={styles.resetButton}
                onClick={() => onChange({ ...DEFAULT_IMAGE_EDIT_MODEL_CONFIG })}
              >
                <RotateCcw size={11} aria-hidden="true" />
                {t('dashboard.imageEdit.config.reset')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
