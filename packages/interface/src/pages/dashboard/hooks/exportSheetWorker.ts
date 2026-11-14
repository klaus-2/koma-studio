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

// CWE-1236 (CSV formula injection): characters a spreadsheet evaluates as a
// formula lead when a CSV cell starts with them.
const CSV_FORMULA_LEAD_CHARS: ReadonlySet<string> = new Set([
  '=',
  '+',
  '-',
  '@',
  '\t',
  '\r',
]);

/**
 * CSV-branch guard: a cell whose first character can start a spreadsheet
 * formula is prefixed with an apostrophe so opening the exported file cannot
 * execute it (dash-led dialogue lines are common OCR output). The XLSX branch
 * needs no guard — string-typed cells are stored, never evaluated.
 */
const escapeCsvFormulaLead = (cell: string): string =>
  CSV_FORMULA_LEAD_CHARS.has(cell.charAt(0)) ? `'${cell}` : cell;

/**
 * Mirror of `escapeCsvFormulaLead` on parse: strips ONE leading apostrophe
 * from every parsed cell so escaped cells round-trip losslessly. Accepted
 * cosmetic edge (stated, by design): OCR/translation text that genuinely
 * starts with an apostrophe round-trips with it stripped.
 */
const stripCsvFormulaEscape = (cell: string): string =>
  cell.startsWith("'") ? cell.slice(1) : cell;

const buildExportBytes = async (
  request: SheetExportRequest,
): Promise<{ blobBytes: ArrayBuffer; mimeType: string }> => {
  const XLSX = await import('xlsx');
  const buildValues = (escape: boolean): string[][] => [
    [...SHEET_HEADERS],
    ...request.rows.map((row): string[] => {
      const cells: string[] = [
        row.imageId,
        row.regionId,
        row.chapterLabel,
        row.ocrText,
        row.translation,
        row.notes,
      ];
      return escape ? cells.map(escapeCsvFormulaLead) : cells;
    }),
  ];

  if (request.format === 'csv') {
    const csvWorksheet = XLSX.utils.aoa_to_sheet(buildValues(true));
    const csv: string = XLSX.utils.sheet_to_csv(csvWorksheet);
    const encoded = new TextEncoder().encode(csv);
    const copy = new Uint8Array(encoded.byteLength);
    copy.set(encoded);
    return {
      blobBytes: copy.buffer,
      mimeType: CSV_MIME_TYPE,
    };
  }

  const worksheet = XLSX.utils.aoa_to_sheet(buildValues(false));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
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
    imageId: stripCsvFormulaEscape(String(record.imageId ?? '')),
    regionId: stripCsvFormulaEscape(String(record.regionId ?? '')),
    chapterLabel: stripCsvFormulaEscape(String(record.chapterLabel ?? '')),
    ocrText: stripCsvFormulaEscape(String(record.ocrText ?? '')),
    translation: stripCsvFormulaEscape(String(record.translation ?? '')),
    notes: stripCsvFormulaEscape(String(record.notes ?? '')),
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

/**
 * Test seam (same shape as exportPackageWorker.attachWorkerScopeForTest):
 * lets vitest drive the real worker module same-thread with a capturing
 * scope instead of spawning a real Worker.
 */
export const attachSheetWorkerScopeForTest = (
  scope: {
    onmessage: ((event: MessageEvent<SheetWorkerRequest>) => void) | null;
    postMessage: (response: SheetWorkerResponse) => void;
  } | null,
): void => {
  messageTarget = scope ?? (self as unknown as typeof messageTarget);
  messageTarget.onmessage = (event: MessageEvent<SheetWorkerRequest>): void => {
    void handleWorkerMessage(event.data);
  };
};
