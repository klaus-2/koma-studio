"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { SITE_RELEASES_URL, SITE_REPO_NAME, SITE_REPO_OWNER } from "@/lib/project";

const LATEST_RELEASE_API = `https://api.github.com/repos/${SITE_REPO_OWNER}/${SITE_REPO_NAME}/releases/latest`;
const INSTALLER_URL_PREFIX = `https://github.com/${SITE_REPO_OWNER}/${SITE_REPO_NAME}/releases/download/`;

type ReleaseAsset = {
  name?: string;
  browser_download_url?: string;
  size?: number;
};

type LatestRelease = {
  tag_name?: string;
  assets?: ReleaseAsset[];
};

type Installer = {
  version: string;
  url: string;
  size: number;
};

const formatSize = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function LatestDownloadButton() {
  const [installer, setInstaller] = useState<Installer | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response = await fetch(LATEST_RELEASE_API);
        if (!response.ok) return;
        const release: LatestRelease = await response.json();
        if (!alive || typeof release.tag_name !== "string" || !Array.isArray(release.assets)) return;

        const asset = release.assets.find(
          (entry) =>
            typeof entry.name === "string" &&
            (entry.name.endsWith("_x64-setup.exe") || entry.name.endsWith("-setup-tauri.exe")) &&
            typeof entry.browser_download_url === "string" &&
            entry.browser_download_url.startsWith(INSTALLER_URL_PREFIX) &&
            typeof entry.size === "number",
        );
        if (
          asset &&
          typeof asset.browser_download_url === "string" &&
          typeof asset.size === "number"
        ) {
          setInstaller({
            version: release.tag_name,
            url: asset.browser_download_url,
            size: asset.size,
          });
        }
      } catch {
        // The releases page stays as the fallback.
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <a
      href={installer?.url ?? SITE_RELEASES_URL}
      target="_blank"
      rel="noreferrer"
      className="btn-ghost"
    >
      <Download size={18} /> Download for Windows
      {installer && (
        <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-widest text-paper/50">
          Tauri · {installer.version} · {formatSize(installer.size)}
        </span>
      )}
    </a>
  );
}
