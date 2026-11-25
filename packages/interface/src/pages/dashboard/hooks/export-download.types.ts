export interface DownloadBundleResult {
  readonly fileName: string;
  readonly blob: Blob | null;
  readonly shellFilePath: string | null;
}
