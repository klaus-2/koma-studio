import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { BrowserWindow } from "electron";

export interface DesktopDownloadModelPayload {
  id: string;
  name: string;
  version: string;
  downloadUrl: string;
  checksumSHA256: string;
  expectedDownloadBytes: number;
  requiredDiskBytes: number;
  sourceLanguage?: string;
  installStrategy?: "direct_download" | "backend_managed" | "manual_import";
  runtimeFamily?:
    | "onnx"
    | "onnx_bundle"
    | "enhance_onnx_bundle"
    | "pytorch_checkpoint"
    | "ctranslate2"
    | "transformers_vlm"
    | "transformers_vlm_paddleocr_manga"
    | "managed_runtime";
  backendInstallEndpoint?: string;
}

export interface DesktopDiskSpaceInfo {
  freeBytes: number;
  totalBytes: number;
  path: string;
}

export type DesktopModelManifestStatus = "installed" | "incomplete";

export interface DesktopInstalledModelRecord {
  modelId: string;
  version: string;
  installedAt: string;
  checksumSHA256: string;
  status: DesktopModelManifestStatus;
  installedLanguages?: string[];
  origin?: string | null;
  modelDir: string;
  manifestPath: string;
  sizeBytes: number;
}

export interface DesktopRemoteModelUpdateCheckResult {
  modelId: string;
  installedChecksumSHA256: string | null;
  remoteChecksumSHA256: string | null;
  registryVersion: string;
  checked: boolean;
  updateAvailable: boolean;
}

export type DesktopModelManagerEvent =
  | {
      type: "queued";
      modelId: string;
      queueLength: number;
    }
  | {
      type: "started";
      modelId: string;
      attempt: number;
    }
  | {
      type: "progress";
      modelId: string;
      bytesDownloaded: number;
      totalBytes: number;
      speedBytesPerSecond: number;
      percent: number;
      attempt: number;
    }
  | {
      type: "verifying";
      modelId: string;
    }
  | {
      type: "completed";
      modelId: string;
      version: string;
      installedAt: string;
    }
  | {
      type: "failed";
      modelId: string;
      message: string;
      attempt: number;
      willRetry: boolean;
      code?: ModelDownloadErrorCode;
    }
  | {
      type: "cancelled";
      modelId: string;
    };

// Taxonomy mirrors packages/mini-backend/core/download_jobs.py.
type ModelDownloadErrorCode =
  | "network"
  | "disk_full"
  | "checksum_mismatch"
  | "rate_limited"
  | "cancelled"
  | "unknown";

const MODEL_DOWNLOAD_ERROR_CODES: ReadonlySet<string> = new Set([
  "network",
  "disk_full",
  "checksum_mismatch",
  "rate_limited",
  "cancelled",
  "unknown",
]);

const isModelDownloadErrorCode = (value: unknown): value is ModelDownloadErrorCode =>
  typeof value === "string" && MODEL_DOWNLOAD_ERROR_CODES.has(value);

interface ModelDownloadJobSnapshot {
  jobId: string;
  modelId: string;
  state: "queued" | "downloading" | "verifying" | "ready" | "error" | "cancelled";
  bytesDownloaded: number;
  totalBytes: number | null;
  speedBytesPerSecond: number;
  percent: number;
  errorCode?: string;
  errorMessage?: string;
  httpStatus?: number;
}

interface DesktopModelManifest {
  modelId: string;
  version: string;
  installedAt: string;
  checksumSHA256: string;
  status: DesktopModelManifestStatus;
  origin?: string;
}

interface DownloadTask {
  model: DesktopDownloadModelPayload;
  enqueuedAt: number;
}

interface ActiveDownload {
  modelId: string;
  abortController: AbortController;
}

const MAX_RETRY_ATTEMPTS = 3;
// Poll interval for the job snapshot from the mini-backend (the backend already
// throttles its own granularity; 1s is enough for multi-GB downloads).
const MODEL_JOB_POLL_INTERVAL_MS = 1000;
const PARTIAL_FILE_NAME = "download.partial";
const MANIFEST_FILE_NAME = "manifest.json";
const LOCAL_API_SESSION_HEADER = "x-koma-local-session";
const EASYOCR_MODEL_ID = "easyocr";
const PORORO_MODEL_ID = "pororo";
const MANGA_OCR_MODEL_ID = "manga_ocr";
const PADDLE_OCR_MODEL_ID = "paddleocr";
const PADDLE_OCR_EN_MODEL_ID = "paddleocr_en_v5";
const PADDLE_OCR_LATIN_MODEL_ID = "paddleocr_latin_v5";
const PADDLE_OCR_CH_MODEL_ID = "paddleocr_ch_v5";
const MEIKI_OCR_MODEL_ID = "meiki_ocr";
const PADDLE_OCR_VL_MANGA_MODEL_ID = "paddleocr_vl_manga";
const GOT_OCR2_MODEL_ID = "got_ocr2";
const QWEN2_5_VL_3B_MODEL_ID = "qwen2_5_vl_3b";
const MANGALMM_MODEL_ID = "mangalmm";
const ROLMOCR_MODEL_ID = "rolmocr";
const GLM_OCR_ONNX_MODEL_ID = "glm_ocr_onnx";
const SUGOI_MODEL_ID = "sugoi_v4_ja_en_ct2";
const M2M100_MODEL_ID = "m2m100_1_2b_ct2";
const INPAINT_AOT_MODEL_ID = "aot";
const INPAINT_LAMA_MODEL_ID = "lama_manga";
const INPAINT_OPENCV_LAMA_MODEL_ID = "opencv_lama";
const INPAINT_LAMA_FP32_MODEL_ID = "lama_fp32";
const SEGMENT_BAKA_MODEL_ID = "baka_content_cc";
const FONT_RTDETR_MODEL_ID = "font_rtdetr_v2";
const FONT_RTDETR_FILE_NAME = "detector.onnx";
const ENHANCE_MODEL_FILE_NAME = "model.onnx";
const EASYOCR_DETECTION_FILE = "craft_mlt_25k.pth";
const EASYOCR_BUCKET_SPECS: Array<{
  bucket: string;
  recognitionFile: string;
  languages: string[];
}> = [
  { bucket: "en", recognitionFile: "english_g2.pth", languages: ["en"] },
  { bucket: "ko", recognitionFile: "korean_g2.pth", languages: ["ko"] },
  { bucket: "ja", recognitionFile: "japanese_g2.pth", languages: ["ja"] },
  { bucket: "ch_sim", recognitionFile: "chinese_sim.pth", languages: ["zh", "zh-cn"] },
  { bucket: "ch_tra", recognitionFile: "chinese.pth", languages: ["zh-tw"] },
  { bucket: "ru", recognitionFile: "cyrillic_g2.pth", languages: ["ru"] },
  { bucket: "latin", recognitionFile: "latin_g2.pth", languages: ["fr", "de", "nl", "es", "it", "pt", "tr", "pl", "vi", "id", "hu"] },
  { bucket: "th", recognitionFile: "thai_g1.pth", languages: ["th"] },
  { bucket: "ar", recognitionFile: "arabic_g1.pth", languages: ["ar"] },
];
const BACKEND_MANAGED_MODEL_IDS = new Set<string>([
  EASYOCR_MODEL_ID,
  PORORO_MODEL_ID,
  MANGA_OCR_MODEL_ID,
  PADDLE_OCR_MODEL_ID,
  PADDLE_OCR_EN_MODEL_ID,
  PADDLE_OCR_LATIN_MODEL_ID,
  PADDLE_OCR_CH_MODEL_ID,
  MEIKI_OCR_MODEL_ID,
  PADDLE_OCR_VL_MANGA_MODEL_ID,
  GOT_OCR2_MODEL_ID,
  QWEN2_5_VL_3B_MODEL_ID,
  MANGALMM_MODEL_ID,
  ROLMOCR_MODEL_ID,
  GLM_OCR_ONNX_MODEL_ID,
  "waifu2x_swin_unet_art_scan_2x",
  "waifu2x_swin_unet_art_scan_4x",
  "waifu2x_swin_unet_art_2x",
  SUGOI_MODEL_ID,
  M2M100_MODEL_ID,
  INPAINT_AOT_MODEL_ID,
  INPAINT_LAMA_MODEL_ID,
  INPAINT_OPENCV_LAMA_MODEL_ID,
  INPAINT_LAMA_FP32_MODEL_ID,
  SEGMENT_BAKA_MODEL_ID,
  "comic_text_detector",
]);

const sanitizeModelId = (modelId: string): string => {
  const normalized = modelId.trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    throw new Error("Invalid model ID.");
  }
  return normalized;
};

const computeDirectorySize = (targetPath: string): number => {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return stat.size;
  }

  if (!stat.isDirectory()) {
    return 0;
  }

  let total = 0;
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    total += computeDirectorySize(path.join(targetPath, entry.name));
  }

  return total;
};

const readJsonFile = <T>(filePath: string): T | null => {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJsonFile = (filePath: string, payload: unknown): void => {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
};

const isValidChecksum = (value: string): boolean => /^[a-fA-F0-9]{64}$/.test(value.trim());

const normalizeChecksum = (value: string): string => value.trim().toLowerCase();

const normalizeLanguageCode = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
};

const CHECKSUM_HEADER_KEYS = [
  "x-linked-etag",
  "x-checksum-sha256",
  "x-amz-meta-checksum-sha256",
  "x-amz-meta-sha256",
  "etag",
] as const;

const parseChecksumFromHeaderValue = (rawValue: string | null): string | null => {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue
    .trim()
    .replace(/^W\//i, "")
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "");

  const prefixedMatch = normalized.match(/sha256[:=]([a-fA-F0-9]{64})/i);
  if (prefixedMatch?.[1]) {
    return normalizeChecksum(prefixedMatch[1]);
  }

  const plainMatch = normalized.match(/([a-fA-F0-9]{64})/);
  if (plainMatch?.[1]) {
    return normalizeChecksum(plainMatch[1]);
  }

  return null;
};

const extractChecksumFromHeaders = (headers: Headers): string | null => {
  for (const headerKey of CHECKSUM_HEADER_KEYS) {
    const parsed = parseChecksumFromHeaderValue(headers.get(headerKey));
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

const easyocrBucketReady = (baseDir: string, recognitionFile: string): boolean =>
  fs.existsSync(path.join(baseDir, EASYOCR_DETECTION_FILE)) &&
  fs.existsSync(path.join(baseDir, recognitionFile));

const detectEasyocrInstalledLanguages = (modelDir: string): string[] => {
  const bucketRoot = path.join(modelDir, "easyocr-cache");
  const languages = new Set<string>();

  for (const spec of EASYOCR_BUCKET_SPECS) {
    const bucketDir = path.join(bucketRoot, spec.bucket);
    const legacyReady = easyocrBucketReady(bucketRoot, spec.recognitionFile);
    const bucketReady = easyocrBucketReady(bucketDir, spec.recognitionFile);
    if (!legacyReady && !bucketReady) {
      continue;
    }
    for (const language of spec.languages) {
      languages.add(language);
    }
  }

  return Array.from(languages).sort((left, right) => left.localeCompare(right));
};

interface HuggingFaceResolveUrlParts {
  owner: string;
  repo: string;
  revision: string;
  filePath: string;
}

const parseHuggingFaceResolveUrl = (downloadUrl: string): HuggingFaceResolveUrlParts | null => {
  try {
    const parsed = new URL(downloadUrl);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== "huggingface.co") {
      return null;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const resolveIndex = segments.findIndex((segment) => segment.toLowerCase() === "resolve");
    if (resolveIndex < 2 || resolveIndex + 2 >= segments.length) {
      return null;
    }

    const owner = decodeURIComponent(segments[resolveIndex - 2] ?? "");
    const repo = decodeURIComponent(segments[resolveIndex - 1] ?? "");
    const revision = decodeURIComponent(segments[resolveIndex + 1] ?? "");
    const filePath = decodeURIComponent(segments.slice(resolveIndex + 2).join("/"));
    if (!owner || !repo || !revision || !filePath) {
      return null;
    }

    return {
      owner,
      repo,
      revision,
      filePath,
    };
  } catch {
    return null;
  }
};

const checksumFile = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      hash.update(chunk);
    });
    stream.once("end", () => resolve());
    stream.once("error", (error) => reject(error));
  });
  return hash.digest("hex");
};

const readBackendErrorDetail = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    return typeof payload.detail === "string" ? payload.detail : "";
  } catch {
    return "";
  }
};

const checksumDirectoryTree = async (directoryPath: string): Promise<string> => {
  const hash = createHash("sha256");

  const walk = (targetPath: string, prefix = ""): string[] => {
    if (!fs.existsSync(targetPath)) {
      return [];
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return [];
    }

    const files: string[] = [];
    const entries = fs
      .readdirSync(targetPath, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absolutePath = path.join(targetPath, entry.name);
      const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        files.push(...walk(absolutePath, relativePath));
        continue;
      }

      if (entry.isFile()) {
        files.push(relativePath);
      }
    }

    return files;
  };

  const filePaths = walk(directoryPath);
  for (const relativePath of filePaths) {
    const absolutePath = path.join(directoryPath, relativePath);
    const fileChecksum = await checksumFile(absolutePath);
    hash.update(relativePath);
    hash.update(":");
    hash.update(fileChecksum);
    hash.update("\n");
  }

  return hash.digest("hex");
};

export class DesktopModelManagerService {
  private readonly queue: DownloadTask[] = [];

  private activeDownload: ActiveDownload | null = null;

  private processing = false;

  constructor(
    private readonly userDataDirProvider: () => string,
    private readonly windowProvider: () => BrowserWindow | null,
    private readonly backendBaseUrlProvider: () => string,
    private readonly localApiSessionSecretProvider: () => string = () => "",
  ) {}

  private createLocalBackendHeaders(contentType = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (contentType) {
      headers["Content-Type"] = "application/json";
    }

    const localApiSessionSecret = this.localApiSessionSecretProvider().trim();
    if (localApiSessionSecret) {
      headers[LOCAL_API_SESSION_HEADER] = localApiSessionSecret;
    }

    return headers;
  }

  private getModelsRootDir(): string {
    const rootDir = path.join(this.userDataDirProvider(), "models");
    fs.mkdirSync(rootDir, { recursive: true });
    return rootDir;
  }

  private getModelDir(modelId: string): string {
    return path.join(this.getModelsRootDir(), sanitizeModelId(modelId));
  }

  private getModelManifestPath(modelId: string): string {
    return path.join(this.getModelDir(modelId), MANIFEST_FILE_NAME);
  }

  private hasAnyPayloadFile(modelDir: string): boolean {
    const walk = (targetPath: string): boolean => {
      if (!fs.existsSync(targetPath)) {
        return false;
      }

      const stat = fs.statSync(targetPath);
      if (stat.isFile()) {
        const basename = path.basename(targetPath);
        return basename !== MANIFEST_FILE_NAME && basename !== PARTIAL_FILE_NAME;
      }

      if (!stat.isDirectory()) {
        return false;
      }

      for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
        if (walk(path.join(targetPath, entry.name))) {
          return true;
        }
      }

      return false;
    };

    return walk(modelDir);
  }

  private isInstalledPayloadPresent(modelId: string, modelDir: string): boolean {
    const normalizedModelId = sanitizeModelId(modelId);
    const hasRequiredFiles = (requiredFiles: string[]): boolean =>
      requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));

    if (normalizedModelId === EASYOCR_MODEL_ID || normalizedModelId === PORORO_MODEL_ID) {
      return this.hasAnyPayloadFile(modelDir);
    }

    if (normalizedModelId === MANGA_OCR_MODEL_ID) {
      const requiredFiles = ["encoder_model.onnx", "decoder_model.onnx", "vocab.txt"];
      return requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));
    }

    if (normalizedModelId === PADDLE_OCR_MODEL_ID) {
      const requiredFiles = [
        "ch_PP-OCRv5_mobile_det.onnx",
        "eslav_PP-OCRv5_rec_mobile_infer.onnx",
        "ppocrv5_eslav_dict.txt",
      ];
      return requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));
    }

    if (normalizedModelId === PADDLE_OCR_EN_MODEL_ID) {
      const requiredFiles = [
        "ch_PP-OCRv5_mobile_det.onnx",
        "en_PP-OCRv5_mobile_rec.onnx",
        "ppocrv5_en_dict.txt",
      ];
      return requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));
    }

    if (normalizedModelId === PADDLE_OCR_LATIN_MODEL_ID) {
      const requiredFiles = [
        "ch_PP-OCRv5_mobile_det.onnx",
        "latin_PP-OCRv5_rec_mobile_infer.onnx",
        "ppocrv5_latin_dict.txt",
      ];
      return requiredFiles.every((fileName) => fs.existsSync(path.join(modelDir, fileName)));
    }

    if (normalizedModelId === PADDLE_OCR_CH_MODEL_ID) {
      const requiredFiles = [
        "ch_PP-OCRv5_mobile_det.onnx",
        "ch_PP-OCRv5_rec_mobile_infer.onnx",
        "ppocrv5_dict.txt",
      ];
      return hasRequiredFiles(requiredFiles);
    }

    if (normalizedModelId === MEIKI_OCR_MODEL_ID) {
      return hasRequiredFiles([
        "meiki.text.rec.v0.960x32.onnx",
        "meiki.text.rec.v0.vertical.32x480.onnx",
      ]);
    }

    if (normalizedModelId === PADDLE_OCR_VL_MANGA_MODEL_ID) {
      return hasRequiredFiles([
        "config.json",
        "configuration_paddleocr_vl.py",
        "generation_config.json",
        "image_processing.py",
        "model.safetensors",
        "modeling_paddleocr_vl.py",
        "preprocessor_config.json",
        "processing_paddleocr_vl.py",
        "processor_config.json",
        "tokenizer.json",
        "tokenizer.model",
        "tokenizer_config.json",
      ]);
    }

    if (normalizedModelId === GOT_OCR2_MODEL_ID) {
      return hasRequiredFiles([
        "config.json",
        "generation_config.json",
        "model.safetensors",
        "preprocessor_config.json",
        "tokenizer.json",
        "tokenizer_config.json",
      ]);
    }

    if (normalizedModelId === QWEN2_5_VL_3B_MODEL_ID) {
      return hasRequiredFiles([
        "config.json",
        "generation_config.json",
        "model-00001-of-00002.safetensors",
        "model-00002-of-00002.safetensors",
        "model.safetensors.index.json",
        "preprocessor_config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "vocab.json",
      ]);
    }

    if (normalizedModelId === MANGALMM_MODEL_ID || normalizedModelId === ROLMOCR_MODEL_ID) {
      return hasRequiredFiles([
        "config.json",
        "generation_config.json",
        "model-00001-of-00004.safetensors",
        "model-00002-of-00004.safetensors",
        "model-00003-of-00004.safetensors",
        "model-00004-of-00004.safetensors",
        "model.safetensors.index.json",
        "preprocessor_config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "vocab.json",
      ]);
    }

    if (normalizedModelId === GLM_OCR_ONNX_MODEL_ID) {
      return hasRequiredFiles([
        "config.json",
        "generation_config.json",
        "model.safetensors",
        "preprocessor_config.json",
        "tokenizer.json",
        "tokenizer_config.json",
      ]);
    }

    if (normalizedModelId === SUGOI_MODEL_ID) {
      return hasRequiredFiles([
        "config.json",
        "model.bin",
        "source_vocabulary.json",
        "target_vocabulary.json",
        "spm/spm.ja.nopretok.model",
        "spm/spm.en.nopretok.model",
      ]);
    }

    if (normalizedModelId === M2M100_MODEL_ID) {
      return hasRequiredFiles([
        "config.json",
        "model.bin",
        "sentencepiece.bpe.model",
        "shared_vocabulary.json",
        "vocab.json",
      ]);
    }

    if (normalizedModelId === INPAINT_AOT_MODEL_ID) {
      return fs.existsSync(path.join(modelDir, "aot.onnx"));
    }

    if (normalizedModelId === INPAINT_LAMA_MODEL_ID) {
      return fs.existsSync(path.join(modelDir, "lama-manga-dynamic.onnx"));
    }

    if (normalizedModelId === INPAINT_OPENCV_LAMA_MODEL_ID) {
      return fs.existsSync(path.join(modelDir, "inpainting_lama_2025jan.onnx"));
    }

    if (normalizedModelId === INPAINT_LAMA_FP32_MODEL_ID) {
      return fs.existsSync(path.join(modelDir, "lama_fp32.onnx"));
    }

    if (normalizedModelId === SEGMENT_BAKA_MODEL_ID) {
      return fs.existsSync(path.join(modelDir, "segmenter.meta"));
    }

    if (normalizedModelId === FONT_RTDETR_MODEL_ID) {
      return fs.existsSync(path.join(modelDir, FONT_RTDETR_FILE_NAME));
    }

    return this.hasAnyPayloadFile(modelDir);
  }

  private emit(event: DesktopModelManagerEvent): void {
    const targetWindow = this.windowProvider();
    if (!targetWindow || targetWindow.isDestroyed()) {
      return;
    }

    targetWindow.webContents.send("model-manager:event", event);
  }

  getDiskSpaceInfo(): DesktopDiskSpaceInfo {
    const rootDir = this.getModelsRootDir();
    const stats = fs.statfsSync(rootDir);

    return {
      freeBytes: Number(stats.bavail) * Number(stats.bsize),
      totalBytes: Number(stats.blocks) * Number(stats.bsize),
      path: rootDir,
    };
  }

  listInstalledModels(): DesktopInstalledModelRecord[] {
    const rootDir = this.getModelsRootDir();
    const records: DesktopInstalledModelRecord[] = [];

    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const modelId = entry.name;
      const modelDir = path.join(rootDir, modelId);
      const manifestPath = path.join(modelDir, MANIFEST_FILE_NAME);
      const partialPath = path.join(modelDir, PARTIAL_FILE_NAME);
      const manifest = readJsonFile<DesktopModelManifest>(manifestPath);
      const hasPartial = fs.existsSync(partialPath);
      const sizeBytes = computeDirectorySize(modelDir);

      if (manifest?.status === "installed") {
        const hasPayload = this.isInstalledPayloadPresent(modelId, modelDir);
        const installedLanguages =
          modelId === EASYOCR_MODEL_ID ? detectEasyocrInstalledLanguages(modelDir) : undefined;
        if (!hasPayload) {
          records.push({
            modelId,
            version: manifest.version,
            installedAt: manifest.installedAt,
            checksumSHA256: manifest.checksumSHA256,
            status: "incomplete",
            installedLanguages,
            modelDir,
            manifestPath,
            sizeBytes,
          });
          continue;
        }

        records.push({
          modelId,
          version: manifest.version,
          installedAt: manifest.installedAt,
          checksumSHA256: manifest.checksumSHA256,
          status: "installed",
          installedLanguages,
          origin: typeof manifest.origin === "string" ? manifest.origin : null,
          modelDir,
          manifestPath,
          sizeBytes,
        });
        continue;
      }

      if (manifest?.status === "incomplete" || hasPartial) {
        const installedLanguages =
          modelId === EASYOCR_MODEL_ID ? detectEasyocrInstalledLanguages(modelDir) : undefined;
        records.push({
          modelId,
          version: manifest?.version ?? "0.0.0",
          installedAt: manifest?.installedAt ?? new Date(0).toISOString(),
          checksumSHA256: manifest?.checksumSHA256 ?? "",
          status: "incomplete",
          installedLanguages,
          origin: typeof manifest?.origin === "string" ? manifest.origin : null,
          modelDir,
          manifestPath,
          sizeBytes,
        });
      }
    }

    return records;
  }

  async checkRemoteUpdates(
    models: DesktopDownloadModelPayload[],
  ): Promise<DesktopRemoteModelUpdateCheckResult[]> {
    const installedById = new Map(
      this.listInstalledModels()
        .filter((record) => record.status === "installed")
        .map((record) => [record.modelId, record]),
    );

    const results: DesktopRemoteModelUpdateCheckResult[] = [];
    for (const model of models) {
      const normalizedModelId = sanitizeModelId(model.id);
      const installed = installedById.get(normalizedModelId);
      if (!installed) {
        continue;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const checksumCandidates = new Set<string>();
        const fromHead = await this.resolveChecksumFromHead(model.downloadUrl, controller.signal);
        if (fromHead) checksumCandidates.add(fromHead);
        const fromHfApi = await this.resolveChecksumFromHuggingFaceApi(model.downloadUrl, controller.signal);
        if (fromHfApi) checksumCandidates.add(fromHfApi);
        const remoteChecksum = Array.from(checksumCandidates)[0] ?? null;
        const installedChecksum = normalizeChecksum(installed.checksumSHA256 || "");
        const updateAvailable = Boolean(remoteChecksum) && remoteChecksum !== installedChecksum;

        results.push({
          modelId: normalizedModelId,
          installedChecksumSHA256: installed.checksumSHA256 || null,
          remoteChecksumSHA256: remoteChecksum,
          registryVersion: model.version,
          checked: Boolean(remoteChecksum),
          updateAvailable,
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    return results;
  }

  enqueueDownload(model: DesktopDownloadModelPayload): { queued: boolean; queueLength: number } {
    const normalizedModelId = sanitizeModelId(model.id);
    const normalizedModel: DesktopDownloadModelPayload = {
      ...model,
      id: normalizedModelId,
      checksumSHA256: normalizeChecksum(model.checksumSHA256),
      sourceLanguage: normalizeLanguageCode(model.sourceLanguage),
      installStrategy: model.installStrategy ?? (BACKEND_MANAGED_MODEL_IDS.has(normalizedModelId) ? "backend_managed" : "direct_download"),
      runtimeFamily: model.runtimeFamily,
      backendInstallEndpoint: model.backendInstallEndpoint ?? (BACKEND_MANAGED_MODEL_IDS.has(normalizedModelId) ? "/models/install" : undefined),
    };

    if (!/^https?:\/\//i.test(normalizedModel.downloadUrl)) {
      throw new Error("Invalid download URL.");
    }

    if (!isValidChecksum(normalizedModel.checksumSHA256)) {
      throw new Error("Invalid SHA256 checksum.");
    }

    const alreadyQueued = this.queue.some((item) => item.model.id === normalizedModel.id);
    if (alreadyQueued || this.activeDownload?.modelId === normalizedModel.id) {
      return { queued: true, queueLength: this.queue.length + (this.activeDownload ? 1 : 0) };
    }

    this.queue.push({
      model: normalizedModel,
      enqueuedAt: Date.now(),
    });

    this.emit({
      type: "queued",
      modelId: normalizedModel.id,
      queueLength: this.queue.length,
    });

    void this.processQueue();

    return {
      queued: true,
      queueLength: this.queue.length,
    };
  }

  cancelDownload(modelId: string): void {
    const normalizedModelId = sanitizeModelId(modelId);

    const queueIndex = this.queue.findIndex((item) => item.model.id === normalizedModelId);
    if (queueIndex >= 0) {
      this.queue.splice(queueIndex, 1);
      this.emit({ type: "cancelled", modelId: normalizedModelId });
      return;
    }

    if (this.activeDownload?.modelId === normalizedModelId) {
      this.activeDownload.abortController.abort();
    }
  }

  cancelAllDownloads(): void {
    const queuedIds = this.queue.map((item) => item.model.id);
    this.queue.splice(0, this.queue.length);
    queuedIds.forEach((modelId) => {
      this.emit({ type: "cancelled", modelId });
    });

    if (this.activeDownload) {
      this.activeDownload.abortController.abort();
    }
  }

  uninstallModel(modelId: string): void {
    const normalizedModelId = sanitizeModelId(modelId);

    if (this.activeDownload?.modelId === normalizedModelId) {
      this.activeDownload.abortController.abort();
    }

    this.queue.forEach((item, index) => {
      if (item.model.id === normalizedModelId) {
        this.queue.splice(index, 1);
      }
    });

    const modelDir = this.getModelDir(normalizedModelId);
    fs.rmSync(modelDir, { recursive: true, force: true });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const nextTask = this.queue.shift();
        if (!nextTask) {
          continue;
        }

        try {
          await this.executeDownloadTask(nextTask);
        } catch (error) {
          const normalizedError =
            error instanceof Error ? error : new Error("Unexpected failure while processing download.");
          this.emit({
            type: "failed",
            modelId: nextTask.model.id,
            message: normalizedError.message,
            attempt: MAX_RETRY_ATTEMPTS,
            willRetry: false,
          });
          this.writeIncompleteManifest(nextTask.model);
          this.activeDownload = null;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeDownloadTask(task: DownloadTask): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const abortController = new AbortController();
      this.activeDownload = {
        modelId: task.model.id,
        abortController,
      };

      this.emit({
        type: "started",
        modelId: task.model.id,
        attempt,
      });

      try {
        await this.downloadAndInstall(task.model, attempt, abortController.signal);

        this.emit({
          type: "completed",
          modelId: task.model.id,
          version: task.model.version,
          installedAt: new Date().toISOString(),
        });

        this.activeDownload = null;
        return;
      } catch (error) {
        const isCancelled = abortController.signal.aborted;
        const normalizedError =
          error instanceof Error ? error : new Error("Failed to download model.");

        if (isCancelled) {
          this.writeIncompleteManifest(task.model);
          this.emit({
            type: "cancelled",
            modelId: task.model.id,
          });
          this.activeDownload = null;
          return;
        }

        const willRetry = attempt < MAX_RETRY_ATTEMPTS && this.shouldRetryDownload(normalizedError);
        const errorCode = (normalizedError as Error & { code?: string }).code;
        this.emit({
          type: "failed",
          modelId: task.model.id,
          message: normalizedError.message,
          attempt,
          willRetry,
          code: isModelDownloadErrorCode(errorCode) ? errorCode : undefined,
        });

        this.writeIncompleteManifest(task.model);
        this.activeDownload = null;

        if (willRetry) {
          continue;
        }

        break;
      }
    }
  }

  private shouldRetryDownload(error: Error): boolean {
    // The new taxonomy takes precedence; string parsing is just a safety net
    // for errors that didn't come from the job.
    const code = (error as Error & { code?: string }).code;
    if (code === "checksum_mismatch" || code === "disk_full" || code === "cancelled") {
      return false;
    }
    if (code === "network" || code === "rate_limited") {
      return true;
    }
    if (code === "unknown") {
      return false;
    }

    const message = error.message.toLowerCase();
    if (message.includes("invalid sha256 checksum")) {
      return false;
    }

    if (message.includes("insufficient disk space")) {
      return false;
    }

    const httpStatusMatch = message.match(/http\s+(\d{3})/i);
    if (httpStatusMatch?.[1]) {
      const status = Number(httpStatusMatch[1]);
      if (Number.isFinite(status) && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        return false;
      }
    }

    return true;
  }

  private ensureEnoughDiskSpace(requiredBytes: number): void {
    const diskSpace = this.getDiskSpaceInfo();
    if (requiredBytes <= 0) {
      return;
    }

    if (diskSpace.freeBytes < requiredBytes) {
      const requiredGb = (requiredBytes / 1024 ** 3).toFixed(1);
      const freeGb = (diskSpace.freeBytes / 1024 ** 3).toFixed(1);
      throw new Error(`Insufficient disk space for download. Required: ${requiredGb} GB | Available: ${freeGb} GB.`);
    }
  }

  private writeIncompleteManifest(model: DesktopDownloadModelPayload, origin = "download"): void {
    const modelDir = this.getModelDir(model.id);
    fs.mkdirSync(modelDir, { recursive: true });

    const payload: DesktopModelManifest = {
      modelId: model.id,
      version: model.version,
      installedAt: new Date().toISOString(),
      checksumSHA256: model.checksumSHA256,
      status: "incomplete",
      origin,
    };

    writeJsonFile(this.getModelManifestPath(model.id), payload);
  }

  private writeInstalledManifest(model: DesktopDownloadModelPayload, checksumSHA256: string, origin = "download"): void {
    const payload: DesktopModelManifest = {
      modelId: model.id,
      version: model.version,
      installedAt: new Date().toISOString(),
      checksumSHA256,
      status: "installed",
      origin,
    };

    writeJsonFile(this.getModelManifestPath(model.id), payload);
  }

  private async validateEnhanceOnnxFile(filePath: string): Promise<void> {
    const backendBaseUrl = this.backendBaseUrlProvider().trim();
    if (!backendBaseUrl) {
      throw new Error("Mini backend unavailable to validate the ONNX file.");
    }

    const fileBytes = fs.readFileSync(filePath);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBytes], { type: "application/octet-stream" }),
      path.basename(filePath),
    );

    const response = await fetch(`${backendBaseUrl}/enhance/validate-model`, {
      method: "POST",
      headers: this.createLocalBackendHeaders(false),
      body: formData,
    });
    if (response.ok) {
      return;
    }

    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = typeof payload.detail === "string" ? payload.detail : "";
    } catch {
      // no-op
    }
    throw new Error(detail || `Failed to validate ONNX (HTTP ${response.status}).`);
  }

  async importOnnxModel(model: { id: string; name: string; version: string }, sourcePath: string): Promise<DesktopInstalledModelRecord> {
    const normalizedModelId = sanitizeModelId(model.id);
    const normalizedSourcePath = path.resolve(sourcePath);
    if (!fs.existsSync(normalizedSourcePath)) {
      throw new Error("Selected ONNX file was not found.");
    }
    if (path.extname(normalizedSourcePath).toLowerCase() !== ".onnx") {
      throw new Error("Manual import only accepts .onnx files.");
    }

    await this.validateEnhanceOnnxFile(normalizedSourcePath);
    const modelDir = this.getModelDir(normalizedModelId);
    fs.rmSync(modelDir, { recursive: true, force: true });
    fs.mkdirSync(modelDir, { recursive: true });

    const targetPath = path.join(modelDir, ENHANCE_MODEL_FILE_NAME);
    fs.copyFileSync(normalizedSourcePath, targetPath);
    const checksumSHA256 = await checksumFile(targetPath);
    this.writeInstalledManifest(
      {
        id: normalizedModelId,
        name: model.name.trim(),
        version: model.version.trim(),
        downloadUrl: normalizedSourcePath,
        checksumSHA256,
        expectedDownloadBytes: fs.statSync(targetPath).size,
        requiredDiskBytes: fs.statSync(targetPath).size,
        installStrategy: "manual_import",
        runtimeFamily: "onnx",
      },
      checksumSHA256,
      "local_import",
    );

    return {
      modelId: normalizedModelId,
      version: model.version.trim(),
      installedAt: JSON.parse(fs.readFileSync(this.getModelManifestPath(normalizedModelId), "utf8")).installedAt,
      checksumSHA256,
      status: "installed",
      origin: "local_import",
      modelDir,
      manifestPath: this.getModelManifestPath(normalizedModelId),
      sizeBytes: fs.statSync(targetPath).size,
    };
  }

  private async resolveChecksumFromHead(downloadUrl: string, signal: AbortSignal): Promise<string | null> {
    try {
      const headResponse = await fetch(downloadUrl, {
        method: "HEAD",
        redirect: "manual",
        signal,
      });
      const directChecksum = extractChecksumFromHeaders(headResponse.headers);
      if (directChecksum) {
        return directChecksum;
      }

      const redirectLocation = headResponse.headers.get("location");
      if (!redirectLocation) {
        return null;
      }

      const redirectedHeadResponse = await fetch(redirectLocation, {
        method: "HEAD",
        redirect: "manual",
        signal,
      });
      return extractChecksumFromHeaders(redirectedHeadResponse.headers);
    } catch {
      return null;
    }
  }

  private async resolveChecksumFromHuggingFaceApi(
    downloadUrl: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    const parsed = parseHuggingFaceResolveUrl(downloadUrl);
    if (!parsed) {
      return null;
    }

    const apiUrl = `https://huggingface.co/api/models/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/revision/${encodeURIComponent(parsed.revision)}`;

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        signal,
      });
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        siblings?: Array<{
          rfilename?: string;
          lfs?: {
            oid?: string;
            sha256?: string;
          };
        }>;
      };

      const siblings = Array.isArray(payload?.siblings) ? payload.siblings : [];
      const filePathLower = parsed.filePath.toLowerCase();

      for (const sibling of siblings) {
        const candidatePath =
          typeof sibling?.rfilename === "string" ? decodeURIComponent(sibling.rfilename) : "";
        if (!candidatePath || candidatePath.toLowerCase() !== filePathLower) {
          continue;
        }

        const directSha = parseChecksumFromHeaderValue(
          typeof sibling?.lfs?.sha256 === "string" ? sibling.lfs.sha256 : null,
        );
        if (directSha) {
          return directSha;
        }

        const oidSha = parseChecksumFromHeaderValue(
          typeof sibling?.lfs?.oid === "string" ? sibling.lfs.oid : null,
        );
        if (oidSha) {
          return oidSha;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async downloadAndInstall(
    model: DesktopDownloadModelPayload,
    attempt: number,
    signal: AbortSignal,
  ): Promise<void> {
    this.ensureEnoughDiskSpace(model.requiredDiskBytes);

    // Single source of truth: the mini-backend downloads (with resume,
    // checksum, and a serial queue) and this process only translates the
    // job snapshot into events. Nothing is deleted before the job runs —
    // the preserved .part file allows the download to resume.
    const installedChecksum = await this.installViaBackendJob(model, attempt, signal);
    this.writeInstalledManifest(model, installedChecksum);
  }

  private async installViaBackendJob(
    model: DesktopDownloadModelPayload,
    attempt: number,
    signal: AbortSignal,
  ): Promise<string> {
    const backendBaseUrl = this.backendBaseUrlProvider().trim();
    if (!backendBaseUrl) {
      throw new Error("Mini backend unavailable to install the local model.");
    }

    const jobId = await this.createModelDownloadJob(backendBaseUrl, model, signal);
    let lastEmittedState = "";

    while (true) {
      if (signal.aborted) {
        break;
      }

      await this.sleep(MODEL_JOB_POLL_INTERVAL_MS);

      const snapshot = await this.fetchModelJobSnapshot(backendBaseUrl, jobId, signal);
      if (!snapshot) {
        continue;
      }

      if (snapshot.state !== lastEmittedState) {
        lastEmittedState = snapshot.state;
        if (snapshot.state === "verifying") {
          this.emit({ type: "verifying", modelId: model.id });
        }
      }

      if (snapshot.state === "downloading") {
        this.emitProgressFromJobSnapshot(model, attempt, snapshot);
        continue;
      }

      if (snapshot.state === "ready") {
        return await this.validateBackendInstallResult(model);
      }

      if (snapshot.state === "error") {
        const error = new Error(
          snapshot.errorMessage || `Download failed (${snapshot.errorCode ?? "unknown"}).`,
        );
        (error as Error & { code?: string }).code =
          snapshot.errorCode && snapshot.errorCode !== "cancelled"
            ? snapshot.errorCode
            : "unknown";
        throw error;
      }

      if (snapshot.state === "cancelled") {
        throw new Error("Download cancelled.");
      }
    }

    // Loop exited via abort: request backend cancellation and propagate.
    void this.cancelModelDownloadJob(backendBaseUrl, jobId, signal);
    throw new Error("Download cancelled.");
  }

  private async createModelDownloadJob(
    backendBaseUrl: string,
    model: DesktopDownloadModelPayload,
    signal: AbortSignal,
  ): Promise<string> {
    const response = await fetch(`${backendBaseUrl}/models/downloads`, {
      method: "POST",
      headers: this.createLocalBackendHeaders(true),
      body: JSON.stringify({
        model_id: model.id,
        source_language:
          typeof model.sourceLanguage === "string" && model.sourceLanguage.trim()
            ? model.sourceLanguage.trim().toLowerCase()
            : null,
        required_disk_bytes: Math.max(0, Math.round(model.requiredDiskBytes)),
        download_url: model.downloadUrl,
        checksum_sha256: model.checksumSHA256,
        expected_download_bytes: Math.max(0, Math.round(model.expectedDownloadBytes || 0)),
      }),
      signal,
    });

    if (!response.ok) {
      const detail = await readBackendErrorDetail(response);
      if (response.status === 404) {
        // Local backend without the job routes: legacy code is running
        // (an orphan process was reused) — the app/backend must be restarted.
        const error = new Error(
          "The local model backend is outdated. Restart the app so it can pick up the new backend.",
        ) as Error & { code?: string };
        error.code = "network";
        throw error;
      }
      throw new Error(
        detail || `Failed to queue the model download (HTTP ${response.status}).`,
      );
    }

    const payload = (await response.json()) as { jobId?: unknown };
    if (typeof payload.jobId !== "string" || !payload.jobId) {
      throw new Error("Mini backend did not return a download job id.");
    }
    return payload.jobId;
  }

  private async fetchModelJobSnapshot(
    backendBaseUrl: string,
    jobId: string,
    signal: AbortSignal,
  ): Promise<ModelDownloadJobSnapshot | null> {
    let response: Response;
    try {
      response = await fetch(`${backendBaseUrl}/models/downloads/${jobId}`, {
        headers: this.createLocalBackendHeaders(true),
        signal,
      });
    } catch (error) {
      if (signal.aborted) {
        return null;
      }
      // Transient instability: keep polling.
      console.warn(`[models] job poll failed for ${jobId}:`, error);
      return null;
    }
    if (response.status === 404) {
      // Backend restarted and lost the in-memory job. Fail and retry:
      // the new submit will resume from the preserved .part file on disk.
      const error = new Error(
        "Model download job was lost because the local backend restarted.",
      ) as Error & { code?: string };
      error.code = "network";
      throw error;
    }
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ModelDownloadJobSnapshot;
  }

  private async cancelModelDownloadJob(
    backendBaseUrl: string,
    jobId: string,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      await fetch(`${backendBaseUrl}/models/downloads/${jobId}/cancel`, {
        method: "POST",
        headers: this.createLocalBackendHeaders(true),
        signal,
      });
    } catch {
      // Best effort: the job will also expire on its own when the network errors.
    }
  }

  private emitProgressFromJobSnapshot(
    model: DesktopDownloadModelPayload,
    attempt: number,
    snapshot: ModelDownloadJobSnapshot,
  ): void {
    const bytesDownloaded = Math.max(0, Math.round(snapshot.bytesDownloaded || 0));
    const backendTotal = Math.max(0, Math.round(snapshot.totalBytes ?? 0));
    // Until the backend has seen every Content-Length, use the registry's
    // expected total only for display — percent stays capped at 98.
    const hasRealTotal = backendTotal > 0;
    const displayTotal = hasRealTotal ? backendTotal : Math.max(bytesDownloaded, model.expectedDownloadBytes);
    const percent = hasRealTotal
      ? snapshot.percent
      : displayTotal > 0
        ? Math.min(98, (bytesDownloaded / displayTotal) * 100)
        : 0;

    this.emit({
      type: "progress",
      modelId: model.id,
      bytesDownloaded,
      totalBytes: displayTotal,
      speedBytesPerSecond: Math.max(0, Math.round(snapshot.speedBytesPerSecond || 0)),
      percent: Math.max(0, Math.min(hasRealTotal ? 100 : 98, percent)),
      attempt,
    });
  }

  private async validateBackendInstallResult(model: DesktopDownloadModelPayload): Promise<string> {
    const modelDir = this.getModelDir(model.id);
    const hasFiles = fs
      .readdirSync(modelDir, { withFileTypes: true })
      .some((entry) => entry.isDirectory() || entry.isFile());
    if (!hasFiles) {
      throw new Error("Model installation finished with no files in the local directory.");
    }
    return checksumDirectoryTree(modelDir);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

}
