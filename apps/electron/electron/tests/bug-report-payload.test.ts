import test from "node:test";
import assert from "node:assert/strict";

import {
  BUG_REPORT_LOG_ITEM_MAX_BYTES,
  BUG_REPORT_LOGS_MAX_ITEMS,
  BUG_REPORT_WIRE_BUDGET_BYTES,
  buildBugReportPayload,
  enforceBugReportWireBudget,
  serializeBugReportPayload,
  tailTruncateBugReportText,
  validateBugReportEndpointUrl,
  type BugReportPayloadInput,
} from "../modules/bug-report-payload.ts";

const makeClient = () => ({
  appVersion: "1.3.1",
  shell: "electron" as const,
  platform: "win32",
  arch: "x64",
  channel: "stable",
  sessionId: "0b9e6c1e-6f4e-4a5b-8c1d-2f3a4b5c6d7e",
});

const makeInput = (overrides: Partial<BugReportPayloadInput> = {}): BugReportPayloadInput => ({
  title: "Renderer crash on export",
  description: "Steps: open project, export, crash.",
  includeLogs: true,
  logs: [],
  diagnostics: { timestamp: "2026-11-21T00:00:00.000Z", appVersion: "1.3.1" },
  screenshot: "data:image/png;base64,AAAA",
  attachments: [],
  client: makeClient(),
  ...overrides,
});

test("validateBugReportEndpointUrl accepts the production endpoint host", () => {
  assert.equal(
    validateBugReportEndpointUrl("https://koma-studio.site/api/bug-reports"),
    "https://koma-studio.site/api/bug-reports",
  );
});

test("validateBugReportEndpointUrl accepts koma-studio.site subdomains", () => {
  assert.equal(
    validateBugReportEndpointUrl("https://api.koma-studio.site/api/bug-reports"),
    "https://api.koma-studio.site/api/bug-reports",
  );
  assert.equal(
    validateBugReportEndpointUrl("https://koma-studio.site:443/api/bug-reports"),
    "https://koma-studio.site/api/bug-reports",
  );
});

test("validateBugReportEndpointUrl rejects non-https schemes", () => {
  assert.equal(validateBugReportEndpointUrl("http://koma-studio.site/api/bug-reports"), null);
  assert.equal(validateBugReportEndpointUrl("file:///etc/passwd"), null);
});

test("validateBugReportEndpointUrl rejects foreign and lookalike hosts", () => {
  assert.equal(validateBugReportEndpointUrl("https://evil.com/api/bug-reports"), null);
  assert.equal(validateBugReportEndpointUrl("https://evil-koma-studio.site/api/bug-reports"), null);
  assert.equal(validateBugReportEndpointUrl("https://koma-studio.site.evil.com/api/bug-reports"), null);
});

test("validateBugReportEndpointUrl rejects non-string and empty input", () => {
  assert.equal(validateBugReportEndpointUrl(null), null);
  assert.equal(validateBugReportEndpointUrl(undefined), null);
  assert.equal(validateBugReportEndpointUrl(42), null);
  assert.equal(validateBugReportEndpointUrl(""), null);
  assert.equal(validateBugReportEndpointUrl("   "), null);
  assert.equal(validateBugReportEndpointUrl("not a url"), null);
});

test("tailTruncateBugReportText keeps the end of oversized content", () => {
  const content = "x".repeat(600_000) + "\nFATAL: detector warmup failed";
  const truncated = tailTruncateBugReportText(content, BUG_REPORT_LOG_ITEM_MAX_BYTES);

  assert.ok(Buffer.byteLength(truncated, "utf8") <= BUG_REPORT_LOG_ITEM_MAX_BYTES);
  assert.ok(truncated.endsWith("FATAL: detector warmup failed"));
  assert.equal(tailTruncateBugReportText("short", BUG_REPORT_LOG_ITEM_MAX_BYTES), "short");
  assert.equal(tailTruncateBugReportText("anything", 0), "");
});

test("tailTruncateBugReportText shaves lossy-expanded tails back under the cap", () => {
  const lossyTail = "\u0080".repeat(BUG_REPORT_LOG_ITEM_MAX_BYTES);
  const truncated = tailTruncateBugReportText(lossyTail, BUG_REPORT_LOG_ITEM_MAX_BYTES);

  assert.ok(truncated.length > 0, "tail must not be emptied by expansion shaving");
  assert.ok(
    Buffer.byteLength(truncated, "utf8") <= BUG_REPORT_LOG_ITEM_MAX_BYTES,
    `re-encoded tail exceeds the cap: ${Buffer.byteLength(truncated, "utf8")}`,
  );
});

test("buildBugReportPayload assembles the C1 payload shape", () => {
  const payload = buildBugReportPayload(
    makeInput({
      attachments: [{ name: "crash.png", mime: "image/png", data: "QUJD" }],
      logs: [{ name: "app/desktop-session.log", content: "line-1\nline-2" }],
    }),
  );

  assert.equal(payload.schema, 1);
  assert.equal(payload.title, "Renderer crash on export");
  assert.equal(payload.includeLogs, true);
  assert.deepEqual(payload.client, makeClient());
  assert.deepEqual(payload.diagnostics, { timestamp: "2026-11-21T00:00:00.000Z", appVersion: "1.3.1" });
  assert.equal(payload.screenshot, "data:image/png;base64,AAAA");
  assert.deepEqual(payload.logs, [{ name: "app/desktop-session.log", content: "line-1\nline-2" }]);
  assert.deepEqual(payload.attachments, [{ name: "crash.png", mime: "image/png", data: "QUJD" }]);
  assert.equal(payload.droppedAttachments, 0);
});

test("buildBugReportPayload omits logs when includeLogs is false", () => {
  const payload = buildBugReportPayload(
    makeInput({ includeLogs: false, logs: [{ name: "app/desktop-session.log", content: "line" }] }),
  );

  assert.equal("logs" in payload, false);
  assert.equal(payload.includeLogs, false);
});

test("buildBugReportPayload caps log names and skips empty log content", () => {
  const payload = buildBugReportPayload(
    makeInput({
      logs: [
        { name: "a".repeat(300), content: "" },
        { name: "b".repeat(300), content: "kept" },
      ],
    }),
  );

  assert.equal(payload.logs?.length, 1);
  assert.equal(payload.logs?.[0]?.name.length, 120);
  assert.equal(payload.logs?.[0]?.content, "kept");
});

test("buildBugReportPayload stops log selection at 24 items", () => {
  const logs = Array.from({ length: BUG_REPORT_LOGS_MAX_ITEMS + 5 }, (_, index) => ({
    name: `log-${index}.txt`,
    content: `content-${index}`,
  }));
  const payload = buildBugReportPayload(makeInput({ logs }));

  assert.equal(payload.logs?.length, BUG_REPORT_LOGS_MAX_ITEMS);
  assert.equal(payload.logs?.[0]?.name, "log-0.txt");
});

test("buildBugReportPayload stops log selection at the 3 MB total", () => {
  const bigLogContent = "z".repeat(600_000);
  const logs = Array.from({ length: 7 }, (_, index) => ({
    name: `log-${index}.txt`,
    content: bigLogContent,
  }));
  const payload = buildBugReportPayload(makeInput({ logs }));

  assert.equal(payload.logs?.length, 6);
  const totalBytes = (payload.logs ?? []).reduce(
    (sum, entry) => sum + Buffer.byteLength(entry.content, "utf8"),
    0,
  );
  assert.ok(totalBytes <= 3 * 1024 * 1024);
});

test("buildBugReportPayload tail-truncates each log to 512 KB", () => {
  const payload = buildBugReportPayload(
    makeInput({ logs: [{ name: "big.log", content: "y".repeat(600_000) + "\nEND-MARKER" }] }),
  );

  assert.equal(payload.logs?.length, 1);
  const content = payload.logs?.[0]?.content ?? "";
  assert.ok(Buffer.byteLength(content, "utf8") <= BUG_REPORT_LOG_ITEM_MAX_BYTES);
  assert.ok(content.endsWith("END-MARKER"));
});

test("enforceBugReportWireBudget keeps a within-budget payload untouched", () => {
  const payload = buildBugReportPayload(makeInput());
  const result = enforceBugReportWireBudget(payload, BUG_REPORT_WIRE_BUDGET_BYTES);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.payload, payload);
    assert.equal(result.payload.droppedAttachments, 0);
  }
});

test("enforceBugReportWireBudget drops attachments largest-first and keeps the screenshot", () => {
  const small = buildBugReportPayload(
    makeInput({
      attachments: [
        { name: "one.txt", mime: "text/plain", data: "a".repeat(1000) },
        { name: "two.txt", mime: "text/plain", data: "b".repeat(2000) },
      ],
    }),
  );
  const large = buildBugReportPayload(
    makeInput({
      attachments: [
        { name: "one.txt", mime: "text/plain", data: "a".repeat(1000) },
        { name: "two.txt", mime: "text/plain", data: "b".repeat(2000) },
        { name: "three.txt", mime: "text/plain", data: "c".repeat(3000) },
      ],
    }),
  );
  const budget = Buffer.byteLength(serializeBugReportPayload(small), "utf8");
  assert.ok(Buffer.byteLength(serializeBugReportPayload(large), "utf8") > budget);

  const result = enforceBugReportWireBudget(large, budget);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.droppedAttachments, 1);
    assert.deepEqual(
      result.payload.attachments.map((attachment) => attachment.name),
      ["one.txt", "two.txt"],
    );
    assert.equal(result.payload.screenshot, large.screenshot);
  }
});

test("enforceBugReportWireBudget truncates logs newest-first while attachments survive", () => {
  const payload = buildBugReportPayload(
    makeInput({
      logs: [{ name: "new.log", content: "NEW-START" + "m".repeat(600_000) + "\nNEW-END" }],
      attachments: [{ name: "note.txt", mime: "text/plain", data: "keep" }],
    }),
  );
  const budget = BUG_REPORT_LOG_ITEM_MAX_BYTES + 8_000;

  const result = enforceBugReportWireBudget(payload, budget);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.droppedAttachments, 0);
    assert.deepEqual(result.payload.attachments, [{ name: "note.txt", mime: "text/plain", data: "keep" }]);
    assert.ok((result.payload.logs ?? [])[0]?.content.endsWith("NEW-END"));
    assert.ok(
      Buffer.byteLength(serializeBugReportPayload(result.payload), "utf8") <= budget,
    );
  }
});

const makeLog = (marker: string) => `${marker}-line`;

test("enforceBugReportWireBudget drops logs oldest-first when shrinking is not enough", () => {
  const hugeDiagnostics = { blob: "D".repeat(1_200_000) };
  const withNewestOnly = buildBugReportPayload(
    makeInput({
      diagnostics: hugeDiagnostics,
      logs: [{ name: "newest.log", content: makeLog("NEWEST") }],
    }),
  );
  const payload = buildBugReportPayload(
    makeInput({
      diagnostics: hugeDiagnostics,
      logs: [
        { name: "newest.log", content: makeLog("NEWEST") },
        { name: "middle.log", content: makeLog("MIDDLE") },
        { name: "oldest.log", content: makeLog("OLDEST") },
      ],
    }),
  );
  const budget = Buffer.byteLength(serializeBugReportPayload(withNewestOnly), "utf8");

  const result = enforceBugReportWireBudget(payload, budget);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(
      result.payload.logs?.map((entry) => entry.name),
      ["newest.log"],
    );
    assert.equal(result.payload.droppedAttachments, 0);
  }
});

test("enforceBugReportWireBudget omits nothing for includeLogs=false payloads", () => {
  const payload = buildBugReportPayload(
    makeInput({
      includeLogs: false,
      attachments: [
        { name: "one.txt", mime: "text/plain", data: "a".repeat(1000) },
        { name: "two.txt", mime: "text/plain", data: "b".repeat(2000) },
        { name: "three.txt", mime: "text/plain", data: "c".repeat(3000) },
      ],
    }),
  );
  const budget = Buffer.byteLength(serializeBugReportPayload(payload), "utf8") - 1500;

  const result = enforceBugReportWireBudget(payload, budget);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal("logs" in result.payload, false);
    assert.equal(result.payload.droppedAttachments, 1);
  }
});

test("enforceBugReportWireBudget is deterministic for identical inputs", () => {
  const input = makeInput({
    logs: [{ name: "big.log", content: "d".repeat(2_000_000) + "\nTAIL-MARKER" }],
    attachments: [
      { name: "a.bin", mime: "image/png", data: "A".repeat(300_000) },
      { name: "b.bin", mime: "image/png", data: "B".repeat(500_000) },
    ],
  });
  const budget = 600_000;

  const first = enforceBugReportWireBudget(buildBugReportPayload(input), budget);
  const second = enforceBugReportWireBudget(buildBugReportPayload(input), budget);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(serializeBugReportPayload(first.payload), serializeBugReportPayload(second.payload));
    assert.equal(first.payload.droppedAttachments, 2);
    assert.equal(first.payload.screenshot, input.screenshot);
  }
});

test("enforceBugReportWireBudget reports failure when nothing more can be shed", () => {
  const payload = buildBugReportPayload(makeInput({ screenshot: "data:image/png;base64," + "s".repeat(100) }));
  const result = enforceBugReportWireBudget(payload, 64);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /too large/);
  }
});
