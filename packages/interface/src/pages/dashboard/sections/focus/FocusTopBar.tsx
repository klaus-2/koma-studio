import { memo } from 'react';
import { Check, Settings } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { TranslationKey } from '../../../../i18n/messages';
import {
  FOCUS_STEP_ORDER,
  type FocusStepId,
} from '../../lib/focus-flow';
import { useAioPipelineStore } from '../../stores/aio-pipeline-store';
import { useUiShellStore } from '../../stores/ui-shell-store';

const STEP_LABEL_KEYS: Record<FocusStepId, TranslationKey> = {
  pages: 'focus.step.pages',
  run: 'focus.step.run',
  review: 'focus.step.review',
  export: 'focus.step.export',
};

interface FocusTopBarProps {
  step: FocusStepId;
  onExit: () => void;
  onOpenSettings?: () => void;
}

/**
 * Focus header: brand, the four-step indicator, the single configuration
 * Focus exposes (language pair) and the always-visible way out.
 */
export default memo(function FocusTopBar({
  step,
  onExit,
  onOpenSettings,
}: FocusTopBarProps) {
  const { t } = useI18n();
  const processing = useUiShellStore((s) => s.processing);
  const aioSrcLang = useAioPipelineStore((s) => s.aioSrcLang);
  const aioTgtLang = useAioPipelineStore((s) => s.aioTgtLang);
  const setAioSrcLang = useAioPipelineStore((s) => s.setAioSrcLang);
  const setAioTgtLang = useAioPipelineStore((s) => s.setAioTgtLang);
  const languageOptions = useAioPipelineStore((s) => s.aioLanguageOptions);

  const activeIndex = FOCUS_STEP_ORDER.indexOf(step);

  return (
    <header className="koma-focus__topbar">
      <div className="koma-focus__brand">
        <span className="koma-focus__brand-name">{t('brand.name')}</span>
        <span className="koma-focus__brand-mode">{t('focus.enter')}</span>
      </div>

      <ol className="koma-focus__steps" aria-label={t('focus.enter')}>
        {FOCUS_STEP_ORDER.map((stepId, index) => {
          const label = t(STEP_LABEL_KEYS[stepId]);
          const state =
            index === activeIndex
              ? 'active'
              : index < activeIndex
                ? 'done'
                : 'todo';
          return (
            <li
              key={stepId}
              className={
                state === 'todo'
                  ? 'koma-focus__step'
                  : `koma-focus__step koma-focus__step--${state}`
              }
              aria-current={state === 'active' ? 'step' : undefined}
              title={t('focus.step.current', {
                current: index + 1,
                total: FOCUS_STEP_ORDER.length,
                label,
              })}
            >
              <span className="koma-focus__step-index" aria-hidden="true">
                {state === 'done' ? <Check size={11} /> : index + 1}
              </span>
              <span>{label}</span>
              {index < FOCUS_STEP_ORDER.length - 1 && (
                <span className="koma-focus__step-sep" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="koma-focus__topbar-actions">
        <div className="koma-focus__lang">
          <label htmlFor="koma-focus-src-lang">{t('focus.lang.from')}</label>
          <select
            id="koma-focus-src-lang"
            className="koma-focus__select"
            value={aioSrcLang}
            disabled={processing}
            onChange={(event) => setAioSrcLang(event.target.value)}
          >
            {languageOptions.source.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
          <span aria-hidden="true">→</span>
          <label htmlFor="koma-focus-tgt-lang">{t('focus.lang.to')}</label>
          <select
            id="koma-focus-tgt-lang"
            className="koma-focus__select"
            value={aioTgtLang}
            disabled={processing}
            onChange={(event) => setAioTgtLang(event.target.value)}
          >
            {languageOptions.target.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="koma-focus__icon-btn"
          onClick={onOpenSettings}
          aria-label={t('focus.settings')}
          title={t('focus.settings')}
        >
          <Settings size={15} />
        </button>

        <button type="button" className="koma-focus__btn" onClick={onExit}>
          {t('focus.exit')}
          <kbd className="koma-focus__kbd">Esc</kbd>
        </button>
      </div>
    </header>
  );
});
