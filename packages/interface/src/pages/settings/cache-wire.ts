import type {
  CachePruneResultView,
  CacheStoreUsageView,
  CacheStoreVacuumView,
  CacheTableUsageView,
  CacheUsageView,
} from './use-cache-manager-panel.types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function parseTableUsage(value: unknown): CacheTableUsageView | null {
  if (!isRecord(value)) {
    return null;
  }
  const rows = asFiniteNumber(value['row_count']);
  const bytes = asFiniteNumber(value['logical_bytes']);
  if (rows === null || bytes === null) {
    return null;
  }
  return { row_count: rows, logical_bytes: bytes };
}

export function parseStoreUsage(value: unknown): CacheStoreUsageView | null {
  if (!isRecord(value)) {
    return null;
  }
  const fileSize = asFiniteNumber(value['file_size_bytes']);
  const pageCount = asFiniteNumber(value['page_count']);
  const freelistCount = asFiniteNumber(value['freelist_count']);
  const rawTables = value['tables'];
  if (
    fileSize === null ||
    pageCount === null ||
    freelistCount === null ||
    !isRecord(rawTables)
  ) {
    return null;
  }
  const tables: Record<string, CacheTableUsageView> = {};
  for (const [name, rawTable] of Object.entries(rawTables)) {
    const parsed = parseTableUsage(rawTable);
    if (parsed !== null) {
      tables[name] = parsed;
    }
  }
  return {
    file_size_bytes: fileSize,
    page_count: pageCount,
    freelist_count: freelistCount,
    tables,
  };
}

export function parseUsageResponse(value: unknown): CacheUsageView | null {
  if (!isRecord(value)) {
    return null;
  }
  const stage = parseStoreUsage(value['stage_store']);
  const translation = parseStoreUsage(value['translation_store']);
  if (stage === null || translation === null) {
    return null;
  }
  return { stage_store: stage, translation_store: translation };
}

export function parsePruneResponse(value: unknown): CachePruneResultView | null {
  if (!isRecord(value)) {
    return null;
  }
  const rows = asFiniteNumber(value['freed_rows']);
  const bytes = asFiniteNumber(value['freed_logical_bytes']);
  if (rows === null || bytes === null) {
    return null;
  }
  return { freed_rows: rows, freed_logical_bytes: bytes };
}

export function parseVacuumResponse(value: unknown): CacheStoreVacuumView[] | null {
  if (!isRecord(value)) {
    return null;
  }
  const rawPerStore = value['per_store'];
  if (!Array.isArray(rawPerStore)) {
    return null;
  }
  const reports: CacheStoreVacuumView[] = [];
  for (const rawReport of rawPerStore) {
    if (!isRecord(rawReport)) {
      continue;
    }
    const store = rawReport['store'];
    const before = asFiniteNumber(rawReport['file_size_bytes_before']);
    const after = asFiniteNumber(rawReport['file_size_bytes_after']);
    if (typeof store !== 'string' || before === null || after === null) {
      continue;
    }
    reports.push({
      store,
      file_size_bytes_before: before,
      file_size_bytes_after: after,
    });
  }
  return reports;
}
