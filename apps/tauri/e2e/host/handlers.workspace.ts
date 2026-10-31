import fs from "node:fs";
import path from "node:path";

import { isRecord } from "./util.ts";

const safeName = (value: string, fallback: string): string => {
  const normalized = path.basename(value).replace(/[^A-Za-z0-9._-]+/g, "-");
  return normalized.replace(/^[-_.]+|[-_.]+$/g, "") || fallback;
};

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  value instanceof ArrayBuffer ||
  Object.prototype.toString.call(value) === "[object ArrayBuffer]";

const encodeWorkspacePayload = (payload: unknown): unknown => {
  if (!isRecord(payload) || !Array.isArray(payload.assets)) return payload;
  return {
    ...payload,
    assets: payload.assets.map((asset) => {
      if (!isRecord(asset)) return asset;
      const buffer = asset.buffer;
      let bytes: Buffer | null = null;
      if (isArrayBuffer(buffer)) {
        bytes = Buffer.from(buffer);
      } else if (ArrayBuffer.isView(buffer)) {
        bytes = Buffer.from(
          buffer.buffer,
          buffer.byteOffset,
          buffer.byteLength,
        );
      } else if (Array.isArray(buffer)) {
        bytes = Buffer.from(buffer);
      }
      if (!bytes) return asset;
      return { ...asset, buffer: { __komaE2EBase64: bytes.toString("base64") } };
    }),
  };
};

const decodeWorkspacePayload = (payload: unknown): unknown => {
  if (!isRecord(payload) || !Array.isArray(payload.assets)) return payload;
  return {
    ...payload,
    assets: payload.assets.map((asset) => {
      if (!isRecord(asset) || !isRecord(asset.buffer)) return asset;
      const encoded = asset.buffer.__komaE2EBase64;
      if (typeof encoded !== "string") return asset;
      const bytes = Buffer.from(encoded, "base64");
      const buffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      return { ...asset, buffer };
    }),
  };
};

export const userId = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Workspace/export command handlers backed by the run root on disk. */
export class WorkspaceHandlers {
  private readonly runRoot: string;

  constructor(options: { runRoot: string }) {
    this.runRoot = options.runRoot;
  }

  loadAutosave(userId: string | null): unknown {
    const filePath = this.autosavePath(userId);
    if (!fs.existsSync(filePath)) return { found: false };
    return {
      found: true,
      path: filePath,
      payload: decodeWorkspacePayload(
        JSON.parse(fs.readFileSync(filePath, "utf8")),
      ),
    };
  }

  saveAutosave(userId: string | null, payload: unknown): unknown {
    const filePath = this.autosavePath(userId);
    fs.writeFileSync(
      filePath,
      JSON.stringify(encodeWorkspacePayload(payload)),
      "utf8",
    );
    return { saved: true, path: filePath };
  }

  clearAutosave(userId: string | null): unknown {
    fs.rmSync(this.autosavePath(userId), { force: true });
    return { cleared: true };
  }

  exportCurrent(defaultFileName: string, payload: unknown): unknown {
    const fileName = safeName(defaultFileName, "workspace.koma");
    const filePath = path.join(this.workspaceDirectory(), fileName);
    fs.writeFileSync(
      filePath,
      JSON.stringify(encodeWorkspacePayload(payload)),
      "utf8",
    );
    return { cancelled: false, filePath };
  }

  saveBlob(defaultFileName: string, dataBase64: string): unknown {
    const directory = path.join(this.runRoot, "exports");
    fs.mkdirSync(directory, { recursive: true });
    const name = safeName(defaultFileName, "export.bin");
    const extension = path.extname(name);
    const stem = path.basename(name, extension);
    let filePath = path.join(directory, name);
    for (let index = 2; fs.existsSync(filePath); index += 1) {
      filePath = path.join(directory, `${stem}-${index}${extension}`);
    }
    // Rename-based publish so pollers never observe a partially written blob.
    const temporary = `${filePath}.${process.pid}.part`;
    fs.writeFileSync(temporary, Buffer.from(dataBase64, "base64"));
    fs.renameSync(temporary, filePath);
    return { cancelled: false, filePath };
  }

  private workspaceDirectory(): string {
    const directory = path.join(this.runRoot, "workspace");
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  private autosavePath(userId: string | null): string {
    return path.join(
      this.workspaceDirectory(),
      `autosave.${safeName(userId ?? "guest", "guest")}.json`,
    );
  }
}
