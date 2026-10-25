import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  MiniBackendRuntimeArtifactManifest,
  MiniBackendRuntimeArtifactRecord,
} from "../mini-backend-artifacts.ts";
import {
  buildRuntimePartDownloadPlan,
  downloadRuntimeParts,
  isRuntimeManifestForCurrentPlatform,
  type RuntimePartsEvent,
} from "../modules/mini-backend-runtime-parts.ts";

const sha512Base64 = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });

const makeTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "koma-parts-dl-"));

const buildRecord = (parts: { file: string; bytes: Buffer }[]): MiniBackendRuntimeArtifactRecord => ({
  profile: "nvidia-cuda",
  version: "1.2.0",
  platform: process.platform,
  arch: process.arch,
  entry: "mini-backend.exe",
  parts: parts.map((part) => ({
    file: part.file,
    url: `https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.0/${part.file}`,
    sha512: createHash("sha512").update(part.bytes).digest("base64"),
    size: part.bytes.byteLength,
  })),
});

interface FetchCall {
  url: string;
  rangeStart: number | null;
}

/**
 * Serves in-memory part payloads with Range/206 support, records every call
 * and can be scripted to interrupt specific responses mid-stream.
 */
const createFakeFetch = (parts: { file: string; bytes: Buffer }[]) => {
  const calls: FetchCall[] = [];
  const interruptions = new Map<string, number>();
  const fetchImpl = (async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const fileName = url.split("/").pop() ?? "";
    const payload = parts.find((part) => part.file === fileName);
    if (!payload) {
      return new Response("not found", { status: 404 });
    }
    const rangeHeader = init?.headers instanceof Headers
      ? init.headers.get("range")
      : undefined;
    const rangeMatch = rangeHeader?.match(/^bytes=(\d+)-$/);
    const rangeStart = rangeMatch ? Number(rangeMatch[1]) : null;
    calls.push({ url, rangeStart });

    const interruptAt = interruptions.get(fileName);
    if (interruptAt !== undefined) {
      interruptions.delete(fileName);
      const chunk = payload.bytes.subarray(0, interruptAt);
      // controller.error() discards whatever is still queued, so the chunk is
      // delivered first and the error lands on the next read (real servers
      // behave the same way: bytes arrive, then the connection dies).
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk);
          setTimeout(() => controller.error(new Error("network interrupted")), 5);
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-length": String(payload.bytes.byteLength) },
      });
    }

    if (rangeStart !== null) {
      const slice = payload.bytes.subarray(rangeStart);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          "content-length": String(slice.byteLength),
          "content-range": `bytes ${rangeStart}-${payload.bytes.byteLength - 1}/${payload.bytes.byteLength}`,
        },
      });
    }

    return new Response(new Uint8Array(payload.bytes), {
      status: 200,
      headers: { "content-length": String(payload.bytes.byteLength) },
    });
  }) as typeof fetch;

  return {
    calls,
    fetchImpl,
    interruptNext: (fileName: string, byteOffset: number) => {
      interruptions.set(fileName, byteOffset);
    },
  };
};

test("downloadRuntimeParts resumes an interrupted part via Range and keeps the verified-part ledger", async () => {
  const partA = { file: "runtime-a.part-1-of-2.zip", bytes: Buffer.alloc(1000, 7) };
  const partB = { file: "runtime-b.part-2-of-2.zip", bytes: Buffer.alloc(600, 9) };
  const record = buildRecord([partA, partB]);
  const tempDir = makeTempDir();
  const fake = createFakeFetch([partA, partB]);
  fake.interruptNext(partA.file, 400);
  const events: RuntimePartsEvent[] = [];

  await downloadRuntimeParts({
    record,
    tempDir,
    fetchImpl: fake.fetchImpl,
    sha512ForFile: sha512Base64,
    isRetryable: () => true,
    onEvent: (event) => events.push(event),
  });

  assert.deepEqual(
    fake.calls.map((call) => ({ url: call.url, rangeStart: call.rangeStart })),
    [
      { url: record.parts[0].url, rangeStart: null },
      { url: record.parts[0].url, rangeStart: 400 },
      { url: record.parts[1].url, rangeStart: null },
    ],
    "the interrupted part resumes from byte 400 via a 206 Range request",
  );
  for (const part of record.parts) {
    const onDisk = fs.readFileSync(path.join(tempDir, part.file));
    assert.equal(onDisk.byteLength, part.size);
  }
  const resumingStarts = events.filter(
    (event): event is Extract<RuntimePartsEvent, { type: "download-start" }> => event.type === "download-start",
  );
  assert.equal(resumingStarts[1]?.resuming, true);

  // Second run: every part is already on disk and verified, so no fetch at all.
  const secondFake = createFakeFetch([partA, partB]);
  await downloadRuntimeParts({
    record,
    tempDir,
    fetchImpl: secondFake.fetchImpl,
    sha512ForFile: sha512Base64,
    isRetryable: () => true,
  });
  assert.equal(secondFake.calls.length, 0, "verified parts are their own cross-restart ledger");
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("downloadRuntimeParts requests only the absolute manifest URLs (tag flips cannot redirect it)", async () => {
  const part = { file: "runtime-a.part-1-of-1.zip", bytes: Buffer.alloc(300, 3) };
  const record = buildRecord([part]);
  const tempDir = makeTempDir();
  const fake = createFakeFetch([part]);

  await downloadRuntimeParts({
    record,
    tempDir,
    fetchImpl: fake.fetchImpl,
    sha512ForFile: sha512Base64,
    isRetryable: () => true,
  });

  assert.deepEqual(fake.calls.map((call) => call.url), [record.parts[0].url]);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("downloadRuntimeParts keeps earlier parts on disk when a later part fails its sha512", async () => {
  const partA = { file: "runtime-a.part-1-of-2.zip", bytes: Buffer.alloc(500, 1) };
  const corruptB = Buffer.alloc(400, 2);
  const record = buildRecord([partA, { file: "runtime-b.part-2-of-2.zip", bytes: Buffer.alloc(400, 5) }]);
  const tempDir = makeTempDir();
  const fake = createFakeFetch([partA, { file: "runtime-b.part-2-of-2.zip", bytes: corruptB }]);

  await assert.rejects(
    downloadRuntimeParts({
      record,
      tempDir,
      fetchImpl: fake.fetchImpl,
      sha512ForFile: sha512Base64,
      isRetryable: () => true,
    }),
    /sha512 mismatch/,
  );

  const partAPath = path.join(tempDir, partA.file);
  assert.equal(fs.existsSync(partAPath), true, "the verified earlier part survives for resume");
  assert.equal(fs.statSync(partAPath).size, partA.bytes.byteLength);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("downloadRuntimeParts aggregates progress across parts", async () => {
  const partA = { file: "runtime-a.part-1-of-2.zip", bytes: Buffer.alloc(800, 4) };
  const partB = { file: "runtime-b.part-2-of-2.zip", bytes: Buffer.alloc(200, 6) };
  const record = buildRecord([partA, partB]);
  const tempDir = makeTempDir();
  const fake = createFakeFetch([partA, partB]);
  const progressEvents: RuntimePartsEvent[] = [];

  await downloadRuntimeParts({
    record,
    tempDir,
    fetchImpl: fake.fetchImpl,
    sha512ForFile: sha512Base64,
    isRetryable: () => true,
    onEvent: (event) => {
      if (event.type === "download-progress") {
        progressEvents.push(event);
      }
    },
  });

  const last = progressEvents[progressEvents.length - 1];
  assert.equal(last?.type, "download-progress");
  if (last?.type === "download-progress") {
    assert.equal(last.progress.totalBytes, 1000);
    assert.equal(last.progress.transferredBytes, 1000);
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("plan building and platform gate reject unsafe or foreign manifests before any request", () => {
  const manifest: MiniBackendRuntimeArtifactManifest = {
    schemaVersion: 2,
    version: "1.2.0",
    generatedAt: new Date().toISOString(),
    platform: "win32",
    arch: "x64",
    defaultProfile: "cpu",
    profiles: {},
  };
  assert.equal(
    isRuntimeManifestForCurrentPlatform(manifest, { platform: "linux", arch: "x64" }),
    false,
  );
  assert.equal(
    isRuntimeManifestForCurrentPlatform(manifest, { platform: "win32", arch: "arm64" }),
    false,
  );

  const record = buildRecord([{ file: "../escape.part-1-of-1.zip", bytes: Buffer.alloc(10) }]);
  assert.throws(
    () => buildRuntimePartDownloadPlan(record, makeTempDir()),
    /unsafe file name/,
  );
});
