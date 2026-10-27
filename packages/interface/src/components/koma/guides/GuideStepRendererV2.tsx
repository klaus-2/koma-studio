'use client';

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Lightbulb,
  Quote,
  ShieldAlert,
} from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { GuideStep } from '@/data/guides-types';
import { useI18n } from '@/i18n';
import {
  GUIDE_EASE,
  copyGuideText,
} from './GuideV2Primitives';
import { useGuideStoreCompat } from './guide-store-compat';

interface Props {
  step: GuideStep;
}

type CalloutTone =
  | 'tip'
  | 'warning'
  | 'danger'
  | 'info';

function EditorialCallout({
  tone,
  children,
}: {
  tone: CalloutTone;
  children: ReactNode;
}) {
  const reduceMotion =
    useReducedMotion();

  const config = {
    tip: {
      icon: Lightbulb,
      label: 'Editorial tip',
      style:
        'border-gold/50 bg-gold/[0.055] text-gold',
    },
    warning: {
      icon: AlertTriangle,
      label: 'Attention',
      style:
        'border-crimson/50 bg-crimson/[0.055] text-crimson',
    },
    danger: {
      icon: ShieldAlert,
      label: 'Critical',
      style:
        'border-crimson bg-crimson/[0.08] text-crimson',
    },
    info: {
      icon: Info,
      label: 'Technical note',
      style:
        'border-azure/50 bg-azure/[0.055] text-azure',
    },
  }[tone];

  const Icon = config.icon;

  return (
    <m.aside
      initial={
        reduceMotion
          ? false
          : {
            opacity: 0,
            x: -14,
          }
      }
      whileInView={{
        opacity: 1,
        x: 0,
      }}
      viewport={{
        once: true,
        amount: 0.25,
      }}
      transition={{
        duration: reduceMotion
          ? 0
          : 0.42,
        ease: GUIDE_EASE,
      }}
      role={
        tone === 'warning' ||
          tone === 'danger'
          ? 'alert'
          : 'note'
      }
      className={[
        'panel-cut-sm my-6 border-l-[3px] p-4 sm:p-5',
        config.style,
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center border border-current/25 bg-current/[0.06] panel-cut-sm"
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>

        <div className="min-w-0">
          <span className="font-mono text-[0.57rem] font-black uppercase tracking-[0.14em] text-current">
            // {config.label}
          </span>

          <div className="mt-2 text-sm leading-7 text-paper/68">
            {children}
          </div>
        </div>
      </div>
    </m.aside>
  );
}

export default function GuideStepRendererV2({
  step,
}: Props) {
  const standaloneTip =
    step.type === 'tip' && !step.tip;

  const standaloneWarning =
    step.type === 'warning' &&
    !step.warning;

  const contentConsumedByType =
    standaloneTip ||
    standaloneWarning ||
    step.type === 'danger' ||
    step.type === 'info' ||
    step.type === 'quote' ||
    step.type === 'divider';

  return (
    <div className="koma-guide-step-copy">
      {step.content &&
        !contentConsumedByType ? (
        <p className="text-[0.95rem] leading-8 text-paper/68 sm:text-base">
          {step.content}
        </p>
      ) : null}

      {step.tip ? (
        <EditorialCallout tone="tip">
          {step.tip}
        </EditorialCallout>
      ) : null}

      {step.warning ? (
        <EditorialCallout tone="warning">
          {step.warning}
        </EditorialCallout>
      ) : null}

      {standaloneTip ? (
        <EditorialCallout tone="tip">
          {step.content}
        </EditorialCallout>
      ) : null}

      {standaloneWarning ? (
        <EditorialCallout tone="warning">
          {step.content}
        </EditorialCallout>
      ) : null}

      {step.type === 'danger' ? (
        <EditorialCallout tone="danger">
          {step.content}
        </EditorialCallout>
      ) : null}

      {step.type === 'info' ? (
        <EditorialCallout tone="info">
          {step.content}
        </EditorialCallout>
      ) : null}

      {step.image ? (
        <figure className="panel-cut my-7 overflow-hidden border border-paper/10 bg-ink/55">
          <div className="relative overflow-hidden">
            <img
              src={step.image.src}
              alt={step.image.alt}
              loading="lazy"
              className="block h-auto w-full"
            />

            <div
              className="pointer-events-none absolute inset-0 border-[6px] border-ink/15"
              aria-hidden="true"
            />
          </div>

          {step.image.caption ? (
            <figcaption className="flex items-start gap-3 border-t border-paper/10 px-4 py-3">
              <span
                className="mt-1 size-1.5 shrink-0 bg-crimson"
                aria-hidden="true"
              />

              <span className="font-accent text-sm italic leading-5 text-paper/45">
                {step.image.caption}
              </span>
            </figcaption>
          ) : null}
        </figure>
      ) : null}

      {step.code ? (
        <CodeBlock code={step.code} />
      ) : null}

      {step.shortcuts &&
        step.shortcuts.length > 0 ? (
        <div className="my-7 overflow-hidden border border-paper/10 panel-cut">
          <header className="flex items-center justify-between border-b border-paper/10 bg-ink/70 px-4 py-3">
            <span className="kicker">
              // Keyboard map
            </span>

            <span className="stamp !border-azure/40 !bg-azure/10 !text-azure">
              {step.shortcuts.length} keys
            </span>
          </header>

          <div className="divide-y divide-paper/[0.065]">
            {step.shortcuts.map(
              (shortcut, index) => (
                <div
                  key={`${shortcut.description}-${index}`}
                  className="grid gap-3 bg-paper/[0.018] px-4 py-3 sm:grid-cols-[minmax(160px,auto)_1fr] sm:items-center"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {shortcut.keys.map(
                      (key, keyIndex) => (
                        <span
                          key={`${key}-${keyIndex}`}
                          className="flex items-center gap-1.5"
                        >
                          {keyIndex > 0 ? (
                            <span className="font-mono text-[0.6rem] text-paper/25">
                              +
                            </span>
                          ) : null}

                          <kbd className="min-w-8 border border-paper/15 bg-ink px-2 py-1.5 text-center font-mono text-[0.65rem] font-bold text-paper panel-cut-sm drop-shadow-[2px_2px_0_rgba(255,46,99,0.38)]">
                            {key}
                          </kbd>
                        </span>
                      ),
                    )}
                  </div>

                  <span className="text-sm leading-5 text-paper/48">
                    {shortcut.description}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}

      {step.checklist ? (
        <Checklist
          items={step.checklist}
        />
      ) : null}

      {step.type === 'divider' ? (
        <div
          className="my-10 flex items-center gap-3"
          role="separator"
        >
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-crimson/40" />
          <span className="size-2 rotate-45 border border-crimson bg-crimson/15" />
          <span className="h-px flex-1 bg-gradient-to-r from-crimson/40 to-transparent" />
        </div>
      ) : null}

      {step.type === 'quote' ? (
        <blockquote className="panel-cut relative my-7 overflow-hidden border border-crimson/25 bg-crimson/[0.045] px-6 py-7 sm:px-9">
          <Quote
            size={50}
            className="pointer-events-none absolute right-5 top-3 text-crimson/12"
            aria-hidden="true"
          />

          <div
            className="absolute inset-y-0 left-0 w-[4px] bg-crimson"
            aria-hidden="true"
          />

          <p className="relative z-10 font-accent text-xl italic leading-8 text-paper/72 sm:text-2xl">
            {step.content}
          </p>
        </blockquote>
      ) : null}
    </div>
  );
}

function CodeBlock({
  code,
}: {
  code: NonNullable<
    GuideStep['code']
  >;
}) {
  const { t } = useI18n();
  const reduceMotion =
    useReducedMotion();

  const [copied, setCopied] =
    useState(false);

  const timeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const handleCopy =
    useCallback(async () => {
      try {
        await copyGuideText(
          code.snippet,
        );

        setCopied(true);

        if (timeoutRef.current) {
          clearTimeout(
            timeoutRef.current,
          );
        }

        timeoutRef.current =
          setTimeout(() => {
            setCopied(false);
          }, 1800);
      } catch {
        setCopied(false);
      }
    }, [code.snippet]);

  const lines =
    code.snippet.split('\n');

  return (
    <m.div
      initial={
        reduceMotion
          ? false
          : {
            opacity: 0,
            y: 12,
          }
      }
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{ once: true }}
      transition={{
        duration: reduceMotion
          ? 0
          : 0.42,
        ease: GUIDE_EASE,
      }}
      className="panel-cut my-7 overflow-hidden border border-paper/10 bg-[#05050a] drop-shadow-[7px_7px_0_rgba(77,201,255,0.16)]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-paper/10 bg-ink-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex gap-1.5"
            aria-hidden="true"
          >
            <span className="size-2 bg-crimson" />
            <span className="size-2 bg-gold" />
            <span className="size-2 bg-mint" />
          </div>

          <span className="truncate font-mono text-[0.65rem] text-paper/48">
            {code.filename ||
              code.language}
          </span>
        </div>

        {code.copyable !== false ? (
          <button
            type="button"
            className={[
              'panel-cut-sm inline-flex min-h-8 items-center gap-2 border px-3',
              'font-mono text-[0.6rem] font-bold uppercase tracking-[0.08em] transition',
              copied
                ? 'border-mint/45 bg-mint/10 text-mint'
                : 'border-paper/10 bg-paper/[0.035] text-paper/42 hover:border-azure/45 hover:text-azure',
            ].join(' ')}
            onClick={() =>
              void handleCopy()
            }
            aria-label={t(
              'guides.step.copyCode',
            )}
          >
            {copied ? (
              <Check size={12} />
            ) : (
              <Copy size={12} />
            )}

            {copied
              ? t('guides.step.copied')
              : t('guides.step.copy')}
          </button>
        ) : null}
      </header>

      <pre className="koma-scrollbar overflow-x-auto py-4 text-[0.76rem] leading-6">
        <code>
          {lines.map(
            (line, index) => {
              const lineNumber =
                index + 1;

              const highlighted =
                code.highlightLines?.includes(
                  lineNumber,
                );

              return (
                <span
                  key={lineNumber}
                  className={[
                    'grid min-w-max grid-cols-[3.5rem_minmax(0,1fr)] border-l-[3px] pr-5',
                    highlighted
                      ? 'border-gold bg-gold/[0.075] text-paper'
                      : 'border-transparent text-paper/64',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'select-none pr-4 text-right font-mono',
                      highlighted
                        ? 'text-gold'
                        : 'text-paper/18',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {String(
                      lineNumber,
                    ).padStart(2, '0')}
                  </span>

                  <span className="font-mono">
                    {line || ' '}
                  </span>
                </span>
              );
            },
          )}
        </code>
      </pre>
    </m.div>
  );
}

function Checklist({
  items,
}: {
  items: NonNullable<
    GuideStep['checklist']
  >;
}) {
  const { t } = useI18n();

  const {
    checklistState,
    toggleChecklistItem,
  } = useGuideStoreCompat();

  const completed = items.filter(
    (item) =>
      checklistState[item.id] ??
      item.checked ??
      false,
  ).length;

  return (
    <section className="panel-cut my-7 overflow-hidden border border-paper/10 bg-ink/45">
      <header className="flex items-center justify-between border-b border-paper/10 px-4 py-3">
        <span className="kicker">
          // Quality checklist
        </span>

        <span className="stamp !border-mint/45 !bg-mint/10 !text-mint">
          {completed}/{items.length}
        </span>
      </header>

      <div className="divide-y divide-paper/[0.065]">
        {items.map((item) => {
          const checked =
            checklistState[item.id] ??
            item.checked ??
            false;

          return (
            <button
              key={item.id}
              type="button"
              className={[
                'panel-cut-sm flex w-full items-center gap-3 px-4 py-3 text-left transition',
                checked
                  ? 'bg-mint/[0.045]'
                  : 'bg-paper/[0.012] hover:bg-paper/[0.035]',
              ].join(' ')}
              aria-pressed={checked}
              aria-label={t(
                'guides.step.checkAria',
                {
                  label: item.label,
                },
              )}
              onClick={() =>
                toggleChecklistItem?.(
                  item.id,
                )
              }
            >
              <span
                className={[
                  'grid size-6 shrink-0 place-items-center border panel-cut-sm',
                  checked
                    ? 'border-mint bg-mint text-ink drop-shadow-[2px_2px_0_#ff2e63]'
                    : 'border-paper/15 bg-ink text-transparent',
                ].join(' ')}
                aria-hidden="true"
              >
                <Check size={13} />
              </span>

              <span
                className={[
                  'text-sm leading-5 transition',
                  checked
                    ? 'text-paper/38 line-through'
                    : 'text-paper/62',
                ].join(' ')}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
