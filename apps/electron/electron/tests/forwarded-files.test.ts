import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  extractForwardedFilePaths,
  extractPendingForwardedFilePaths,
  forwardFilesToRenderer,
  FORWARDED_FILES_EVENT_CHANNEL,
  isForwardedFilePathStaged,
  recordForwardedFilePaths,
  registerOpenFileForwarding,
} from "../modules/forwarded-files.ts";

const makeTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "koma-forwarded-files-"));

test("FORWARDED_FILES_EVENT_CHANNEL matches the frozen shell contract", () => {
  assert.equal(FORWARDED_FILES_EVENT_CHANNEL, "desktop:files:forwarded");
});

test("extractForwardedFilePaths keeps allowlisted absolute existing files", () => {
  const dirPath = makeTempDir();
  try {
    const cbzPath = path.join(dirPath, "chapter.cbz");
    fs.writeFileSync(cbzPath, "archive");
    const pdfPath = path.join(dirPath, "document.PDF");
    fs.writeFileSync(pdfPath, "pdf");
    const zipPath = path.join(dirPath, "batch.zip");
    fs.writeFileSync(zipPath, "zip");

    assert.deepEqual(extractForwardedFilePaths([cbzPath, pdfPath, zipPath]), [
      path.resolve(cbzPath),
      path.resolve(pdfPath),
      path.resolve(zipPath),
    ]);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});

test("extractForwardedFilePaths rejects non-allowlisted, relative, and missing files", () => {
  const dirPath = makeTempDir();
  try {
    const txtPath = path.join(dirPath, "notes.txt");
    fs.writeFileSync(txtPath, "text");
    const missingCbz = path.join(dirPath, "missing.cbz");
    const exeLikeFlag = "--profile=runtime.cbz";

    assert.deepEqual(
      extractForwardedFilePaths([txtPath, missingCbz, "chapter.cbz", exeLikeFlag]),
      [],
    );
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});

test("extractForwardedFilePaths ignores directories with allowlisted extensions and dedupes", () => {
  const dirPath = makeTempDir();
  try {
    const archiveDir = path.join(dirPath, "bundle.cbz");
    fs.mkdirSync(archiveDir);
    const cbzPath = path.join(dirPath, "chapter.cbz");
    fs.writeFileSync(cbzPath, "archive");

    assert.deepEqual(extractForwardedFilePaths([archiveDir, cbzPath, cbzPath]), [
      path.resolve(cbzPath),
    ]);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});

test("extractForwardedFilePaths returns an empty list for empty argv", () => {
  assert.deepEqual(extractForwardedFilePaths([]), []);
});

test("staged set serves exactly the recorded forwarded paths", () => {
  const dirPath = makeTempDir();
  try {
    const cbzPath = path.join(dirPath, "chapter.cbz");
    fs.writeFileSync(cbzPath, "archive");
    const [forwardedPath] = extractForwardedFilePaths([cbzPath]);
    assert.ok(forwardedPath);

    recordForwardedFilePaths([forwardedPath]);

    assert.equal(isForwardedFilePathStaged(forwardedPath), true);
    assert.equal(isForwardedFilePathStaged(path.join(dirPath, "other.cbz")), false);
    assert.equal(isForwardedFilePathStaged(dirPath), false);
    assert.equal(isForwardedFilePathStaged(""), false);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});

test("staged-set matching rejects traversal and sibling variants of a staged path", () => {
  recordForwardedFilePaths(["C:/comics/a.cbz"]);

  assert.equal(isForwardedFilePathStaged("  C:/comics/a.cbz  "), true);
  assert.equal(isForwardedFilePathStaged("C:/comics/b.cbz"), false);
  assert.equal(isForwardedFilePathStaged("C:/comics/a.cbz/../b.cbz"), false);
});

test("extractPendingForwardedFilePaths returns null when argv has nothing forwardable", () => {
  assert.equal(extractPendingForwardedFilePaths([]), null);
  assert.equal(extractPendingForwardedFilePaths(["--flag", "value"]), null);
});

test("forwardFilesToRenderer records and delivers to a live window only", () => {
  const sent: Array<{ channel: string; payload: unknown }> = [];
  const liveWindow = {
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, payload: unknown) => {
        sent.push({ channel, payload });
      },
    },
  };
  const destroyedWindow = { isDestroyed: () => true, webContents: { send: () => undefined } };

  forwardFilesToRenderer(destroyedWindow, ["C:/comics/gone.cbz"]);
  forwardFilesToRenderer(null, ["C:/comics/never.cbz"]);
  assert.equal(sent.length, 0);

  forwardFilesToRenderer(liveWindow, ["C:/comics/live.cbz"]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.channel, FORWARDED_FILES_EVENT_CHANNEL);
  assert.deepEqual(sent[0]?.payload, { paths: ["C:/comics/live.cbz"] });
  assert.equal(isForwardedFilePathStaged("C:/comics/live.cbz"), true);
});

test("registerOpenFileForwarding buffers before ready and forwards live opens", () => {
  const dirPath = makeTempDir();
  const sent: string[][] = [];
  const pending: string[] = [];
  const openFileHandlers: Array<(event: { preventDefault(): void }, filePath: string) => void> = [];
  const fakeApp = {
    on: (
      event: "open-file",
      handler: (event: { preventDefault(): void }, filePath: string) => void,
    ) => {
      if (event === "open-file") openFileHandlers.push(handler);
      return undefined;
    },
  };

  try {
    const cbzPath = path.join(dirPath, "chapter.cbz");
    fs.writeFileSync(cbzPath, "archive");
    const resolved = path.resolve(cbzPath);

    registerOpenFileForwarding(fakeApp, {
      getMainWindow: () => null,
      appendPendingForwardedPaths: (paths) => {
        pending.push(...paths);
      },
    });

    const handler = openFileHandlers[0];
    assert.ok(handler);
    handler({ preventDefault: () => undefined }, cbzPath);
    handler({ preventDefault: () => undefined }, "notes.txt");
    assert.deepEqual(pending, [resolved]);

    registerOpenFileForwarding(fakeApp, {
      getMainWindow: () => ({
        isDestroyed: () => false,
        webContents: {
          send: (channel: string, payload: unknown) => {
            assert.equal(channel, FORWARDED_FILES_EVENT_CHANNEL);
            sent.push((payload as { paths: string[] }).paths);
          },
        },
      }),
      appendPendingForwardedPaths: () => undefined,
    });
    const liveHandler = openFileHandlers[1];
    assert.ok(liveHandler);
    liveHandler({ preventDefault: () => undefined }, cbzPath);
    assert.deepEqual(sent, [[resolved]]);
  } finally {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});
