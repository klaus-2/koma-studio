/**
 * Project coordinates with zero imports.
 *
 * These live in their own module so content files (which are imported by
 * `site.ts`) can reference them without creating a circular import.
 */

export const SITE_URL = "https://koma-studio.site";

export const SITE_DISCORD_URL = "https://discord.gg/tzaV2efD4e";
export const SITE_CHAT_URL = "https://chat.koma-studio.site";
export const SITE_SUPPORT_EMAIL = "support@koma-studio.site";

export const SITE_NAME = "KOMA Studio";
export const SITE_LICENSE = "MIT";

export const SITE_REPO_OWNER = "klaus-2";
export const SITE_REPO_NAME = "koma-studio";

export const SITE_GITHUB_URL = `https://github.com/${SITE_REPO_OWNER}/${SITE_REPO_NAME}`;
export const SITE_ISSUES_URL = `${SITE_GITHUB_URL}/issues`;
export const SITE_DISCUSSIONS_URL = `${SITE_GITHUB_URL}/discussions`;
export const SITE_PULLS_URL = `${SITE_GITHUB_URL}/pulls`;
export const SITE_RELEASES_URL = `${SITE_GITHUB_URL}/releases`;
export const SITE_MILESTONES_URL = `${SITE_GITHUB_URL}/milestones`;
export const SITE_CONTRIBUTORS_URL = `${SITE_GITHUB_URL}/graphs/contributors`;
export const SITE_GOOD_FIRST_ISSUES_URL = `${SITE_GITHUB_URL}/contribute`;
export const SITE_DOCS_URL = `${SITE_GITHUB_URL}/tree/main/docs`;
export const SITE_CLONE_URL = `${SITE_GITHUB_URL}.git`;
export const SITE_LICENSE_URL = `${SITE_GITHUB_URL}/blob/main/LICENSE`;

export const SITE_CONTRIBUTE_PATH = "/contributing";
export const SITE_OPEN_SOURCE_PATH = "/open-source";

export const GITHUB_STARS_API = `https://api.github.com/repos/${SITE_REPO_OWNER}/${SITE_REPO_NAME}`;
