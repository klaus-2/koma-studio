import { useEffect, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, SkipForward, X } from 'lucide-react';

import { useI18n } from '../../i18n';
import { EASE } from '../system/v2/kit';
import { OnboardingRail, OnboardingStepStrip } from './OnboardingRail';
import { OnboardingStepContent } from './OnboardingStepContent';
import { cx } from './onboardingPrimitives';
import { useOnbSkin } from './onboardingSkin';
import { ONBOARDING_STEPS } from './onboardingSteps';
import {
  useOnboardingModalController,
  type OnboardingModalProps,
} from './useOnboardingModalController';
import './OnboardingModal.css';

export type { OnboardingModalProps } from './useOnboardingModalController';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const trapTab = (event: KeyboardEvent<HTMLElement>): void => {
  if (event.key !== 'Tab') return;
  const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.getClientRects().length > 0,
  );
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (!first || !last) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
};

export function OnboardingModal(props: OnboardingModalProps) {
  const { t } = useI18n();
  const skin = useOnbSkin();
  const ctrl = useOnboardingModalController(props);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const seenStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => {
      window.cancelAnimationFrame(frame);
      previous?.focus({ preventScroll: true });
    };
  }, [props.open]);

  useEffect(() => {
    if (seenStepRef.current === null) {
      seenStepRef.current = ctrl.stepIndex;
      return;
    }
    if (seenStepRef.current === ctrl.stepIndex) return;
    seenStepRef.current = ctrl.stepIndex;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [ctrl.stepIndex]);

  if (!props.open) return null;

  const total = ONBOARDING_STEPS.length;
  const words = t(ctrl.currentStep.titleKey).split(' ');
  const accent = skin.noir && words.length > 1 ? words.pop() : undefined;

  const node = (
    <div
      role="presentation"
      className={cx('fixed inset-0 z-[115] flex items-stretch justify-center sm:items-center sm:p-6', skin.backdrop)}
    >
      <m.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="koma-onb-title"
        aria-describedby="koma-onb-subtitle"
        data-onboarding-theme={skin.noir ? 'noir' : 'classic'}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        onKeyDown={trapTab}
        className={cx(
          'relative flex h-full w-full max-w-[1120px] overflow-hidden sm:h-[min(90vh,840px)]',
          skin.dialog,
        )}
      >
        {skin.noir ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 z-20 h-[3px] w-full bg-gradient-to-r from-crimson via-gold/60 to-transparent"
            />
            <span
              aria-hidden="true"
              className="v-text pointer-events-none absolute bottom-20 right-2 hidden select-none font-display text-2xl font-black tracking-[0.26em] text-paper/[0.04] lg:block"
            >
              初回ガイド
            </span>
          </>
        ) : null}

        <OnboardingRail ctrl={ctrl} />

        <div className="relative flex min-w-0 flex-1 flex-col">
          <header className={cx('flex flex-col gap-3 px-5 pb-4 pt-5 sm:px-7', skin.header)}>
            <OnboardingStepStrip ctrl={ctrl} />
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={skin.kicker}>
                    {skin.noir ? '// ' : ''}
                    {String(ctrl.stepIndex + 1).padStart(2, '0')} · {t(ctrl.currentStep.shortLabelKey)}
                  </span>
                  {ctrl.activeDownloadCount > 0 ? (
                    <span role="status" className={skin.badge('info')}>
                      <Download size={11} aria-hidden="true" />
                      {t('onboarding.header.activeDownloads', { count: ctrl.activeDownloadCount })}
                    </span>
                  ) : null}
                </div>
                <h2
                  id="koma-onb-title"
                  ref={headingRef}
                  tabIndex={-1}
                  className={cx('mt-2 outline-none', skin.title)}
                >
                  {words.join(' ')}
                  {accent ? <em className={skin.titleAccent}> {accent}</em> : null}
                </h2>
                <p id="koma-onb-subtitle" className={cx('mt-1 max-w-2xl', skin.subtitle)}>
                  {t(ctrl.currentStep.subtitleKey)}
                </p>
              </div>
              <button
                type="button"
                aria-label={t('onboarding.actions.closeAria')}
                title={t('onboarding.actions.skipHint')}
                onClick={ctrl.handleDismiss}
                className={skin.closeBtn}
                hidden={!ctrl.canDismiss}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div ref={bodyRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <m.div
              key={ctrl.currentStepId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              <OnboardingStepContent ctrl={ctrl} modalProps={props} />
            </m.div>
          </div>

          <footer className={cx('flex items-center justify-between gap-3 px-5 py-3 sm:px-7', skin.footer)}>
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" className={skin.btnGhost} disabled={ctrl.isFirst} onClick={ctrl.goPrev}>
                <ChevronLeft size={13} aria-hidden="true" />
                <span>{t('onboarding.actions.prev')}</span>
              </button>
              <span className={skin.counter}>
                {ctrl.stepIndex + 1} / {total}
              </span>
              <span className={cx('hidden truncate xl:inline', skin.hint)}>
                {t('onboarding.actions.keyboardHint')}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!ctrl.isLast ? (
                <>
                  {ctrl.canDismiss ? (
                    <button
                      type="button"
                      className={skin.btnGhost}
                      title={t('onboarding.actions.skipHint')}
                      onClick={ctrl.handleDismiss}
                    >
                      <SkipForward size={13} aria-hidden="true" />
                      <span>{t('onboarding.actions.skip')}</span>
                    </button>
                  ) : null}
                  <button type="button" className={skin.btnPrimary} onClick={ctrl.goNext}>
                    <span>{t('onboarding.actions.next')}</span>
                    <ChevronRight size={13} aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>
          </footer>
        </div>
      </m.div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
}

export default OnboardingModal;
