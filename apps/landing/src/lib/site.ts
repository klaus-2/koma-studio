import { comparePages } from "@/content/compare-pages";
import { seoPages } from "@/content/seo-pages";
import { SITE_CHAT_URL, SITE_DISCORD_URL, SITE_GITHUB_URL } from "@/lib/project";

/* Project coordinates (repository, license, community links) live in
 * `@/lib/project` so content files can import them without a cycle.
 * They are re-exported here so `@/lib/site` stays the single public entry. */
export {
  GITHUB_STARS_API,
  SITE_CHAT_URL,
  SITE_CLONE_URL,
  SITE_CONTRIBUTE_PATH,
  SITE_CONTRIBUTORS_URL,
  SITE_DISCORD_URL,
  SITE_DISCUSSIONS_URL,
  SITE_DOCS_URL,
  SITE_GITHUB_URL,
  SITE_GOOD_FIRST_ISSUES_URL,
  SITE_ISSUES_URL,
  SITE_LICENSE,
  SITE_LICENSE_URL,
  SITE_MILESTONES_URL,
  SITE_NAME,
  SITE_OPEN_SOURCE_PATH,
  SITE_PULLS_URL,
  SITE_RELEASES_URL,
  SITE_REPO_NAME,
  SITE_REPO_OWNER,
  SITE_SUPPORT_EMAIL,
  SITE_URL,
} from "@/lib/project";

export const SITE_SAME_AS = [
  SITE_GITHUB_URL,
  SITE_DISCORD_URL,
  SITE_CHAT_URL,
] as const;

export const SITE_TAGLINE =
  "The open-source scanlation studio for manga, manhwa, and comics";

export const SITE_DESCRIPTION =
  "Free and open-source (MIT) scanlation studio for manga, manhwa, and comics. Translate, clean, typeset, redraw, and review chapters in a self-hostable desktop app you can read, fork, and extend.";

export const ALL_ROUTES = [
  "/",
  ...seoPages.map((page) => `/${page.slug}`),
  ...comparePages.map((page) => `/${page.slug}`),
];
