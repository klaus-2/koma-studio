import { m, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { useI18n } from '../../../i18n';

interface DashboardEmptyStageProps {
  emptyPreviewTipIndex: number;
  currentEmptyPreviewTip: string;
}

const DashboardEmptyStage = ({ emptyPreviewTipIndex, currentEmptyPreviewTip }: DashboardEmptyStageProps) => {
  const { t } = useI18n();

  return (
    <div className="relative -m-6 flex h-[calc(100%+3rem)] w-[calc(100%+3rem)] flex-col items-center justify-center overflow-hidden p-8" data-tour="dashboard-stage-empty">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at 12% 8%, color-mix(in srgb, var(--color-crimson) 9%, transparent), transparent 55%),' +
            'radial-gradient(ellipse at 88% 88%, color-mix(in srgb, var(--color-azure) 7%, transparent), transparent 52%),' +
            'radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--color-gold) 3%, transparent), transparent 50%)',
        }}
      />
      <div className="halftone-red pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
      <span className="pointer-events-none absolute right-6 top-6 font-display text-[10rem] font-black leading-none text-outline opacity-40 md:text-[16rem]" aria-hidden="true">00</span>
      <span className="v-text pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 font-display text-6xl font-black text-outline opacity-25" aria-hidden="true">スタート</span>

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex max-w-md flex-col items-center text-center"
      >
        <div className="panel-cut animate-stamp mb-5 grid h-20 w-20 place-items-center bg-crimson text-ink shadow-hard-gold">
          <ImageIcon size={30} />
        </div>
        <span className="kicker mb-2">// {t('dashboard.emptyStage.tipMeta')}</span>
        <h2 className="font-display text-3xl font-black uppercase leading-none tracking-tight text-paper">
          {t('dashboard.emptyStage.title')}
        </h2>
        <p className="mt-3 font-mono text-sm leading-relaxed text-paper-dim">
          {t('dashboard.emptyStage.desc')}
        </p>
      </m.div>

      <AnimatePresence mode="wait">
        <m.div
          key={`tip-${emptyPreviewTipIndex}`}
          initial={{ opacity: 0, y: 12, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: -1 }}
          exit={{ opacity: 0, y: -8, rotate: -1, transition: { duration: 0.18 } }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="glass relative z-10 mt-10 max-w-md border border-gold/25 px-5 py-4 panel-cut-sm"
          role="note"
        >
          <span aria-hidden className="absolute -top-2 left-1/2 h-3.5 w-16 -translate-x-1/2 rotate-2 bg-gold/25" />

          <div className="mb-1.5 flex items-center gap-1.5">
            <Sparkles size={11} className="text-gold" aria-hidden />
            <span className="kicker !text-gold !text-[9px]">
              {'//'} {t('dashboard.emptyStage.tipTitle')}
            </span>
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-paper">
            {currentEmptyPreviewTip}
          </p>
          <span className="mt-2 block text-right font-serif-accent text-[11px] italic text-paper-faint">
            — {t('dashboard.emptyStage.tipMeta')}
          </span>
        </m.div>
      </AnimatePresence>
    </div>
  );
};

export default DashboardEmptyStage;