/* ============================================================
   KŌMA STUDIO — Step Renderer
   Renders guide step content based on step type
   ============================================================ */

   import {
    AlertTriangle,
    Check,
    Copy,
    Info,
    Lightbulb,
    ShieldAlert,
  } from 'lucide-react';
  import { useCallback, useState } from 'react';
  
  import type { GuideStep } from '../../data/guides-types';
  import { useI18n } from '../../i18n';
  import { useInfoNavStore } from '../../stores/info-nav-store';
  
  interface Props {
    step: GuideStep;
  }
  
  export default function GuideStepRenderer({ step }: Props) {
    return (
      <div>
        {/* Main text content */}
        {step.content && (
          <p className="koma-gr-content__step-text">{step.content}</p>
        )}
  
        {/* Tip callout */}
        {step.tip && (
          <div className="koma-gr-callout koma-gr-callout--tip" role="note">
            <Lightbulb size={16} className="koma-gr-callout__icon" />
            <div className="koma-gr-callout__text">{step.tip}</div>
          </div>
        )}
  
        {/* Warning callout */}
        {step.warning && (
          <div className="koma-gr-callout koma-gr-callout--warning" role="alert">
            <AlertTriangle size={16} className="koma-gr-callout__icon" />
            <div className="koma-gr-callout__text">{step.warning}</div>
          </div>
        )}
  
        {/* Standalone callout types */}
        {step.type === 'tip' && !step.tip && (
          <div className="koma-gr-callout koma-gr-callout--tip" role="note">
            <Lightbulb size={16} className="koma-gr-callout__icon" />
            <div className="koma-gr-callout__text">{step.content}</div>
          </div>
        )}
        {step.type === 'warning' && !step.warning && (
          <div className="koma-gr-callout koma-gr-callout--warning" role="alert">
            <AlertTriangle size={16} className="koma-gr-callout__icon" />
            <div className="koma-gr-callout__text">{step.content}</div>
          </div>
        )}
        {step.type === 'danger' && (
          <div className="koma-gr-callout koma-gr-callout--danger" role="alert">
            <ShieldAlert size={16} className="koma-gr-callout__icon" />
            <div className="koma-gr-callout__text">{step.content}</div>
          </div>
        )}
        {step.type === 'info' && (
          <div className="koma-gr-callout koma-gr-callout--info" role="note">
            <Info size={16} className="koma-gr-callout__icon" />
            <div className="koma-gr-callout__text">{step.content}</div>
          </div>
        )}
  
        {/* Image */}
        {step.image && (
          <div className="koma-gr-callout" style={{
            border: '1px solid rgba(168,85,247,0.08)',
            borderLeft: '1px solid rgba(168,85,247,0.08)',
            borderRadius: 12,
            padding: 0,
            overflow: 'hidden',
            margin: '16px 0',
            background: 'rgba(6,8,18,0.5)',
          }}>
            <div style={{ width: '100%' }}>
              <img
                src={step.image.src}
                alt={step.image.alt}
                style={{ width: '100%', display: 'block' }}
                loading="lazy"
              />
              {step.image.caption && (
                <div style={{
                  padding: '8px 14px',
                  fontSize: 11.5,
                  color: 'var(--auth-text-muted)',
                  textAlign: 'center',
                  fontStyle: 'italic',
                }}>
                  {step.image.caption}
                </div>
              )}
            </div>
          </div>
        )}
  
        {/* Code block */}
        {step.code && <CodeBlock code={step.code} />}
  
        {/* Shortcut table */}
        {step.shortcuts && step.shortcuts.length > 0 && (
          <div className="koma-gr-shortcuts">
            {step.shortcuts.map((sc, i) => (
              <div key={i} className="koma-gr-shortcut-row">
                <div className="koma-gr-shortcut-keys">
                  {sc.keys.map((key, ki) => (
                    <span key={ki}>
                      {ki > 0 && <span className="koma-gr-kbd-plus">+</span>}
                      <kbd className="koma-gr-kbd">{key}</kbd>
                    </span>
                  ))}
                </div>
                <span className="koma-gr-shortcut-desc">{sc.description}</span>
              </div>
            ))}
          </div>
        )}
  
        {/* Checklist */}
        {step.checklist && <Checklist items={step.checklist} />}
  
        {/* Divider */}
        {step.type === 'divider' && (
          <hr style={{
            border: 'none',
            height: 1,
            background: 'rgba(168,85,247,0.06)',
            margin: '28px 0',
          }} />
        )}
  
        {/* Quote */}
        {step.type === 'quote' && (
          <blockquote style={{
            borderLeft: '3px solid var(--auth-purple)',
            padding: '12px 18px',
            margin: '16px 0',
            background: 'rgba(168,85,247,0.04)',
            borderRadius: '0 12px 12px 0',
            fontStyle: 'italic',
            color: 'rgba(186,199,247,0.75)',
            fontSize: 14,
            lineHeight: 1.65,
          }}>
            {step.content}
          </blockquote>
        )}
      </div>
    );
  }
  
  /* ─── Code Block sub-component ─── */
  
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
      <div className="koma-gr-code">
        <div className="koma-gr-code__header">
          <span className="koma-gr-code__filename">
            {code.filename || code.language}
          </span>
          {(code.copyable !== false) && (
            <button
              type="button"
              className={`koma-gr-code__copy ${copied ? 'koma-gr-code__copy--done' : ''}`}
              onClick={handleCopy}
              aria-label={t('guides.step.copyCode')}
            >
              {copied ? (
                <><Check size={11} /> {t('guides.step.copied')}</>
              ) : (
                <><Copy size={11} /> {t('guides.step.copy')}</>
              )}
            </button>
          )}
        </div>
        <pre className="koma-gr-code__body">
          {lines.map((line, i) => {
            const isHl = code.highlightLines?.includes(i + 1);
            return (
              <span
                key={i}
                className={isHl ? 'koma-gr-code__line--hl' : undefined}
              >
                {line}
                {i < lines.length - 1 ? '\n' : ''}
              </span>
            );
          })}
        </pre>
      </div>
    );
  }
  
  /* ─── Checklist sub-component ─── */
  
  function Checklist({ items }: { items: NonNullable<GuideStep['checklist']> }) {
    const { t } = useI18n();
    const checklistState = useInfoNavStore((s) => s.checklistState);
    const toggleChecklistItem = useInfoNavStore((s) => s.toggleChecklistItem);
  
    return (
      <div className="koma-gr-checklist">
        {items.map((item) => {
          const isChecked = checklistState[item.id] ?? item.checked ?? false;
          return (
            <div
              key={item.id}
              className="koma-gr-checklist-item"
              onClick={() => toggleChecklistItem(item.id)}
            >
              <button
                type="button"
                className={`koma-gr-checklist-box ${isChecked ? 'koma-gr-checklist-box--checked' : ''}`}
                aria-label={t('guides.step.checkAria', { label: item.label })}
                aria-pressed={isChecked}
              >
                {isChecked && <Check size={12} />}
              </button>
              <span className={`koma-gr-checklist-label ${isChecked ? 'koma-gr-checklist-label--checked' : ''}`}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

