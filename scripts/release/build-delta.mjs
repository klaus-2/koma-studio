import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const sha256Buffer = (buf) => createHash("sha256").update(buf).digest("hex");

export const createVerifiedZstdDelta = ({
  basePath,
  targetPath,
  outputPath,
  maxRatio = 0.4,
  level = 19,
}) => {
  const baseBuf = fs.readFileSync(basePath);
  const targetBuf = fs.readFileSync(targetPath);

  const combinedSize = Math.max(baseBuf.length + targetBuf.length, 1024 * 1024);
  const windowLog = Math.min(27, Math.max(20, Math.ceil(Math.log2(combinedSize))));

  const patchBuf = zlib.zstdCompressSync(targetBuf, {
    dictionary: baseBuf,
    params: {
      [zlib.constants.ZSTD_c_compressionLevel]: level,
      [zlib.constants.ZSTD_c_windowLog]: windowLog,
      [zlib.constants.ZSTD_c_hashLog]: Math.min(windowLog, 26),
      [zlib.constants.ZSTD_c_chainLog]: Math.min(windowLog, 26),
      [zlib.constants.ZSTD_c_enableLongDistanceMatching]: 1,
      [zlib.constants.ZSTD_c_checksumFlag]: 1,
    },
  });

  const ratio = targetBuf.length > 0 ? patchBuf.length / targetBuf.length : 1;
  if (ratio >= maxRatio) {
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { force: true });
    }
    return {
      created: false,
      reason: `patch ratio ${(ratio * 100).toFixed(1)}% >= ${(maxRatio * 100).toFixed(0)}% threshold`,
      ratio,
      patchSize: patchBuf.length,
      targetSize: targetBuf.length,
    };
  }

  const reconstructed = zlib.zstdDecompressSync(patchBuf, { dictionary: baseBuf });
  const targetSha256 = sha256Buffer(targetBuf);
  const reconstructedSha256 = sha256Buffer(reconstructed);
  if (targetSha256 !== reconstructedSha256) {
    throw new Error(
      `Delta roundtrip verification failed: expected ${targetSha256}, got ${reconstructedSha256}`,
    );
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, patchBuf);

  return {
    created: true,
    outputPath,
    patchSize: patchBuf.length,
    patchSha256: sha256Buffer(patchBuf),
    baseSize: baseBuf.length,
    baseSha256: sha256Buffer(baseBuf),
    targetSize: targetBuf.length,
    targetSha256,
    ratio,
  };
};

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const args = process.argv.slice(2);
  let basePath = "";
  let targetPath = "";
  let outputPath = "";
  let metaOut = "";
  let targetKey = "";
  let fromVersion = "";
  let maxRatio = 0.4;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--base") basePath = path.resolve(args[++i] ?? "");
    else if (args[i] === "--target") targetPath = path.resolve(args[++i] ?? "");
    else if (args[i] === "--out") outputPath = path.resolve(args[++i] ?? "");
    else if (args[i] === "--meta-out") metaOut = path.resolve(args[++i] ?? "");
    else if (args[i] === "--target-key") targetKey = (args[++i] ?? "").trim();
    else if (args[i] === "--from-version") fromVersion = (args[++i] ?? "").trim();
    else if (args[i] === "--max-ratio") maxRatio = Number(args[++i] ?? 0.4);
  }

  if (!basePath || !targetPath || !outputPath) {
    console.error(
      "Usage: build-delta.mjs --base <old> --target <new> --out <patch.zst> [--max-ratio <0.4>] [--meta-out <meta.json> --target-key <key> --from-version <ver>]",
    );
    process.exit(2);
  }

  if (metaOut && (!targetKey || !fromVersion)) {
    console.error("--target-key and --from-version are required when --meta-out is specified.");
    process.exit(2);
  }

  const res = createVerifiedZstdDelta({ basePath, targetPath, outputPath, maxRatio });
  if (!res.created) {
    if (metaOut && fs.existsSync(metaOut)) {
      fs.rmSync(metaOut, { force: true });
    }
    console.log(`[release:delta] skipped (${res.reason})`);
  } else {
    if (metaOut) {
      fs.mkdirSync(path.dirname(metaOut), { recursive: true });
      const meta = {
        targetKey,
        fromVersion,
        file: path.basename(outputPath),
        patchSha256: res.patchSha256,
        targetSha256: res.targetSha256,
        size: res.patchSize,
      };
      fs.writeFileSync(metaOut, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
    }
    console.log(
      `[release:delta] wrote ${outputPath} (${(res.patchSize / 1024).toFixed(1)} KB, ${(res.ratio * 100).toFixed(1)}% of full)`,
    );
  }
}
