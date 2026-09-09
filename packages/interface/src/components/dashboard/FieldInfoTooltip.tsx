import { Info } from 'lucide-react';

import { useToolTips } from '../../hooks/useToolTips';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@koma/ui/components/tooltip";

interface FieldInfoTooltipProps {
  content: string;
  ariaLabel: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export default function FieldInfoTooltip({
  content,
  ariaLabel,
  side = 'top',
}: FieldInfoTooltipProps) {
  const { enabled } = useToolTips();

  if (!enabled || !content.trim()) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="koma-inline-info-button"
            aria-label={ariaLabel}
          >
            <Info size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="koma-inline-info-tooltip">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
