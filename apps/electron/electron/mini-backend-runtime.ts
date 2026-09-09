export type MiniBackendAccelerationProfile =
  | "cpu"
  | "nvidia-cuda"
  | "nvidia-cuda-legacy"
  | "nvidia-tensorrt"
  | "apple-mps"
  | "amd-rocm"
  | "intel-openvino";

export type MiniBackendRuntimeSource = "bundled-core" | "downloaded-runtime";

export type MiniBackendManualInstallBlockReason = "cpu-not-required" | "dev-only-unavailable";

type RuntimePlatform = NodeJS.Platform;

export interface ResolveAccelerationProfileInput {
  platform: RuntimePlatform;
  arch: string;
  overrideProfile?: MiniBackendAccelerationProfile | "auto" | null;
  gpuVendors: string[];
}

export interface MiniBackendLaunchManifestEntry {
  entry: string;
  env: Record<string, string>;
}

export interface MiniBackendLaunchManifest {
  schemaVersion: 1;
  platform: RuntimePlatform;
  arch: string;
  defaultProfile: MiniBackendAccelerationProfile;
  profiles: Partial<Record<MiniBackendAccelerationProfile, MiniBackendLaunchManifestEntry>>;
}

export interface ResolvedMiniBackendManifestEntry extends MiniBackendLaunchManifestEntry {
  profile: MiniBackendAccelerationProfile;
}

export interface ManualInstallBlockedRuntimeState {
  status: "ready";
  statusMessage: string;
  requestedProfile: MiniBackendAccelerationProfile;
  activeProfile: MiniBackendAccelerationProfile;
  source: MiniBackendRuntimeSource;
  lastError: null;
  attempt: 0;
  maxAttempts: 0;
  progress: null;
}

export interface ResolveEffectiveAccelerationProfileInput {
  requestedProfile: MiniBackendAccelerationProfile;
  provider: string | null | undefined;
}

const normalizeVendor = (value: string): string => value.trim().toLowerCase();

const GPU_VENDOR_ID_LABELS: Record<string, string> = {
  "10de": "NVIDIA",
  "1002": "AMD",
  "1022": "AMD",
  "8086": "Intel",
  "106b": "Apple",
};

const isAppleSiliconProfile = (platform: RuntimePlatform, arch: string): boolean =>
  platform === "darwin" && arch === "arm64";

const hasVendorMatch = (gpuVendors: string[], matcher: (vendor: string) => boolean): boolean =>
  gpuVendors.map(normalizeVendor).some(matcher);

const isNvidiaVendor = (vendor: string): boolean => vendor.includes("nvidia");
const isLegacyNvidiaDescriptor = (vendor: string): boolean =>
  /gtx\s*10|1050|1060|1070|1080|titan\s*x|p1000|p2000|p4000|p5000|p6000/i.test(vendor);
const isAmdVendor = (vendor: string): boolean =>
  vendor.includes("advanced micro devices") || vendor.includes("amd") || vendor.includes("radeon");
const isIntelVendor = (vendor: string): boolean => vendor.includes("intel");

const collectNonEmptyString = (value: unknown): string[] =>
  typeof value === "string" && value.trim().length > 0 ? [value.trim()] : [];

const normalizeVendorId = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value).toString(16).padStart(4, "0").toLowerCase();
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const directMatch = trimmed.match(/^(?:0x)?([0-9a-f]{4})$/i);
  if (directMatch) {
    return directMatch[1].toLowerCase();
  }

  const pnpMatch = trimmed.match(/VEN[_-]?([0-9a-f]{4})/i);
  if (pnpMatch) {
    return pnpMatch[1].toLowerCase();
  }

  return null;
};

const collectVendorIdLabels = (record: Record<string, unknown>): string[] => {
  const candidates = [record.vendorId, record.vendorID, record.vendor_id, record.PNPDeviceID, record.pnpDeviceId];
  const labels = candidates
    .map(normalizeVendorId)
    .flatMap((vendorId) => (vendorId && GPU_VENDOR_ID_LABELS[vendorId] ? [GPU_VENDOR_ID_LABELS[vendorId]] : []));
  return Array.from(new Set(labels));
};

const uniqueStrings = (values: string[]): string[] => Array.from(new Set(values.filter((value) => value.trim().length > 0)));

const PROVIDER_PROFILE_MAP: Record<string, MiniBackendAccelerationProfile> = {
  CPUExecutionProvider: "cpu",
  CUDAExecutionProvider: "nvidia-cuda",
  TensorrtExecutionProvider: "nvidia-tensorrt",
  OpenVINOExecutionProvider: "intel-openvino",
  ROCMExecutionProvider: "amd-rocm",
  CoreMLExecutionProvider: "apple-mps",
};

const platformProfiles: Record<RuntimePlatform, MiniBackendAccelerationProfile[]> = {
  aix: ["cpu"],
  android: ["cpu"],
  darwin: ["cpu", "apple-mps"],
  freebsd: ["cpu"],
  linux: ["cpu", "nvidia-cuda", "nvidia-tensorrt", "amd-rocm", "intel-openvino"],
  openbsd: ["cpu"],
  sunos: ["cpu"],
  win32: ["cpu", "nvidia-cuda", "nvidia-cuda-legacy", "nvidia-tensorrt", "intel-openvino"],
  cygwin: ["cpu"],
  netbsd: ["cpu"],
  haiku: ["cpu"],
};

export const resolveAccelerationProfile = ({
  platform,
  arch,
  overrideProfile,
  gpuVendors,
}: ResolveAccelerationProfileInput): MiniBackendAccelerationProfile => {
  if (overrideProfile && overrideProfile !== "auto") {
    return overrideProfile;
  }

  if (isAppleSiliconProfile(platform, arch)) {
    return "apple-mps";
  }

  if (platform === "win32" && hasVendorMatch(gpuVendors, isLegacyNvidiaDescriptor)) {
    return "nvidia-cuda-legacy";
  }

  if (hasVendorMatch(gpuVendors, isNvidiaVendor)) {
    return "nvidia-cuda";
  }

  if (platform === "linux" && hasVendorMatch(gpuVendors, isAmdVendor)) {
    return "amd-rocm";
  }

  if (hasVendorMatch(gpuVendors, isIntelVendor)) {
    return "intel-openvino";
  }

  return "cpu";
};

export const resolveManifestEntry = (
  manifest: MiniBackendLaunchManifest,
  profile: MiniBackendAccelerationProfile,
): ResolvedMiniBackendManifestEntry => {
  const directEntry = manifest.profiles[profile];
  if (directEntry) {
    return {
      profile,
      entry: directEntry.entry,
      env: { ...directEntry.env },
    };
  }

  const fallbackEntry = manifest.profiles[manifest.defaultProfile];
  if (!fallbackEntry) {
    throw new Error(`Mini backend manifest is missing the default profile entry: ${manifest.defaultProfile}`);
  }

  return {
    profile: manifest.defaultProfile,
    entry: fallbackEntry.entry,
    env: { ...fallbackEntry.env },
  };
};

export const buildLaunchManifest = (
  platform: RuntimePlatform,
  arch: string,
  entry: string,
  {
    defaultProfile = "cpu",
  }: {
    defaultProfile?: MiniBackendAccelerationProfile;
  } = {},
): MiniBackendLaunchManifest => {
  const profiles = platformProfiles[platform] ?? ["cpu"];
  const profileEntries = Object.fromEntries(
    profiles.map((profile) => [
      profile,
      {
        entry,
        env: {
          MINI_BACKEND_ACCELERATION_PROFILE: profile,
        },
      },
    ]),
  ) as MiniBackendLaunchManifest["profiles"];

  return {
    schemaVersion: 1,
    platform,
    arch,
    defaultProfile,
    profiles: profileEntries,
  };
};

export const extractGpuVendors = (gpuInfo: unknown): string[] => {
  if (!gpuInfo || typeof gpuInfo !== "object") {
    return [];
  }

  const payload = gpuInfo as {
    gpuDevice?: Array<Record<string, unknown>> | Record<string, unknown>;
    auxAttributes?: Record<string, unknown>;
  };
  const gpuDevices = Array.isArray(payload.gpuDevice)
    ? payload.gpuDevice
    : (payload.gpuDevice && typeof payload.gpuDevice === "object" ? [payload.gpuDevice] : []);

  const vendors = gpuDevices.flatMap((item) => [
    ...collectNonEmptyString(item.vendor),
    ...collectNonEmptyString(item.deviceName),
    ...collectNonEmptyString(item.vendorString),
    ...collectNonEmptyString(item.deviceString),
    ...collectNonEmptyString(item.driverVendor),
    ...collectVendorIdLabels(item),
  ]);

  const auxAttributes = payload.auxAttributes && typeof payload.auxAttributes === "object"
    ? payload.auxAttributes
    : null;

  const auxDescriptors = auxAttributes
    ? [
        ...collectNonEmptyString(auxAttributes.glVendor),
        ...collectNonEmptyString(auxAttributes.glRenderer),
        ...collectNonEmptyString(auxAttributes.inProcessGpu),
      ]
    : [];

  return uniqueStrings([...vendors, ...auxDescriptors]);
};

export const extractGpuVendorsFromWindowsVideoControllers = (payload: unknown): string[] => {
  const controllers = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === "object" ? [payload] : []);

  const descriptors = controllers.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    return [
      ...collectNonEmptyString(record.Name),
      ...collectNonEmptyString(record.AdapterCompatibility),
      ...collectNonEmptyString(record.VideoProcessor),
      ...collectVendorIdLabels(record),
    ];
  });

  return uniqueStrings(descriptors);
};

export const resolveEffectiveAccelerationProfile = ({
  requestedProfile,
  provider,
}: ResolveEffectiveAccelerationProfileInput): MiniBackendAccelerationProfile => {
  if (!provider || typeof provider !== "string") {
    return requestedProfile;
  }

  if (provider === "CUDAExecutionProvider" && requestedProfile === "nvidia-cuda-legacy") {
    return "nvidia-cuda-legacy";
  }

  return PROVIDER_PROFILE_MAP[provider] ?? requestedProfile;
};

export const formatRuntimeFallbackReason = (reason: string | null | undefined): string | null => {
  if (!reason || typeof reason !== "string") {
    return null;
  }

  const normalized = reason.trim();
  if (!normalized) {
    return null;
  }

  const knownMessages: Record<string, string> = {
    onnx_cuda_provider_unavailable:
      "The requested CUDA runtime is unavailable, so the app is using CPU execution.",
    onnx_cuda_legacy_provider_unavailable:
      "The requested CUDA Legacy runtime is unavailable, so the app is using CPU execution.",
    onnx_tensorrt_provider_unavailable:
      "TensorRT is unavailable on this runtime, so the app is using CPU execution.",
    onnx_rocm_provider_unavailable:
      "ROCm is unavailable on this runtime, so the app is using CPU execution.",
    openvino_provider_unavailable:
      "OpenVINO is unavailable on this runtime, so the app is using CPU execution.",
    coreml_only_for_onnx:
      "CoreML acceleration is unavailable for the current ONNX runtime, so the app is using CPU execution.",
    runtime_warmup_fallback_to_cpu:
      "The selected runtime profile failed warmup and was downgraded to CPU.",
  };

  return knownMessages[normalized] ?? normalized;
};

export const buildManualInstallBlockedState = ({
  reason,
  requestedProfile,
  activeProfile,
  source,
}: {
  reason: MiniBackendManualInstallBlockReason;
  requestedProfile: MiniBackendAccelerationProfile;
  activeProfile: MiniBackendAccelerationProfile;
  source: MiniBackendRuntimeSource;
}): ManualInstallBlockedRuntimeState => ({
  status: "ready",
  statusMessage:
    reason === "cpu-not-required"
      ? "This device does not need a downloadable GPU runtime profile."
      : "Manual runtime artifact install is only available in the packaged app.",
  requestedProfile,
  activeProfile,
  source,
  lastError: null,
  attempt: 0,
  maxAttempts: 0,
  progress: null,
});
