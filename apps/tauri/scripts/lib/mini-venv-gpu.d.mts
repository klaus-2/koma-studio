import type { SpawnSyncOptions } from "node:child_process";

export interface SpawnSyncLikeResult {
    error?: Error;
    status?: number | null;
}

export type SpawnSyncLike = (
    command: string,
    args: readonly string[],
    options?: SpawnSyncOptions,
) => SpawnSyncLikeResult;

export interface IsPackageInstalledInput {
    pythonPath: string;
    name: string;
    spawnSync: SpawnSyncLike;
}

export declare const CUDA_PROVIDER_PROBE_SNIPPET: string;
export declare const TORCH_CUDA_INDEX_URL: string;

export declare function requiresNvidiaProviderProbe(
    profile: string | null | undefined,
): boolean;

export declare function resolveOnnxruntimeRequirement(
    lines: readonly string[],
): string | null;

export declare function onnxruntimeVariantOf(
    requirement: string | null | undefined,
): string | null;

export declare function conflictingOnnxruntimeVariant(
    variant: string | null | undefined,
): string | null;

export declare function withoutTorchLines(lines: readonly string[]): string[];

export declare function isPackageInstalled(input: IsPackageInstalledInput): boolean;
