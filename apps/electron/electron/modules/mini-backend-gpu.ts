/**
 * Mini-backend GPU vendor collection (Electron GPU info + Windows CIM).
 */
import { app } from "electron";
import { execFileSync } from "node:child_process";
import {
  extractGpuVendors,
  extractGpuVendorsFromWindowsVideoControllers,
} from "../mini-backend-runtime.ts";

const readWindowsVideoControllerDescriptors = (): string[] => {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const rawOutput = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,PNPDeviceID,VideoProcessor | ConvertTo-Json -Depth 3 -Compress",
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 10_000,
      },
    );
    if (typeof rawOutput !== "string" || rawOutput.trim().length === 0) {
      return [];
    }

    return extractGpuVendorsFromWindowsVideoControllers(JSON.parse(rawOutput));
  } catch {
    return [];
  }
};

const collectMiniBackendGpuVendors = async (): Promise<string[]> => {
  const gpuInfo = await app.getGPUInfo("complete").catch(() => null);
  const electronDescriptors = extractGpuVendors(gpuInfo);
  const windowsDescriptors = readWindowsVideoControllerDescriptors();
  return Array.from(new Set([...electronDescriptors, ...windowsDescriptors]));
};

export { collectMiniBackendGpuVendors, readWindowsVideoControllerDescriptors };
