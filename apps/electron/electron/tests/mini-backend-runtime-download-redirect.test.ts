import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";


import { downloadUrlToFileWithResume } from "../mini-backend-runtime-download.ts";

const payload = Buffer.alloc(512 * 1024, 11);

interface CdnRequestRecord {
  rangeHeader: string | null;
  status: number;
}

const startServer = (): Promise<{
  server: http.Server;
  baseUrl: string;
  cdnRequests: CdnRequestRecord[];
}> =>
  new Promise((resolve) => {
    const cdnRequests: CdnRequestRecord[] = [];
    const server = http.createServer((request, response) => {
      const url = request.url ?? "";
      if (url.startsWith("/redirector/")) {
        response.writeHead(302, { location: `/cdn${url}` });
        response.end();
        return;
      }
      if (url.startsWith("/cdn/redirector/")) {
        const rangeHeader = request.headers.range ?? null;
        cdnRequests.push({ rangeHeader, status: 0 });
        const match = rangeHeader?.match(/^bytes=(\d+)-$/);
        if (match) {
          const start = Number(match[1]);
          const slice = payload.subarray(start);
          response.writeHead(206, {
            "content-length": String(slice.byteLength),
            "content-range": `bytes ${start}-${payload.byteLength - 1}/${payload.byteLength}`,
          });
          response.end(slice);
          return;
        }
        response.writeHead(200, { "content-length": String(payload.byteLength) });
        response.end(payload);
        return;
      }
      response.writeHead(404);
      response.end();
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("server did not bind a TCP port");
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}`, cdnRequests });
    });
  });

test("downloadUrlToFileWithResume follows 302 redirects and preserves the Range header", async () => {
  const { server, baseUrl, cdnRequests } = await startServer();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-redirect-"));
  const outputPath = path.join(tempDir, "part.zip");
  const expectedSha = createHash("sha512").update(payload).digest("base64");

  try {
    // Full download through the redirect hop.
    await downloadUrlToFileWithResume(`${baseUrl}/redirector/part.zip`, outputPath, {
      expectedTotalBytes: payload.byteLength,
    });
    assert.equal(fs.statSync(outputPath).size, payload.byteLength);
    assert.equal(cdnRequests.length, 1);
    assert.equal(cdnRequests[0]?.rangeHeader, null, "first request carries no Range");

    // Resume: existing bytes on disk must turn into a Range request that
    // survives the 302 hop (this is the GitHub CDN redirect shape).
    fs.rmSync(outputPath, { force: true });
    const resumeOffset = 300 * 1024;
    fs.writeFileSync(outputPath, payload.subarray(0, resumeOffset));
    const progress = await downloadUrlToFileWithResume(`${baseUrl}/redirector/part.zip`, outputPath, {
      expectedTotalBytes: payload.byteLength,
    });

    assert.equal(cdnRequests.length, 2);
    assert.equal(
      cdnRequests[1]?.rangeHeader,
      `bytes=${resumeOffset}-`,
      "undici must forward the Range header across the 302 redirect",
    );
    assert.equal(fs.statSync(outputPath).size, payload.byteLength);
    assert.equal(progress.transferredBytes, payload.byteLength);

    const actualSha = createHash("sha512")
      .update(fs.readFileSync(outputPath))
      .digest("base64");
    assert.equal(actualSha, expectedSha);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    server.close();
  }
});
