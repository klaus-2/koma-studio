import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Download,
  Eraser,
  FolderOpen,
  Languages,
  Type,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import './TranslatorTextStage.css';

interface TranslatorTextStageProps {
  translatorDraftText: string;
  /** Programmatic replace (clear button): commits to the store. */
  setTranslatorDraftText: (value: string) => void;
  setTranslatorTextPending: (value: boolean) => void;
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

function useTranslatorTextDraft(
  translatorDraftText: string,
  setTranslatorDraftText: (value: string) => void,
  setTranslatorTextDirty: (value: boolean) => void,
  setTranslatorTextPending: (value: boolean) => void,
) {
  const pendingDraftRef = useRef<string | null>(null);
  const storeTextRef = useRef(translatorDraftText);
  useEffect(() => {
    storeTextRef.current = translatorDraftText;
  }, [translatorDraftText]);
  const [draftInputValue, setDraftInputValue] = useState(translatorDraftText);

  // External store writes (import, restore, clear) replace the draft.
  useEffect(() => {
    if (pendingDraftRef.current === null) {
      setDraftInputValue(translatorDraftText);
      return;
    }
    if (translatorDraftText !== pendingDraftRef.current) {
      pendingDraftRef.current = null;
      setDraftInputValue(translatorDraftText);
      // The pending draft was discarded wholesale — clear its mirror bit.
      setTranslatorTextPending(false);
    }
  }, [translatorDraftText, setTranslatorTextPending]);

  const handleDraftInput = useCallback(
    (value: string) => {
      pendingDraftRef.current = value;
      setDraftInputValue(value);
      // Boolean slice write: zustand only notifies when the value flips, so
      // typing without crossing the empty boundary stays cascade-free.
      setTranslatorTextPending(value.trim().length > 0);
    },
    [setTranslatorTextPending],
  );

  const flushPendingDraft = useCallback(() => {
    const pending = pendingDraftRef.current;
    if (pending === null) return;
    pendingDraftRef.current = null;
    if (pending !== storeTextRef.current) {
      setTranslatorDraftText(pending);
    }
    setTranslatorTextDirty(true);
    setTranslatorTextPending(false);
  }, [
    setTranslatorDraftText,
    setTranslatorTextDirty,
    setTranslatorTextPending,
  ]);

  const clearPendingDraft = useCallback(() => {
    pendingDraftRef.current = null;
    setTranslatorTextPending(false);
  }, [setTranslatorTextPending]);

  useEffect(
    () => () => {
      // Dirty unmount (mode/route switch): persist the draft like blur would.
      const pending = pendingDraftRef.current;
      if (pending === null) return;
      pendingDraftRef.current = null;
      if (pending !== storeTextRef.current) {
        setTranslatorDraftText(pending);
      }
      setTranslatorTextDirty(true);
      setTranslatorTextPending(false);
    },
    [
      setTranslatorDraftText,
      setTranslatorTextDirty,
      setTranslatorTextPending,
    ],
  );

  return {
    draftInputValue,
    handleDraftInput,
    flushPendingDraft,
    clearPendingDraft,
  };
}

export default function TranslatorTextStage({
  translatorDraftText,
  setTranslatorDraftText,
  setTranslatorTextPending,
  setTranslatorTextDirty,
  translatorTextImportRef,
  translatorTextRunning,
  processing,
  runTranslatorText,
  translatorTranslatedText,
  copyTextToClipboardSafe,
  setStatusMessage,
  handleDownload,
  setTranslatorLastTextModelUsed,
  translatorLastTextModelUsed,
  setTranslatorTranslatedText,
  handleTranslatorTextImport,
  translatorTextDirty,
}: TranslatorTextStageProps) {
  const { t } = useI18n();
  const {
    draftInputValue,
    handleDraftInput,
    flushPendingDraft,
    clearPendingDraft,
  } = useTranslatorTextDraft(
    translatorDraftText,
    setTranslatorDraftText,
    setTranslatorTextDirty,
    setTranslatorTextPending,
  );

  return (
    <div className="koma-translator-text">
      {/* ═══ Source Panel ═══ */}
      <div className="koma-translator-text__panel">
        <div className="koma-translator-text__head">
          <span className="koma-translator-text__head-icon" aria-hidden="true">
            <Languages size={13} />
          </span>
          <div className="koma-translator-text__head-info">
            <h3 className="koma-translator-text__title">{t("dashboard.translator.sourceTitle")}</h3>
            <p className="koma-translator-text__desc">
              {t("dashboard.translator.sourceDescription")}
            </p>
          </div>
        </div>

        <textarea
          id="translator-text-editor"
          className="koma-translator-text__editor"
          value={draftInputValue}
          onChange={(e) => {
            handleDraftInput(e.target.value);
          }}
          onBlur={flushPendingDraft}
          rows={14}
          placeholder={t("dashboard.translator.sourcePlaceholder")}
          aria-label={t("dashboard.translator.sourceAria")}
        />

        <div className="koma-translator-text__actions">
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            onClick={() => translatorTextImportRef.current?.click()}
          >
            <FolderOpen size={12} /> {t("dashboard.translator.import")}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--primary"
            disabled={processing || draftInputValue.trim().length === 0}
            onClick={() => {
              flushPendingDraft();
              void runTranslatorText();
            }}
            aria-busy={translatorTextRunning}
          >
            {translatorTextRunning ? (
              <>
                <span
                  className="auth-spinner"
                  style={{ width: 12, height: 12 }}
                  aria-hidden="true"
                />
                {t("dashboard.translator.translating")}
              </>
            ) : (
              <>
                <Languages size={12} /> {t("dashboard.translator.translate")}
              </>
            )}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            disabled={
              draftInputValue.trim().length === 0 &&
              translatorTranslatedText.trim().length === 0
            }
            onClick={() => {
              clearPendingDraft();
              setTranslatorDraftText('');
              setTranslatorTranslatedText('');
              setTranslatorLastTextModelUsed(null);
              setTranslatorTextDirty(false);
              setStatusMessage(t("dashboard.translator.editorCleared"));
            }}
          >
            <Eraser size={12} /> {t("dashboard.translator.clear")}
          </button>
        </div>

        <input
          ref={translatorTextImportRef as React.LegacyRef<HTMLInputElement>}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          hidden
          onChange={handleTranslatorTextImport}
        />
      </div>

      {/* ═══ Result Panel ═══ */}
      <div className="koma-translator-text__panel">
        <div className="koma-translator-text__head">
          <span className="koma-translator-text__head-icon" aria-hidden="true">
            <Type size={13} />
          </span>
          <div className="koma-translator-text__head-info">
            <h3 className="koma-translator-text__title">{t("dashboard.translator.resultTitle")}</h3>
            <p className="koma-translator-text__desc">
              {translatorLastTextModelUsed
                ? t("dashboard.translator.resultModelPrefix", { value: translatorLastTextModelUsed })
                : t("dashboard.translator.resultPlaceholder")}
            </p>
          </div>
          {translatorLastTextModelUsed && (
            <span className="koma-translator-text__model">
              {translatorLastTextModelUsed}
            </span>
          )}
        </div>

        <textarea
          id="translator-text-result"
          className="koma-translator-text__editor koma-translator-text__editor--readonly"
          value={translatorTranslatedText}
          readOnly
          rows={14}
          placeholder={t("dashboard.translator.resultFieldPlaceholder")}
          aria-label={t("dashboard.translator.resultPlaceholderAria")}
        />

        {translatorTextDirty && translatorTranslatedText.trim().length > 0 && (
          <div className="koma-translator-text__dirty">
            <AlertTriangle
              size={11}
              className="koma-translator-text__dirty-icon"
            />
            {t("dashboard.translator.editorDirty")}
          </div>
        )}

        <div className="koma-translator-text__actions">
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            disabled={translatorTranslatedText.trim().length === 0}
            onClick={() => {
              void copyTextToClipboardSafe(translatorTranslatedText);
              setStatusMessage(t("dashboard.translator.resultCopied"));
            }}
          >
            <Copy size={12} /> {t("dashboard.translator.copy")}
          </button>
          <button
            type="button"
            className="koma-btn koma-btn--ghost"
            disabled={translatorTranslatedText.trim().length === 0}
            onClick={() => void handleDownload('translator')}
          >
            <Download size={12} /> {t("dashboard.translator.downloadTxt")}
          </button>
        </div>
      </div>
    </div>
  );
}
