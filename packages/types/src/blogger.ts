export type BloggerPreprocessFormat = "original" | "jpeg" | "png" | "webp";
export type BloggerOptimizerProvider = "template" | "cloudinary";

export interface BloggerCloudinaryConfig {
  cloudName: string;
  transformation: string;
  resourceType: "image";
  deliveryType: "fetch";
  encodeSourceUrl: boolean;
}

export interface BloggerOptimizerConfig {
  enabled: boolean;
  provider: BloggerOptimizerProvider;
  template: string;
  cloudinary: BloggerCloudinaryConfig;
}

export interface BloggerPreprocessConfig {
  enabled: boolean;
  maxWidth: number;
  maxHeight: number;
  outputFormat: BloggerPreprocessFormat;
  quality: number;
  stripMetadata: boolean;
}

export interface BloggerConfig {
  label: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  blogId: string;
  defaultLabels: string[];
  optimizer: BloggerOptimizerConfig;
  preprocess: BloggerPreprocessConfig;
}

export interface BloggerUploadItemInput {
  id: string;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  altText?: string;
  width?: number;
  height?: number;
  byteLength?: number;
}

export interface BloggerUploadResult {
  id: string;
  fileName: string;
  filename: string;
  mimeType: string;
  altText: string;
  canonicalUrl: string;
  imageUrl: string;
  fileId?: string | null;
  alternativeUrls?: {
    driveDownload: string;
    driveThumbnail: string;
  } | null;
  driveViewLink?: string | null;
  originalImage?: string | null;
  message?: string | null;
  optimizedUrl: string | null;
  imageTag: string;
  width?: number;
  height?: number;
  byteLength?: number;
  draftPostId?: string | null;
  draftPostUrl?: string | null;
}

export interface BloggerUploadPayload {
  items: BloggerUploadItemInput[];
}

export interface BloggerPublishPayload {
  title: string;
  html: string;
  labels: string[];
  publish: boolean;
  uploadedImages?: BloggerUploadResult[];
}

export interface BloggerPublishResult {
  postId: string;
  postUrl: string | null;
  blogId: string;
  isDraft: boolean;
  uploadedImages: BloggerUploadResult[];
}

export interface BloggerConnectionResult {
  ok: boolean;
  blogTitle: string;
  blogId: string;
  message: string;
}

const escapeHtmlAttribute = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const buildBloggerDraftResolveRequest = (blogId: string, postId: string) => ({
  blogId,
  postId,
  fetchBody: true,
  fetchImages: true,
  view: "ADMIN" as const,
});

export const buildBloggerDraftFinalizeRequest = (
  blogId: string,
  postId: string,
  requestBody: {
    title: string;
    content: string;
    labels: string[];
  },
) => ({
  blogId,
  postId,
  fetchBody: true,
  fetchImages: true,
  requestBody,
});

export const buildBloggerBatchDraftContent = (items: BloggerUploadItemInput[]): string =>
  [
    "<p>KŌMA Studio Blogger CDN batch asset</p>",
    ...items.map((item) => {
      const altText = escapeHtmlAttribute((item.altText ?? "").trim());
      return [
        `<!-- KOMA_BLOGGER_ITEM:${item.id} -->`,
        `<img src="data:${item.mimeType};base64,${item.contentBase64}" alt="${altText}" />`,
      ].join("");
    }),
  ].join("");

export const mapBloggerBatchCanonicalUrls = (
  items: BloggerUploadItemInput[],
  canonicalUrls: string[],
): Array<{
  id: string;
  fileName: string;
  mimeType: string;
  altText: string;
  canonicalUrl: string;
}> => {
  if (canonicalUrls.length < items.length) {
    throw new Error(
      `Blogger returned ${canonicalUrls.length} hosted URL(s) for ${items.length} image(s).`,
    );
  }

  return items.map((item, index) => ({
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    altText: (item.altText ?? "").trim(),
    canonicalUrl: canonicalUrls[index] ?? '',
  }));
};

export const buildGoogleDriveDirectImageUrl = (fileId: string): string =>
  `https://lh3.googleusercontent.com/d/${fileId}`;

export const buildCloudinaryFetchUrl = (
  config: BloggerCloudinaryConfig,
  sourceUrl: string,
): string | null => {
  const cloudName = config.cloudName.trim();
  const normalizedSource = sourceUrl.trim();
  if (!cloudName || !normalizedSource) {
    return null;
  }

  const transformation = config.transformation.trim().replace(/^\/+|\/+$/g, "");
  const encodedSource = config.encodeSourceUrl ? encodeURIComponent(normalizedSource) : normalizedSource;
  const prefix = `https://res.cloudinary.com/${cloudName}/${config.resourceType}/${config.deliveryType}/`;
  return `${prefix}${transformation ? `${transformation}/` : ""}${encodedSource}`;
};

export const resolveBloggerOptimizedUrl = (
  optimizer: BloggerOptimizerConfig,
  canonicalUrl: string,
): string | null => {
  if (!optimizer.enabled) {
    return null;
  }

  if (optimizer.provider === "cloudinary") {
    return buildCloudinaryFetchUrl(optimizer.cloudinary, canonicalUrl);
  }

  const template = optimizer.template.trim();
  const normalizedUrl = canonicalUrl.trim();
  if (!template || !normalizedUrl || !template.includes("{{url}}")) {
    return null;
  }

  return template.split("{{url}}").join(normalizedUrl);
};

export const buildBloggerBatchPostContentFromHostedImages = (
  items: Array<{
    canonicalUrl: string;
    altText: string;
    fileName: string;
  }>,
): string =>
  [
    "<p>KŌMA Studio Blogger CDN batch asset</p>",
    ...items.map((item) => {
      const altText = escapeHtmlAttribute(item.altText.trim() || item.fileName.trim());
      return `<figure><img src="${item.canonicalUrl.trim()}" alt="${altText}" /></figure>`;
    }),
  ].join("");

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const sanitizeText = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const sanitizeSecret = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((entry) => {
    const label = sanitizeText(entry, 64);
    if (!label) {
      return;
    }
    const dedupeKey = label.toLocaleLowerCase("en-US");
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    normalized.push(label);
  });
  return normalized;
};

export const DEFAULT_BLOGGER_OPTIMIZER_CONFIG: BloggerOptimizerConfig = {
  enabled: false,
  provider: "cloudinary",
  template: "https://wsrv.nl/?url={{url}}&output=webp",
  cloudinary: {
    cloudName: "",
    transformation: "f_auto,q_auto",
    resourceType: "image",
    deliveryType: "fetch",
    encodeSourceUrl: true,
  },
};

export const DEFAULT_BLOGGER_PREPROCESS_CONFIG: BloggerPreprocessConfig = {
  enabled: false,
  maxWidth: 32768,
  maxHeight: 32768,
  outputFormat: "original",
  quality: 0.92,
  stripMetadata: true,
};

export const DEFAULT_BLOGGER_CONFIG: BloggerConfig = {
  label: "Blogger principal",
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  blogId: "",
  defaultLabels: [],
  optimizer: { ...DEFAULT_BLOGGER_OPTIMIZER_CONFIG },
  preprocess: { ...DEFAULT_BLOGGER_PREPROCESS_CONFIG },
};

export const normalizeBloggerConfig = (value: unknown): BloggerConfig => {
  const payload = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawOptimizer =
    payload.optimizer && typeof payload.optimizer === "object"
      ? (payload.optimizer as Record<string, unknown>)
      : {};
  const rawPreprocess =
    payload.preprocess && typeof payload.preprocess === "object"
      ? (payload.preprocess as Record<string, unknown>)
      : {};

  const outputFormat =
    rawPreprocess.outputFormat === "jpeg" ||
    rawPreprocess.outputFormat === "png" ||
    rawPreprocess.outputFormat === "webp" ||
    rawPreprocess.outputFormat === "original"
      ? rawPreprocess.outputFormat
      : DEFAULT_BLOGGER_PREPROCESS_CONFIG.outputFormat;

  return {
    label: sanitizeText(payload.label, 80) || DEFAULT_BLOGGER_CONFIG.label,
    clientId: sanitizeSecret(payload.clientId, 400),
    clientSecret: sanitizeSecret(payload.clientSecret, 400),
    refreshToken: sanitizeSecret(payload.refreshToken, 1200),
    blogId: sanitizeText(payload.blogId, 128),
    defaultLabels: normalizeStringArray(payload.defaultLabels),
    optimizer: {
      enabled: rawOptimizer.enabled === true,
      provider:
        rawOptimizer.provider === "template" || rawOptimizer.provider === "cloudinary"
          ? rawOptimizer.provider
          : DEFAULT_BLOGGER_OPTIMIZER_CONFIG.provider,
      template:
        sanitizeText(rawOptimizer.template, 500) || DEFAULT_BLOGGER_OPTIMIZER_CONFIG.template,
      cloudinary: {
        cloudName: sanitizeText(
          rawOptimizer.cloudinary && typeof rawOptimizer.cloudinary === "object"
            ? (rawOptimizer.cloudinary as Record<string, unknown>).cloudName
            : DEFAULT_BLOGGER_OPTIMIZER_CONFIG.cloudinary.cloudName,
          120,
        ),
        transformation: sanitizeText(
          rawOptimizer.cloudinary && typeof rawOptimizer.cloudinary === "object"
            ? (rawOptimizer.cloudinary as Record<string, unknown>).transformation
            : DEFAULT_BLOGGER_OPTIMIZER_CONFIG.cloudinary.transformation,
          240,
        ) || DEFAULT_BLOGGER_OPTIMIZER_CONFIG.cloudinary.transformation,
        resourceType: "image",
        deliveryType: "fetch",
        encodeSourceUrl:
          rawOptimizer.cloudinary && typeof rawOptimizer.cloudinary === "object"
            ? ((rawOptimizer.cloudinary as Record<string, unknown>).encodeSourceUrl !== false)
            : DEFAULT_BLOGGER_OPTIMIZER_CONFIG.cloudinary.encodeSourceUrl,
      },
    },
    preprocess: {
      enabled: rawPreprocess.enabled !== false,
      maxWidth: Math.round(
        clampNumber(
          Number(rawPreprocess.maxWidth ?? DEFAULT_BLOGGER_PREPROCESS_CONFIG.maxWidth),
          320,
          32768,
        ),
      ),
      maxHeight: Math.round(
        clampNumber(
          Number(rawPreprocess.maxHeight ?? DEFAULT_BLOGGER_PREPROCESS_CONFIG.maxHeight),
          320,
          32768,
        ),
      ),
      outputFormat,
      quality: Math.round(
        clampNumber(
          Number(rawPreprocess.quality ?? DEFAULT_BLOGGER_PREPROCESS_CONFIG.quality),
          0.2,
          1,
        ) * 100,
      ) / 100,
      stripMetadata: rawPreprocess.stripMetadata !== false,
    },
  };
};
