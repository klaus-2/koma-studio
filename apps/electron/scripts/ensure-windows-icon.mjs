import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const iconPath = path.join(rootDir, "resources", "windows", "icon.ico");
const sourceSizes = [16, 32, 48, 64, 128, 256];
const sourceFiles = sourceSizes.map((size) => ({
  size,
  path: path.join(rootDir, "resources", "windows", `${size}x${size}.png`),
}));

const shouldRebuildIcon = () => {
  if (!fs.existsSync(iconPath)) {
    return true;
  }

  const iconMtimeMs = fs.statSync(iconPath).mtimeMs;
  return sourceFiles.some(({ path: sourcePath }) => {
    if (!fs.existsSync(sourcePath)) {
      return true;
    }
    return fs.statSync(sourcePath).mtimeMs > iconMtimeMs;
  });
};

const writeWindowsIcon = () => {
  const pngBuffers = sourceFiles.map(({ size, path: sourcePath }) => {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing Windows icon source: ${sourcePath}`);
    }

    return {
      size,
      data: fs.readFileSync(sourcePath),
    };
  });

  const header = Buffer.alloc(6 + pngBuffers.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);

  let dataOffset = header.length;
  pngBuffers.forEach(({ size, data }, index) => {
    const entryOffset = 6 + index * 16;
    const dimensionByte = size === 256 ? 0 : size;

    header.writeUInt8(dimensionByte, entryOffset);
    header.writeUInt8(dimensionByte, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(data.length, entryOffset + 8);
    header.writeUInt32LE(dataOffset, entryOffset + 12);
    dataOffset += data.length;
  });

  fs.mkdirSync(path.dirname(iconPath), { recursive: true });
  fs.writeFileSync(iconPath, Buffer.concat([header, ...pngBuffers.map(({ data }) => data)]));
  console.log(`[windows-icon] wrote ${iconPath}`);
};

if (shouldRebuildIcon()) {
  writeWindowsIcon();
} else {
  console.log(`[windows-icon] up to date: ${iconPath}`);
}
