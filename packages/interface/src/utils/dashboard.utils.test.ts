import { describe, expect, it } from "vitest";

import { readExecutionFallbackNotice } from "@/utils/dashboard.utils";

const responseWithHeaders = (headers: Record<string, string>): Response =>
  new Response(null, { headers });

describe("readExecutionFallbackNotice", () => {
  it("maps gpu_oom_to_cpu to the existing fallback notice", () => {
    const notice = readExecutionFallbackNotice(
      responseWithHeaders({
        "X-Koma-Execution-Fallback": "gpu_oom_to_cpu",
        "X-Koma-Execution-Model": "got_ocr2",
      }),
      "OCR",
    );

    expect(notice).toBe(
      'Model "got_ocr2" fell back to CPU due to insufficient VRAM during the "OCR" stage. Processing continued on CPU and may be slower.',
    );
  });

  it("maps vram_to_cpu to the pre-load decision notice", () => {
    const notice = readExecutionFallbackNotice(
      responseWithHeaders({
        "X-Koma-Execution-Fallback": "vram_to_cpu",
        "X-Koma-Execution-Model": "got_ocr2",
      }),
      "OCR",
    );

    expect(notice).toContain('Model "got_ocr2"');
    expect(notice).toContain("ran on CPU");
    expect(notice).toContain("free VRAM was below the model's declared requirement");
    expect(notice).toContain("(decided before load)");
  });

  it("returns null for an unrelated fallback reason", () => {
    const notice = readExecutionFallbackNotice(
      responseWithHeaders({ "X-Koma-Execution-Fallback": "something_else" }),
      "OCR",
    );

    expect(notice).toBeNull();
  });

  it("returns null when the fallback header is absent", () => {
    expect(readExecutionFallbackNotice(responseWithHeaders({}), "OCR")).toBeNull();
  });
});
