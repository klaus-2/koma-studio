import type { ReactElement, ReactNode } from 'react';
import { Database } from 'lucide-react';
import { useState } from 'react';

import { formatBytes } from '@/utils/formatBytes';
import type { useI18n } from '../../../i18n';
import { useCacheManagerPanel } from '../use-cache-manager-panel';
import type { CacheStoreUsageView } from '../use-cache-manager-panel.types';
import type { UseCacheManagerPanelResult } from '../use-cache-manager-panel';

type TranslationFn = ReturnType<typeof useI18n>['t'];

interface SettingsCacheSectionNoirProps {
  readonly t: TranslationFn;
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="panel-cut-sm border border-paper/12 bg-ink/50 p-4">
      <div className="flex items-center gap-2">
        <Database size={14} className="text-crimson" aria-hidden />
        <h3 className="font-display text-xs font-black uppercase tracking-tight text-paper">
          {title}
        </h3>
      </div>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-paper/40">
        {desc}
      </p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function storeRows(
  store: CacheStoreUsageView,
): readonly [string, number, number][] {
  return Object.entries(store.tables).map(([name, table]) => [
    name,
    table.row_count,
    table.logical_bytes,
  ]);
}

const STORE_ORDER = ['stage_store', 'translation_store'] as const;

function UsageTables({
  panel,
  t,
}: {
  panel: UseCacheManagerPanelResult;
  t: TranslationFn;
}): ReactElement {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {STORE_ORDER.map((storeKey) => {
        const store = panel.usage?.[storeKey];
        if (!store) {
          return null;
        }
        return (
          <div
            key={storeKey}
            className="border border-paper/10 bg-ink/60 p-3 font-mono text-[10px] text-paper/70"
          >
            <div className="font-display text-[10px] font-black uppercase tracking-wider text-paper">
              {storeKey}
            </div>
            <table className="mt-2 w-full">
              <tbody>
                {storeRows(store).map(([name, rows, bytes]) => (
                  <tr key={name}>
                    <td className="py-0.5">{name}</td>
                    <td className="py-0.5 text-right">
                      {rows} · {formatBytes(bytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-paper/50">
              {t('settings.cache.table.diskBytes')}: {formatBytes(store.file_size_bytes)} ·{' '}
              {t('settings.cache.table.freelist')}: {store.freelist_count}/{store.page_count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SettingsCacheSectionNoir({
  t,
}: SettingsCacheSectionNoirProps): ReactElement {
  const panel = useCacheManagerPanel();
  const [vacuumArmed, setVacuumArmed] = useState(false);

  const actionsDisabled = panel.batchActive || panel.busy !== 'idle';

  return (
    <Section title={t('settings.cache.title')} desc={t('settings.cache.desc')}>
      {panel.batchActive && (
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-crimson" role="status">
          {t('settings.cache.disabledWhileProcessing')}
        </p>
      )}

      <UsageTables panel={panel} t={t} />

      <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-paper/40">
        {t('settings.cache.logicalVsDisk')}
      </p>

      <label className="mt-3 flex items-center justify-between border border-paper/10 bg-ink/60 p-3">
        <span className="font-display text-[10px] font-black uppercase tracking-tight text-paper">
          {t('settings.cache.limit.enable')}
        </span>
        <input
          type="checkbox"
          checked={panel.limitSettings.enabled}
          onChange={(event) =>
            panel.setLimitSettings({
              ...panel.limitSettings,
              enabled: event.target.checked,
            })
          }
          className="h-4 w-4 accent-crimson"
        />
      </label>

      {panel.limitSettings.enabled && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="border border-paper/10 bg-ink/60 p-3">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-paper/40">
              {t('settings.cache.limit.rows')}
            </span>
            <input
              type="number"
              min={0}
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
              className="mt-1 w-full bg-ink text-paper"
            />
          </label>
          <label className="border border-paper/10 bg-ink/60 p-3">
            <span className="block font-mono text-[9px] uppercase tracking-wider text-paper/40">
              {t('settings.cache.limit.bytes')}
            </span>
            <input
              type="number"
              min={0}
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
              className="mt-1 w-full bg-ink text-paper"
            />
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={() => void panel.pruneNow()}
          className="border border-crimson/60 bg-crimson/10 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-paper disabled:opacity-40"
        >
          {t('settings.cache.actions.prune')}
        </button>
        <span className="font-mono text-[9px] uppercase tracking-wider text-paper/40">
          {t('settings.cache.oldestFirst')}
        </span>
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={() => {
            if (!vacuumArmed) {
              setVacuumArmed(true);
              return;
            }
            setVacuumArmed(false);
            void panel.vacuumNow();
          }}
          className="border border-paper/20 px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-wider text-paper disabled:opacity-40"
        >
          {vacuumArmed
            ? t('settings.cache.actions.confirmVacuum')
            : t('settings.cache.actions.vacuum')}
        </button>
      </div>

      {panel.pruneResult && (
        <p className="mt-2 font-mono text-[10px] text-paper/70" role="status">
          {t('settings.cache.freed')}: {formatBytes(panel.pruneResult.freed_logical_bytes)} (
          {panel.pruneResult.freed_rows})
        </p>
      )}
      {panel.vacuumResult && (
        <p className="mt-2 font-mono text-[10px] text-paper/70" role="status">
          {panel.vacuumResult
            .map(
              (report) =>
                `${report.store}: ${formatBytes(report.file_size_bytes_before)} -> ${formatBytes(report.file_size_bytes_after)}`,
            )
            .join(' · ')}
        </p>
      )}
      {panel.errorKind === 'conflict' && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-crimson" role="alert">
          {t('settings.cache.disabledWhileProcessing')}
        </p>
      )}
      {panel.errorKind === 'http' && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-crimson" role="alert">
          {t('settings.cache.error.http')}
        </p>
      )}
    </Section>
  );
}

export default SettingsCacheSectionNoir;
