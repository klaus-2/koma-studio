export const ACCELERATION_PROFILE_KEY: "MINI_BACKEND_ACCELERATION_PROFILE";

export function readEnvFileValue(rootDir: string, key: string): string;

export interface ProfileChannels {
    argvProfile?: string | null;
    envProfile?: string | null;
    fileValue?: string;
}

export function resolveActiveProfile(channels: ProfileChannels): string;
