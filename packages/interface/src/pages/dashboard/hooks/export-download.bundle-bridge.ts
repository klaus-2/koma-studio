import { desktopBridge } from "@/lib/desktop-bridge";
import type { DesktopBundleExtension } from "@shared/desktop-api";

import type { WorkerZipEntry } from "./exportPackageWorker";

export interface ShellBundleOutcome {
  readonly cancelled: boolean;
  readonly filePath: string | null;
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  if (
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength &&
    bytes.buffer instanceof ArrayBuffer
  ) {
    return bytes.buffer;
  }
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};

export const streamBundleViaShell = async (
  extension: DesktopBundleExtension,
  defaultFileName: string,
  entries: readonly WorkerZipEntry[],
): Promise<ShellBundleOutcome | null> => {
  const bundle = desktopBridge.desktop?.bundle;
  if (!bundle) {
    return null;
  }
  try {
    const begin = await bundle.begin({ extension, defaultFileName });
    if (begin.cancelled || begin.sessionId === null) {
      return { cancelled: true, filePath: null };
    }
    const sessionId = begin.sessionId;
    for (const entry of entries) {
      await bundle.append({
        sessionId,
        name: entry.path,
        data: toArrayBuffer(entry.bytes),
      });
    }
    const finalize = await bundle.finalize({ sessionId });
    return { cancelled: false, filePath: finalize.filePath };
  } catch (error) {
    void desktopBridge.desktop
      ?.sessionLog({
        level: "warn",
        source: "renderer",
        message: `bundle stream "${defaultFileName}" failed: ${error instanceof Error ? error.message : String(error)}`,
      })
      .catch(() => undefined);
    return null;
  }
};
