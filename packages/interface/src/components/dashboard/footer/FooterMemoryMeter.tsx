import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@koma/ui/components/tooltip';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';

import { useI18n } from '../../../i18n';
import { cn } from '../../../utils/dashboard.utils';

const MEMORY_WARNING_RATIO = 0.85;
const MIB = 1024;

export interface MemoryAmount {
  used: number;
  total: number | null;
}

export interface VramAmount {
  used: number;
  total: number;
  free?: number | null;
}

export interface FooterMemoryMeterData {
  ram: MemoryAmount | null;
  vram: VramAmount | null;
}

const formatMb = (value: number): string =>
  value >= MIB ? `${(value / MIB).toFixed(1)} GB` : `${Math.round(value)} MB`;

const usageRatio = (amount: MemoryAmount): number =>
  amount.total === null || amount.total <= 0 ? 0 : Math.max(0, amount.used / amount.total);

const isNearLimit = ({ ram, vram }: FooterMemoryMeterData): boolean => {
  if (ram !== null && usageRatio(ram) >= MEMORY_WARNING_RATIO) return true;
  if (vram === null) return false;
  const vramRatio =
    vram.free !== null && vram.free !== undefined && vram.total > 0
      ? Math.max(0, (vram.total - vram.free) / vram.total)
      : usageRatio(vram);
  return vramRatio >= MEMORY_WARNING_RATIO;
};

interface ContentProps {
  data: FooterMemoryMeterData;
  titleClassName: string;
  bodyClassName: string;
}

function MemoryMeterContent({ data, titleClassName, bodyClassName }: ContentProps) {
  const { t } = useI18n();
  return (
    <>
      <div className={titleClassName}>{t('dashboard.footer.memory.title')}</div>
      {isNearLimit(data) && <p className={bodyClassName}>{t('dashboard.footer.memory.warning')}</p>}
      {data.ram && (
        <p className={bodyClassName}>
          {t('dashboard.footer.memory.ram', {
            used: formatMb(data.ram.used),
            total: data.ram.total === null ? '—' : formatMb(data.ram.total),
          })}
        </p>
      )}
      {data.vram && (
        <p className={bodyClassName}>
          {t('dashboard.footer.memory.vram', {
            used: formatMb(data.vram.used),
            total: formatMb(data.vram.total),
          })}
        </p>
      )}
      {data.ram?.total === null && (
        <p className={bodyClassName}>{t('dashboard.footer.memory.ramTotalUnknown')}</p>
      )}
    </>
  );
}

const FooterMemoryMeterClassic: React.FC<FooterMemoryMeterData> = ({ ram, vram }) => {
  const { t } = useI18n();
  if (ram === null && vram === null) return null;
  const data = { ram, vram };
  const nearLimit = isNearLimit(data);
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`koma-footerbar__workspace${nearLimit ? ' koma-footerbar__runtime--fallback' : ''}`}
          >
            {nearLimit && (
              <span className="koma-footerbar__runtimeIcon" role="img" aria-label={t('dashboard.footer.memory.warning')}>
                <AlertTriangle size={12} />
              </span>
            )}
            {ram && <span className="koma-footerbar__workspaceLabel">{formatMb(ram.used)}</span>}
            {vram && <span className="koma-footerbar__workspaceLabel">{formatMb(vram.used)}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="koma-footerbar__tooltip">
          <MemoryMeterContent
            data={data}
            titleClassName="koma-footerbar__tooltipTitle"
            bodyClassName=""
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const FooterMemoryMeterNoir: React.FC<FooterMemoryMeterData> = ({ ram, vram }) => {
  const { t } = useI18n();
  if (ram === null && vram === null) return null;
  const data = { ram, vram };
  const nearLimit = isNearLimit(data);
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'panel-cut-sm flex items-center gap-1.5 border bg-ink-3/60 px-2 py-1',
              nearLimit ? 'border-gold/40 text-gold' : 'border-paper/20 text-paper-dim',
            )}
          >
            {nearLimit && <AlertTriangle size={11} aria-label={t('dashboard.footer.memory.warning')} />}
            {ram && <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">{formatMb(ram.used)}</span>}
            {vram && <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">{formatMb(vram.used)}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="end" className="glass panel-cut-sm border-crimson/30 max-w-xs">
          <MemoryMeterContent
            data={data}
            titleClassName="kicker mb-1"
            bodyClassName="font-mono text-[11px] text-paper-dim"
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const FooterMemoryMeter = createFamilyComponent(
  FooterMemoryMeterClassic,
  FooterMemoryMeterNoir,
);

export default FooterMemoryMeter;
