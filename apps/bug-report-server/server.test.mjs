import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  createBugReportServer,
  runRetentionSweep,
  selectDiscordFiles,
} from "./server.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WIRE_CAP_BYTES = 25 * 1024 * 1024;

function validReport() {
  return {
    schema: 1,
    title: "Renderer crash while exporting",
    description: "Steps to reproduce are included in the diagnostics blob.",
    includeLogs: true,
    client: {
      appVersion: "1.2.3",
      shell: "electron",
      platform: "win32",
      arch: "x64",
      channel: "stable",
      sessionId: "0f8e2b1c-93aa-4c1e-9d7e-5a2b6c8d1e4f",
    },
    diagnostics: { recentEvents: ["app.start", "export.click"] },
    screenshot: null,
    logs: [{ name: "session.log", content: "log line" }],
    attachments: [],
    droppedAttachments: 0,
  };
}

function minimalReport() {
  return {
    schema: 1,
    title: "minimal report",
    description: "",
    includeLogs: false,
    client: {
      appVersion: "1.0.0",
      shell: "tauri",
      platform: "linux",
      arch: "x64",
      channel: "stable",
      sessionId: "session-1",
    },
  };
}

function without(object, key) {
  const copy = { ...object };
  delete copy[key];
  return copy;
}

async function withServer(t, overrides = {}) {
  const reportsDir = overrides.reportsDir ?? (await fs.mkdtemp(path.join(os.tmpdir(), "koma-bug-reports-")));
  const server = createBugReportServer({
    port: 0,
    host: "127.0.0.1",
    reportsDir,
    retentionDays: 180,
    rateLimitPerHour: 5,
    notifyWebhookUrl: null,
    ...overrides,
  });
  await server.ready;
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(reportsDir, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, reportsDir };
}

async function postJson(base, body, headers = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return fetch(`${base}/api/bug-reports`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: raw,
  });
}

function rawRequest(port, { method, requestPath, headers, body }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = http.request({ host: "127.0.0.1", port, method, path: requestPath, headers }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        settled = true;
        resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8") });
      });
    });
    request.on("error", (error) => {
      if (!settled) reject(error);
    });
    if (body !== undefined) request.write(body);
    request.end();
  });
}

async function waitFor(predicate, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("condition not met before timeout");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

test("accepts a valid report and stores it as <yyyy-mm>/<uuid>.json", async (t) => {
  const { base, reportsDir } = await withServer(t);
  const response = await postJson(base, validReport());
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("content-type"), "application/json");
  const payload = await response.json();
  assert.match(payload.id, UUID_PATTERN);
  assert.ok(!Number.isNaN(Date.parse(payload.received)));
  const storedPath = path.join(reportsDir, payload.received.slice(0, 7), `${payload.id}.json`);
  const stored = JSON.parse(await fs.readFile(storedPath, "utf8"));
  assert.equal(stored.id, payload.id);
  assert.equal(stored.report.title, "Renderer crash while exporting");
  assert.deepEqual(stored.report.client, validReport().client);
});

test("ignores unknown fields and accepts omitted optional fields", async (t) => {
  const { base, reportsDir } = await withServer(t);
  const payload = {
    ...minimalReport(),
    client: { ...minimalReport().client, renderBackend: "vulkan" },
    traceId: "trace-42",
  };
  const response = await postJson(base, payload);
  assert.equal(response.status, 201);
  const { id, received } = await response.json();
  const stored = JSON.parse(await fs.readFile(path.join(reportsDir, received.slice(0, 7), `${id}.json`), "utf8"));
  assert.equal(stored.report.traceId, "trace-42");
  assert.equal(stored.report.client.renderBackend, "vulkan");
});

const seconds = (ms) => ms / 1000;

const REJECT_CASES = [
  ["missing schema", (report) => without(report, "schema"), "schema"],
  ["wrong schema version", (report) => ({ ...report, schema: 2 }), "schema"],
  ["non-integer schema", (report) => ({ ...report, schema: "1" }), "schema"],
  ["missing title", (report) => without(report, "title"), "title"],
  ["short title", (report) => ({ ...report, title: "ab" }), "title"],
  ["overlong title", (report) => ({ ...report, title: "x".repeat(181) }), "title"],
  ["non-string title", (report) => ({ ...report, title: 42 }), "title"],
  ["missing description", (report) => without(report, "description"), "description"],
  ["overlong description", (report) => ({ ...report, description: "x".repeat(3501) }), "description"],
  ["non-boolean includeLogs", (report) => ({ ...report, includeLogs: "yes" }), "includeLogs"],
  ["non-object client", (report) => ({ ...report, client: null }), "client"],
  ["invalid client.shell", (report) => ({ ...report, client: { ...report.client, shell: "web" } }), "client.shell"],
  ["missing client.sessionId", (report) => ({ ...report, client: without(report.client, "sessionId") }), "client.sessionId"],
  ["overlong client.appVersion", (report) => ({ ...report, client: { ...report.client, appVersion: "x".repeat(65) } }), "client.appVersion"],
  ["overlong client.arch", (report) => ({ ...report, client: { ...report.client, arch: "x".repeat(33) } }), "client.arch"],
  ["non-object diagnostics", (report) => ({ ...report, diagnostics: [] }), "diagnostics"],
  ["oversized diagnostics", (report) => ({ ...report, diagnostics: { blob: "x".repeat(70000) } }), "diagnostics"],
  ["wrong screenshot data uri", (report) => ({ ...report, screenshot: "data:text/plain;base64,AAAA" }), "screenshot"],
  ["invalid screenshot base64", (report) => ({ ...report, screenshot: "data:image/png;base64,not base64!!" }), "screenshot"],
  ["oversized screenshot", (report) => ({ ...report, screenshot: `data:image/png;base64,${"A".repeat(8_400_000)}` }), "screenshot"],
  ["non-array logs", (report) => ({ ...report, logs: {} }), "logs"],
  ["too many log items", (report) => ({ ...report, logs: Array.from({ length: 25 }, () => ({ name: "a.log", content: "line" })) }), "logs"],
  ["overlong log name", (report) => ({ ...report, logs: [{ name: "x".repeat(121), content: "line" }] }), "logs[0].name"],
  ["oversized log item", (report) => ({ ...report, logs: [{ name: "a.log", content: "x".repeat(513 * 1024) }] }), "logs[0].content"],
  ["oversized log total", (report) => ({ ...report, logs: Array.from({ length: 7 }, (_, index) => ({ name: `f${index}.log`, content: "x".repeat(450 * 1024) })) }), "logs"],
  ["non-array attachments", (report) => ({ ...report, attachments: {} }), "attachments"],
  ["too many attachments", (report) => ({ ...report, attachments: Array.from({ length: 5 }, () => ({ name: "shot.png", mime: "image/png", data: "AAAA" })) }), "attachments"],
  ["overlong attachment name", (report) => ({ ...report, attachments: [{ name: "x".repeat(201), mime: "image/png", data: "AAAA" }] }), "attachments[0].name"],
  ["invalid attachment mime", (report) => ({ ...report, attachments: [{ name: "notes.pdf", mime: "application/pdf", data: "AAAA" }] }), "attachments[0].mime"],
  ["invalid attachment data", (report) => ({ ...report, attachments: [{ name: "shot.png", mime: "image/png", data: "not base64!!" }] }), "attachments[0].data"],
  ["oversized attachment data", (report) => ({ ...report, attachments: [{ name: "shot.png", mime: "image/png", data: "A".repeat(7_000_000) }] }), "attachments[0].data"],
  ["non-integer droppedAttachments", (report) => ({ ...report, droppedAttachments: 1.5 }), "droppedAttachments"],
  ["negative droppedAttachments", (report) => ({ ...report, droppedAttachments: -1 }), "droppedAttachments"],
  ["non-string screenshot", (report) => ({ ...report, screenshot: 123 }), "screenshot"],
];

for (const [label, mutate, field] of REJECT_CASES) {
  test(`rejects ${label} with 400 naming ${field}`, async (t) => {
    const { base } = await withServer(t);
    const response = await postJson(base, mutate(validReport()));
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.field, field);
    assert.equal(typeof payload.error, "string");
  });
}

test("rejects non-object and invalid JSON bodies with field=body", async (t) => {
  const { base } = await withServer(t);
  const arrayResponse = await postJson(base, [1, 2, 3]);
  assert.equal(arrayResponse.status, 400);
  assert.equal((await arrayResponse.json()).field, "body");
  const malformedResponse = await postJson(base, "{not json");
  assert.equal(malformedResponse.status, 400);
  assert.equal((await malformedResponse.json()).field, "body");
});

test("rejects bodies over the 25 MB wire cap with 413 before reading", async (t) => {
  const { base } = await withServer(t);
  const oversizedBody = Buffer.alloc(WIRE_CAP_BYTES + 1, 0x7b);
  const response = await rawRequest(new URL(base).port, {
    method: "POST",
    requestPath: "/api/bug-reports",
    headers: { "content-type": "application/json", "content-length": String(oversizedBody.length) },
    body: oversizedBody,
  });
  assert.equal(response.status, 413);
  assert.equal(JSON.parse(response.body).error, "payload too large");
});

test("accepts chunked bodies without Content-Length", async (t) => {
  const { base } = await withServer(t);
  const response = await rawRequest(new URL(base).port, {
    method: "POST",
    requestPath: "/api/bug-reports",
    headers: { "content-type": "application/json" },
    body: Buffer.from(JSON.stringify(validReport()), "utf8"),
  });
  assert.equal(response.status, 201);
});

test("rate limits the sixth report per client IP with 429", async (t) => {
  const { base } = await withServer(t);
  const firstIpHeaders = { "x-forwarded-for": "203.0.113.10" };
  for (let index = 0; index < 5; index += 1) {
    const response = await postJson(base, minimalReport(), firstIpHeaders);
    assert.equal(response.status, 201);
  }
  const limited = await postJson(base, minimalReport(), firstIpHeaders);
  assert.equal(limited.status, 429);
  assert.equal(typeof (await limited.json()).error, "string");
  const otherIp = await postJson(base, minimalReport(), { "x-forwarded-for": "203.0.113.11" });
  assert.equal(otherIp.status, 201);
});

test("retention sweep removes expired files, keeps fresh files, prunes emptied month directories", async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), "koma-bug-reports-retention-"));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const now = Date.now();
  const expiredSeconds = (now - 200 * 24 * 60 * 60 * 1000) / 1000;
  const expiredDirectory = path.join(reportsDir, "2020-01");
  const expiredFile = path.join(expiredDirectory, "00000000-0000-4000-8000-000000000000.json");
  await fs.mkdir(expiredDirectory, { recursive: true });
  await fs.writeFile(expiredFile, "{}");
  await fs.utimes(expiredFile, expiredSeconds, expiredSeconds);
  const survivingDirectory = path.join(reportsDir, "2020-02");
  const survivingFile = path.join(survivingDirectory, "fresh.json");
  await fs.mkdir(survivingDirectory, { recursive: true });
  await fs.writeFile(survivingFile, "{}");
  await fs.utimes(survivingFile, now / 1000, now / 1000);
  const result = await runRetentionSweep(reportsDir, 180, now);
  assert.deepEqual(result, { deletedFiles: 1, deletedDirectories: 1 });
  await assert.rejects(() => fs.access(expiredFile), /ENOENT/);
  await assert.rejects(() => fs.access(expiredDirectory), /ENOENT/);
  await assert.doesNotReject(() => fs.access(survivingFile));
});

test("retention sweep enforces the total bytes budget oldest-first", async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), "koma-bug-reports-budget-"));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const now = Date.now();
  const makeFile = async (name, bytes, mtimeMs) => {
    const filePath = path.join(reportsDir, "2026-11", name);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.alloc(bytes, 0x61));
    await fs.utimes(filePath, seconds(mtimeMs), seconds(mtimeMs));
    return filePath;
  };
  const oldest = await makeFile("oldest.json", 100, now - 3 * 24 * 60 * 60 * 1000);
  const middle = await makeFile("middle.json", 100, now - 2 * 24 * 60 * 60 * 1000);
  const newest = await makeFile("newest.json", 100, now - 1 * 24 * 60 * 60 * 1000);

  const withinBudget = await runRetentionSweep(reportsDir, 180, now, 400);
  assert.deepEqual(withinBudget, { deletedFiles: 0, deletedDirectories: 0 });

  const overBudget = await runRetentionSweep(reportsDir, 180, now, 250);
  assert.deepEqual(overBudget, { deletedFiles: 1, deletedDirectories: 0 });
  await assert.rejects(() => fs.access(oldest), /ENOENT/);
  await assert.doesNotReject(() => fs.access(middle));
  await assert.doesNotReject(() => fs.access(newest));
});

test("startup sweep removes reports that expired before server start", async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), "koma-bug-reports-startup-"));
  const expiredSeconds = (Date.now() - 200 * 24 * 60 * 60 * 1000) / 1000;
  const expiredDirectory = path.join(reportsDir, "2019-06");
  const expiredFile = path.join(expiredDirectory, "00000000-0000-4000-8000-000000000001.json");
  await fs.mkdir(expiredDirectory, { recursive: true });
  await fs.writeFile(expiredFile, "{}");
  await fs.utimes(expiredFile, expiredSeconds, expiredSeconds);
  await withServer(t, { reportsDir });
  await assert.rejects(() => fs.access(expiredFile), /ENOENT/);
  await assert.rejects(() => fs.access(expiredDirectory), /ENOENT/);
});

test("discord notify failure does not fail the 201", async (t) => {
  const { base } = await withServer(t, { notifyWebhookUrl: "http://127.0.0.1:1/hook" });
  const response = await postJson(base, validReport());
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.match(payload.id, UUID_PATTERN);
});

test("discord notify posts multipart files to a reachable webhook", async (t) => {
  const deliveries = [];
  const webhook = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      deliveries.push({
        contentType: request.headers["content-type"],
        body: Buffer.concat(chunks).toString("utf8"),
      });
      response.writeHead(204);
      response.end();
    });
  });
  await new Promise((resolve) => webhook.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    webhook.closeAllConnections();
    return new Promise((resolve) => webhook.close(resolve));
  });
  const webhookUrl = `http://127.0.0.1:${webhook.address().port}/hook`;
  const report = validReport();
  report.screenshot = "data:image/png;base64,aGVsbG8=";
  const { base } = await withServer(t, { notifyWebhookUrl: webhookUrl });
  const response = await postJson(base, report);
  assert.equal(response.status, 201);
  const { id } = await response.json();
  await waitFor(() => deliveries.length > 0, 2000, 25);
  assert.equal(deliveries.length, 1, "multipart delivery only");
  const boundary = /boundary=([^;]+)/.exec(deliveries[0].contentType)[1];
  assert.ok(deliveries[0].body.includes(`name="files[0]"; filename="screenshot.png"`));
  assert.ok(deliveries[0].body.includes(`name="files[1]"; filename="session.log"`));
  assert.ok(deliveries[0].body.includes("log line"));
  const payloadCrlf = String.fromCharCode(13, 10);
  const payloadMarker =
    'name="payload_json"' + payloadCrlf + 'Content-Type: application/json' + payloadCrlf + payloadCrlf;
  const payloadStart =
    deliveries[0].body.indexOf(payloadMarker) + payloadMarker.length;
  const payloadEnd = deliveries[0].body.indexOf(payloadCrlf + '--', payloadStart);
  const payloadJson = deliveries[0].body.slice(payloadStart, payloadEnd);
  const delivery = JSON.parse(payloadJson);
  assert.ok(delivery.content.includes(id));
  assert.equal(delivery.embeds[0].title, "Renderer crash while exporting");
  assert.deepEqual(
    delivery.attachments.map((a) => a.filename),
    ["screenshot.png", "session.log"],
  );
});

test("discord notify falls back to the plain embed when multipart is rejected", async (t) => {
  const deliveries = [];
  const webhook = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const contentType = request.headers["content-type"] ?? "";
      deliveries.push({
        multipart: contentType.startsWith("multipart/form-data"),
        body: Buffer.concat(chunks).toString("utf8"),
      });
      response.writeHead(contentType.startsWith("multipart/form-data") ? 413 : 204);
      response.end();
    });
  });
  await new Promise((resolve) => webhook.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    webhook.closeAllConnections();
    return new Promise((resolve) => webhook.close(resolve));
  });
  const webhookUrl = `http://127.0.0.1:${webhook.address().port}/hook`;
  const { base } = await withServer(t, { notifyWebhookUrl: webhookUrl });
  const response = await postJson(base, validReport());
  assert.equal(response.status, 201);
  await waitFor(() => deliveries.length >= 2, 2000, 25);
  assert.equal(deliveries[0].multipart, true);
  assert.equal(deliveries[1].multipart, false);
  const delivery = JSON.parse(deliveries[1].body);
  assert.equal(delivery.embeds[0].title, "Renderer crash while exporting");
});

test("selectDiscordFiles sanitizes names, enforces count and byte budget", () => {
  const hugeBase64 = Buffer.alloc(8 * 1024 * 1024, 0x41).toString("base64");
  const result = selectDiscordFiles({
    screenshot: "data:image/png;base64,aGVsbG8=",
    attachments: [
      { name: "../../evil.sh", mime: "text/plain", data: Buffer.from("tiny").toString("base64") },
      { name: "huge.bin", mime: "image/png", data: hugeBase64 },
    ],
    logs: Array.from({ length: 12 }, (_unused, index) => ({
      name: `log-${index}.log`,
      content: `line ${index}`,
    })),
  });
  assert.equal(result.selected.length, 9);
  assert.equal(result.selected[0].filename, "screenshot.png");
  assert.equal(result.selected[1].filename, "evil.sh");
  assert.ok(!result.selected.some((file) => file.filename === "huge.bin"));
  assert.ok(result.selected.every((file) => !file.filename.includes("/")));
  assert.ok(result.selected.every((file) => !file.filename.includes("/")));
  assert.equal(result.omittedCount, 6);
});

test("health endpoints return ok on both paths", async (t) => {
  const { base } = await withServer(t);
  for (const healthPath of ["/healthz", "/api/bug-reports/healthz"]) {
    const response = await fetch(`${base}${healthPath}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  }
});

test("non-POST on the report endpoint is 405 and unknown paths are 404", async (t) => {
  const { base } = await withServer(t);
  const getResponse = await fetch(`${base}/api/bug-reports`);
  assert.equal(getResponse.status, 405);
  assert.equal(getResponse.headers.get("allow"), "POST");
  const postHealth = await fetch(`${base}/healthz`, { method: "POST" });
  assert.equal(postHealth.status, 405);
  const notFound = await fetch(`${base}/api/unknown`);
  assert.equal(notFound.status, 404);
});
