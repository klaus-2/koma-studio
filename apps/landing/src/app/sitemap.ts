import type { MetadataRoute } from "next";
import { ALL_ROUTES, SITE_URL } from "@/lib/site";
import { LEGAL_PATHS } from "@/content/legal";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ALL_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency:
      route === "/"
        ? "weekly"
        : route === "/compare"
          ? "weekly"
          : LEGAL_PATHS.includes(route)
            ? "yearly"
            : "monthly",
    priority:
      route === "/"
        ? 1
        : route === "/compare"
          ? 0.95
          : LEGAL_PATHS.includes(route)
            ? 0.5
            : route.includes("-vs-")
              ? 0.9
              : 0.88,
  }));
}
