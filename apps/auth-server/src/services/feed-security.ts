import type { EmailLocale } from "./locale.js";
import { tServer } from "./server-i18n.js";

const DANGEROUS_PROTOCOLS = ["javascript:", "data:", "file:", "vbscript:"];
const HIGH_RISK_HOST_PATTERNS = [
  /(^|\.)mega\.nz$/i,
  /(^|\.)mediafire\.com$/i,
  /(^|\.)anonfiles\./i,
  /(^|\.)bit\.ly$/i,
  /(^|\.)tinyurl\.com$/i,
];
const SUSPICIOUS_TERM_PATTERNS = [
  /\bfree[-\s]?nitro\b/i,
  /\bgratis\b/i,
  /\bgift\b/i,
  /\bbonus\b/i,
  /\bbtc\b/i,
  /\bcrypto\b/i,
  /\bdownload\b/i,
  /\bpack\b/i,
  /\bpremium\b/i,
];
const HIGH_RISK_TERM_PATTERNS = [
  /\bnitro\b/i,
  /\bcrack\b/i,
  /\bmalware\b/i,
  /\bkeygen\b/i,
  /\bpirated\b/i,
];

export interface DiscordWebhookValidationResult {
  valid: boolean;
  normalizedUrl: string;
  error: string | null;
}

export interface FeedRiskAnalysisResult {
  score: number;
  blocked: boolean;
  reasons: string[];
  normalizedUrls: string[];
}

const appendHttpsProtocol = (value: string): string =>
  /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const dedupeStrings = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

export const normalizeCommunityUrl = (rawUrl: string): string | null => {
  const trimmed = collapseWhitespace(rawUrl);
  if (!trimmed) {
    return null;
  }

  const lowered = trimmed.toLowerCase();
  if (DANGEROUS_PROTOCOLS.some((protocol) => lowered.startsWith(protocol))) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(appendHttpsProtocol(trimmed));
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  parsed.hash = "";
  return parsed.toString();
};

export const getCommunityLinkWarnings = (rawUrl: string, locale: EmailLocale = "en"): string[] => {
  const normalizedUrl = normalizeCommunityUrl(rawUrl);
  if (!normalizedUrl) {
    return [tServer(locale, "feedSecurity.warning.unsafeUrl")];
  }

  const warnings: string[] = [];
  const parsed = new URL(normalizedUrl);
  const haystack = `${parsed.hostname} ${parsed.pathname} ${parsed.search}`.toLowerCase();

  if (HIGH_RISK_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    warnings.push(tServer(locale, "feedSecurity.warning.highRiskHost"));
  }

  if (
    SUSPICIOUS_TERM_PATTERNS.some((pattern) => pattern.test(haystack)) ||
    HIGH_RISK_TERM_PATTERNS.some((pattern) => pattern.test(haystack))
  ) {
    warnings.push(tServer(locale, "feedSecurity.warning.suspiciousTermsUrl"));
  }

  if (parsed.hostname.includes("xn--")) {
    warnings.push(tServer(locale, "feedSecurity.warning.punycodeDomain"));
  }

  return warnings;
};

export const analyzeFeedPostRisk = (input: {
  title: string;
  body: string;
  urls: string[];
  locale?: EmailLocale;
}): FeedRiskAnalysisResult => {
  const title = collapseWhitespace(input.title).toLowerCase();
  const body = collapseWhitespace(input.body).toLowerCase();
  const combinedText = `${title} ${body}`;
  const locale = input.locale ?? "en";
  let score = 0;
  const reasons: string[] = [];
  const normalizedUrls: string[] = [];

  for (const rawUrl of input.urls) {
    const normalizedUrl = normalizeCommunityUrl(rawUrl);
    if (!normalizedUrl) {
      score += 100;
      reasons.push(tServer(locale, "feedSecurity.warning.unsafeUrl"));
      continue;
    }

    normalizedUrls.push(normalizedUrl);
    const warnings = getCommunityLinkWarnings(normalizedUrl, locale);
    const hasHighRiskHost = HIGH_RISK_HOST_PATTERNS.some((pattern) => pattern.test(new URL(normalizedUrl).hostname));
    for (const warning of warnings) {
      reasons.push(warning);
      score += hasHighRiskHost && warning === tServer(locale, "feedSecurity.warning.highRiskHost") ? 45 : 20;
    }
  }

  if (HIGH_RISK_TERM_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    reasons.push(tServer(locale, "feedSecurity.warning.suspiciousVocabulary"));
    score += 55;
  } else if (SUSPICIOUS_TERM_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    reasons.push(tServer(locale, "feedSecurity.warning.moderateSuspiciousVocabulary"));
    score += 20;
  }

  if (/\bno experience\b/i.test(combinedText) && /\bbtc|crypto\b/i.test(combinedText)) {
    reasons.push(tServer(locale, "feedSecurity.warning.easyMoneyCrypto"));
    score += 35;
  }

  const dedupedReasons = dedupeStrings(reasons);
  return {
    score,
    blocked: score >= 100,
    reasons: dedupedReasons,
    normalizedUrls: dedupeStrings(normalizedUrls),
  };
};

export const validateDiscordWebhookUrl = (
  rawUrl: string,
  locale: EmailLocale = "en",
): DiscordWebhookValidationResult => {
  const trimmed = collapseWhitespace(rawUrl);
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: "",
      error: tServer(locale, "feedSecurity.error.discordWebhookRequired"),
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      normalizedUrl: "",
      error: tServer(locale, "feedSecurity.error.discordWebhookInvalidUrl"),
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      normalizedUrl: "",
      error: tServer(locale, "feedSecurity.error.discordWebhookHttpsOnly"),
    };
  }

  const host = parsed.hostname.trim().toLowerCase();
  const allowedHost =
    host === "discord.com" ||
    host === "discordapp.com" ||
    host.endsWith(".discord.com") ||
    host.endsWith(".discordapp.com");

  if (!allowedHost) {
    return {
      valid: false,
      normalizedUrl: "",
      error: tServer(locale, "feedSecurity.error.discordWebhookOfficialOnly"),
    };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  const webhookPathPattern = /^\/api(?:\/v\d+)?\/webhooks\/\d{16,22}\/[A-Za-z0-9._-]+$/;
  if (!webhookPathPattern.test(normalizedPath)) {
    return {
      valid: false,
      normalizedUrl: "",
      error: tServer(locale, "feedSecurity.error.discordWebhookPathInvalid"),
    };
  }

  parsed.pathname = normalizedPath;
  parsed.hash = "";
  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    error: null,
  };
};
