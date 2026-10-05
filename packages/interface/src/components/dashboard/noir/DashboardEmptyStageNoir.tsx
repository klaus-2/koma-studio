import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
import { useI18n } from '../../../i18n';

interface DashboardEmptyStageProps {
  emptyPreviewTipIndex: number;
  currentEmptyPreviewTip: string;
}

const DashboardEmptyStageNoir = ({ emptyPreviewTipIndex, currentEmptyPreviewTip }: DashboardEmptyStageProps) => {
  const { t } = useI18n();

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden p-8" data-tour="dashboard-stage-empty">
      <div className="halftone-red pointer-events-none absolute inset-0 opacity-15" aria-hidden="true" />
      <span className="pointer-events-none absolute right-6 top-6 font-display text-[10rem] font-black leading-none text-outline opacity-40 md:text-[16rem]" aria-hidden="true">00</span>
      <span className="v-text pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 font-display text-6xl font-black text-outline opacity-25" aria-hidden="true">スタート</span>

      <motion.div
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
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`tip-${emptyPreviewTipIndex}`}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="glass panel-cut relative z-10 mt-10 w-full max-w-md border-gold/30 p-4 shadow-hard-gold"
        >
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={13} className="text-gold" />
            <span className="kicker !text-gold">{t('dashboard.emptyStage.tipTitle')}</span>
          </div>
          <p className="font-mono text-[13px] leading-relaxed text-paper">{currentEmptyPreviewTip}</p>
          <span className="mt-2 block font-mono text-[9px] uppercase tracking-widest text-paper-dim">{t('dashboard.emptyStage.tipMeta')}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default DashboardEmptyStageNoir;
