import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import { useI18n } from '../../i18n';
import type { CleanProtocol } from '../../utils/customLlm';
import {
  assessImageEditModelCompatibility,
  type ImageEditCompatibilityTarget,
} from '../../utils/imageEditModelCompatibility';

interface ImageEditCompatibilityBannerProps {
  model: string;
  apiBase?: string;
  protocol?: CleanProtocol;
  targetMode: ImageEditCompatibilityTarget;
  noir?: boolean;
}

export default function ImageEditCompatibilityBanner({
  model,
  apiBase = '',
  protocol = 'auto',
  targetMode,
  noir = false,
}: ImageEditCompatibilityBannerProps) {
  const { t } = useI18n();
  if (!model.trim()) {
    return null;
  }

  const assessment = assessImageEditModelCompatibility({
    model,
    apiBase,
    protocol,
    targetMode,
  });
  const examples = assessment.recommendedReplacements.join(', ');

  if (assessment.status === 'incompatible_text_only') {
    return (
      <div
        role="alert"
        className={
          noir
            ? 'panel-cut-sm flex items-start gap-2 border border-gold/40 border-l-[3px] border-l-gold bg-gold/10 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-gold'
            : 'flex items-start gap-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200'
        }
      >
        <AlertTriangle size={13} className="mt-0.5 flex-none" aria-hidden="true" />
        <span>
          {t(
            assessment.reasonKey === 'localOllama'
              ? 'dashboard.aio.customAi.cleanCompatibility.localOllama'
              : 'dashboard.aio.customAi.cleanCompatibility.textOnlyModel',
            {
              model,
              examples,
            },
          )}
        </span>
      </div>
    );
  }

  if (assessment.status === 'clean_only' && targetMode === 'aio_ai') {
    return (
      <div
        role="status"
        className={
          noir
            ? 'panel-cut-sm flex items-start gap-2 border border-gold/35 border-l-[3px] border-l-gold bg-gold/8 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-gold'
            : 'flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200'
        }
      >
        <Info size={13} className="mt-0.5 flex-none" aria-hidden="true" />
        <span>
          {t('dashboard.aio.customAi.cleanCompatibility.textInpaintingOnly', {
            model,
            examples,
          })}
        </span>
      </div>
    );
  }

  if (assessment.status === 'compatible_both') {
    return (
      <div
        role="status"
        className={
          noir
            ? 'panel-cut-sm flex items-center gap-1.5 border border-mint/35 bg-mint/8 px-2.5 py-1.5 font-mono text-[9.5px] text-mint'
            : 'flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[10.5px] text-emerald-200'
        }
      >
        <CheckCircle2 size={12} className="flex-none" aria-hidden="true" />
        <span>{t('dashboard.aio.customAi.cleanCompatibility.readyBoth')}</span>
      </div>
    );
  }

  if (assessment.status === 'clean_only' && targetMode === 'clean') {
    return (
      <div
        role="status"
        className={
          noir
            ? 'panel-cut-sm flex items-center gap-1.5 border border-azure/35 bg-azure/8 px-2.5 py-1.5 font-mono text-[9.5px] text-azure'
            : 'flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1.5 text-[10.5px] text-sky-200'
        }
      >
        <Info size={12} className="flex-none" aria-hidden="true" />
        <span>{t('dashboard.aio.customAi.cleanCompatibility.readyCleanOnly')}</span>
      </div>
    );
  }

  return null;
}
