import type { JSX } from 'react';
import { useState } from 'react';

import { formatBytes } from '@/utils/formatBytes';
import type { useI18n } from '../../i18n';
import { useCacheManagerPanel } from './use-cache-manager-panel';
import type { CacheStoreUsageView } from './use-cache-manager-panel.types';

type TranslationFn = ReturnType<typeof useI18n>['t'];

interface SettingsCacheSectionProps {
  readonly t: TranslationFn;
}

function storeUsageRows(
  store: CacheStoreUsageView,
): readonly [string, number, number][] {
  return Object.entries(store.tables).map(([name, table]) => [
    name,
    table.row_count,
    table.logical_bytes,
  ]);
}

const STORE_ORDER = ['stage_store', 'translation_store'] as const;

export function SettingsCacheSection({
  t,
}: SettingsCacheSectionProps): JSX.Element {
  const panel = useCacheManagerPanel();
  const [vacuumArmed, setVacuumArmed] = useState(false);

  const actionsDisabled = panel.batchActive || panel.busy !== 'idle';

  return (
    <section className="koma-stg-section">
      <div className="koma-stg-section__head">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" className="koma-stg-section__ico">
          <path d="M3 5a2 2 0 012-2h4a2 2 0 012 2v1h4a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm6 1V5H5v3h6V6H9zm-6 5v4h12v-7H5v3h3a1 1 0 000-2H5z" />
        </svg>
        <h3 className="koma-stg-section__title">{t('settings.cache.title')}</h3>
      </div>
      <p className="koma-stg-section__desc">{t('settings.cache.desc')}</p>

      {panel.batchActive && (
        <p className="koma-stg-section__desc" role="status">
          {t('settings.cache.disabledWhileProcessing')}
        </p>
      )}

      <div className="koma-stg-grid" style={{ marginTop: 12 }}>
        {STORE_ORDER.map((storeKey) => {
          const store = panel.usage?.[storeKey];
          if (!store) {
            return null;
          }
          return (
            <div className="koma-stg-item" key={storeKey}>
              <span className="koma-stg-item__label koma-stg-item__value--mono">
                {storeKey}
              </span>
              <table style={{ marginTop: 8, width: '100%' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ textAlign: 'left' }}>
                      <span className="koma-stg-item__value--mono" />
                    </th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      <span className="koma-stg-item__value">
                        {t('settings.cache.table.rows')}
                      </span>
                    </th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      <span className="koma-stg-item__value">
                        {t('settings.cache.table.logicalBytes')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {storeUsageRows(store).map(([name, rows, bytes]) => (
                    <tr key={name}>
                      <td>
                        <span className="koma-stg-item__value--mono">{name}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="koma-stg-item__value">{rows}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="koma-stg-item__value">
                          {formatBytes(bytes)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="koma-stg-section__desc" style={{ marginTop: 8 }}>
                {t('settings.cache.table.diskBytes')}: {formatBytes(store.file_size_bytes)} ·{' '}
                {t('settings.cache.table.freelist')}: {store.freelist_count} /{' '}
                {store.page_count}
              </p>
            </div>
          );
        })}
      </div>

      <p className="koma-stg-section__desc">{t('settings.cache.logicalVsDisk')}</p>

      <label className="koma-stg-toggle-wide">
        <div>
          <span className="koma-stg-toggle-wide__title">
            {t('settings.cache.limit.enable')}
          </span>
        </div>
        <div className={`koma-toggle ${panel.limitSettings.enabled ? 'koma-toggle--on' : ''}`}>
          <input
            type="checkbox"
            className="koma-toggle__input"
            checked={panel.limitSettings.enabled}
            onChange={(event) =>
              panel.setLimitSettings({
                ...panel.limitSettings,
                enabled: event.target.checked,
              })
            }
          />
          <span className="koma-toggle__track">
            <span className="koma-toggle__thumb" />
          </span>
        </div>
      </label>

      {panel.limitSettings.enabled && (
        <div className="koma-stg-grid" style={{ marginTop: 12 }}>
          <div className="koma-stg-item">
            <span className="koma-stg-item__label">
              {t('settings.cache.limit.rows')}
            </span>
            <input
              type="number"
              min={0}
              className="koma-ig-field__input"
              value={
                panel.limitSettings.rowsPerTable === null
                  ? ''
                  : String(panel.limitSettings.rowsPerTable)
              }
              onChange={(event) => {
                const raw = event.target.value.trim();
                const parsed = raw === '' ? null : Number(raw);
                panel.setLimitSettings({
                  ...panel.limitSettings,
                  rowsPerTable:
                    parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0
                      ? parsed
                      : null,
                });
              }}
              style={{ maxWidth: 160, height: 32 }}
            />
          </div>
          <div className="koma-stg-item">
            <span className="koma-stg-item__label">
              {t('settings.cache.limit.bytes')}
            </span>
            <input
              type="number"
              min={0}
              className="koma-ig-field__input"
              value={
                panel.limitSettings.totalBytes === null
                  ? ''
                  : String(panel.limitSettings.totalBytes)
              }
              onChange={(event) => {
                const raw = event.target.value.trim();
                const parsed = raw === '' ? null : Number(raw);
                panel.setLimitSettings({
                  ...panel.limitSettings,
                  totalBytes:
                    parsed !== null && Number.isSafeInteger(parsed) && parsed >= 0
                      ? parsed
                      : null,
                });
              }}
              style={{ maxWidth: 160, height: 32 }}
            />
          </div>
        </div>
      )}

      <div className="koma-stg-actions koma-stg-actions--row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="koma-btn koma-btn--primary koma-btn--sm"
          disabled={actionsDisabled}
          onClick={() => void panel.pruneNow()}
        >
          {t('settings.cache.actions.prune')}
        </button>
        <span className="koma-stg-item__value">{t('settings.cache.oldestFirst')}</span>
        <button
          type="button"
          className="koma-btn koma-btn--ghost koma-btn--sm"
          disabled={actionsDisabled}
          onClick={() => {
            if (!vacuumArmed) {
              setVacuumArmed(true);
              return;
            }
            setVacuumArmed(false);
            void panel.vacuumNow();
          }}
        >
          {vacuumArmed
            ? t('settings.cache.actions.confirmVacuum')
            : t('settings.cache.actions.vacuum')}
        </button>
      </div>

      {panel.pruneResult && (
        <p className="koma-stg-section__desc" role="status">
          {t('settings.cache.freed')}: {formatBytes(panel.pruneResult.freed_logical_bytes)} (
          {panel.pruneResult.freed_rows})
        </p>
      )}
      {panel.vacuumResult && (
        <p className="koma-stg-section__desc" role="status">
          {panel.vacuumResult
            .map(
              (report) =>
                `${report.store}: ${formatBytes(report.file_size_bytes_before)} -> ${formatBytes(report.file_size_bytes_after)}`,
            )
            .join(' · ')}
        </p>
      )}
      {panel.errorKind === 'conflict' && (
        <p className="koma-stg-section__desc" role="alert">
          {t('settings.cache.disabledWhileProcessing')}
        </p>
      )}
      {panel.errorKind === 'http' && (
        <p className="koma-stg-section__desc" role="alert">
          {t('settings.cache.error.http')}
        </p>
      )}
    </section>
  );
}

export default SettingsCacheSection;
