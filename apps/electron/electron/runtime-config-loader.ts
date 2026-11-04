import fs from "node:fs";
import path from "node:path";

export function loadRuntimeConfig(configDir: string): Record<string, string> {
  const configPath = path.join(configDir, "runtime-config.json");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  return parsed as Record<string, string>;
}
