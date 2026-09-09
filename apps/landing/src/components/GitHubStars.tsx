"use client";

import { useEffect, useState } from "react";
import { GITHUB_STARS_API } from "@/lib/site";

function formatStars(stars: number) {
  if (stars < 1000) {
    return String(stars);
  }

  return `${(stars / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

/**
 * Live GitHub star count.
 *
 * The site is a static export, so the number is fetched in the browser.
 * Unauthenticated GitHub API calls are rate limited, so any failure simply
 * hides the counter instead of showing a wrong number.
 */
export function useGitHubStars() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(GITHUB_STARS_API, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { stargazers_count?: number } | null) => {
        if (typeof data?.stargazers_count === "number") {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {
        // Rate limit, offline, or blocked request — stay silent.
      });

    return () => controller.abort();
  }, []);

  return stars;
}

export function StarCount({
  stars,
  className = "",
  prefix = "",
}: {
  stars: number | null;
  className?: string;
  prefix?: string;
}) {
  if (stars === null) {
    return null;
  }

  return (
    <span className={className}>
      {prefix}
      {formatStars(stars)}
    </span>
  );
}
