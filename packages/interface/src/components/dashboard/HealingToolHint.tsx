import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToolTips } from '@/hooks/useToolTips';
import { useThemeStore } from "@koma/ui/stores/theme-store";

const HINT_ID = 'healing-tool-first-use';

interface HealingToolHintProps {
  trigger: number;
  rightOffset?: number;
}

export function HealingToolHint({ trigger, rightOffset = 24 }: HealingToolHintProps) {
  const { shouldShow, dismiss } = useToolTips();
  const { t } = useI18n();
  const theme = useThemeStore((s) => s.theme);
  const family = useThemeStore((s) => s.family);
  const [dismissed, setDismissed] = useState(false);
  const visible = trigger > 0 && !dismissed && shouldShow(HINT_ID);

  const handleDismiss = () => {
    dismiss(HINT_ID);
    setDismissed(true);
  };

  const isNoir = family === 'noir';
  const isLight = !isNoir && theme === 'light';

  const surfaceClass = isNoir
    ? 'border border-paper/10 bg-[rgba(10,12,24,0.96)] shadow-[0_32px_80px_rgba(0,0,0,0.6)]'
    : isLight
      ? 'border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.98)] text-slate-900 shadow-[0_24px_56px_rgba(15,23,42,0.12),0_0_40px_rgba(168,85,247,0.04),inset_0_1px_0_rgba(255,255,255,0.72)]'
      : 'border border-purple-500/15 bg-[rgba(10,12,24,0.96)] shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(168,85,247,0.04),inset_0_1px_0_rgba(255,255,255,0.025)]';
  const bodyClass = isNoir ? 'text-paper/70' : isLight ? 'text-slate-600' : 'text-text-muted';
  const footerClass = isNoir ? 'text-paper/45' : isLight ? 'text-slate-500/80' : 'text-text-muted/60';
  const dismissClass = isNoir
    ? 'border-paper/15 bg-transparent text-paper/40 hover:bg-paper/5 hover:text-crimson'
    : isLight
      ? 'border-black/8 bg-black/[0.02] text-slate-500 hover:bg-black/[0.05] hover:text-slate-900'
      : 'border-white/6 bg-white/[0.02] text-text-muted hover:bg-white/[0.06] hover:text-text';
  const accentGradientClass = isNoir
    ? 'bg-gradient-to-r from-crimson via-azure to-crimson opacity-60'
    : 'bg-gradient-to-r from-purple-600 via-cyan-500 to-purple-600 opacity-50';
  const iconBoxClass = isNoir
    ? 'border border-crimson/40 bg-crimson/10 text-crimson'
    : isLight
      ? 'bg-purple-500/10 text-purple-600'
      : 'bg-purple-500/14 text-purple-300';
  const eyebrowClass = isNoir
    ? 'font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-crimson'
    : isLight
      ? 'text-purple-700/90'
      : 'text-purple-200/90';

  return (
      <AnimatePresence>
        {visible && (
          <m.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`pointer-events-none fixed bottom-24 z-[200] w-72 border backdrop-blur-[32px] ${isNoir ? 'panel-cut-sm' : 'rounded-xl'
              } ${surfaceClass}`}
            style={{ right: rightOffset }}
            role="dialog"
            aria-label={t('dashboard.hint.healing.ariaLabel')}
          >
            {/* Top accent gradient */}
            <div className={`absolute inset-x-0 top-0 h-[2px] ${accentGradientClass} ${isNoir ? '' : 'rounded-t-xl'
              }`} />

            <div className="relative p-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center ${isNoir ? '' : 'rounded-lg'
                      } ${iconBoxClass}`}
                  >
                    <Sparkles size={14} />
                  </div>
                  <span
                    className={`text-xs font-bold tracking-wide uppercase ${isNoir
                        ? 'font-mono tracking-[0.14em]'
                        : 'font-heading'
                      } ${eyebrowClass}`}
                  >
                    {t('dashboard.hint.healing.eyebrow')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className={`pointer-events-auto flex h-6 w-6 items-center justify-center border transition-colors ${isNoir ? '' : 'rounded-md'
                    } ${dismissClass}`}
                  aria-label={t('common.close')}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Body */}
              <p className={`mt-3 text-[13px] leading-relaxed ${bodyClass}`}>
                {t('dashboard.hint.healing.body')}
              </p>

              {/* Footer hint */}
              <p className={`mt-3 text-[11px] ${footerClass}`}>
                {t('dashboard.hint.healing.footer')}
              </p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
  );
}
