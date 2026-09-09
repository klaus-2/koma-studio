import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToolTips } from '@/hooks/useToolTips';
import { useThemeStore } from "@koma/ui/stores/theme-store";

const HINT_ID = 'healing-tool-first-use';

interface HealingToolHintProps {
  /** Increment this value to attempt showing the hint */
  trigger: number;
}

export function HealingToolHint({ trigger }: HealingToolHintProps) {
  const { shouldShow, dismiss } = useToolTips();
  const { t } = useI18n();
  const theme = useThemeStore((s) => s.theme);
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current || visible) return;
    if (trigger > 0 && shouldShow(HINT_ID)) {
      shownRef.current = true;
      setVisible(true);
    }
  }, [trigger, shouldShow, visible]);

  const handleDismiss = () => {
    dismiss(HINT_ID);
    setVisible(false);
  };

  const isLight = theme === 'light';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`fixed bottom-24 right-6 z-[200] w-72 rounded-xl border backdrop-blur-[32px] ${
            isLight
              ? 'border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.98)] text-slate-900 shadow-[0_24px_56px_rgba(15,23,42,0.12),0_0_40px_rgba(168,85,247,0.04),inset_0_1px_0_rgba(255,255,255,0.72)]'
              : 'border border-purple-500/15 bg-[rgba(10,12,24,0.96)] shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(168,85,247,0.04),inset_0_1px_0_rgba(255,255,255,0.025)]'
          }`}
          role="dialog"
          aria-label={t('dashboard.hint.healing.ariaLabel')}
        >
          {/* Top accent gradient */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-purple-600 via-cyan-500 to-purple-600 opacity-50 rounded-t-xl" />

          <div className="relative p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    isLight ? 'bg-purple-500/10' : 'bg-purple-500/14'
                  }`}
                >
                  <Sparkles size={14} className={isLight ? 'text-purple-600' : 'text-purple-300'} />
                </div>
                <span
                  className={`text-xs font-bold tracking-wide font-heading uppercase ${
                    isLight ? 'text-purple-700/90' : 'text-purple-200/90'
                  }`}
                >
                  {t('dashboard.hint.healing.eyebrow')}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className={`flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
                  isLight
                    ? 'border-black/8 bg-black/[0.02] text-slate-500 hover:bg-black/[0.05] hover:text-slate-900'
                    : 'border-white/6 bg-white/[0.02] text-text-muted hover:bg-white/[0.06] hover:text-text'
                }`}
                aria-label={t('common.close')}
              >
                <X size={12} />
              </button>
            </div>

            {/* Body */}
            <p className={`mt-3 text-[13px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-text-muted'}`}>
              {t('dashboard.hint.healing.body')}
            </p>

            {/* Footer hint */}
            <p className={`mt-3 text-[11px] ${isLight ? 'text-slate-500/80' : 'text-text-muted/60'}`}>
              {t('dashboard.hint.healing.footer')}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
