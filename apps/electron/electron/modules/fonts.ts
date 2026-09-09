/**
 * Font management module.
 * Extracted from electron/main.ts during God File decomposition.
 */
import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import {
  readCommandOutput,
  registerSecureIpcHandler,
} from "./shared.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DesktopFontEntry {
  id: string;
  family: string;
  fileName: string;
  dataUrl: string;
}

type DesktopFontsManifest = Record<string, { family: string }>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_FILE_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);

const DESKTOP_FONT_MIME_BY_EXT: Record<string, string> = {
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const DEFAULT_SYSTEM_FONTS = [
  "Arial",
  "Calibri",
  "Comic Sans MS",
  "Georgia",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sanitizeFontFamily = (value: string): string => {
  const normalized = value.replace(/[^a-zA-Z0-9\s._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Custom Font";
  }
  return normalized.slice(0, 96);
};

const sanitizeFontFileComponent = (value: string): string => {
  const normalized = value
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return normalized.slice(0, 80) || "custom-font";
};

const ensureDesktopFontsDir = (): string => {
  const fontsDir = path.join(app.getPath("userData"), "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });
  return fontsDir;
};

const getDesktopFontsManifestPath = (): string => path.join(ensureDesktopFontsDir(), "manifest.json");

const readDesktopFontsManifest = (): DesktopFontsManifest => {
  const manifestPath = getDesktopFontsManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const manifest: DesktopFontsManifest = {};
    for (const [fileName, meta] of Object.entries(parsed as Record<string, unknown>)) {
      if (!meta || typeof meta !== "object") {
        continue;
      }
      const family = typeof (meta as Record<string, unknown>).family === "string"
        ? String((meta as Record<string, unknown>).family)
        : "";
      const safeFamily = sanitizeFontFamily(family);
      if (!safeFamily) {
        continue;
      }
      manifest[fileName] = { family: safeFamily };
    }
    return manifest;
  } catch {
    return {};
  }
};

const writeDesktopFontsManifest = (manifest: DesktopFontsManifest): void => {
  const manifestPath = getDesktopFontsManifestPath();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
};

const buildDesktopFontDataUrl = (extension: string, fileBuffer: Buffer): string => {
  const mime = DESKTOP_FONT_MIME_BY_EXT[extension] ?? "application/octet-stream";
  const base64 = fileBuffer.toString("base64");
  return `data:${mime};base64,${base64}`;
};

const listDesktopSystemFonts = (): string[] => {
  const bucket = new Set<string>(DEFAULT_SYSTEM_FONTS);
  if (process.platform !== "win32") {
    return Array.from(bucket).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const output = readCommandOutput(
    "reg.exe",
    [
      "query",
      "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
    ],
    4_000,
  );

  if (!output) {
    return Array.from(bucket).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parser = /^(.+?)\s+REG_\w+\s+(.+)$/i;
  for (const line of lines) {
    const match = line.match(parser);
    if (!match) {
      continue;
    }
    const rawFamily = (match[1] ?? "").replace(/\s*\(.*?\)\s*$/g, "").trim();
    const family = sanitizeFontFamily(rawFamily);
    if (family) {
      bucket.add(family);
    }
  }

  return Array.from(bucket).sort((a, b) => a.localeCompare(b, "pt-BR"));
};

const listDesktopCustomFonts = (): DesktopFontEntry[] => {
  const fontsDir = ensureDesktopFontsDir();
  const manifest = readDesktopFontsManifest();
  const entries: DesktopFontEntry[] = [];
  const nextManifest: DesktopFontsManifest = {};

  for (const fileName of fs.readdirSync(fontsDir)) {
    const fullPath = path.join(fontsDir, fileName);
    if (!fs.statSync(fullPath).isFile()) {
      continue;
    }

    const extension = path.extname(fileName).toLowerCase();
    if (!FONT_FILE_EXTENSIONS.has(extension)) {
      continue;
    }

    const buffer = fs.readFileSync(fullPath);
    const manifestFamily = manifest[fileName]?.family;
    const fallbackFamily = path.basename(fileName, extension).replace(/[_-]+/g, " ");
    const family = sanitizeFontFamily(manifestFamily ?? fallbackFamily);
    nextManifest[fileName] = { family };
    entries.push({
      id: fileName,
      family,
      fileName,
      dataUrl: buildDesktopFontDataUrl(extension, buffer),
    });
  }

  writeDesktopFontsManifest(nextManifest);
  return entries.sort((a, b) => a.family.localeCompare(b.family, "pt-BR"));
};

// ---------------------------------------------------------------------------
// IPC handler setup
// ---------------------------------------------------------------------------

const setupDesktopFontIpcHandlers = (): void => {
  registerSecureIpcHandler<{ system: string[]; custom: DesktopFontEntry[] }>(
    "desktop-api:fonts:list",
    async () => {
      return {
        system: listDesktopSystemFonts(),
        custom: listDesktopCustomFonts(),
      };
    },
  );

  registerSecureIpcHandler<{ entry: DesktopFontEntry }>(
    "desktop-api:fonts:import",
    async (value) => {
      const payload = (value ?? {}) as Record<string, unknown>;
      const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
      const contentBase64 = typeof payload.contentBase64 === "string" ? payload.contentBase64.trim() : "";
      const providedFamily = typeof payload.family === "string" ? payload.family.trim() : "";

      if (!fileName || !contentBase64) {
        throw new Error("Invalid font payload.");
      }

      const extension = path.extname(fileName).toLowerCase();
      if (!FONT_FILE_EXTENSIONS.has(extension)) {
        throw new Error("Unsupported font format. Use TTF, OTF, WOFF, or WOFF2.");
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(contentBase64, "base64");
      } catch {
        throw new Error("Invalid font content.");
      }

      if (buffer.length < 256 || buffer.length > 12 * 1024 * 1024) {
        throw new Error("Invalid font size.");
      }

      const family = sanitizeFontFamily(
        providedFamily || path.basename(fileName, extension).replace(/[_-]+/g, " "),
      );
      const baseComponent = sanitizeFontFileComponent(path.basename(fileName, extension));
      const uniqueFileName = `${baseComponent}-${Date.now()}${extension}`;
      const fontsDir = ensureDesktopFontsDir();
      const finalPath = path.join(fontsDir, uniqueFileName);
      fs.writeFileSync(finalPath, buffer, { flag: "wx" });

      const manifest = readDesktopFontsManifest();
      manifest[uniqueFileName] = { family };
      writeDesktopFontsManifest(manifest);

      return {
        entry: {
          id: uniqueFileName,
          family,
          fileName: uniqueFileName,
          dataUrl: buildDesktopFontDataUrl(extension, buffer),
        },
      };
    },
  );
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  type DesktopFontEntry,
  type DesktopFontsManifest,
  FONT_FILE_EXTENSIONS,
  DESKTOP_FONT_MIME_BY_EXT,
  DEFAULT_SYSTEM_FONTS,
  sanitizeFontFamily,
  sanitizeFontFileComponent,
  ensureDesktopFontsDir,
  getDesktopFontsManifestPath,
  readDesktopFontsManifest,
  writeDesktopFontsManifest,
  buildDesktopFontDataUrl,
  listDesktopSystemFonts,
  listDesktopCustomFonts,
  setupDesktopFontIpcHandlers,
};
