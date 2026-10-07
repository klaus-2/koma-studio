import { useCallback, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Lightbulb,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';

import type { GuideStep } from '../../../data/guides-types';
import { useI18n } from '../../../i18n';
import { useInfoNavStore } from '../../../stores/info-nav-store';

interface Props {
  step: GuideStep;
}

/* ── Callout (margin-note editorial style) ──────── */
type CalloutTone = 'tip' | 'warning' | 'danger' | 'info';

const CALLOUT: Record<
  CalloutTone,
  { icon: LucideIcon; border: string; bg: string; text: string; jp: string; role: 'note' | 'alert' }
> = {
  tip: { icon: Lightbulb, border: 'border-l-gold', bg: 'bg-gold/6', text: 'text-gold', jp: 'ヒント', role: 'note' },
  info: { icon: Info, border: 'border-l-azure', bg: 'bg-azure/6', text: 'text-azure', jp: '情報', role: 'note' },
  warning: { icon: AlertTriangle, border: 'border-l-gold', bg: 'bg-gold/8', text: 'text-gold', jp: '注意', role: 'alert' },
  danger: { icon: ShieldAlert, border: 'border-l-crimson', bg: 'bg-crimson/8', text: 'text-crimson', jp: '危険', role: 'alert' },
};

function Callout({ tone, children }: { tone: CalloutTone; children: ReactNode }) {
  const c = CALLOUT[tone];
  const Icon = c.icon;
  return (
    <div
      role={c.role}
      className={`panel-cut-sm relative my-4 flex items-start gap-3 border-l-[3px] ${c.border} ${c.bg} px-4 py-3`}
    >
      <Icon size={15} className={`mt-0.5 flex-none ${c.text}`} aria-hidden />
      <div className="text-[12.5px] leading-relaxed text-paper/78">{children}</div>
      <span
        aria-hidden
        className={`v-text absolute right-1.5 top-2 select-none font-mono text-[8px] tracking-[0.25em] opacity-40 ${c.text}`}
      >
        {c.jp}
      </span>
    </div>
  );
}

export default function GuideStepRenderer({ step }: Props) {
  return (
    <div>
      {step.content &&
        !['tip', 'warning', 'danger', 'info', 'quote', 'divider'].includes(step.type ?? '') && (
          <p className="noir-guide-text">{step.content}</p>
        )}

      {step.tip && <Callout tone="tip">{step.tip}</Callout>}
      {step.warning && <Callout tone="warning">{step.warning}</Callout>}

      {/* Standalone callout types */}
      {step.type === 'tip' && !step.tip && <Callout tone="tip">{step.content}</Callout>}
      {step.type === 'warning' && !step.warning && (
        <Callout tone="warning">{step.content}</Callout>
      )}
      {step.type === 'danger' && <Callout tone="danger">{step.content}</Callout>}
      {step.type === 'info' && <Callout tone="info">{step.content}</Callout>}

      {/* Image — manga panel frame */}
      {step.image && (
        <figure className="panel-cut my-5 border border-paper/12 bg-ink/70">
          <img
            src={step.image.src}
            alt={step.image.alt}
            className="block w-full"
            loading="lazy"
          />
          {step.image.caption && (
            <figcaption className="border-t border-paper/10 px-4 py-2 text-center font-accent text-[12px] italic text-paper/45">
              {step.image.caption}
            </figcaption>
          )}
        </figure>
      )}

      {/* Code block */}
      {step.code && <CodeBlock code={step.code} />}

      {/* Shortcut table */}
      {step.shortcuts && step.shortcuts.length > 0 && (
        <div className="my-4 flex flex-col divide-y divide-paper/8 border border-paper/12 bg-ink/50">
          {step.shortcuts.map((sc, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5">
              <div className="flex flex-none items-center gap-1">
                {sc.keys.map((key, ki) => (
                  <span key={ki} className="flex items-center gap-1">
                    {ki > 0 && (
                      <span aria-hidden className="font-mono text-[9px] text-paper/30">
                        +
                      </span>
                    )}
                    <kbd className="noir-kbd">{key}</kbd>
                  </span>
                ))}
              </div>
              <span className="text-[11.5px] text-paper/60">{sc.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Checklist */}
      {step.checklist && <Checklist items={step.checklist} />}

      {/* Divider — cinematic slash */}
      {step.type === 'divider' && (
        <div aria-hidden className="my-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-paper/10" />
          <span className="h-1.5 w-1.5 rotate-45 bg-crimson" />
          <span className="h-px flex-1 bg-paper/10" />
        </div>
      )}

      {/* Quote — Instrument Serif */}
      {step.type === 'quote' && (
        <blockquote className="panel-cut-sm my-5 border-l-[3px] border-l-crimson bg-crimson/5 px-5 py-4 font-accent text-[15px] italic leading-relaxed text-paper/70">
          <span aria-hidden className="mr-1 text-2xl leading-none text-crimson">
            “
          </span>
          {step.content}
        </blockquote>
      )}
    </div>
  );
}

/* ─── Code Block — terminal noir ─── */

function CodeBlock({ code }: { code: NonNullable<GuideStep['code']> }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code.snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code.snippet]);

  const lines = code.snippet.split('\n');

  return (
    <div className="panel-cut-sm my-4 border border-paper/12 bg-ink">
      <div className="flex items-center justify-between border-b border-paper/10 bg-ink-2/80 px-3.5 py-2">
        <span className="flex items-center gap-2 font-mono text-[10px] text-paper/55">
          <span aria-hidden className="flex gap-1">
            <span className="h-2 w-2 bg-crimson" />
            <span className="h-2 w-2 bg-gold" />
            <span className="h-2 w-2 bg-mint" />
          </span>
          {code.filename || code.language}
        </span>
        {code.copyable !== false && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={t('guides.step.copyCode')}
            className={`panel-cut-sm flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-all duration-150 ${copied
              ? 'border-mint/50 bg-mint/10 text-mint'
              : 'border-paper/18 text-paper/55 hover:-translate-x-px hover:-translate-y-px hover:border-paper/45 hover:text-paper hover:drop-shadow-[2px_2px_0_rgba(255,200,87,0.5)]'
              }`}
          >
            {copied ? (
              <>
                <Check size={10} /> {t('guides.step.copied')}
              </>
            ) : (
              <>
                <Copy size={10} /> {t('guides.step.copy')}
              </>
            )}
          </button>
        )}
      </div>
      <pre className="noir-scroll overflow-x-auto p-4 font-mono text-[11.5px] leading-relaxed text-mint">
        {lines.map((line, i) => {
          const isHl = code.highlightLines?.includes(i + 1);
          return (
            <span key={i} className={isHl ? 'noir-code-line--hl' : undefined}>
              {line}
              {i < lines.length - 1 ? '\n' : ''}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

/* ─── Checklist — hanko checkboxes ─── */

function Checklist({ items }: { items: NonNullable<GuideStep['checklist']> }) {
  const { t } = useI18n();
  const checklistState = useInfoNavStore((s) => s.checklistState);
  const toggleChecklistItem = useInfoNavStore((s) => s.toggleChecklistItem);

  return (
    <div className="my-4 flex flex-col gap-2">
      {items.map((item) => {
        const isChecked = checklistState[item.id] ?? item.checked ?? false;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={isChecked}
            aria-label={t('guides.step.checkAria', { label: item.label })}
            onClick={() => toggleChecklistItem(item.id)}
            className={`panel-cut-sm group flex items-center gap-3 border p-3 text-left transition-all duration-150 ${isChecked
              ? 'border-mint/35 bg-mint/6'
              : 'border-paper/12 hover:-translate-x-px hover:-translate-y-px hover:border-paper/30 hover:drop-shadow-[3px_3px_0_rgba(255,200,87,0.35)]'
              }`}
          >
            <span
              aria-hidden
              className={`grid h-5 w-5 flex-none place-items-center border transition-all duration-200 ${isChecked ? 'border-mint bg-mint text-ink' : 'border-paper/30 group-hover:border-crimson'
                }`}
              style={{ clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)' }}
            >
              {isChecked && <Check size={12} strokeWidth={3.5} />}
            </span>
            <span
              className={`text-[12.5px] transition-colors ${isChecked ? 'text-paper/40 line-through decoration-mint/50' : 'text-paper/75'
                }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
