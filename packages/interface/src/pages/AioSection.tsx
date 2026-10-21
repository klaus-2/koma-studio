import { memo, useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { createFamilyComponent } from '@koma/ui/themes/family-skins';
import { AioSectionNoir } from './aio-noir/AioSectionNoir';

interface AioSectionProps {
  icon: LucideIcon;
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

const AioSectionClassic = memo(function AioSectionClassic({
  icon: Icon,
  title,
  badge,
  defaultOpen = true,
  children,
}: AioSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('koma-aio-section', open && 'koma-aio-section--open')}>
      <button
        type="button"
        className="koma-aio-section__header"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="koma-aio-section__header-icon" aria-hidden="true">
          <Icon size={12} />
        </span>
        <span className="koma-aio-section__title">{title}</span>
        {badge}
        <ChevronDown size={12} className="koma-aio-section__chevron" />
      </button>

      {open && <div className="koma-aio-section__body">{children}</div>}
    </div>
  );
});

export const AioSection = memo(
  createFamilyComponent(AioSectionClassic, AioSectionNoir),
);