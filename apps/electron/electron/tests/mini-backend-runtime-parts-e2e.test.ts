import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import type { MiniBackendRuntimeArtifactRecord } from "../mini-backend-artifacts.ts";
import {
  downloadRuntimeParts,
  extractZipStreamToDir,
} from "../modules/mini-backend-runtime-parts.ts";

const sha512Base64 = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });

const resolvePythonCommand = (): string[] => {
  const candidates = process.platform === "win32"
    ? [["py", "-3.12"], ["python"]]
    : [["python3"], ["python"]];
  for (const [command, ...args] of candidates) {
    const probe = spawnSync(command, [...args, "--version"], { encoding: "utf-8" });
    if (probe.status === 0) {
      return [command, ...args];
    }
  }
  return [];
};

const pythonCommand = resolvePythonCommand();

/**
 * Full local pipeline against real zips: partition a tree with the python
 * producer, serve the parts over local HTTP, download them with the real
 * downloader and extract them with the portable streaming extractor.
 */
test(
  "multi-part runtime downloads and extracts end to end from a local server",
  { skip: pythonCommand.length > 0 ? false : "python interpreter not available" },
  async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "koma-parts-e2e-"));
    const sourceDir = path.join(workDir, "dist");
    const partsDir = path.join(workDir, "parts");
    const downloadDir = path.join(workDir, "downloaded");
    const extractDir = path.join(workDir, "extracted");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(partsDir, { recursive: true });
    fs.mkdirSync(downloadDir, { recursive: true });

    const entryName = process.platform === "win32" ? "mini-backend.exe" : "mini-backend";
    const files: { relative: string; content: Buffer }[] = [
      { relative: entryName, content: Buffer.from("#!/bin/sh\necho koma\n".repeat(200)) },
      { relative: "_internal/torch/libary.dll", content: randomBytes(600 * 1024) },
      { relative: "_internal/nvidia/cudnn64_9.dll", content: randomBytes(700 * 1024) },
      { relative: "_internal/nvidia/cublas64_12.dll", content: randomBytes(800 * 1024) },
      { relative: "_internal/transformers/tokenizer.json", content: randomBytes(50 * 1024) },
    ];
    for (const file of files) {
      const target = path.join(sourceDir, file.relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content);
    }

    const [python, ...pythonArgs] = pythonCommand;
    const zipBase = path.join(partsDir, "mini-backend-runtime-cpu-1.2.0-test");
    const partition = spawnSync(
      python,
      [
        ...pythonArgs,
        path.join(import.meta.dirname, "..", "..", "scripts", "zip-runtime-parts.py"),
        "--source-dir",
        sourceDir,
        "--output-base",
        zipBase,
        // Small budget forces several parts out of the ~2.6MB tree.
        "--budget-bytes",
        String(1024 * 1024 + 64 * 1024),
      ],
      { encoding: "utf-8" },
    );
    assert.equal(partition.status, 0, `partitioner failed: ${partition.stderr}`);
    const plan = JSON.parse(fs.readFileSync(`${zipBase}.partition-plan.json`, "utf-8"));
    assert.ok(plan.parts.length >= 2, "the small budget must produce multiple parts");

    const server = http.createServer((request, response) => {
      const fileName = (request.url ?? "").replace(/^\//, "");
      const partPath = path.join(partsDir, fileName);
      if (!fs.existsSync(partPath)) {
        response.writeHead(404);
        response.end();
        return;
      }
      const bytes = fs.readFileSync(partPath);
      const rangeMatch = (request.headers.range ?? "").match(/^bytes=(\d+)-$/);
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const slice = bytes.subarray(start);
        response.writeHead(206, {
          "content-length": String(slice.byteLength),
          "content-range": `bytes ${start}-${bytes.byteLength - 1}/${bytes.byteLength}`,
        });
        response.end(slice);
        return;
      }
      response.writeHead(200, { "content-length": String(bytes.byteLength) });
      response.end(bytes);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("server did not bind a TCP port");
    }
    const baseHttpUrl = `http://127.0.0.1:${address.port}`;

    try {
      const recordParts: MiniBackendRuntimeArtifactRecord["parts"] = [];
      for (const part of plan.parts as { file: string; sizeBytes: number }[]) {
        recordParts.push({
          file: part.file,
          url: `${baseHttpUrl}/${part.file}`,
          sha512: await sha512Base64(path.join(partsDir, part.file)),
          size: part.sizeBytes,
        });
      }
      const record: MiniBackendRuntimeArtifactRecord = {
        profile: "cpu",
        version: "1.2.0",
        platform: process.platform,
        arch: process.arch,
        entry: entryName,
        parts: recordParts,
      };

      await downloadRuntimeParts({
        record,
        tempDir: downloadDir,
        sha512ForFile: sha512Base64,
        isRetryable: () => true,
      });

      // One clean slate, then every part extracts into the same tree.
      for (const part of record.parts) {
        await extractZipStreamToDir(path.join(downloadDir, part.file), extractDir);
      }

      for (const file of files) {
        const extractedPath = path.join(extractDir, file.relative);
        assert.equal(
          fs.existsSync(extractedPath),
          true,
          `extracted tree is missing ${file.relative} (union-completeness violation)`,
        );
        assert.deepEqual(fs.readFileSync(extractedPath), file.content);
      }

      // A tampered manifest hash must fail the part verification.
      const tamperedRecord = {
        ...record,
        parts: record.parts.map((part, index) =>
          index === 0 ? { ...part, sha512: "AAAA".repeat(22) } : part,
        ),
      } as MiniBackendRuntimeArtifactRecord;
      await assert.rejects(
        downloadRuntimeParts({
          record: tamperedRecord,
          tempDir: downloadDir,
          sha512ForFile: sha512Base64,
          isRetryable: () => true,
        }),
        /sha512 mismatch/,
      );
    } finally {
      server.close();
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  },
);
