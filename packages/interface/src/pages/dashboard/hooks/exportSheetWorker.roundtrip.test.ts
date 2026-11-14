import { describe, expect, it } from "vitest";

import type { SheetRow } from "../../../utils/spreadsheet-bridge";
import type {
  SheetWorkerRequest,
  SheetWorkerResponse,
} from "./exportSheetWorker";

interface CapturingWorkerScope {
  onmessage: ((event: MessageEvent<SheetWorkerRequest>) => void) | null;
  postMessage: (response: SheetWorkerResponse) => void;
}

const runWorkerRequest = async (
  request: SheetWorkerRequest,
): Promise<SheetWorkerResponse> => {
  const captured: SheetWorkerResponse[] = [];
  const scope: CapturingWorkerScope = {
    onmessage: null,
    postMessage: (response) => captured.push(response),
  };
  const workerModule = await import("./exportSheetWorker");
  workerModule.attachSheetWorkerScopeForTest(scope);
  if (!scope.onmessage) throw new Error("worker did not register onmessage");
  scope.onmessage(new MessageEvent("message", { data: request }));
  for (
    let waited = 0;
    captured.length === 0 && waited < 5000;
    waited += 100
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const response = captured[0];
  if (!response) throw new Error("sheet worker did not respond in time");
  return response;
};

const rows: SheetRow[] = [
  {
    imageId: "img-1",
    regionId: "r1",
    chapterLabel: "Chapter 01",
    ocrText: "先輩は今日も遅刻した",
    translation: "My senpai is late again",
    notes: "",
  },
  {
    imageId: "img-2",
    regionId: "r2",
    chapterLabel: "",
    ocrText: "ドン!",
    translation: "BOOM!\nSecond line",
    notes: "keep tone | short",
  },
];

describe("exportSheetWorker serialize/parse roundtrip (real xlsx dep)", () => {
  it("roundtrips SheetRow[] through a real xlsx write/read", async () => {
    const exportResponse = await runWorkerRequest({
      kind: "sheet-export",
      jobId: 1,
      format: "xlsx",
      rows,
    });
    expect(exportResponse.kind).toBe("sheet-export-success");
    if (exportResponse.kind !== "sheet-export-success") return;
    expect(exportResponse.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const importResponse = await runWorkerRequest({
      kind: "sheet-import",
      jobId: 2,
      fileName: "corrections.xlsx",
      bytes: exportResponse.blobBytes,
    });
    expect(importResponse.kind).toBe("sheet-import-success");
    if (importResponse.kind !== "sheet-import-success") return;
    expect(importResponse.rows).toEqual(rows);
  });

  it("roundtrips SheetRow[] through a real csv write/read", async () => {
    const exportResponse = await runWorkerRequest({
      kind: "sheet-export",
      jobId: 1,
      format: "csv",
      rows,
    });
    expect(exportResponse.kind).toBe("sheet-export-success");
    if (exportResponse.kind !== "sheet-export-success") return;
    expect(exportResponse.mimeType).toBe("text/csv;charset=utf-8");

    const importResponse = await runWorkerRequest({
      kind: "sheet-import",
      jobId: 2,
      fileName: "corrections.csv",
      bytes: exportResponse.blobBytes,
    });
    expect(importResponse.kind).toBe("sheet-import-success");
    if (importResponse.kind !== "sheet-import-success") return;
    expect(importResponse.rows).toEqual(rows);
  });

  it("neutralizes CSV formula leads on export and strips the escape on reimport", async () => {
    // CWE-1236: dash-led dialogue lines and formula-style OCR text must not
    // become live formulas when the reviewer opens the CSV in a spreadsheet.
    const dangerousRows: SheetRow[] = [
      {
        imageId: "img-1",
        regionId: "r1",
        chapterLabel: "",
        ocrText: "=1+1",
        translation: "Computed",
        notes: "",
      },
      {
        imageId: "img-2",
        regionId: "r2",
        chapterLabel: "",
        ocrText: "-Sore na no?",
        translation: "Is that so?",
        notes: "",
      },
    ];

    const exportResponse = await runWorkerRequest({
      kind: "sheet-export",
      jobId: 1,
      format: "csv",
      rows: dangerousRows,
    });
    expect(exportResponse.kind).toBe("sheet-export-success");
    if (exportResponse.kind !== "sheet-export-success") return;
    const csvText = new TextDecoder().decode(
      new Uint8Array(exportResponse.blobBytes),
    );
    expect(csvText).toContain("'=1+1");
    expect(csvText).toContain("'-Sore na no?");

    const importResponse = await runWorkerRequest({
      kind: "sheet-import",
      jobId: 2,
      fileName: "corrections.csv",
      bytes: exportResponse.blobBytes,
    });
    expect(importResponse.kind).toBe("sheet-import-success");
    if (importResponse.kind !== "sheet-import-success") return;
    expect(importResponse.rows).toEqual(dangerousRows);
  });
});
