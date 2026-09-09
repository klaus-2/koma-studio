import { app, safeStorage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { google, type blogger_v3, type drive_v3 } from "googleapis";

import {
  buildBloggerBatchPostContentFromHostedImages,
  buildGoogleDriveDirectImageUrl,
  DEFAULT_BLOGGER_CONFIG,
  normalizeBloggerConfig,
  resolveBloggerOptimizedUrl,
  type BloggerConfig,
  type BloggerConnectionResult,
  type BloggerPublishPayload,
  type BloggerPublishResult,
  type BloggerUploadPayload,
  type BloggerUploadResult,
} from "../../../packages/types/src/blogger.ts";

interface BloggerConfigEnvelope {
  encrypted: boolean;
  payload: string;
}

const DRIVE_FOLDER_NAME = "KOMA Blogger CDN";
const DRIVE_SCOPE_HINT =
  "For image uploads, generate the Refresh Token with the https://www.googleapis.com/auth/drive scope and enable the Google Drive API in the same project.";
const BLOGGER_SCOPE_HINT =
  "To validate Blogger + Drive, the Refresh Token must include at least https://www.googleapis.com/auth/blogger and https://www.googleapis.com/auth/drive. If the token only has Drive scopes, the connection test will fail on Blogger.";
const INVALID_CLIENT_HINT =
  "Google rejected the OAuth client. Check that the Client ID and Client Secret belong to the same OAuth client, that the client is a Web application, that it is the same one used in the OAuth Playground under 'Use your own OAuth credentials', and that the Refresh Token was issued for that same client.";

const normalizeGoogleAuthError = (
  error: unknown,
  fallback: string,
): string => {
  const message = error instanceof Error ? error.message : fallback;
  if (/invalid_client/i.test(message)) {
    return `${message} ${INVALID_CLIENT_HINT}`;
  }
  if (/insufficient authentication scopes|scope/i.test(message)) {
    return `${message} ${BLOGGER_SCOPE_HINT}`;
  }
  return message;
};

const sanitizeHtmlAttribute = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildImageTag = (url: string, altText: string): string => {
  const normalizedUrl = url.trim();
  const normalizedAlt = sanitizeHtmlAttribute(altText.trim());

  if (!normalizedAlt) {
    return `<img src="${normalizedUrl}" />`;
  }

  return `<img src="${normalizedUrl}" alt="${normalizedAlt}" />`;
};

const ensureDesktopSecretsDir = (): string => {
  const secretsDir = path.join(app.getPath("userData"), "secure-store");
  fs.mkdirSync(secretsDir, { recursive: true });
  return secretsDir;
};

const getDesktopBloggerConfigPath = (): string =>
  path.join(ensureDesktopSecretsDir(), "blogger-config.json");

const serializeBloggerConfig = (config: BloggerConfig): BloggerConfigEnvelope => {
  const payload = JSON.stringify(config);
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      payload: safeStorage.encryptString(payload).toString("base64"),
    };
  }

  return {
    encrypted: false,
    payload,
  };
};

const parseBloggerConfig = (raw: string): BloggerConfig => {
  if (!raw.trim()) {
    return { ...DEFAULT_BLOGGER_CONFIG };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_BLOGGER_CONFIG };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "payload" in parsed) {
    const envelope = parsed as Partial<BloggerConfigEnvelope>;
    if (typeof envelope.payload !== "string") {
      return { ...DEFAULT_BLOGGER_CONFIG };
    }

    let payload = envelope.payload;
    if (envelope.encrypted) {
      if (!safeStorage.isEncryptionAvailable()) {
        return { ...DEFAULT_BLOGGER_CONFIG };
      }

      try {
        payload = safeStorage.decryptString(Buffer.from(envelope.payload, "base64"));
      } catch {
        return { ...DEFAULT_BLOGGER_CONFIG };
      }
    }

    return normalizeBloggerConfig(JSON.parse(payload));
  }

  return normalizeBloggerConfig(parsed);
};

const readDesktopBloggerConfig = (): BloggerConfig => {
  const filePath = getDesktopBloggerConfigPath();
  if (!fs.existsSync(filePath)) {
    return { ...DEFAULT_BLOGGER_CONFIG };
  }

  try {
    return parseBloggerConfig(fs.readFileSync(filePath, "utf8"));
  } catch {
    return { ...DEFAULT_BLOGGER_CONFIG };
  }
};

const assertValidBloggerConfig = (value: unknown): BloggerConfig => {
  const config = normalizeBloggerConfig(value);
  if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.blogId) {
    throw new Error("Fill in Client ID, Client Secret, Refresh Token, and Blog ID.");
  }
  return config;
};

const writeDesktopBloggerConfig = (config: BloggerConfig): boolean => {
  const filePath = getDesktopBloggerConfigPath();
  const envelope = serializeBloggerConfig(config);
  fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), "utf8");
  return envelope.encrypted;
};

const createOAuthClient = (config: BloggerConfig) => {
  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    "https://developers.google.com/oauthplayground",
  );
  oauth2Client.setCredentials({
    refresh_token: config.refreshToken,
  });
  return oauth2Client;
};

const createBloggerClient = (config: BloggerConfig) =>
  google.blogger({
    version: "v3",
    auth: createOAuthClient(config),
  });

const createDriveClient = (config: BloggerConfig) =>
  google.drive({
    version: "v3",
    auth: createOAuthClient(config),
  });

const assertUploadItems = (items: BloggerUploadPayload["items"]): void => {
  items.forEach((item) => {
    const mimeType = item.mimeType.trim().toLowerCase();
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      throw new Error(`Unsupported format for ${item.fileName}: ${item.mimeType}`);
    }
    if (!item.contentBase64.trim()) {
      throw new Error(`Missing content for ${item.fileName}.`);
    }
  });
};

const getOrCreateDriveFolder = async (drive: drive_v3.Drive): Promise<string> => {
  const existing = await drive.files.list({
    q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    spaces: "drive",
    pageSize: 1,
  });

  const folderId = existing.data.files?.[0]?.id?.trim();
  if (folderId) {
    return folderId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: DRIVE_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  const createdFolderId = created.data.id?.trim();
  if (!createdFolderId) {
    throw new Error("Could not create the Google Drive folder for the Blogger CDN.");
  }

  return createdFolderId;
};

const uploadSingleImageToDrive = async (
  drive: drive_v3.Drive,
  folderId: string,
  item: BloggerUploadPayload["items"][number],
): Promise<BloggerUploadResult> => {
  const mimeType = item.mimeType.trim().toLowerCase();
  const fileBuffer = Buffer.from(item.contentBase64.trim(), "base64");
  const upload = await drive.files.create({
    requestBody: {
      name: item.fileName,
      mimeType,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: "id,name,webViewLink,webContentLink",
  });

  const fileId = upload.data.id?.trim();
  if (!fileId) {
    throw new Error(`Google Drive did not return the fileId for ${item.fileName}.`);
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  const canonicalUrl = buildGoogleDriveDirectImageUrl(fileId);
  const alternativeUrls = {
    driveDownload: `https://drive.google.com/uc?id=${fileId}`,
    driveThumbnail: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
  };
  const altText = (item.altText ?? "").trim();
  return {
    id: item.id,
    fileName: item.fileName,
    filename: item.fileName,
    mimeType,
    altText,
    canonicalUrl,
    imageUrl: canonicalUrl,
    fileId,
    alternativeUrls,
    driveViewLink:
      typeof upload.data.webViewLink === "string" ? upload.data.webViewLink.trim() : null,
    originalImage: null,
    message: "Image uploaded to Google Drive successfully.",
    optimizedUrl: null,
    imageTag: buildImageTag(canonicalUrl, altText),
    width: item.width,
    height: item.height,
    byteLength: item.byteLength,
    draftPostId: null,
    draftPostUrl: null,
  };
};

const uploadBloggerImageBatch = async (
  blogger: blogger_v3.Blogger,
  drive: drive_v3.Drive,
  config: BloggerConfig,
  items: BloggerUploadPayload["items"],
): Promise<BloggerUploadResult[]> => {
  assertUploadItems(items);

  const folderId = await getOrCreateDriveFolder(drive);
  const uploadedImages: BloggerUploadResult[] = [];
  for (const item of items) {
    uploadedImages.push(await uploadSingleImageToDrive(drive, folderId, item));
  }

  const created = await blogger.posts.insert({
    blogId: config.blogId,
    isDraft: true,
    fetchBody: true,
    fetchImages: true,
    requestBody: {
      title: `[KOMA CDN] Batch • ${new Date().toISOString()}`,
      labels: ["koma-studio-cdn-asset", ...config.defaultLabels],
      content: buildBloggerBatchPostContentFromHostedImages(uploadedImages),
    },
  });

  return uploadedImages.map((item) => ({
    ...item,
    optimizedUrl: resolveBloggerOptimizedUrl(config.optimizer, item.canonicalUrl),
    draftPostId: created.data.id ?? null,
    draftPostUrl: created.data.url ?? null,
  }));
};

export const loadDesktopBloggerConfig = (): {
  config: BloggerConfig;
  secureStorage: boolean;
} => ({
  config: readDesktopBloggerConfig(),
  secureStorage: safeStorage.isEncryptionAvailable(),
});

export const saveDesktopBloggerConfig = (
  value: unknown,
): {
  config: BloggerConfig;
  secureStorage: boolean;
} => {
  const config = assertValidBloggerConfig(value);
  const secureStorage = writeDesktopBloggerConfig(config);
  return {
    config,
    secureStorage,
  };
};

export const testDesktopBloggerConnection = async (value?: unknown): Promise<BloggerConnectionResult> => {
  const config = value ? assertValidBloggerConfig(value) : assertValidBloggerConfig(readDesktopBloggerConfig());
  const blogger = createBloggerClient(config);
  const drive = createDriveClient(config);
  let blogPayload: blogger_v3.Schema$Blog | null = null;

  try {
    const response = await blogger.blogs.get({
      blogId: config.blogId,
    });
    blogPayload = response.data;
  } catch (error) {
    throw new Error(normalizeGoogleAuthError(error, "Failed to validate Blogger access."));
  }

  try {
    await drive.files.list({
      pageSize: 1,
      fields: "files(id)",
      spaces: "drive",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to validate Google Drive access.";
    if (/invalid_client/i.test(message)) {
      throw new Error(`${message} ${INVALID_CLIENT_HINT}`);
    }
    if (/insufficient authentication scopes|scope|forbidden|access denied/i.test(message)) {
      throw new Error(`${message} ${DRIVE_SCOPE_HINT}`);
    }
    throw error;
  }

  return {
    ok: true,
    blogTitle: blogPayload?.name ?? "",
    blogId: blogPayload?.id ?? config.blogId,
    message: blogPayload?.name
      ? `Connected to blog "${blogPayload.name}" and Google Drive.`
      : "Connection validated successfully.",
  };
};

export const uploadDesktopBloggerImages = async (
  payload: BloggerUploadPayload,
): Promise<{
  items: BloggerUploadResult[];
  optimizerApplied: boolean;
}> => {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("No images received for upload.");
  }

  const config = assertValidBloggerConfig(readDesktopBloggerConfig());
  const blogger = createBloggerClient(config);
  const drive = createDriveClient(config);

  let items: BloggerUploadResult[];
  try {
    items = await uploadBloggerImageBatch(blogger, drive, config, payload.items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload images.";
    if (/invalid_client/i.test(message)) {
      throw new Error(`${message} ${INVALID_CLIENT_HINT}`);
    }
    if (
      /insufficient authentication scopes|permission|forbidden|access denied/i.test(message)
    ) {
      throw new Error(`${message} ${DRIVE_SCOPE_HINT}`);
    }
    throw error;
  }

  return {
    items,
    optimizerApplied: config.optimizer.enabled,
  };
};

export const publishDesktopBloggerPost = async (
  payload: BloggerPublishPayload,
): Promise<BloggerPublishResult> => {
  const config = assertValidBloggerConfig(readDesktopBloggerConfig());
  const blogger = createBloggerClient(config);
  const title = payload.title.trim();
  const html = payload.html.trim();

  if (!title) {
    throw new Error("Set a title for the post.");
  }
  if (!html) {
    throw new Error("The post HTML content cannot be empty.");
  }

  const labels = Array.from(
    new Set(
      [...config.defaultLabels, ...payload.labels]
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

  const response = await blogger.posts.insert({
    blogId: config.blogId,
    isDraft: payload.publish !== true,
    fetchBody: true,
    requestBody: {
      title,
      content: html,
      labels,
    },
  });

  const postId = response.data.id?.trim() ?? "";
  if (!postId) {
    throw new Error("Blogger did not return the new post ID.");
  }

  return {
    postId,
    postUrl: response.data.url ?? null,
    blogId: config.blogId,
    isDraft: payload.publish !== true,
    uploadedImages: Array.isArray(payload.uploadedImages) ? payload.uploadedImages : [],
  };
};
