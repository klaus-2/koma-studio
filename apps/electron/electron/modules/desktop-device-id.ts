/**
 * Stable per-install device id (persisted in userData — no hardware fingerprinting).
 * Reset by resetDesktopLocalSettings, which deletes the same userData file.
 */
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const resolveDesktopDeviceId = (): string => {
  const filePath = path.join(app.getPath("userData"), "desktop-device-id.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { deviceId?: unknown };
    if (typeof parsed.deviceId === "string" && parsed.deviceId.trim().length > 0) {
      return parsed.deviceId.trim();
    }
  } catch {
    // Missing or malformed file — generate a new id below.
  }
  const deviceId = `desktop-${randomUUID()}`;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify({ deviceId }, null, 2)}\n`, "utf8");
  } catch {
    // Best effort persistence; the id still works for this session.
  }
  return deviceId;
};

export { resolveDesktopDeviceId };
