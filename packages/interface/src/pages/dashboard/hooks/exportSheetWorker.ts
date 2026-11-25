/// <reference lib="webworker" />

import type { Row, SheetData } from 'write-excel-file/universal';

import type { SheetRow } from '../../../utils/spreadsheet-bridge';
import { parseCsvRows, serializeCsvRows } from './csvCodec';

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

const HEADER_INDEX_NOT_FOUND = -1;

const resolveHeaderIndexes = (
  headerRow: readonly string[],
): Record<keyof SheetRow, number> => ({
  imageId: headerRow.indexOf('imageId'),
  regionId: headerRow.indexOf('regionId'),
  chapterLabel: headerRow.indexOf('chapterLabel'),
  ocrText: headerRow.indexOf('ocrText'),
  translation: headerRow.indexOf('translation'),
  notes: headerRow.indexOf('notes'),
});

const readMappedCell = (
  row: readonly string[],
  columnIndex: number,
): string => {
  if (columnIndex === HEADER_INDEX_NOT_FOUND) {
    return '';
  }
  return stripCsvFormulaEscape(row[columnIndex] ?? '');
};

const normalizeImportedCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const mapHeaderRowsToSheetRows = (
  matrix: readonly (readonly string[])[],
): SheetRow[] => {
  if (matrix.length <= 1) {
    return [];
  }
  const indexes = resolveHeaderIndexes(matrix[0] ?? []);
  const mappedRows: SheetRow[] = [];
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const rawRow = matrix[rowIndex] ?? [];
    if (rawRow.every((cell) => cell.length === 0)) {
      continue;
    }
    mappedRows.push({
      imageId: readMappedCell(rawRow, indexes.imageId),
      regionId: readMappedCell(rawRow, indexes.regionId),
      chapterLabel: readMappedCell(rawRow, indexes.chapterLabel),
      ocrText: readMappedCell(rawRow, indexes.ocrText),
      translation: readMappedCell(rawRow, indexes.translation),
      notes: readMappedCell(rawRow, indexes.notes),
    });
  }
  return mappedRows;
};

const blobToArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Response(blob).arrayBuffer();
};

const toXlsxSheetData = (rows: readonly (readonly string[])[]): SheetData =>
  rows.map((row): Row => row.map((value) => ({ type: String, value })));

const buildExportBytes = async (
  request: SheetExportRequest,
): Promise<{ blobBytes: ArrayBuffer; mimeType: string }> => {
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
    const csv = serializeCsvRows(buildValues(true));
    const encoded = new TextEncoder().encode(csv);
    const copy = new Uint8Array(encoded.byteLength);
    copy.set(encoded);
    return {
      blobBytes: copy.buffer,
      mimeType: CSV_MIME_TYPE,
    };
  }

  const { default: writeXlsxFile } = await import('write-excel-file/universal');
  const blob = await writeXlsxFile(toXlsxSheetData(buildValues(false)), {
    sheet: SHEET_NAME,
  }).toBlob();
  const output = await blobToArrayBuffer(blob);
  return { blobBytes: output, mimeType: XLSX_MIME_TYPE };
};

const parseImportRows = async (
  request: SheetImportRequest,
): Promise<SheetRow[]> => {
  const isCsv = request.fileName.toLowerCase().endsWith('.csv');
  if (isCsv) {
    const csvText = new TextDecoder().decode(new Uint8Array(request.bytes));
    return mapHeaderRowsToSheetRows(parseCsvRows(csvText));
  }

  const { readSheet } = await import('read-excel-file/universal');
  const rawRows = await readSheet(new Uint8Array(request.bytes), { trim: false });
  const matrix = rawRows.map((row) => row.map(normalizeImportedCell));
  return mapHeaderRowsToSheetRows(matrix);
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
