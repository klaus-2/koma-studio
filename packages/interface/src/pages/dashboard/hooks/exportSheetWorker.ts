/// <reference lib="webworker" />

// Type-only import: erased at build time, so no static xlsx code lands in any
// chunk — the runtime `await import('xlsx')` happens inside the handlers.
import type { WorkBook, WorkSheet } from 'xlsx';

import type { SheetRow } from '../../../utils/spreadsheet-bridge';

export type SheetExportFormat = 'csv' | 'xlsx';

export interface SheetExportRequest {
  readonly kind: 'sheet-export';
  readonly jobId: number;
  readonly format: SheetExportFormat;
  readonly rows: readonly SheetRow[];
}

export interface SheetImportRequest {
  readonly kind: 'sheet-import';
  readonly jobId: number;
  readonly fileName: string;
  readonly bytes: ArrayBuffer;
}

export type SheetWorkerRequest = SheetExportRequest | SheetImportRequest;

export interface SheetExportSuccess {
  readonly kind: 'sheet-export-success';
  readonly jobId: number;
  readonly blobBytes: ArrayBuffer;
  readonly mimeType: string;
}

export interface SheetImportSuccess {
  readonly kind: 'sheet-import-success';
  readonly jobId: number;
  readonly rows: SheetRow[];
}

export interface SheetWorkerFailure {
  readonly kind: 'sheet-failure';
  readonly jobId: number;
  readonly message: string;
}

export type SheetWorkerResponse =
  | SheetExportSuccess
  | SheetImportSuccess
  | SheetWorkerFailure;

/**
 * STANDALONE sheet worker (Feature 3) — deliberately NOT plugged into
 * `exportWorkerPool.ts` (that pool's entry is hardcoded to
 * `exportPackageWorker.ts`; hosting SheetJS there would bloat the package
 * worker chunk, and sheet ops are rare single-file ops needing no queue).
 * `xlsx` is lazy-imported INSIDE the handlers so it lands only in this
 * worker's chunk; the main thread imports only the types above.
 */
const SHEET_NAME = 'Corrections';
const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEET_HEADERS: readonly string[] = [
  'imageId',
  'regionId',
  'chapterLabel',
  'ocrText',
  'translation',
  'notes',
];

const buildExportBytes = async (
  request: SheetExportRequest,
): Promise<{ blobBytes: ArrayBuffer; mimeType: string }> => {
  const XLSX = await import('xlsx');
  const values: string[][] = [
    [...SHEET_HEADERS],
    ...request.rows.map((row): string[] => [
      row.imageId,
      row.regionId,
      row.chapterLabel,
      row.ocrText,
      row.translation,
      row.notes,
    ]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(values);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);

  if (request.format === 'csv') {
    const sheet = workbook.Sheets[SHEET_NAME];
    if (!sheet) throw new Error('sheet serialization failed');
    const csv: string = XLSX.utils.sheet_to_csv(sheet);
    const encoded = new TextEncoder().encode(csv);
    const copy = new Uint8Array(encoded.byteLength);
    copy.set(encoded);
    return {
      blobBytes: copy.buffer,
      mimeType: CSV_MIME_TYPE,
    };
  }

  const output: ArrayBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });
  return { blobBytes: output, mimeType: XLSX_MIME_TYPE };
};

const parseImportRows = async (
  request: SheetImportRequest,
): Promise<SheetRow[]> => {
  const XLSX = await import('xlsx');
  const isCsv = request.fileName.toLowerCase().endsWith('.csv');
  const workbook: WorkBook = isCsv
    ? XLSX.read(new TextDecoder().decode(new Uint8Array(request.bytes)), {
      type: 'string',
    })
    : XLSX.read(request.bytes, { type: 'array' });

  const firstSheetName: string | undefined = workbook.SheetNames[0];
  if (firstSheetName === undefined) return [];
  const worksheet: WorkSheet | undefined = workbook.Sheets[firstSheetName];
  if (worksheet === undefined) return [];

  const records = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
    defval: '',
    raw: false,
  });
  return records.map((record): SheetRow => ({
    imageId: String(record.imageId ?? ''),
    regionId: String(record.regionId ?? ''),
    chapterLabel: String(record.chapterLabel ?? ''),
    ocrText: String(record.ocrText ?? ''),
    translation: String(record.translation ?? ''),
    notes: String(record.notes ?? ''),
  }));
};

let messageTarget: {
  onmessage: ((event: MessageEvent<SheetWorkerRequest>) => void) | null;
  postMessage: (response: SheetWorkerResponse) => void;
} = self as unknown as {
  onmessage: ((event: MessageEvent<SheetWorkerRequest>) => void) | null;
  postMessage: (response: SheetWorkerResponse) => void;
};

async function handleWorkerMessage(request: SheetWorkerRequest): Promise<void> {
  try {
    if (request.kind === 'sheet-export') {
      const result = await buildExportBytes(request);
      const response: SheetExportSuccess = {
        kind: 'sheet-export-success',
        jobId: request.jobId,
        blobBytes: result.blobBytes,
        mimeType: result.mimeType,
      };
      messageTarget.postMessage(response);
      return;
    }
    const rows = await parseImportRows(request);
    const response: SheetImportSuccess = {
      kind: 'sheet-import-success',
      jobId: request.jobId,
      rows,
    };
    messageTarget.postMessage(response);
  } catch (error) {
    const response: SheetWorkerFailure = {
      kind: 'sheet-failure',
      jobId: request.kind === 'sheet-export' || request.kind === 'sheet-import'
        ? request.jobId
        : -1,
      message: error instanceof Error ? error.message : String(error),
    };
    messageTarget.postMessage(response);
  }
}

messageTarget.onmessage = (event: MessageEvent<SheetWorkerRequest>): void => {
  void handleWorkerMessage(event.data);
};
