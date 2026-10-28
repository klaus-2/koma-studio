import { normalizeChecksum } from "./validation.ts";

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

const resolveChecksumFromHead = async (
  downloadUrl: string,
  signal: AbortSignal,
): Promise<string | null> => {
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
};

const resolveChecksumFromHuggingFaceApi = async (
  downloadUrl: string,
  signal: AbortSignal,
): Promise<string | null> => {
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
};

export { resolveChecksumFromHead, resolveChecksumFromHuggingFaceApi };
