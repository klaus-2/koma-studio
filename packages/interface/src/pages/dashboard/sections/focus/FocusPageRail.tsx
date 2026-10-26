import { memo, type ComponentProps } from 'react';
import { Plus, X } from 'lucide-react';

import { useI18n } from '../../../../i18n';
import type { LoadedImage } from '../../../../types/dashboard.types';
import type { useDashboardUploads } from '../../hooks/image-collection';
import type { FocusPageFlow } from '../../lib/focus-flow';

type UploadsApi = ReturnType<typeof useDashboardUploads>;

export interface FocusRailItem {
  image: LoadedImage;
  flow: FocusPageFlow;
}

interface FocusPageRailProps {
  items: FocusRailItem[];
  activeId: string | null;
  processing: boolean;
  onSelect: (imageId: string) => void;
  onRemove: (imageId: string) => void;
  getRootProps: UploadsApi['getRootProps'];
  getInputProps: UploadsApi['getInputProps'];
}

/**
 * The only page navigation in Focus: thumbnail, name and one status
 * (pending / processed / reviewed) per page, plus add/remove. Adding and
 * removing are locked while the pipeline runs — mutating the collection
 * mid-run aborts the batch, so the dropzone is unmounted entirely then.
 */
export default memo(function FocusPageRail({
  items,
  activeId,
  processing,
  onSelect,
  onRemove,
  getRootProps,
  getInputProps,
}: FocusPageRailProps) {
  const { t } = useI18n();

  const statusFor = (flow: FocusPageFlow) =>
    flow.reviewed && flow.processed
      ? {
          className: 'koma-focus__dot koma-focus__dot--reviewed',
          label: t('focus.pages.statusReviewed'),
        }
      : flow.processed
        ? {
            className: 'koma-focus__dot koma-focus__dot--processed',
            label: t('focus.pages.statusProcessed'),
          }
        : {
            className: 'koma-focus__dot',
            label: t('focus.pages.statusPending'),
          };

  return (
    <nav className="koma-focus__rail" aria-label={t('focus.pages.title')}>
      <div className="koma-focus__rail-head">
        <span>{t('focus.pages.title')}</span>
        <span className="koma-focus__rail-count">{items.length}</span>
      </div>

      <ul className="koma-focus__rail-list custom-scrollbar">
        {items.map(({ image, flow }, index) => {
          const status = statusFor(flow);
          const active = image.id === activeId;
          return (
            <li key={image.id} className="koma-focus__rail-row">
              <button
                type="button"
                className={
                  active
                    ? 'koma-focus__rail-item koma-focus__rail-item--active'
                    : 'koma-focus__rail-item'
                }
                onClick={() => onSelect(image.id)}
                aria-current={active ? 'true' : undefined}
                aria-label={t('focus.pages.select', { index: index + 1 })}
              >
                <img
                  className="koma-focus__rail-thumb"
                  src={image.thumbnailUrl ?? image.url}
                  alt=""
                  draggable={false}
                />
                <span className="koma-focus__rail-meta">
                  <span className="koma-focus__rail-name" title={image.file.name}>
                    {index + 1}. {image.file.name}
                  </span>
                  <span className="koma-focus__rail-status">
                    <span className={status.className} aria-hidden="true" />
                    {status.label}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="koma-focus__rail-remove"
                onClick={() => onRemove(image.id)}
                disabled={processing}
                aria-label={t('focus.pages.remove', { index: index + 1 })}
                title={t('focus.pages.remove', { index: index + 1 })}
              >
                <X size={13} />
              </button>
            </li>
          );
        })}
      </ul>

      {processing ? (
        <button
          type="button"
          className="koma-focus__rail-add"
          disabled
          title={t('focus.status.locked')}
        >
          <Plus size={14} />
          {t('focus.pages.add')}
        </button>
      ) : (
        <div
          {...(getRootProps() as ComponentProps<'div'>)}
          className="koma-focus__rail-add"
        >
          <input {...(getInputProps() as ComponentProps<'input'>)} />
          <Plus size={14} />
          {t('focus.pages.add')}
        </div>
      )}
    </nav>
  );
});
