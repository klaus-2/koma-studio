'use client';

import React from 'react';
import { m } from 'framer-motion';
import { AlertTriangle, Copy, Download, Eraser, FolderOpen, Languages, Type } from 'lucide-react';
import { useI18n } from '../../../i18n';
import { EASE } from '../../noir-panels/NoirPrimitives';

interface TranslatorTextStageProps {
  translatorDraftText: string;
  setTranslatorDraftText: (value: string) => void;
  setTranslatorTranslatedText: (value: string) => void;
  setTranslatorTextDirty: (value: boolean) => void;
  translatorTextImportRef: React.RefObject<HTMLInputElement | null>;
  translatorTextRunning: boolean;
  processing: boolean;
  runTranslatorText: () => void | Promise<void>;
  translatorTranslatedText: string;
  translatorTextDirty: boolean;
  copyTextToClipboardSafe: (text: string) => Promise<boolean> | void;
  setStatusMessage: (value: string) => void;
  handleDownload: (scope: string | null) => Promise<void> | void;
  setTranslatorLastTextModelUsed: (value: string | null) => void;
  translatorLastTextModelUsed: string | null;
  handleTranslatorTextImport: React.ChangeEventHandler<HTMLInputElement>;
}

export default function TranslatorTextStage(props: TranslatorTextStageProps) {
  const {
    translatorDraftText, setTranslatorDraftText, setTranslatorTextDirty, translatorTextImportRef,
    translatorTextRunning, processing, runTranslatorText, translatorTranslatedText,
    copyTextToClipboardSafe, setStatusMessage, handleDownload, setTranslatorLastTextModelUsed,
    translatorLastTextModelUsed, setTranslatorTranslatedText, handleTranslatorTextImport, translatorTextDirty,
  } = props;

  const { t } = useI18n();

  return (
    <div className="grid gap-4 font-display text-paper lg:grid-cols-2">
      {/* ═══ SOURCE PANEL ═══ */}
      <m.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        className="glass panel-cut halftone flex flex-col border-l-2 border-l-crimson"
      >
        <PanelHead icon={Languages} title={t('dashboard.translator.sourceTitle')} desc={t('dashboard.translator.sourceDescription')} tone="crimson" />
        <div className="px-4 pb-2">
          <textarea
            id="translator-text-editor"
            className="noir-textarea panel-cut-sm min-h-[320px] w-full resize-y !bg-ink/60 leading-relaxed"
            value={translatorDraftText}
            onChange={(e) => { setTranslatorDraftText(e.target.value); setTranslatorTextDirty(true); }}
            rows={14}
            placeholder={t('dashboard.translator.sourcePlaceholder')}
            aria-label={t('dashboard.translator.sourceAria')}
          />
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <button type="button" className="btn-ghost panel-cut-sm" onClick={() => translatorTextImportRef.current?.click()}><FolderOpen size={12} /> {t('dashboard.translator.import')}</button>
          <button type="button" className="btn-primary panel-cut-sm flex-1" disabled={processing || translatorDraftText.trim().length === 0} onClick={() => void runTranslatorText()} aria-busy={translatorTextRunning}>
            {translatorTextRunning ? (<><span className="auth-spinner" style={{ width: 12, height: 12 }} aria-hidden="true" /> {t('dashboard.translator.translating')}</>) : (<><Languages size={12} /> {t('dashboard.translator.translate')}</>)}
          </button>
          <button type="button" className="btn-ghost panel-cut-sm" disabled={translatorDraftText.trim().length === 0 && translatorTranslatedText.trim().length === 0}
            onClick={() => { setTranslatorDraftText(''); setTranslatorTranslatedText(''); setTranslatorLastTextModelUsed(null); setTranslatorTextDirty(false); setStatusMessage(t('dashboard.translator.editorCleared')); }}>
            <Eraser size={12} /> {t('dashboard.translator.clear')}
          </button>
        </div>
        <input ref={translatorTextImportRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={handleTranslatorTextImport} />
      </m.section>

      {/* ═══ RESULT PANEL ═══ */}
      <m.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08, ease: EASE }}
        className="glass panel-cut halftone flex flex-col border-l-2 border-l-mint"
      >
        <PanelHead
          icon={Type}
          title={t('dashboard.translator.resultTitle')}
          desc={translatorLastTextModelUsed ? t('dashboard.translator.resultModelPrefix', { value: translatorLastTextModelUsed }) : t('dashboard.translator.resultPlaceholder')}
          tone="mint"
          badge={translatorLastTextModelUsed ?? undefined}
        />
        <div className="px-4 pb-2">
          <textarea
            id="translator-text-result"
            className="noir-textarea panel-cut-sm min-h-[320px] w-full resize-y !bg-ink/40 leading-relaxed opacity-90"
            value={translatorTranslatedText}
            readOnly
            rows={14}
            placeholder={t('dashboard.translator.resultFieldPlaceholder')}
            aria-label={t('dashboard.translator.resultPlaceholderAria')}
          />
        </div>

        {translatorTextDirty && translatorTranslatedText.trim().length > 0 && (
          <div className="mx-4 mb-2 flex items-center gap-2 panel-cut-sm border border-gold/40 bg-gold/8 px-3 py-2 font-mono text-[10.5px] text-gold">
            <AlertTriangle size={11} className="shrink-0" />
            {t('dashboard.translator.editorDirty')}
          </div>
        )}

        <div className="flex flex-wrap gap-2 px-4 pb-4">
          <button type="button" className="btn-ghost panel-cut-sm flex-1" disabled={translatorTranslatedText.trim().length === 0}
            onClick={() => { void copyTextToClipboardSafe(translatorTranslatedText); setStatusMessage(t('dashboard.translator.resultCopied')); }}>
            <Copy size={12} /> {t('dashboard.translator.copy')}
          </button>
          <button type="button" className="btn-ghost panel-cut-sm flex-1" disabled={translatorTranslatedText.trim().length === 0} onClick={() => void handleDownload('translator')}>
            <Download size={12} /> {t('dashboard.translator.downloadTxt')}
          </button>
        </div>
      </m.section>
    </div>
  );
}

function PanelHead({ icon: Icon, title, desc, tone, badge }: {
  icon: any; title: string; desc: string; tone: 'crimson' | 'mint'; badge?: string;
}) {
  const c = tone === 'mint' ? 'bg-mint/12 text-mint' : 'bg-crimson/12 text-crimson';
  return (
    <div className="flex items-start gap-3 border-b border-paper/8 p-4">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center panel-cut-sm ${c}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-tight text-paper">{title}</h3>
        <p className="truncate font-mono text-[10px] text-paper-dim">{desc}</p>
      </div>
      {badge && (
        <span className="stamp shrink-0 !py-0.5 !text-[8px]">{badge}</span>
      )}
    </div>
  );
}
