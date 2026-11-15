import { describe, expect, it } from "vitest";

import { readExecutionRuntimeNotice } from "./dashboard.utils";

function responseWithDetail(detail: object, status = 500): Response {
  return new Response(JSON.stringify({ detail }), { status });
}

describe("readExecutionRuntimeNotice log path", () => {
  it("appends the runtime log path to the notice when present", async () => {
    const response = responseWithDetail({
      error: 'Out of VRAM while running the "OCR" stage with model "got_ocr2" on the GPU.',
      code: "INSUFFICIENT_VRAM",
      stage: "ocr",
      stage_label: "OCR",
      model_key: "got_ocr2",
      backend: "gpu",
      cpu_fallback_attempted: true,
      cpu_fallback_error: "cpu failed too",
      raw_detail: "cuda out of memory",
      log_path: "C:/logs/mini-backend-runtime.log",
    });

    const notice = await readExecutionRuntimeNotice(response, "Recognize Text");

    expect(notice).not.toBeNull();
    expect(notice?.detail).toContain("Runtime log: C:/logs/mini-backend-runtime.log");
    expect(notice?.tone).toBe("legacy");
  });

  it("omits the log line when the payload has no log path", async () => {
    const response = responseWithDetail({
      error: 'Out of VRAM while running the "OCR" stage with model "got_ocr2" on the GPU.',
      code: "INSUFFICIENT_VRAM",
      stage: "ocr",
      stage_label: "OCR",
      model_key: "got_ocr2",
      backend: "gpu",
      cpu_fallback_attempted: false,
      cpu_fallback_error: null,
      raw_detail: "cuda out of memory",
    });

    const notice = await readExecutionRuntimeNotice(response, "Recognize Text");

    expect(notice).not.toBeNull();
    expect(notice?.detail).not.toContain("Runtime log:");
  });
});
