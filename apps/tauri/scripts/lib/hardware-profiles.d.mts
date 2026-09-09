/**
 * Types for `hardware-profiles.mjs`, the JS copy of the hardware acceleration
 * profile catalog. Written by hand because the module is plain JavaScript used
 * by both the build scripts and `tests/unit/hardware-profiles.test.ts`; keep in
 * sync with the exports below.
 */
export type PlatformKey = "win" | "mac" | "linux";

export interface HardwareProfile {
    id: string;
    label: string;
    summary: string;
    requirements: Readonly<Partial<Record<PlatformKey, string>>>;
}

export const DEFAULT_PROFILE: "cpu";
export const PLATFORM_KEYS: readonly PlatformKey[];
export const HARDWARE_PROFILES: readonly HardwareProfile[];
export const PROFILE_IDS: readonly string[];

export function platformKeyFromNodePlatform(nodePlatform: string): string;
export function pythonSystemNameFor(
    platformKey: string,
): "Windows" | "Darwin" | "Linux" | null;
export function normalizeProfile(value: string | null | undefined): string | null;
export function findProfile(profileId: string | null | undefined): HardwareProfile | null;
export function profilesForPlatform(platformKey: PlatformKey): readonly HardwareProfile[];
export function resolveProfileRequirements(
    profileId: string,
    platformKey: PlatformKey,
): { profile: string; platformKey: PlatformKey; relativePath: string };
