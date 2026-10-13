// `reg query` stdout is the OEM console codepage, never UTF-8, so exact Unicode needs `reg export` (UTF-16LE + BOM).
// The PowerShell provider decodes Unicode too, but measured 337-513 ms against `reg export`'s 43-47 ms on the launch path.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const WINDOWS_FONT_REGISTRY_KEY = "SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";

export const FONT_REGISTRY_HIVES = ["HKLM", "HKCU"] as const;
export type WindowsFontHive = (typeof FONT_REGISTRY_HIVES)[number];

const QUOTE = "\"";
const VALUE_NAME_SEPARATOR = "\"=" + QUOTE;
const FAMILY_GROUP_SEPARATOR = " & ";
const FORMAT_MARKER = /\s*\(.*?\)\s*$/g;
// Longest first: `"Bold Italic"` must collapse in one step, never as two overlapping shorter tokens.
const STYLE_INSTANCE_TOKENS = ["bold italic", "italic bold", "bold", "italic", "regular"] as const;
const LEADING_BOM = /^\uFEFF/;

const REGISTRY_READ_TIMEOUT_MS = 4_000;
// An oversized value name is dropped whole, never truncated: a truncation invents a family nothing resolves.
const REGISTRY_VALUE_NAME_MAX_CHARS = 512;
// Ceiling sized from a measured bytes-per-name figure: 158 value names = 15,114 UTF-16 bytes on this box.
const REGISTRY_EXPORT_MAX_FILE_BYTES = 4 * 1024 * 1024;
const REGISTRY_EXPORT_CLEANUP_MAX_RETRIES = 3;
const REGISTRY_EXPORT_CLEANUP_RETRY_DELAY_MS = 100;

const execFileAsync = promisify(execFile);

interface FontRegistryReadOptions {
  tempDir: string;
  timeoutMs?: number;
}

const isFontRegistryKeySection = (line: string): boolean => {
  if (!line.startsWith("[") || !line.endsWith("]")) {
    return false;
  }
  const keyPath = line.slice(1, -1).toLowerCase();
  return keyPath.endsWith(WINDOWS_FONT_REGISTRY_KEY.toLowerCase());
};

const readExportedValueName = (line: string): string | null => {
  if (!line.startsWith(QUOTE)) {
    return null;
  }
  const separatorIndex = line.indexOf(VALUE_NAME_SEPARATOR);
  if (separatorIndex <= 0) {
    return null;
  }
  return line.slice(1, separatorIndex);
};

// Linear on purpose: a `+` over this alternation, where `"bold italic"` is also `"bold"`+`"italic"`,
// is exponential on a tail that fails to match. A strip that would empty the name is not taken.
const stripStyleInstanceSuffix = (value: string): string => {
  const lowered = value.toLowerCase();
  let end = lowered.length;
  let strippedInThisPass = true;

  while (strippedInThisPass) {
    strippedInThisPass = false;
    for (const token of STYLE_INSTANCE_TOKENS) {
      if (!lowered.endsWith(token, end)) {
        continue;
      }
      const tokenStart = end - token.length;
      let cutAt = tokenStart;
      while (cutAt > 0 && /\s/.test(lowered.charAt(cutAt - 1))) {
        cutAt -= 1;
      }
      if (cutAt === 0 || cutAt === tokenStart) {
        continue;
      }
      end = cutAt;
      strippedInThisPass = true;
      break;
    }
  }

  return value.slice(0, end).trim();
};

const familiesFromValueName = (valueName: string): string[] => {
  if (valueName.length > REGISTRY_VALUE_NAME_MAX_CHARS) {
    return [];
  }
  const withoutMarker = valueName.replace(FORMAT_MARKER, "").trim();
  if (!withoutMarker) {
    return [];
  }
  const families: string[] = [];
  for (const groupMember of withoutMarker.split(FAMILY_GROUP_SEPARATOR)) {
    const trimmed = groupMember.trim();
    if (!trimmed) {
      continue;
    }
    const collapsed = stripStyleInstanceSuffix(trimmed);
    families.push(collapsed.length > 0 ? collapsed : trimmed);
  }
  return families;
};

// `Array.from` rather than `for..of` because this project compiles to an ES5 iteration downlevel.
const dedupeFamilies = (values: Iterable<string>): string[] => {
  const families: string[] = [];
  const seenFamilies = new Set<string>();
  for (const family of Array.from(values)) {
    const dedupeKey = family.toLowerCase();
    if (seenFamilies.has(dedupeKey)) {
      continue;
    }
    seenFamilies.add(dedupeKey);
    families.push(family);
  }
  return families;
};

export const parseFontRegistryExport = (text: string): string[] => {
  const families: string[] = [];
  let inFontRegistrySection = false;

  for (const line of text.replace(LEADING_BOM, "").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("[")) {
      inFontRegistrySection = isFontRegistryKeySection(trimmedLine);
      continue;
    }
    if (!inFontRegistrySection) {
      continue;
    }

    const valueName = readExportedValueName(trimmedLine);
    if (valueName === null) {
      continue;
    }

    families.push(...familiesFromValueName(valueName));
  }

  return dedupeFamilies(families);
};

export const parseFontRegistryExportBytes = (bytes: Uint8Array): string[] => {
  if (bytes.byteLength > REGISTRY_EXPORT_MAX_FILE_BYTES) {
    return [];
  }
  return parseFontRegistryExport(new TextDecoder("utf-16le").decode(bytes));
};

const deleteFontRegistryExportFile = async (exportPath: string): Promise<void> => {
  try {
    await fs.promises.rm(exportPath, {
      force: true,
      maxRetries: REGISTRY_EXPORT_CLEANUP_MAX_RETRIES,
      retryDelay: REGISTRY_EXPORT_CLEANUP_RETRY_DELAY_MS,
    });
  } catch (error) {
    // A still-locked export must not fail the font list, and must not vanish quietly either.
    console.warn(`[font-registry] could not remove the registry export ${exportPath}:`, error);
  }
};

// execFile rejects with a numeric `code` when the child ran, a string one when the spawn never happened.
const childExitedNonZero = (error: unknown): boolean =>
  error instanceof Error && "code" in error && typeof error.code === "number";

// `reg.exe` exits 1 both for an absent key and a broken read, and its error text is localized.
const fontRegistryKeyIsMissing = async (
  hive: WindowsFontHive,
  timeoutMs: number,
): Promise<boolean> => {
  try {
    await execFileAsync(
      "reg.exe",
      ["query", `${hive}\\${WINDOWS_FONT_REGISTRY_KEY}`],
      { windowsHide: true, timeout: timeoutMs },
    );
    return false;
  } catch (error) {
    return childExitedNonZero(error);
  }
};

const readHiveFontFamilies = async (
  hive: WindowsFontHive,
  tempDir: string,
  timeoutMs: number,
): Promise<string[]> => {
  const exportPath = path.join(
    tempDir,
    `koma-fonts-${hive.toLowerCase()}-${randomBytes(6).toString("hex")}.reg`,
  );

  try {
    await execFileAsync(
      "reg.exe",
      ["export", `${hive}\\${WINDOWS_FONT_REGISTRY_KEY}`, exportPath, "/y"],
      {
        windowsHide: true,
        timeout: timeoutMs,
      },
    );
    return parseFontRegistryExportBytes(await fs.promises.readFile(exportPath));
  } catch (error) {
    if (!(await fontRegistryKeyIsMissing(hive, timeoutMs))) {
      console.warn(`[font-registry] could not read the ${hive} font registry:`, error);
    }
    return [];
  } finally {
    await deleteFontRegistryExportFile(exportPath);
  }
};

export const readWindowsFontFamilies = async (
  options: FontRegistryReadOptions,
): Promise<string[]> => {
  if (process.platform !== "win32") {
    return [];
  }

  const timeoutMs = options.timeoutMs ?? REGISTRY_READ_TIMEOUT_MS;
  const perHiveFamilies = await Promise.all(
    FONT_REGISTRY_HIVES.map((hive) => readHiveFontFamilies(hive, options.tempDir, timeoutMs)),
  );

  return dedupeFamilies(perHiveFamilies.flat());
};
