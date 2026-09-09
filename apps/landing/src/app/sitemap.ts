import type { MetadataRoute } from "next";
import { ALL_ROUTES, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ALL_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency:
      route === "/" ? "weekly" : route === "/compare" ? "weekly" : "monthly",
    priority:
      route === "/"
        ? 1
        : route === "/compare"
          ? 0.95
          : route.includes("-vs-")
            ? 0.9
            : 0.88,
  }));
}
