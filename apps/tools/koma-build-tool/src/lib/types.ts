/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ProgressEvent {
  phase: string;
  message: string;
  pct: number;
  is_warn: boolean;
  is_error: boolean;
}

interface BuildResult {
  success: boolean;
  summary: string;
  log_path: string;
  duration_secs: number;
}

interface BuildConfig {
  v2_root: string;
  v1_root: string;
  landing_dir: string;
  vps_host: string;
  vps_user: string;
  vps_path: string;
  ssh_key: string;
  version: string;
  channel: string;
}

interface ProfileInfo {
  id: string;
  label: string;
  enabled: boolean;
}

interface VpsStatus {
  total_gb: number;
  used_gb: number;
  avail_gb: number;
  use_pct: number;
}

type TabId = "build" | "update" | "artifacts" | "landing";

export type { ProgressEvent, BuildResult, BuildConfig, ProfileInfo, VpsStatus, TabId };
