
export interface CacheTableUsageView {
  readonly row_count: number;
  readonly logical_bytes: number;
}

export interface CacheStoreUsageView {
  readonly file_size_bytes: number;
  readonly page_count: number;
  readonly freelist_count: number;
  readonly tables: Readonly<Record<string, CacheTableUsageView>>;
}

export interface CacheUsageView {
  readonly stage_store: CacheStoreUsageView;
  readonly translation_store: CacheStoreUsageView;
}

export interface CacheStoreVacuumView {
  readonly store: string;
  readonly file_size_bytes_before: number;
  readonly file_size_bytes_after: number;
}

export interface CachePruneResultView {
  readonly freed_rows: number;
  readonly freed_logical_bytes: number;
}
