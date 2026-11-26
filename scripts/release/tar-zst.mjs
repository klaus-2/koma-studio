import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";

const BLOCK_SIZE = 512;
const ZERO_BLOCK = Buffer.alloc(BLOCK_SIZE);

const writeOctal = (buf, offset, length, value) => {
  const str = Math.max(0, value).toString(8).padStart(length - 1, "0");
  buf.write(str.slice(-(length - 1)), offset, length - 1, "ascii");
  buf[offset + length - 1] = 0;
};

const writeString = (buf, offset, length, value) => {
  buf.fill(0, offset, offset + length);
  buf.write(value, offset, Math.min(Buffer.byteLength(value, "utf8"), length), "utf8");
};

const computeChecksum = (header) => {
  let sum = 0;
  for (let i = 0; i < BLOCK_SIZE; i += 1) {
    sum += header[i];
  }
  return sum;
};

const splitUstarPath = (posixPath) => {
  const raw = Buffer.from(posixPath, "utf8");
  if (raw.length <= 100) {
    return { name: posixPath, prefix: "" };
  }
  let splitIdx = posixPath.lastIndexOf("/", 155);
  while (splitIdx > 0) {
    const prefix = posixPath.slice(0, splitIdx);
    const name = posixPath.slice(splitIdx + 1);
    if (
      Buffer.byteLength(prefix, "utf8") <= 155 &&
      Buffer.byteLength(name, "utf8") <= 100
    ) {
      return { name, prefix };
    }
    splitIdx = posixPath.lastIndexOf("/", splitIdx - 1);
  }
  return null;
};

const buildPaxRecord = (key, value) => {
  const body = ` ${key}=${value}\n`;
  let len = Buffer.byteLength(body, "utf8") + 1;
  while (true) {
    const candidate = `${len}${body}`;
    const actualLen = Buffer.byteLength(candidate, "utf8");
    if (actualLen === len) {
      return Buffer.from(candidate, "utf8");
    }
    len = actualLen;
  }
};

const buildTarHeaderBlock = ({
  name,
  prefix = "",
  mode,
  size,
  typeflag,
  linkname = "",
}) => {
  const header = Buffer.alloc(BLOCK_SIZE);
  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = typeflag.charCodeAt(0);
  writeString(header, 157, 100, linkname);
  writeString(header, 257, 6, "ustar");
  header.write("00", 263, 2, "ascii");
  writeString(header, 265, 32, "koma");
  writeString(header, 297, 32, "koma");
  writeOctal(header, 329, 8, 0);
  writeOctal(header, 337, 8, 0);
  writeString(header, 345, 155, prefix);

  const checksum = computeChecksum(header);
  const checksumStr = checksum.toString(8).padStart(6, "0");
  header.write(checksumStr, 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
};

const padToBlock = (size) => {
  const remainder = size % BLOCK_SIZE;
  return remainder === 0 ? 0 : BLOCK_SIZE - remainder;
};

export function* generateTarEntryChunks(entry) {
  const posixPath = entry.tarPath.replaceAll("\\", "/").replace(/^\/+/, "");
  const paxFields = [];
  const split = splitUstarPath(posixPath);
  const fallbackName = split ? split.name : posixPath.slice(-96);
  const fallbackPrefix = split ? split.prefix : "";
  if (!split) {
    paxFields.push(buildPaxRecord("path", posixPath));
  }

  let linkname = "";
  if (entry.type === "hardlink") {
    const posixLink = entry.linkTarget.replaceAll("\\", "/").replace(/^\/+/, "");
    if (Buffer.byteLength(posixLink, "utf8") > 100) {
      linkname = posixLink.slice(0, 100);
      paxFields.push(buildPaxRecord("linkpath", posixLink));
    } else {
      linkname = posixLink;
    }
  }

  if (paxFields.length > 0) {
    const paxPayload = Buffer.concat(paxFields);
    const paxName = `PaxHeaders.0/${path.posix.basename(posixPath).slice(0, 80)}`;
    yield buildTarHeaderBlock({
      name: paxName,
      mode: 0o644,
      size: paxPayload.length,
      typeflag: "x",
    });
    yield paxPayload;
    const paxPad = padToBlock(paxPayload.length);
    if (paxPad > 0) {
      yield Buffer.alloc(paxPad);
    }
  }

  if (entry.type === "dir") {
    yield buildTarHeaderBlock({
      name: fallbackName.endsWith("/") ? fallbackName : `${fallbackName}/`,
      prefix: fallbackPrefix,
      mode: 0o755,
      size: 0,
      typeflag: "5",
    });
    return;
  }

  if (entry.type === "hardlink") {
    yield buildTarHeaderBlock({
      name: fallbackName,
      prefix: fallbackPrefix,
      mode: entry.mode ?? 0o644,
      size: 0,
      typeflag: "1",
      linkname,
    });
    return;
  }

  const size = entry.data ? entry.data.length : fs.statSync(entry.absPath).size;
  yield buildTarHeaderBlock({
    name: fallbackName,
    prefix: fallbackPrefix,
    mode: entry.mode ?? 0o644,
    size,
    typeflag: "0",
  });

  if (size > 0) {
    if (entry.data) {
      yield entry.data;
    } else {
      const fd = fs.openSync(entry.absPath, "r");
      try {
        const chunkSize = 1024 * 1024;
        const buf = Buffer.allocUnsafe(chunkSize);
        let offset = 0;
        while (offset < size) {
          const toRead = Math.min(chunkSize, size - offset);
          const bytesRead = fs.readSync(fd, buf, 0, toRead, offset);
          if (bytesRead <= 0) {
            break;
          }
          offset += bytesRead;
          yield Buffer.from(buf.subarray(0, bytesRead));
        }
      } finally {
        fs.closeSync(fd);
      }
    }
    const pad = padToBlock(size);
    if (pad > 0) {
      yield Buffer.alloc(pad);
    }
  }
}

async function* tarByteStream(entries) {
  for (const entry of entries) {
    for (const chunk of generateTarEntryChunks(entry)) {
      yield chunk;
    }
  }
  yield ZERO_BLOCK;
  yield ZERO_BLOCK;
}

const createZstdStream = (level = 15, workers = 0) => {
  const params = {
    [zlib.constants.ZSTD_c_compressionLevel]: level,
    [zlib.constants.ZSTD_c_checksumFlag]: 1,
  };
  if (Number.isInteger(workers) && workers > 0) {
    params[zlib.constants.ZSTD_c_nbWorkers] = workers;
  }
  return zlib.createZstdCompress({ params });
};

export const writeTarZst = async (
  entries,
  outputPath,
  { level = 15, workers } = {},
) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tempPath = `${outputPath}.tmp-${process.pid}`;
  try {
    await pipeline(
      Readable.from(tarByteStream(entries)),
      createZstdStream(level, workers),
      fs.createWriteStream(tempPath),
    );
    fs.renameSync(tempPath, outputPath);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
};

export const collectEntriesFromDirectory = (sourceDir, { includeRootFiles = [] } = {}) => {
  const entries = [];
  const root = path.resolve(sourceDir);

  const walk = (dir) => {
    const dirEntries = fs
      .readdirSync(dir, { withFileTypes: true })
      .toSorted((left, right) => left.name.localeCompare(right.name));

    for (const item of dirEntries) {
      const absPath = path.join(dir, item.name);
      const tarPath = path.relative(root, absPath).split(path.sep).join("/");
      if (item.isDirectory()) {
        entries.push({ type: "dir", tarPath });
        walk(absPath);
      } else if (item.isFile()) {
        const stat = fs.statSync(absPath);
        const execBit = process.platform !== "win32" && (stat.mode & 0o111) !== 0;
        entries.push({
          type: "file",
          tarPath,
          absPath,
          size: stat.size,
          mode: execBit ? 0o755 : 0o644,
        });
      }
    }
  };

  walk(root);
  for (const extra of includeRootFiles) {
    entries.push(extra);
  }
  return entries;
};

export const packShardedTarZst = async ({
  sourceDir,
  outputDir,
  baseName,
  budgetBytes,
  level = 15,
  deduplicateHardlinks = true,
}) => {
  fs.mkdirSync(outputDir, { recursive: true });
  const rawEntries = collectEntriesFromDirectory(sourceDir);
  const dirs = rawEntries.filter((entry) => entry.type === "dir");
  const files = rawEntries.filter((entry) => entry.type === "file");

  const shards = [];
  let currentFiles = [];
  let currentRawBytes = 0;

  for (const file of files) {
    if (file.size > budgetBytes) {
      throw new Error(
        `Single file ${file.tarPath} (${file.size} bytes) exceeds shard budget (${budgetBytes} bytes).`,
      );
    }
    const estimatedRaw = file.size + 1024;
    if (currentFiles.length > 0 && currentRawBytes + estimatedRaw > budgetBytes) {
      shards.push(currentFiles);
      currentFiles = [];
      currentRawBytes = 0;
    }
    currentFiles.push(file);
    currentRawBytes += estimatedRaw;
  }
  if (currentFiles.length > 0 || shards.length === 0) {
    shards.push(currentFiles);
  }

  const totalParts = shards.length;
  const produced = [];

  for (let idx = 0; idx < totalParts; idx += 1) {
    const partNumber = idx + 1;
    const fileName = `${baseName}.part-${partNumber}-of-${totalParts}.tar.zst`;
    const outPath = path.join(outputDir, fileName);

    const shardEntries = [...dirs];
    const hashToTarget = new Map();

    for (const file of shards[idx]) {
      if (deduplicateHardlinks && file.size >= 4096) {
        const digest = await hashFileSha256(file.absPath);
        const existingTarget = hashToTarget.get(digest);
        if (existingTarget) {
          shardEntries.push({
            type: "hardlink",
            tarPath: file.tarPath,
            linkTarget: existingTarget,
            mode: file.mode,
          });
          continue;
        }
        hashToTarget.set(digest, file.tarPath);
      }
      shardEntries.push(file);
    }

    await writeTarZst(shardEntries, outPath, { level });
    const stat = fs.statSync(outPath);
    if (stat.size > budgetBytes) {
      throw new Error(
        `Compressed shard ${fileName} (${stat.size} bytes) exceeded budget (${budgetBytes} bytes).`,
      );
    }
    produced.push({
      partNumber,
      totalParts,
      file: fileName,
      path: outPath,
      sizeBytes: stat.size,
      sha256: await hashFileSha256(outPath),
      sha512: await hashFileSha512Base64(outPath),
    });
  }

  return produced;
};

export const hashFileSha256 = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });

export const hashFileSha512Base64 = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("base64")));
  });

const parsePaxPayload = (buffer) => {
  const result = {};
  let cursor = 0;
  while (cursor < buffer.length) {
    const spaceIdx = buffer.indexOf(0x20, cursor);
    if (spaceIdx < 0) break;
    const len = Number.parseInt(buffer.subarray(cursor, spaceIdx).toString("ascii"), 10);
    if (!Number.isFinite(len) || len <= 0 || cursor + len > buffer.length) break;
    const record = buffer.subarray(spaceIdx + 1, cursor + len).toString("utf8");
    const eqIdx = record.indexOf("=");
    if (eqIdx > 0) {
      result[record.slice(0, eqIdx)] = record.slice(eqIdx + 1).replace(/\n$/, "");
    }
    cursor += len;
  }
  return result;
};

const readNullTerminated = (buf, offset, length) => {
  const slice = buf.subarray(offset, offset + length);
  const nullIdx = slice.indexOf(0);
  return slice.subarray(0, nullIdx >= 0 ? nullIdx : length).toString("utf8");
};

const readOctal = (buf, offset, length) => {
  const raw = readNullTerminated(buf, offset, length).trim();
  return raw ? Number.parseInt(raw, 8) : 0;
};

export const extractTarZst = (archivePath, destDir) => {
  const compressed = fs.readFileSync(archivePath);
  const tarBuf = zlib.zstdDecompressSync(compressed);
  const resolvedDest = path.resolve(destDir);
  fs.mkdirSync(resolvedDest, { recursive: true });

  const entries = [];
  let offset = 0;
  let nextPax = {};

  while (offset + BLOCK_SIZE <= tarBuf.length) {
    const header = tarBuf.subarray(offset, offset + BLOCK_SIZE);
    offset += BLOCK_SIZE;
    if (header.equals(ZERO_BLOCK)) {
      break;
    }

    const rawName = readNullTerminated(header, 0, 100);
    const prefix = readNullTerminated(header, 345, 155);
    const fullName = nextPax.path ?? (prefix ? `${prefix}/${rawName}` : rawName);
    const linkTarget = nextPax.linkpath ?? readNullTerminated(header, 157, 100);
    const typeflag = String.fromCharCode(header[156] || 0x30);
    const mode = readOctal(header, 100, 8) || 0o644;
    const size = readOctal(header, 124, 12);

    const dataStart = offset;
    const dataEnd = dataStart + size;
    const payload = tarBuf.subarray(dataStart, dataEnd);
    offset = dataEnd + padToBlock(size);

    if (typeflag === "x") {
      nextPax = parsePaxPayload(payload);
      continue;
    }
    nextPax = {};

    const cleanRel = fullName.replaceAll("\\", "/").replace(/^\/+/, "");
    if (!cleanRel || cleanRel.split("/").includes("..")) {
      throw new Error(`Unsafe tar entry path: ${fullName}`);
    }
    const targetPath = path.resolve(resolvedDest, cleanRel);
    if (!targetPath.startsWith(`${resolvedDest}${path.sep}`) && targetPath !== resolvedDest) {
      throw new Error(`Tar entry escapes destination: ${fullName}`);
    }

    if (typeflag === "5") {
      fs.mkdirSync(targetPath, { recursive: true });
      entries.push({ type: "dir", path: cleanRel });
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (typeflag === "1") {
      const cleanLink = linkTarget.replaceAll("\\", "/").replace(/^\/+/, "");
      const sourceLinkPath = path.resolve(resolvedDest, cleanLink);
      if (!sourceLinkPath.startsWith(`${resolvedDest}${path.sep}`)) {
        throw new Error(`Unsafe tar hardlink target: ${linkTarget}`);
      }
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { force: true });
      }
      try {
        fs.linkSync(sourceLinkPath, targetPath);
      } catch {
        fs.copyFileSync(sourceLinkPath, targetPath);
      }
      entries.push({ type: "hardlink", path: cleanRel, linkTarget: cleanLink });
      continue;
    }

    fs.writeFileSync(targetPath, payload);
    if (process.platform !== "win32") {
      fs.chmodSync(targetPath, mode);
    }
    entries.push({ type: "file", path: cleanRel, size });
  }

  return entries;
};
